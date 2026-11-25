import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}
type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}
type ChatRequest = {
  config?: { baseUrl?: string; apiKey?: string; model?: string }
  messages?: { role: 'user' | 'assistant'; text: string }[]
  assets?: { id: string; name: string; kind: string; tags: string[]; excerpt?: string }[]
  online?: boolean
}

const FORMULA_URI = 'moonshot/web-search:latest'
const MAX_BODY = 2 * 1024 * 1024
const DEFAULT_UPSTREAM_TIMEOUT = 300000

function upstreamSignal(clientSignal: AbortSignal) {
  const configured = Number(process.env.MOTIF_UPSTREAM_TIMEOUT_MS)
  const timeout = Number.isFinite(configured) && configured >= 1000 ? configured : DEFAULT_UPSTREAM_TIMEOUT
  return AbortSignal.any([clientSignal, AbortSignal.timeout(timeout)])
}

async function readBody(request: IncomingMessage): Promise<ChatRequest> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY) throw new Error('请求内容过大，请减少本次对话引用的资料。')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ChatRequest
}

function apiRoot(value: string) {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('模型接口只支持 HTTP(S)。')
  return url.toString().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '')
}

async function apiJson<T>(url: string, key: string, clientSignal: AbortSignal, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...init?.headers },
    signal: upstreamSignal(clientSignal),
  })
  const data = await response.json().catch(() => null) as { error?: { message?: string } } | null
  if (!response.ok) throw new Error(data?.error?.message || `模型接口返回 HTTP ${response.status}。`)
  return data as T
}

function sseHeaders(response: ServerResponse) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })
}
function sendEvent(response: ServerResponse, event: string, data: unknown) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}
function sendContent(response: ServerResponse, content: string) {
  response.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
}

async function runMoonshotSearch(root: string, key: string, model: string, messages: ChatMessage[], response: ServerResponse, clientSignal: AbortSignal) {
  const toolData = await apiJson<{ tools?: unknown }>(`${root}/formulas/${FORMULA_URI}/tools`, key, clientSignal)
  const tools = toolData.tools
  if (!Array.isArray(tools)) throw new Error('联网工具声明不可用，请检查模型接口权限。')
  const conversation: ChatMessage[] = [...messages]
  const queries: string[] = []
  let searches = 0
  sseHeaders(response)

  for (let round = 0; round < 5; round += 1) {
    const data = await apiJson<{ choices?: { message?: ChatMessage }[] }>(`${root}/chat/completions`, key, clientSignal, {
      method: 'POST',
      body: JSON.stringify({ model, messages: conversation, tools }),
    })
    const message = data.choices?.[0]?.message
    if (!message) throw new Error('模型没有返回有效消息。')
    const toolCalls = message.tool_calls ?? []
    if (!toolCalls.length) {
      sendEvent(response, 'motif-meta', { searched: searches > 0, queries })
      sendContent(response, message.content || '')
      response.write('data: [DONE]\n\n')
      response.end()
      return
    }

    conversation.push({ role: 'assistant', content: message.content, tool_calls: toolCalls })
    for (const call of toolCalls) {
      let query = call.function.name
      try {
        const args = JSON.parse(call.function.arguments) as { query?: string }
        if (args.query) query = args.query
      } catch { /* Keep the tool name when arguments cannot be displayed. */ }
      queries.push(query)
      searches += 1
      sendEvent(response, 'motif-status', { phase: 'searching', query, queries })
      // Status events require the SSE stream to be open before tool execution.
      if (!response.headersSent) sseHeaders(response)
      const fiber = await apiJson<{
        status?: string
        error?: string | { message?: string }
        context?: { output?: unknown; encrypted_output?: unknown }
      }>(`${root}/formulas/${FORMULA_URI}/fibers`, key, clientSignal, {
        method: 'POST',
        body: JSON.stringify({ name: call.function.name, arguments: call.function.arguments }),
      })
      const content = fiber.context?.output || fiber.context?.encrypted_output
      if (!content) {
        const detail = typeof fiber.error === 'string' ? fiber.error : fiber.error?.message
        const diagnostic = [fiber.status && `状态：${fiber.status}`, detail, `返回字段：${Object.keys(fiber).join(', ') || '无'}`, fiber.context && `上下文字段：${Object.keys(fiber.context).join(', ') || '无'}`].filter(Boolean).join('；')
        throw new Error(`联网工具没有返回搜索结果。${diagnostic}`)
      }
      conversation.push({ role: 'tool', tool_call_id: call.id, content: String(content) })
    }
  }
  throw new Error('联网检索轮次过多，请缩小问题范围后重试。')
}

async function forwardStandardStream(root: string, key: string, model: string, messages: ChatMessage[], response: ServerResponse, clientSignal: AbortSignal) {
  const upstream = await fetch(`${root}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, stream: true }),
    signal: upstreamSignal(clientSignal),
  })
  if (!upstream.ok) {
    const data = await upstream.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(data?.error?.message || `模型接口返回 HTTP ${upstream.status}。`)
  }
  if (!upstream.body) throw new Error('模型接口没有返回可读取的响应。')
  sseHeaders(response)
  const reader = upstream.body.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!response.destroyed) response.write(Buffer.from(value))
    }
    if (!response.destroyed) response.end()
  } finally {
    if (clientSignal.aborted) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

async function handleChat(request: IncomingMessage, response: ServerResponse) {
  const clientController = new AbortController()
  let clientDisconnected = false
  const disconnect = () => {
    clientDisconnected = true
    clientController.abort()
  }
  const onResponseClose = () => { if (!response.writableEnded) disconnect() }
  request.once('aborted', disconnect)
  response.once('close', onResponseClose)
  try {
    if (request.method !== 'POST') {
      response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: { message: 'Method not allowed' } }))
      return
    }
    const body = await readBody(request)
    const root = apiRoot(body.config?.baseUrl || '')
    const key = body.config?.apiKey?.trim() || process.env.MOONSHOT_API_KEY || ''
    const model = body.config?.model?.trim() || ''
    if (!key || !model) throw new Error('请先在设置中填写模型名和 API Key。')
    const history: ChatMessage[] = (body.messages ?? []).slice(-12).map((message) => ({ role: message.role, content: message.text }))
    const onlineInstruction = body.online ? '\n联网搜索完成后，请在回答末尾添加“### 来源”，每个实际使用且由工具返回的链接单独一行，格式为“- [标题](https://...)”。不得创造 URL；没有可用链接时明确说明。' : ''
    const system: ChatMessage = {
      role: 'system',
      content: `你是 MOTIF 个人工作台中的协作者。针对真实问题给出具体、审慎的回答，不要假装执行未执行的操作。素材索引由用户提供；只有含 excerpt 的文稿具有可读正文，PDF、Office、图片和视频不能被直接阅读。引用本地资料时使用真实文件名，并区分资料事实与建议。${onlineInstruction}\n\n素材索引：${JSON.stringify(body.assets ?? [])}`,
    }
    const messages = [system, ...history]
    const hostname = new URL(root).hostname
    if (body.online) {
      const localProtocolTest = process.env.MOTIF_ALLOW_LOCAL_SEARCH === '1' && ['127.0.0.1', 'localhost'].includes(hostname)
      if (!/^api\.moonshot\.(cn|ai)$/i.test(hostname) && !localProtocolTest) throw new Error('当前联网搜索使用 Moonshot 官方工具，请将 Base URL 设为 Moonshot API；其他接口仍可关闭联网后对话。')
      await runMoonshotSearch(root, key, model, messages, response, clientController.signal)
    } else await forwardStandardStream(root, key, model, messages, response, clientController.signal)
  } catch (error) {
    if (clientDisconnected || response.destroyed) return
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || /timeout/i.test(error.message))
    const message = isTimeout
      ? '模型响应超时，请稍后重试，或先拆成较短任务。'
      : error instanceof Error ? error.message : '模型请求失败，请稍后重试。'
    if (!response.headersSent) {
      response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: { message } }))
    } else if (!response.writableEnded) {
      sendEvent(response, 'motif-error', { message })
      response.end()
    }
  } finally {
    request.off('aborted', disconnect)
    response.off('close', onResponseClose)
  }
}

export function motifApiPlugin(): Plugin {
  return {
    name: 'motif-local-agent-api',
    configureServer(server) { server.middlewares.use('/api/motif/chat', handleChat) },
    configurePreviewServer(server) { server.middlewares.use('/api/motif/chat', handleChat) },
  }
}

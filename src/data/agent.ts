import { portfolioDemo, streamPortfolioReply } from './portfolioDemo'
import type { LibraryAsset } from './library'

export type AgentConfig = { baseUrl: string; apiKey: string; model: string }
export type AgentMessage = { id: number; role: 'assistant' | 'user'; text: string }
export type RetrievalResult = { asset: LibraryAsset; score: number }
export type AgentSource = { id: string; title: string; url: string; saved?: boolean }
export type AgentResult = { text: string; sources: AgentSource[]; searched: boolean; queries: string[] }

export const isAgentConfigured = (config: AgentConfig) => portfolioDemo || Boolean(config.baseUrl.trim() && config.apiKey.trim() && config.model.trim())

export function retrieveLocalAssets(query: string, assets: LibraryAsset[]): RetrievalResult[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const stop = new Set(['一下', '帮我', '可以', '怎么', '什么', '寻找', '查找', '检索', '整理', '相关', '素材', '东西', '这个', '需要', '继续'])
  const terms = new Set<string>()
  const phrases = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}_.-]+/gu) || []
  phrases.forEach((phrase) => {
    if (!stop.has(phrase)) terms.add(phrase)
    if (phrase.length > 4) {
      for (let index = 0; index < phrase.length - 1; index += 1) {
        const pair = phrase.slice(index, index + 2)
        if (!stop.has(pair)) terms.add(pair)
      }
    }
  })
  assets.forEach((asset) => {
    asset.tags.forEach((tag) => { if (normalized.includes(tag.toLowerCase())) terms.add(tag.toLowerCase()) })
    const basename = asset.name.replace(/\.[^.]+$/, '').toLowerCase()
    if (basename.length > 1 && normalized.includes(basename)) terms.add(basename)
  })
  return assets.map((asset) => {
    const name = asset.name.toLowerCase()
    const tags = asset.tags.join(' ').toLowerCase()
    const content = asset.content?.toLowerCase() || ''
    let score = 0
    terms.forEach((term) => {
      if (name.includes(term)) score += term.length > 2 ? 16 : 9
      if (tags.includes(term)) score += term.length > 2 ? 14 : 8
      if (content.includes(term)) score += term.length > 2 ? 5 : 2
    })
    return { asset, score }
  }).filter((result) => result.score > 0).sort((a, b) => b.score - a.score || a.asset.createdAt - b.asset.createdAt).slice(0, 6)
}

export function localRetrievalText(results: RetrievalResult[]) {
  if (!results.length) return '本地检索（非模型生成）\n\n在现有素材的名称、手动标签和可读正文中，没有找到与这个问题匹配的内容。你可以先上传素材或添加主题标签；PDF、DOC、DOCX 目前只按文件名和标签检索，不解析正文。'
  return `本地检索（非模型生成）\n\n根据名称、手动标签与可读正文，找到 ${results.length} 项相关材料。以下只是文件索引，不是 AI 对问题的回答：`
}

export function extractSources(text: string): AgentSource[] {
  const sources: AgentSource[] = []
  const seen = new Set<string>()
  const markdownLinks = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  for (const match of text.matchAll(markdownLinks)) {
    const title = match[1].trim()
    const url = match[2].trim()
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol) || seen.has(parsed.toString())) continue
      seen.add(parsed.toString())
      sources.push({ id: crypto.randomUUID(), title: title || parsed.hostname, url: parsed.toString() })
    } catch { /* Ignore malformed model-generated links. */ }
  }
  return sources
}

type CompletionData = {
  choices?: { delta?: { content?: string }; message?: { content?: string } }[]
  error?: { message?: string }
}

async function responseError(response: Response) {
  const data = await response.json().catch(() => null) as CompletionData | null
  const detail = data?.error?.message || `HTTP ${response.status}`
  const hint = response.status === 401 || response.status === 403
    ? '。请检查 API Key 与接口权限。'
    : response.status === 404 ? '。请检查 Base URL 和模型名。' : ''
  return new Error(`模型接口返回错误：${detail}${hint}`)
}

export async function streamAgent(
  config: AgentConfig,
  messages: AgentMessage[],
  assets: LibraryAsset[],
  online: boolean,
  signal: AbortSignal,
  onDelta: (text: string) => void,
  onSearch?: (query: string) => void,
): Promise<AgentResult> {
  if (portfolioDemo) return streamPortfolioReply(/可执行的预案|actionable plan/.test(messages.at(-1)?.text ?? ''), signal, onDelta)
  const index = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    tags: asset.tags,
    ...(asset.content ? { excerpt: asset.content.slice(0, 1800) } : {}),
  }))
  let response: Response
  try {
    response = await fetch('/api/motif/chat', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, messages: messages.slice(-12), assets: index, online }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('无法连接 MOTIF 本地服务。请通过 npm run dev 或 npm run preview 启动工作台，不要直接打开静态 HTML。')
  }
  if (!response.ok) throw await responseError(response)

  const contentType = response.headers.get('content-type') || ''
  let answer = ''
  let searched = false
  let queries: string[] = []
  if (!response.body || contentType.includes('application/json')) {
    const data = await response.json().catch(() => null) as CompletionData | null
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('接口已响应，但没有返回可用的文本内容。')
    answer = text
    onDelta(text)
    return { text, sources: extractSources(text), searched, queries }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done = false

  const processEvent = (event: string) => {
    const eventName = event.split(/\r?\n/).find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message'
    const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
    if (!data) return
    if (data.trim() === '[DONE]') { done = true; return }
    let parsed: CompletionData & { message?: string; query?: string; queries?: string[]; searched?: boolean }
    try { parsed = JSON.parse(data) as typeof parsed } catch { return }
    if (eventName === 'motif-status') {
      if (parsed.query) onSearch?.(parsed.query)
      if (parsed.queries) queries = parsed.queries
      return
    }
    if (eventName === 'motif-meta') {
      searched = Boolean(parsed.searched)
      if (parsed.queries) queries = parsed.queries
      return
    }
    if (eventName === 'motif-error') throw new Error(parsed.message || '联网检索失败。')
    if (parsed.error?.message) throw new Error(`模型接口返回错误：${parsed.error.message}`)
    const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content
    if (delta) {
      answer += delta
      onDelta(delta)
    }
  }

  try {
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      buffer += decoder.decode(value, { stream: !readerDone })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() || ''
      events.forEach(processEvent)
      if (readerDone) {
        if (buffer.trim()) processEvent(buffer)
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
  if (!answer) throw new Error('流式响应已结束，但没有收到文本。请确认接口使用 OpenAI SSE delta.content 格式。')
  return { text: answer, sources: extractSources(answer), searched, queries }
}

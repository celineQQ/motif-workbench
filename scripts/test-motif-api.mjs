import assert from 'node:assert/strict'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const sockets = new Set()
let releaseHungRequest
let markUpstreamStopped
let notifyHungRequest

const upstream = http.createServer((request, response) => {
  sockets.add(request.socket)
  request.socket.on('close', () => sockets.delete(request.socket))
  let body = ''
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => {
    const payload = JSON.parse(body)
    if (payload.model === 'mock-success') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '短任务连接成功' } }] })}\n\n`)
      response.end('data: [DONE]\n\n')
      return
    }
    response.on('close', () => {
      if (!response.writableEnded) markUpstreamStopped?.()
    })
    notifyHungRequest?.()
    releaseHungRequest = () => response.end()
  })
})

await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
const upstreamPort = upstream.address().port
const app = await createServer({
  root,
  configFile: `${root}vite.config.ts`,
  server: { host: '127.0.0.1', port: 0 },
})
await app.listen()
const appPort = app.httpServer.address().port
const endpoint = `http://127.0.0.1:${appPort}/api/motif/chat`
const config = { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'offline-test', model: 'mock-success' }
const body = (model) => JSON.stringify({ config: { ...config, model }, messages: [{ role: 'user', text: 'test' }], assets: [], online: false })

try {
  const normal = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body('mock-success') })
  assert.equal(normal.status, 200)
  assert.match(await normal.text(), /短任务连接成功/)
  console.log('PASS 普通流式回答可以完整返回')

  const controller = new AbortController()
  const hungRequestSeen = new Promise((resolve) => { notifyHungRequest = resolve })
  const upstreamStopped = new Promise((resolve) => { markUpstreamStopped = resolve })
  const pending = fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body('mock-hang'),
    signal: controller.signal,
  })
  await hungRequestSeen
  controller.abort()
  await assert.rejects(pending)
  const stopped = await Promise.race([
    upstreamStopped.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 600)),
  ])
  assert.equal(stopped, true, '页面停止后，本地代理没有取消上游模型请求')
  console.log('PASS 停止操作会同步取消上游模型请求')

  process.env.MOTIF_UPSTREAM_TIMEOUT_MS = '1000'
  try {
    const timeout = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body('mock-hang'),
    })
    assert.equal(timeout.status, 400)
    const detail = await timeout.json()
    assert.match(detail.error.message, /模型响应超时/)
    console.log('PASS 超时会返回明确提示，不会无限等待')
  } finally {
    delete process.env.MOTIF_UPSTREAM_TIMEOUT_MS
  }
} finally {
  releaseHungRequest?.()
  await app.close()
  for (const socket of sockets) socket.destroy()
  await new Promise((resolve) => upstream.close(resolve))
}

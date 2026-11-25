import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const sockets = new Set()
const upstream = http.createServer((request, response) => {
  sockets.add(request.socket)
  request.socket.on('close', () => sockets.delete(request.socket))
  let body = ''
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => {
    const payload = JSON.parse(body)
    const instruction = payload.messages.at(-1)?.content || ''
    const content = instruction.includes('只给出具体、可执行的预案')
      ? '# 项目预案\n\n1. 明确研究问题。\n2. 完成简短文稿。\n3. 收集图片与视频。'
      : '# 人造生命研究初稿\n\n这是一份用于验证工作流的短文。'
    response.writeHead(200, { 'Content-Type': 'text/event-stream' })
    response.end(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`)
  })
})

await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
const upstreamPort = upstream.address().port
const app = await createServer({ root, configFile: `${root}vite.config.ts`, server: { host: '127.0.0.1', port: 0 } })
await app.listen()
const appPort = app.httpServer.address().port
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

try {
  await page.goto(`http://127.0.0.1:${appPort}/atelier`)

  // Real browser-generated fixtures keep the full workflow deterministic and offline.
  const fixtures = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.fillStyle = '#756079'
    context.fillRect(0, 0, 64, 64)
    context.fillStyle = '#c5d0c7'
    context.fillRect(12, 12, 40, 40)
    const image = canvas.toDataURL('image/png')
    const stream = canvas.captureStream(12)
    const video = await new Promise((resolve, reject) => {
      const chunks = []
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => reject(new Error('Could not create the video fixture'))
      recorder.onstop = () => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }))
      }
      recorder.start()
      let frame = 0
      const timer = window.setInterval(() => {
        frame += 1
        context.fillStyle = frame % 2 ? '#756079' : '#87947c'
        context.fillRect(frame % 16, frame % 16, 32, 32)
      }, 50)
      window.setTimeout(() => {
        window.clearInterval(timer)
        recorder.stop()
        stream.getTracks().forEach((track) => track.stop())
      }, 350)
    })
    return { image, video }
  })
  const fixtureBody = (data) => Buffer.from(data.split(',')[1], 'base64')
  await page.route('**/api/motif/media**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/download')) {
      const target = url.searchParams.get('url') || ''
      const isVideo = target.startsWith('data:video/')
      await route.fulfill({
        status: 200,
        contentType: isVideo ? 'video/webm' : 'image/png',
        body: fixtureBody(isVideo ? fixtures.video : fixtures.image),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [
        { id: 'offline-image', title: '离线图片样本.png', kind: 'image', url: fixtures.image, thumbUrl: fixtures.image, sourceUrl: 'https://commons.wikimedia.org/', license: 'CC0 test fixture', provider: 'Wikimedia Commons' },
        { id: 'offline-video', title: '离线视频样本.webm', kind: 'video', url: fixtures.video, thumbUrl: fixtures.image, sourceUrl: 'https://commons.wikimedia.org/', license: 'CC0 test fixture', provider: 'Wikimedia Commons' },
      ] }),
    })
  })

  await page.getByRole('button', { name: '打开设置' }).click()
  await page.getByLabel('Base URL', { exact: true }).fill(`http://127.0.0.1:${upstreamPort}/v1`)
  await page.getByLabel('模型名', { exact: true }).fill('mock-workflow')
  await page.getByLabel('API Key', { exact: true }).fill('offline-test')
  await page.getByRole('button', { name: '保存配置' }).click()
  const persistedSettings = await page.evaluate(() => JSON.stringify(localStorage))
  assert.ok(!persistedSettings.includes('offline-test'), 'API Key 被写入了 localStorage')
  console.log('PASS API Key 仅用于当前请求，不写入 localStorage')
  await page.keyboard.press('Escape')
  await page.locator('#agent-message').fill('我要做一个关于弗兰肯斯坦的研究')
  await page.getByRole('button', { name: '发送消息' }).click()
  await page.locator('.message-stage-plan').getByText('项目预案', { exact: true }).waitFor()
  assert.equal(await page.locator('.message-outcomes').count(), 0, '确认预案前不应生成文稿')
  console.log('PASS 首次任务只生成预案')

  await page.getByRole('button', { name: '确认预案，生成文稿' }).click()
  await page.locator('.message-stage-draft .message-outcomes').waitFor()
  assert.equal(await page.locator('.agent-media-results').count(), 0, '确认文稿前不应检索媒体')
  assert.match(await page.locator('.message-stage-draft .message-outcomes').innerText(), /人造生命研究初稿/)
  console.log('PASS 确认预案后生成并保存文稿')

  await page.getByRole('button', { name: '确认文稿，寻找图片与视频' }).click()
  await page.locator('.agent-media-card').first().waitFor()
  assert.equal(await page.locator('.agent-media-card').count(), 2)
  await page.locator('.agent-media-card img').first().scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    const image = document.querySelector('.agent-media-card img')
    return image && image.complete && image.naturalWidth > 0
  })
  await page.locator('.agent-media-card video').first().scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    const video = document.querySelector('.agent-media-card video')
    return video && video.readyState >= 1
  })
  console.log('PASS 对话内可预览离线图片与视频样本')

  const firstCard = page.locator('.agent-media-card').first()
  const mediaName = await firstCard.locator('.agent-media-caption > strong').innerText()
  await firstCard.getByRole('button', { name: '收入项目' }).click()
  await firstCard.getByRole('button', { name: '已入档' }).waitFor({ timeout: 5000 })
  await page.waitForFunction(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('motif-atelier', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const count = db.transaction('uploaded-assets', 'readonly').objectStore('uploaded-assets').count()
      count.onsuccess = () => { resolve(count.result >= 1); db.close() }
      count.onerror = () => reject(count.error)
    }
  }), undefined, { timeout: 5000 })
  console.log('PASS 媒体已下载并保存到 IndexedDB')

  if (process.env.MOTIF_TEST_SCREENSHOT === '1') {
    await page.locator('.agent-media-results').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(root, '.workflow-check.jpg'), type: 'jpeg', quality: 82 })
  }
  await page.getByRole('button', { name: '去档案室整理' }).click()
  await page.getByText(mediaName, { exact: true }).first().waitFor()
  console.log('PASS 同一素材可在档案室继续可视化管理')
  assert.deepEqual(errors, [], `浏览器出现错误：${errors.join('\n')}`)
  console.log('PASS 浏览器无脚本错误')
} finally {
  await browser.close()
  await app.close()
  for (const socket of sockets) socket.destroy()
  await new Promise((resolve) => upstream.close(resolve))
}

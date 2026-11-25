import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const app = await createServer({ root, configFile: `${root}vite.config.ts`, server: { host: '127.0.0.1', port: 0 } })
await app.listen()
const port = app.httpServer.address().port
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DwnwEYmBgaAAAADQAB2sS8AAAAAElFTkSuQmCC', 'base64')

try {
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.waitForFunction(() => window.__SCENE_READY__ === true, null, { timeout: 20000 })
  assert.equal(await page.locator('.room-hotspot').count(), 0)
  assert.equal(await page.evaluate(() => window.__SCENE_ERROR__ ?? null), null)
  console.log('PASS Three.js 房间可以载入，且无数字热点')
  await page.getByRole('button', { name: 'Skip to the atelier' }).click()
  await page.waitForURL('**/atelier')

  await page.getByRole('button', { name: '新建', exact: true }).click()
  await page.getByRole('button', { name: /新建项目/ }).click()
  await page.getByLabel('项目名称').fill('发布测试项目')
  await page.getByLabel('项目说明').fill('验证项目管理')
  await page.getByLabel('领域').fill('文学，影像')
  await page.getByRole('button', { name: '创建并关联对话' }).click()
  await page.waitForFunction(() => document.querySelector('.agent-project-select select')?.selectedOptions[0]?.textContent === '发布测试项目')
  console.log('PASS 新建项目并关联当前对话')

  await page.getByRole('button', { name: '新建', exact: true }).click()
  await page.getByRole('button', { name: /新建任务/ }).click()
  await page.getByLabel('任务内容').fill('完成发布检查')
  await page.getByRole('button', { name: '创建任务', exact: true }).click()
  await page.locator('.topbar-utility-button').filter({ hasText: '待办清单' }).click()
  const task = page.locator('.task-item').filter({ hasText: '完成发布检查' })
  await task.waitFor()
  await task.locator('input[type=checkbox]').check()
  assert.ok((await task.getAttribute('class')).includes('done'))
  await page.getByRole('button', { name: '删除任务：完成发布检查' }).click()
  assert.equal(await task.count(), 0)
  console.log('PASS 待办添加、完成与删除')
  await page.getByRole('button', { name: '收起浮层' }).last().click()

  await page.locator('.topbar-utility-button').filter({ hasText: '即时灵感' }).click()
  await page.locator('#workspace-note').fill('测试玻璃便签')
  await page.getByRole('button', { name: '添加便签' }).click()
  const note = page.locator('.draggable-note').filter({ hasText: '测试玻璃便签' })
  await note.waitFor()
  const before = await note.getAttribute('style')
  await note.focus()
  await page.keyboard.press('ArrowRight')
  assert.notEqual(await note.getAttribute('style'), before)
  await note.getByLabel('修改便签分类').selectOption('研究')
  await page.getByRole('button', { name: '删除便签：测试玻璃便签' }).click()
  assert.equal(await note.count(), 0)
  console.log('PASS 灵感便签添加、键盘移动、分类与删除')
  await page.getByRole('button', { name: '收起浮层' }).last().click()

  await page.locator('.direct-workspace-nav button').filter({ hasText: '档案室' }).click()
  await page.locator('input[type=file]').setInputFiles([
    { name: '界面测试图.png', mimeType: 'image/png', buffer: png },
    { name: '界面测试文稿.md', mimeType: 'text/markdown', buffer: Buffer.from('# 测试\n\n可检索正文。') },
  ])
  await page.getByText('界面测试图.png', { exact: true }).waitFor()
  await page.getByText('界面测试文稿.md', { exact: true }).waitFor()
  console.log('PASS 图片与 Markdown 上传')

  await page.getByRole('button', { name: '编辑界面测试图.png的主题标签' }).click()
  await page.locator('#asset-tags').fill('人造生命，测试')
  await page.getByRole('button', { name: '保存标签' }).click()
  await page.getByText('人造生命 · 测试', { exact: true }).waitFor()
  const zipEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出', exact: true }).click()
  const zip = await zipEvent
  assert.ok(zip.suggestedFilename().endsWith('.zip'))
  console.log('PASS 手动标签与 ZIP 导出')

  await page.getByRole('button', { name: '删除界面测试图.png' }).click()
  await page.getByRole('button', { name: /仅从当前项目移除/ }).click()
  assert.equal(await page.getByText('界面测试图.png', { exact: true }).count(), 0)
  await page.getByRole('button', { name: /打开全部文件/ }).click()
  await page.getByText('界面测试图.png', { exact: true }).waitFor()
  console.log('PASS 仅从项目移除后，原文件仍在档案室')

  await page.getByRole('button', { name: '视觉板', exact: true }).click()
  await page.getByRole('button', { name: '添加界面测试图.png' }).click()
  await page.getByRole('button', { name: '添加文字' }).click()
  const editor = page.locator('.object-inspector textarea')
  await editor.fill('A portable vision board.')
  const pngEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 PNG' }).click()
  const image = await pngEvent
  assert.ok(image.suggestedFilename().endsWith('.png'))
  console.log('PASS 视觉板添加图片、编辑文字与 PNG 导出')

  await page.locator('.direct-workspace-nav button').filter({ hasText: '项目星云' }).click()
  await page.locator('.knowledge-atlas canvas').waitFor()
  await page.getByRole('button', { name: '架构图' }).click()
  await page.getByText('发布测试项目', { exact: true }).first().waitFor()
  console.log('PASS 项目星云与平面架构图')

  await page.reload()
  await page.locator('.direct-workspace-nav button').filter({ hasText: '项目星云' }).click()
  await page.getByRole('button', { name: '架构图' }).click()
  await page.getByText('发布测试项目', { exact: true }).first().waitFor()
  console.log('PASS 刷新后项目仍保留')
  assert.deepEqual(errors, [], `浏览器出现错误：${errors.join('\n')}`)
  console.log('PASS 全部界面测试无脚本错误')
} finally {
  await browser.close()
  await app.close()
}

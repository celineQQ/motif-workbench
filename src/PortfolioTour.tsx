import type { AtlasTourAction } from './components/KnowledgeAtlas'
import { t } from './data/language'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { demoModel } from './data/portfolioDemo'
import type { RoomObject } from './components/RoomScene'
import './PortfolioTour.css'

export function PortfolioTour() {
  const navigate = useNavigate()
  const location = useLocation()
  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])

  const [run, setRun] = useState(0)
  const [playing, setPlaying] = useState(() => location.pathname === '/')
  const [caption, setCaption] = useState(() => location.pathname === '/' ? t("正在打开 MOTIF") : t("手动试玩"))
  const [cursor, setCursor] = useState<{ x: number; y: number; click: boolean; dragging?: boolean }>({ x: 30, y: 30, click: false })
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const change = (event: Event) => {
      const action = (event as CustomEvent<'replay' | 'stop'>).detail
      setPaused(action === 'stop')
      setPlaying(action === 'replay')
      if (action === 'replay') setRun((value) => value + 1)
    }
    window.addEventListener('motif-tour-action', change)
    return () => window.removeEventListener('motif-tour-action', change)
  }, [])

  useEffect(() => {
    if (!playing || paused) return
    const abort = new AbortController()
    const wait = async (ms: number) => {
      await new Promise<void>((resolve) => window.setTimeout(resolve, ms))
      abort.signal.throwIfAborted()
    }
    const find = async (selector: string, name = '', allowDisabled = false) => {
      for (let attempt = 0; attempt < 110; attempt += 1) {
        const target = Array.from(document.querySelectorAll<HTMLElement>(selector)).find((item) =>
          item.getClientRects().length && (allowDisabled || !item.matches(':disabled')) && (!name || item.getAttribute('aria-label') === name || item.textContent?.trim().startsWith(name)))
        if (target) return target
        await wait(100)
      }
      throw new Error(t("找不到") + (name || selector))
    }
    const point = async (target: HTMLElement, click = false) => {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const bounds = target.getBoundingClientRect()
      setCursor({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2, click })
      await wait(680)
    }
    const click = async (name: string, selector = 'button') => {
      const target = await find(selector, name)
      await point(target)
      target.click()
      setCursor((current) => ({ ...current, click: true }))
      await wait(790)
      setCursor((current) => ({ ...current, click: false }))
    }
    const type = async (selector: string, value: string, append = false) => {
      const target = (await find(selector)) as HTMLInputElement | HTMLTextAreaElement
      await point(target)
      target.focus({ preventScroll: true })
      const write = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set
      let text = append ? target.value : ''
      for (const part of value.match(/[^]{1,8}/gu) ?? []) {
        text += part
        write?.call(target, text)
        target.dispatchEvent(new Event('input', { bubbles: true }))
        await wait(110)
      }
    }
    const execute = async () => {
      navigateRef.current('/', { replace: true })
      setCaption(t("01 / 探索 3D 房间"))
      const canvas = await find('.room-viewport canvas')
      await point(canvas)
      const bounds = canvas.getBoundingClientRect()
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -330, clientX: bounds.x + bounds.width / 2, bubbles: true, cancelable: true }))
      await wait(1200)
      const explore = async (object: RoomObject, label: string, dwell: number) => {
        setCaption('01 / 3D Room · ' + label)
        const dispatch = (phase: 'focus' | 'wide' | 'point' | 'activate') => canvas.dispatchEvent(new CustomEvent('motif-demo-object', {
          detail: { object, phase, move: (x: number, y: number) => setCursor({ x, y, click: false }) },
        }))
        const openingWindow = object === 'window'
        if (openingWindow) setCaption(t("01 / 3D 房间 · 镜头靠近窗户"))
        dispatch('focus')
        await wait(openingWindow ? 1400 : 920)
        dispatch('point')
        await wait(openingWindow ? 700 : 640)
        if (openingWindow) setCaption('01 / 3D Room · ' + label)
        if (object === 'desk') setCaption(t("01 / 3D 房间 · 点开桌上的笔记本"))
        dispatch('activate')
        setCursor((current) => ({ ...current, click: true }))
        await wait(190)
        setCursor((current) => ({ ...current, click: false }))
        await wait(dwell)
      }
      await explore('lamp', t("点亮台灯"), 1900)
      await explore('bookcase', t("从书架抽出伍尔夫的书"), 1900)
      await explore('wardrobe', t("打开衣柜，查看收藏"), 2100)
      await explore('window', t("开窗 · 花从窗台向外绽放"), 4200)
      await click(t("关闭物件注释"))
      setCaption(t("01 / 3D 房间 · 拉远，看看开满花的庭院"))
      canvas.dispatchEvent(new CustomEvent('motif-demo-object', { detail: { object: 'window', phase: 'wide' } }))
      await wait(2900)
      setCaption(t("01 / 3D 房间 · 360° 环绕全景 · 也可以拖动探索"))
      canvas.dispatchEvent(new CustomEvent('motif-demo-object', { detail: { object: 'desk', phase: 'prepare-orbit' } }))
      await wait(850)
      canvas.dispatchEvent(new CustomEvent('motif-demo-object', { detail: { object: 'desk', phase: 'orbit' } }))
      await wait(10800)
      await explore('desk', t("拉近书桌，看看桌上的笔记本"), 2350)
      setCaption(t("01 / 3D 房间 · 从笔记本进入工作台"))
      await click(t("打开我的工作台"), '.journal-book.is-ready')
      setCaption(t("02 / 模拟填写 API 配置"))
      await click(t("打开设置"))
      await type('#motif-settings-drawer .agent-api-settings label:nth-of-type(2) input', demoModel)
      await type('#motif-settings-drawer input[type=password]', 'demo-only')
      await click('Close', '#motif-settings-drawer button')
      setCaption(t("03 / 当造物有了感情，人类该如何回应？"))
      const importProject = await find('button', t("打开《从弗兰肯斯坦到幻视》")) as HTMLButtonElement
      await point(importProject)
      importProject.click()
      await wait(100)
      if (importProject.disabled) setCaption('03 / Loading project materials…')
      while (importProject.isConnected && importProject.disabled) await wait(200)
      // Opening the imported project activates a fresh conversation and clears its composer.
      const projectSelect = await find('.agent-project-select select') as HTMLSelectElement
      if (projectSelect.selectedOptions[0]?.textContent !== 'From Frankenstein to Vision') {
        throw new Error('Project conversation did not open')
      }
      setCaption(t("03 / 当造物有了感情，人类该如何回应？"))
      await click(t("填入研究问题"))
      await click(t("发送消息"))
      await find('button', t("确认预案，生成文稿"))
      await wait(2800)
      await click(t("确认预案，生成文稿"))
      await find('.message-stage-draft .message-outcomes button')
      await wait(2400)
      await click('', '.message-stage-draft .message-outcomes button')
      if (!(await find('.document-dialog-editor') as HTMLTextAreaElement).value.includes(t("## 补充记录"))) await type('.document-dialog-editor', '\n\n## Field note\nCompare how the Creature and Vision express a choice.', true)
      await wait(2100)
      await click(t("关闭文稿编辑器"))
      setCaption(t("04 / 预览素材并收入项目"))
      await click(t("确认文稿，寻找图片与视频"))
      await click(t("全部收入项目"))
      await find('button', t("已全部入档"), true)
      await click(t("去档案室整理"))
      setCaption(t("05 / 对照两代《弗兰肯斯坦》与幻视的影像"))
      await point(await find('#vision-media-title'))
      await wait(4700)
      setCaption('05 / Scroll through the complete archive')
      const archive = await find('.library-workspace')
      await point(await find('.library-pool-layout .asset-pool-heading'))
      const scrollDown = async (top: number) => {
        const start = archive.scrollTop
        const distance = top - start
        for (let frame = 1; frame <= 24; frame += 1) {
          const time = frame / 24
          archive.scrollTop = start + distance * time * time * (3 - 2 * time)
          await wait(32)
        }
      }
      const cards = Array.from(archive.querySelectorAll<HTMLElement>('.material-grid .material-card'))
      const archiveBounds = archive.getBoundingClientRect()
      for (const card of cards.filter((_, index) => index === 0 || index % 2 === 1).slice(0, 6)) {
        const target = card.getBoundingClientRect().top - archiveBounds.top + archive.scrollTop - archive.clientHeight * 0.28
        await scrollDown(Math.min(archive.scrollHeight - archive.clientHeight, Math.max(0, target)))
        card.dataset.tourHover = 'true'
        try { await point(card); await wait(420) } finally { delete card.dataset.tourHover }
      }
      await scrollDown(archive.scrollHeight - archive.clientHeight)
      await wait(900)
      await scrollDown(0)
      for (const kind of [t("图片"), t("视频"), t("文稿")]) {
        setCaption('05 / Archive · ' + kind)
        await click(kind, '.media-kind-tabs button')
        await point(kind === t("文稿") ? await find('.material-card-copy h3', t("幻视研究任务与资料.md")) : await find('.material-card'))
        const film = kind === t("视频") ? document.querySelector<HTMLVideoElement>('.material-video video') : null
        if (film) {
          film.muted = true
          void film.play().catch(() => undefined)
        }
        await wait(kind === t("视频") ? 4800 : 2700)
        film?.pause()
      }
      setCaption(t("06 / 在档案室拖放文稿"))
      const visionHeading = await find('.material-document h3', t("幻视研究任务与资料.md"))
      const documentCard = visionHeading.closest<HTMLElement>('.material-document') ?? visionHeading
      const folder = await find('.library-folder-item.active')
      const transfer = new DataTransfer()
      await point(documentCard)
      documentCard.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      await point(folder)
      folder.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      await wait(950)
      folder.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      documentCard.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }))
      setCaption('06 / Open the same draft in Archive')
      await click('When Our Creations Feel, How Should We Respond?.md', '.archive-document-open')
      await point(await find('.document-dialog-editor'))
      await wait(1800)
      await click(t("关闭文稿编辑器"))
      setCaption(t("07 / 记下灵感并添加待办"))
      await click(t("即时灵感"))
      await type('#workspace-note', t("关键词：造物责任 · 自主选择 · 归属"))
      const category = (await find('#workspace-note-category')) as HTMLSelectElement
      await point(category)
      category.value = '研究'
      category.dispatchEvent(new Event('change', { bubbles: true }))
      await click(t("添加便签"))
      await click(t("收起浮层"))
      await click(t("待办清单"))
      const comparison = t("整理弗兰肯斯坦与幻视的对照表")
      if (!Array.from(document.querySelectorAll('.utility-task-list .task-item')).some((row) => row.textContent?.includes(comparison))) {
        await type('#new-task', comparison)
        await click(t("添加任务"))
      }
      await wait(1900)
      await click('', '#motif-utility-drawer header button')
      setCaption('08 / Project Atlas · Explore the 3D nebula')
      await click(t('项目星云'), '.direct-workspace-nav button')
      const nebula = await find('.nebula-canvas')
      await point(nebula)
      await click(t('放大星云'))
      await point(nebula)
      const sendAtlas = (detail: AtlasTourAction) => nebula.dispatchEvent(new CustomEvent('motif-atlas-tour', { detail }))
      setCaption('08 / Project Atlas · Drag to orbit the 3D network')
      const atlasBounds = nebula.getBoundingClientRect()
      const travel = Math.min(298, atlasBounds.width * .56)
      for (const vertical of [59, -106, 47]) {
        const left = atlasBounds.left + (atlasBounds.width - travel) / 2
        const midY = atlasBounds.top + atlasBounds.height * .48
        setCursor({ x: left, y: midY - vertical / 2, click: false })
        await wait(450)
        let previous = 0
        for (let step = 1; step <= 36; step += 1) {
          const time = step / 36
          const eased = time * time * (3 - 2 * time)
          const delta = eased - previous
          sendAtlas({ action: 'drag', dx: 300 * delta, dy: vertical * delta })
          setCursor({ x: left + travel * eased, y: midY + (eased - .5) * vertical, click: true, dragging: true })
          previous = eased
          await wait(34)
        }
        setCursor((current) => ({ ...current, click: false }))
        await wait(360)
      }
      const getNodes = () => new Promise<Parameters<Extract<AtlasTourAction, { action: 'nodes' }>['receive']>[0]>((resolve) => sendAtlas({ action: 'nodes', receive: resolve }))
      const nodes = await getNodes()
      const order = ['core', 'project', 'domain', 'tag']
      const kinds = { core: 'Workbench', project: 'Project', domain: 'Field', tag: 'Tag' }
      nodes.sort((left, right) => order.indexOf(left.kind) - order.indexOf(right.kind))
      for (const node of nodes) {
        const current = (await getNodes()).find((item) => item.id === node.id) ?? node
        setCaption('08 / Select node · ' + kinds[current.kind] + ': ' + current.label)
        setCursor({ x: current.x, y: current.y, click: false })
        await wait(450)
        sendAtlas({ action: 'select', id: current.id })
        setCursor((position) => ({ ...position, click: true }))
        await wait(180)
        setCursor((position) => ({ ...position, click: false }))
        await wait(730)
      }
      setCaption('09 / Project Map · Trace a research connection')
      await click(t('架构图'), '.atlas-mode-switch button')
      const project = await find('.flat-project strong', 'From Frankenstein to Vision')
      await point(project)
      project.closest('button')?.click()
      await wait(1500)
      const field = await find('.flat-motifs button', 'Field · Literature')
      await point(field)
      field.click()
      await wait(2600)
      setCaption(t("演示完成 · 现在可以自己操作"))
      setPlaying(false)
    }
    void execute().catch((error: unknown) => {
      if (!abort.signal.aborted) {
        setCaption(t("自动演示已停止 · 可以继续手动试玩"))
        setPlaying(false)
        console.warn(error)
      }
    })
    return () => abort.abort()
  }, [run, playing, paused])

  const cinematic = playing && caption.includes("360°")
  if (!playing) return null
  return <><aside className="portfolio-tour" data-cinematic={cinematic} aria-label={t("自动演示")}>
    <div className="portfolio-tour-title"><span key={caption} role="status">{caption}</span></div>
    {playing && <button type="button" onClick={() => { setPlaying(false); setPaused(true); setCaption(t("手动试玩")) }}>{t("接管操作")}</button>}
  </aside>
    {playing && !cinematic && <i className={'portfolio-tour-cursor' + ((cursor.click ? ' is-clicking' : '') + (cursor.dragging ? ' is-dragging' : ''))} style={{ left: cursor.x, top: cursor.y }} aria-hidden="true">➤</i>}
  </>
}







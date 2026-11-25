
import { t } from '../data/language'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { ArrowDownToLine, ArrowRight, Grid2X2, Images, Minus, Plus, RefreshCw, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { downloadBlob } from '../data/library'
import type { LibraryAsset } from '../data/library'

export type BoardItem = {
  id: number
  kind: 'image' | 'note' | 'swatch'
  assetId?: string
  src?: string
  text?: string
  x: number
  y: number
  width: number
  rotation: number
  z: number
}

const initialBoardItems: BoardItem[] = [
  { id: 11, kind: 'image', assetId: 'glass-swan', text: '玻璃天鹅', x: 5, y: 9, width: 23, rotation: -5, z: 2 },
  { id: 12, kind: 'image', assetId: 'antique-frame', text: '古典浮雕与镜框', x: 44, y: 7, width: 32, rotation: 3, z: 1 },
  { id: 13, kind: 'image', assetId: 'pearl-bubbles', text: '珍珠气泡', x: 74, y: 48, width: 18, rotation: 7, z: 3 },
  { id: 14, kind: 'image', assetId: 'satin-bow', text: '缎面蝴蝶结', x: 8, y: 61, width: 17, rotation: -6, z: 3 },
  { id: 16, kind: 'swatch', text: 'PEARL · IRIS · POND', x: 72, y: 10, width: 17, rotation: 4, z: 2 },
]

const BOARD_KEY = 'motif-vision-board-v1'
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function restoreBoard(): BoardItem[] {
  try {
    const saved = JSON.parse(localStorage.getItem(BOARD_KEY) || 'null') as BoardItem[] | null
    if (Array.isArray(saved) && saved.every((item) => ['image', 'note', 'swatch'].includes(item.kind) && [item.x, item.y, item.width, item.rotation, item.z].every(Number.isFinite))) {
      return saved.filter((item) => !(item.id === 15 && item.kind === 'note' && item.text === 'the monstrous body,\nthe tenderest desire.'))
    }
  } catch { /* A malformed local draft should not prevent the editor opening. */ }
  return [
    { ...initialBoardItems[0], assetId: 'c_gothic', text: t('哥特式门廊') },
    { ...initialBoardItems[1], assetId: 'c_gallery', text: t('古典拱廊') },
    { ...initialBoardItems[3], assetId: 's_teapot', text: t('装饰茶壶') },
    initialBoardItems[4],
  ]
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画板中有一张图片无法读取，请重新添加或移除它。'))
    image.src = src
  })
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 8) {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const character of paragraph) {
      if (context.measureText(line + character).width > maxWidth && line) { lines.push(line); line = character }
      else line += character
    }
    lines.push(line)
  }
  lines.slice(0, maxLines).forEach((line, index) => context.fillText(line, x, y + index * lineHeight))
}

async function exportBoard(canvasElement: HTMLDivElement, items: BoardItem[], images: LibraryAsset[], annotations: boolean) {
  const bounds = canvasElement.getBoundingClientRect()
  if (!bounds.width || !items.length) throw new Error(t("画板还是空的，先放入图片或文字吧。"))
  const canvas = document.createElement('canvas')
  const scale = Math.min(2, 1800 / bounds.width)
  canvas.width = Math.round(bounds.width * scale)
  canvas.height = Math.round(bounds.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error(t("当前浏览器无法创建 PNG 画布。"))
  context.fillStyle = '#e9e8e2'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const wash = context.createRadialGradient(canvas.width * .22, canvas.height * .7, 0, canvas.width * .22, canvas.height * .7, canvas.width * .48)
  wash.addColorStop(0, 'rgba(166,190,168,.28)')
  wash.addColorStop(1, 'rgba(166,190,168,0)')
  context.fillStyle = wash
  context.fillRect(0, 0, canvas.width, canvas.height)

  for (const item of [...items].sort((a, b) => a.z - b.z)) {
    const element = canvasElement.querySelector<HTMLElement>(`[data-board-id="${item.id}"]`)
    if (!element) continue
    const x = element.offsetLeft * scale
    const y = element.offsetTop * scale
    const width = element.offsetWidth * scale
    const height = element.offsetHeight * scale
    context.save()
    context.translate(x + width / 2, y + height / 2)
    context.rotate(item.rotation * Math.PI / 180)
    context.translate(-width / 2, -height / 2)
    context.shadowColor = 'rgba(55,42,58,.15)'
    context.shadowBlur = 15 * scale
    if (item.kind === 'image') {
      const src = item.assetId ? images.find((asset) => asset.id === item.assetId)?.src : item.src
      if (!src) throw new Error(`「${item.text || t("未命名素材")}」的原图已不在素材库，请重新添加。`)
      const image = await loadImage(src)
      context.fillStyle = '#f3f0e9'
      context.fillRect(0, 0, width, height)
      context.shadowBlur = 0
      const inset = 6 * scale
      const imageWidth = width - inset * 2
      const imageHeight = imageWidth / 1.25
      const cover = Math.max(imageWidth / image.naturalWidth, imageHeight / image.naturalHeight)
      const sourceWidth = imageWidth / cover
      const sourceHeight = imageHeight / cover
      context.drawImage(image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight, inset, inset, imageWidth, imageHeight)
      if (annotations && item.text) {
        context.fillStyle = '#403643'
        context.font = `${9 * scale}px "Motif Archive CJK", serif`
        context.fillText(item.text, inset, height - 7 * scale, imageWidth)
      }
    } else if (item.kind === 'note') {
      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, 'rgba(245,241,246,.96)')
      gradient.addColorStop(1, 'rgba(188,172,202,.82)')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      context.shadowBlur = 0
      context.fillStyle = '#403643'
      const fontSize = Number.parseFloat(getComputedStyle(element.querySelector('span')!).fontSize) * scale
      context.font = `italic ${fontSize}px "Motif Cormorant", "Motif Archive CJK", serif`
      drawWrappedText(context, item.text || '', 15 * scale, 39 * scale, width - 30 * scale, fontSize * 1.25)
      context.fillStyle = '#3f5c50'
      context.font = `${6 * scale}px sans-serif`
      context.fillText('A THOUGHT, STILL WET', 15 * scale, height - 13 * scale)
    } else {
      context.fillStyle = 'rgba(237,234,229,.85)'
      context.beginPath()
      context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
      context.fill()
      context.shadowBlur = 0
      const colors = ['#c5b6cc', '#e7e0d9', '#8da592']
      colors.forEach((color, index) => {
        context.beginPath()
        context.fillStyle = color
        context.arc(width / 2 + (index - 1) * 23 * scale, height * .39, 14 * scale, 0, Math.PI * 2)
        context.fill()
      })
      context.fillStyle = '#403643'
      context.font = `${6 * scale}px sans-serif`
      context.textAlign = 'center'
      context.fillText(item.text || '', width / 2, height * .72)
      context.textAlign = 'start'
    }
    context.restore()
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error(t("PNG 导出失败，请重试。"))
  downloadBlob(blob, `MOTIF-Vision-Board-${new Date().toISOString().slice(0, 10)}.png`)
}

export function BoardWorkspace({ assets, annotations, onNotice }: { assets: LibraryAsset[]; annotations: boolean; onNotice: (message: string) => void }) {
  const [items, setItems] = useState<BoardItem[]>(restoreBoard)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [layout, setLayout] = useState<'free' | 'grid'>('free')
  const [exporting, setExporting] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; clientX: number; clientY: number; x: number; y: number } | null>(null)
  const images = assets.filter((asset) => asset.kind === 'image')
  const selected = items.find((item) => item.id === selectedId)
  const displayItems = layout === 'grid' ? items.map((item, index) => ({ ...item, x: 1 + index % 4 * 25, y: 2 + Math.floor(index / 4) * 32, width: 23, rotation: 0 })) : items

  useEffect(() => { localStorage.setItem(BOARD_KEY, JSON.stringify(items)) }, [items])

  const updateItem = (id: number, patch: Partial<BoardItem>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  const beginDrag = (event: PointerEvent<HTMLButtonElement>, item: BoardItem) => {
    if (layout === 'grid') return
    setSelectedId(item.id)
    drag.current = { id: item.id, clientX: event.clientX, clientY: event.clientY, x: item.x, y: item.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || !canvasRef.current || layout === 'grid') return
    const bounds = canvasRef.current.getBoundingClientRect()
    const { id, clientX, clientY, x, y } = drag.current
    const item = items.find((candidate) => candidate.id === id)
    if (!item) return
    updateItem(id, { x: clamp(x + (event.clientX - clientX) / bounds.width * 100, 0, 96 - item.width), y: clamp(y + (event.clientY - clientY) / bounds.height * 100, 0, 90) })
  }
  const nudgeItem = (event: KeyboardEvent<HTMLButtonElement>, item: BoardItem) => {
    if (layout === 'grid') return
    const delta = event.shiftKey ? 5 : 2
    let x = item.x
    let y = item.y
    if (event.key === 'ArrowLeft') x -= delta
    else if (event.key === 'ArrowRight') x += delta
    else if (event.key === 'ArrowUp') y -= delta
    else if (event.key === 'ArrowDown') y += delta
    else return
    event.preventDefault()
    updateItem(item.id, { x: clamp(x, 0, 96 - item.width), y: clamp(y, 0, 90) })
  }
  const addItem = (item: Omit<BoardItem, 'id' | 'z'>) => {
    const id = Date.now()
    setItems((current) => [...current, { ...item, id, z: Math.max(0, ...current.map((entry) => entry.z)) + 1 }])
    setSelectedId(id)
  }
  const rearrange = () => {
    setLayout('free')
    setItems((current) => current.map((item, index) => {
      const angle = index * 2.399 + .4
      const radius = 12 + index % 4 * 6
      return { ...item, x: clamp(48 + Math.cos(angle) * radius * 1.6 - item.width / 2, 1, 95 - item.width), y: clamp(46 + Math.sin(angle) * radius * 1.8, 2, 82), rotation: (index % 5 - 2) * 3 }
    }))
    onNotice(t("画板已重新排布，可以继续拖动调整。"))
  }
  const exportPng = async () => {
    setExporting(true)
    try {
      await exportBoard(canvasRef.current!, displayItems, images, annotations)
      onNotice(t("当前构图已按位置、尺寸、旋转和层级导出为 PNG。"))
    } catch (error) {
      onNotice(error instanceof Error ? error.message : t("PNG 导出失败，请重试。"))
    } finally { setExporting(false) }
  }

  return (
    <div className="board-workspace board-embedded">
      <div className="collage-toolbar board-toolbar">
        <div role="group" aria-label={t("画板布局")}><button className={layout === 'free' ? 'active' : ''} onClick={() => setLayout('free')} aria-pressed={layout === 'free'}><Images size={14} /> {t("自由布局")}</button><button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')} aria-pressed={layout === 'grid'}><Grid2X2 size={14} /> {t("网格布局")}</button></div>
        <button onClick={rearrange}><RefreshCw size={14} /> {t("重排")}</button>
        <button onClick={() => void exportPng()} disabled={exporting || !items.length}><ArrowDownToLine size={14} /> {exporting ? t("正在导出") : t("导出 PNG")}</button>
      </div>
      <div className="board-editor">
        <section className={`board-canvas layout-${layout}`} ref={canvasRef} aria-label={t("可拖动编辑并导出的 Vision Board")} style={layout === 'grid' ? { minHeight: Math.max(520, Math.ceil(items.length / 4) * 205 + 30) } : undefined}>
          <span className="board-coordinate coordinate-x" aria-hidden="true" /><span className="board-coordinate coordinate-y" aria-hidden="true" />
          {displayItems.map((item) => {
            const src = item.assetId ? images.find((asset) => asset.id === item.assetId)?.src : item.src
            return <button
              key={item.id}
              data-board-id={item.id}
              className={`board-item board-${item.kind} ${selectedId === item.id ? 'selected' : ''}`}
              style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, transform: `rotate(${item.rotation}deg)`, zIndex: item.z }}
              onClick={() => setSelectedId(item.id)}
              onPointerDown={(event) => beginDrag(event, item)}
              onPointerMove={moveDrag}
              onPointerUp={() => { drag.current = null }}
              onPointerCancel={() => { drag.current = null }}
              onKeyDown={(event) => nudgeItem(event, item)}
              aria-label={`${item.text || t("画板素材")}，${layout === 'free' ? t("可拖动或使用方向键移动") : t("当前为网格布局")}`}
            >
              {item.kind === 'image' && (src ? <><img src={src} alt={item.text || t("画板图片")} draggable="false" /><span>{annotations ? item.text : ''}</span></> : <span className="board-missing">{t("原图已移除")}<br />{t("请在右侧删除此物件")}</span>)}
              {item.kind === 'note' && <><i aria-hidden="true" /><span>{item.text}</span><small>A THOUGHT, STILL WET</small></>}
              {item.kind === 'swatch' && <><div><i /><i /><i /></div><span>{item.text}</span></>}
            </button>
          })}
          {!items.length && <div className="board-empty">{t("从右侧添加图片或文字。")}</div>}
          <span className="board-canvas-note">DRAG · ARRANGE · CONNECT</span>
        </section>
        <aside className="board-tools">
          <section className="asset-shelf"><p>{t("图片")}</p><div>{images.map((asset) => <button key={asset.id} onClick={() => { addItem({ kind: 'image', assetId: asset.id, text: asset.name, x: 28 + items.length % 4 * 7, y: 22 + items.length % 3 * 8, width: 24, rotation: items.length % 2 ? 3 : -3 }); onNotice(`「${asset.name}」已放上画板。`) }} aria-label={`添加${asset.name}`}><img src={asset.src} alt="" /><span>{asset.name}</span><Plus size={12} /></button>)}</div>{!images.length && <p>{t("先在素材库上传图片。")}</p>}<button className="add-board-text" onClick={() => addItem({ kind: 'note', text: 'a new thought\nworth keeping.', x: 35, y: 34, width: 27, rotation: -2 })}><Plus size={14} /> {t("添加文字")}</button><small>{t("视频和文档请留在素材库中整理。")}</small></section>
          <section className="object-inspector"><p>{t("选中物件")}</p>{selected ? <><strong>{selected.text || t("未命名素材")}</strong>{selected.kind === 'note' && <label>{t("文字")}<textarea value={selected.text} onChange={(event) => updateItem(selected.id, { text: event.target.value })} /></label>}<div className="inspector-grid"><button onClick={() => updateItem(selected.id, { rotation: selected.rotation - 5 })}><RotateCcw size={14} /> {t("左转")}</button><button onClick={() => updateItem(selected.id, { rotation: selected.rotation + 5 })}><RotateCw size={14} /> {t("右转")}</button><button onClick={() => updateItem(selected.id, { width: clamp(selected.width - 3, 10, 55) })}><Minus size={14} /> {t("缩小")}</button><button onClick={() => updateItem(selected.id, { width: clamp(selected.width + 3, 10, 55) })}><Plus size={14} /> {t("放大")}</button></div><button className="bring-forward" onClick={() => updateItem(selected.id, { z: Math.max(...items.map((item) => item.z)) + 1 })}>{t("置顶")} <ArrowRight size={13} /></button><button className="delete-board-item" onClick={() => { setItems((current) => current.filter((item) => item.id !== selected.id)); setSelectedId(null) }}><Trash2 size={13} /> {t("移除")}</button></> : <p className="inspector-empty">{t("选中画板上的图像或文字，即可调整。")}</p>}</section>
          <p className="board-session-note">{t("拖动或使用方向键调整位置。构图自动保存；移除物件不会删除素材原图。")}</p>
        </aside>
      </div>
    </div>
  )
}


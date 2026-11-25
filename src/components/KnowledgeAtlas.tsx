import { portfolioDemo } from '../data/portfolioDemo'
import { isEnglish, t } from '../data/language'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, WheelEvent } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force-3d'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force-3d'
import { ArrowRight, FolderKanban, Map, Minus, Orbit, Plus, RotateCcw } from 'lucide-react'
import type { LibraryAsset } from '../data/library'
import type { Project } from '../data/projects'
import { projectStages } from '../data/projects'
import type { WorkDocument } from '../data/works'
import '../KnowledgeAtlas.css'

type AtlasKind = 'core' | 'project' | 'domain' | 'tag'
type AtlasGroup = 'self' | 'project' | 'domain' | 'shared' | 'single'
type AtlasMode = 'nebula' | 'flat'
type TourNode = { id: string; label: string; kind: AtlasKind; x: number; y: number }
export type AtlasTourAction =
  | { action: 'drag'; dx: number; dy: number }
  | { action: 'nodes'; receive: (nodes: TourNode[]) => void }
  | { action: 'select'; id: string }

type AtlasNode = SimulationNodeDatum & { id: string; label: string; shortLabel: string; kind: AtlasKind; group: AtlasGroup; subtitle: string; tags: string[] }
type Relation = { source: string; target: string }
type ForceLink = SimulationLinkDatum<AtlasNode> & { distance: number }
type ProjectedNode = { node: AtlasNode; x: number; y: number; z: number; radius: number }
type ViewTransform = { yaw: number; pitch: number; zoom: number }
type SourceItem = { id: string; label: string; subtitle: string; domains: string[]; tags: string[] }
const groupColors: Record<AtlasGroup, string> = { self: '#51405f', project: '#8d72a2', domain: '#648777', shared: '#a394b1', single: '#809487' }
const dust = Array.from({ length: 74 }, (_, index) => ({ x: ((Math.sin(index * 91.73) + 1) / 2), y: ((Math.sin(index * 47.21 + 2) + 1) / 2), radius: .35 + (index % 4) * .22, alpha: .08 + (index % 5) * .025 }))
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function createLayout(items: SourceItem[]) {
  const domainNames = [...new Set(items.flatMap((item) => item.domains))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const tagNames = [...new Set(items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const nodes: AtlasNode[] = [{ id: 'self', label: t("我的项目星系"), shortLabel: 'MOTIF', kind: 'core', group: 'self', subtitle: t("项目 · 领域 · 知识标签"), tags: [], x: 0, y: 0, z: 0 }]
  const relations: Relation[] = []
  items.forEach((item, index) => {
    const angle = index * 2.399963
    nodes.push({ id: item.id, label: item.label, shortLabel: item.label.length > 18 ? `${item.label.slice(0, 18)}…` : item.label, kind: 'project', group: 'project', subtitle: item.subtitle, tags: [...item.domains, ...item.tags], x: Math.cos(angle) * 100, y: Math.sin(angle) * 85, z: Math.sin(angle * .7) * 70 })
    relations.push({ source: 'self', target: item.id })
    item.domains.forEach((domain) => relations.push({ source: item.id, target: `domain:${domain}` }))
    item.tags.forEach((tag) => relations.push({ source: item.id, target: `tag:${tag}` }))
  })
  const addTaxonomyNodes = (names: string[], kind: 'domain' | 'tag') => names.forEach((name, index) => {
    const related = items.filter((item) => (kind === 'domain' ? item.domains : item.tags).includes(name))
    const angle = index * 2.399963 + (kind === 'domain' ? .7 : 1.8)
    nodes.push({ id: `${kind}:${name}`, label: name, shortLabel: name, kind, group: related.length > 1 ? 'shared' : 'single', subtitle: `${kind === 'domain' ? t("项目领域") : t("知识标签")} · ${related.length} ${isEnglish ? 'projects' : '个项目'}`, tags: [name], x: Math.cos(angle) * (kind === 'domain' ? 70 : 82), y: Math.sin(angle) * 70, z: Math.cos(angle * .8) * 90 })
  })
  addTaxonomyNodes(domainNames, 'domain')
  addTaxonomyNodes(tagNames, 'tag')
  const links: ForceLink[] = relations.map((relation) => ({ ...relation, distance: relation.source === 'self' ? 108 : 58 }))
  const simulation = forceSimulation(nodes, 3)
    .force('link', forceLink<AtlasNode, ForceLink>(links).id((node) => node.id).distance((link) => link.distance).strength(() => .6))
    .force('charge', forceManyBody().strength((node) => (node as AtlasNode).kind === 'core' ? -170 : (node as AtlasNode).kind === 'project' ? -100 : -48))
    .force('centre', forceCenter(0, 0, 0))
    .force('collide', forceCollide<AtlasNode>().radius((node) => node.kind === 'core' ? 42 : node.kind === 'project' ? 32 : 22))
    .stop()
  for (let index = 0; index < 260; index += 1) simulation.tick()
  return { nodes, relations }
}

export function KnowledgeAtlas({ assets, documents, projects, onOpenProject }: { assets: LibraryAsset[]; documents: WorkDocument[]; projects: Project[]; onOpenProject: (projectId?: string) => void }) {
  const items = useMemo<SourceItem[]>(() => projects.map((project) => ({
    id: `project:${project.id}`,
    label: project.name || t("未命名项目"),
    subtitle: `${projectStages.find((stage) => stage.id === project.stage)?.label ?? t("灵感")} · ${project.assetIds.length} ${isEnglish ? 'materials' : '素材'} · ${project.documentIds.length} ${isEnglish ? 'documents' : '文稿'}`,
    domains: project.domains,
    tags: [...new Set([
      ...assets.filter((asset) => project.assetIds.includes(asset.id)).flatMap((asset) => asset.tags),
      ...documents.filter((document) => project.documentIds.includes(document.id)).flatMap((document) => document.tags),
    ])],
  })), [assets, documents, projects])
  const graph = useMemo(() => createLayout(items), [items])
  const [mode, setMode] = useState<AtlasMode>('nebula')
  const [selectedId, setSelectedId] = useState('self')
  const [view, setView] = useState<ViewTransform>({ yaw: -.42, pitch: -.24, zoom: 1 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const projectedRef = useRef<ProjectedNode[]>([])
  const gesture = useRef<{ pointers: Map<number, { x: number; y: number }>; moved: boolean; pinchDistance: number }>({ pointers: new globalThis.Map(), moved: false, pinchDistance: 0 })
  const selected = graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0]
  const nodeById = useMemo(() => new globalThis.Map(graph.nodes.map((node) => [node.id, node])), [graph])
  const related = graph.relations.filter((relation) => relation.source === selected.id || relation.target === selected.id).map((relation) => nodeById.get(relation.source === selected.id ? relation.target : relation.source)).filter((node): node is AtlasNode => Boolean(node))
  const domainNodes = graph.nodes.filter((node) => node.kind === 'domain')
  const tagNodes = graph.nodes.filter((node) => node.kind === 'tag')
  const sharedCount = [...domainNodes, ...tagNodes].filter((node) => node.group === 'shared').length
  const resetView = useCallback(() => setView({ yaw: -.42, pitch: -.24, zoom: 1 }), [])
  const changeZoom = useCallback((factor: number) => setView((current) => ({ ...current, zoom: clamp(current.zoom * factor, .45, 3.4) })), [])

  const dragView = useCallback((dx: number, dy: number) => {
    setView((current) => ({ ...current, yaw: current.yaw + dx * .007, pitch: current.pitch + dy * .007 }))
  }, [])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!portfolioDemo || mode !== 'nebula' || !canvas) return
    const run = (event: Event) => {
      const detail = (event as CustomEvent<AtlasTourAction>).detail
      if (detail.action === 'drag') dragView(detail.dx, detail.dy)
      else if (detail.action === 'select') {
        if (projectedRef.current.some((point) => point.node.id === detail.id)) setSelectedId(detail.id)
      } else {
        const bounds = canvas.getBoundingClientRect()
        detail.receive(projectedRef.current.map(({ node, x, y }) => ({
          id: node.id, label: node.label, kind: node.kind, x: bounds.left + x, y: bounds.top + y,
        })))
      }
    }
    canvas.addEventListener('motif-atlas-tour', run)
    return () => canvas.removeEventListener('motif-atlas-tour', run)
  }, [dragView, mode])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || mode !== 'nebula') return
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(width * ratio); const pixelHeight = Math.round(height * ratio)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight }
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height)
    const halo = context.createRadialGradient(width * .48, height * .48, 10, width * .48, height * .48, Math.max(width, height) * .54)
    halo.addColorStop(0, 'rgba(190,170,204,.24)'); halo.addColorStop(.48, 'rgba(170,194,176,.09)'); halo.addColorStop(1, 'rgba(238,236,232,0)')
    context.fillStyle = halo; context.fillRect(0, 0, width, height)
    dust.forEach((particle) => { context.beginPath(); context.fillStyle = `rgba(81,64,95,${particle.alpha})`; context.arc(particle.x * width, particle.y * height, particle.radius, 0, Math.PI * 2); context.fill() })
    const cosy = Math.cos(view.yaw); const siny = Math.sin(view.yaw); const cosp = Math.cos(view.pitch); const sinp = Math.sin(view.pitch)
    const base = Math.min(width, height) / 345 * view.zoom
    const projectPoint = (sourceX: number, sourceY: number, sourceZ: number) => {
      const rotatedX = sourceX * cosy - sourceZ * siny; const rotatedZ = sourceX * siny + sourceZ * cosy
      const rotatedY = sourceY * cosp - rotatedZ * sinp; const depth = sourceY * sinp + rotatedZ * cosp
      const perspective = 480 / (480 - clamp(depth, -300, 300))
      return { x: width / 2 + rotatedX * base * perspective, y: height / 2 + rotatedY * base * perspective, z: depth, perspective }
    }
    for (const radius of [86, 133, 183]) {
      context.beginPath()
      for (let index = 0; index <= 72; index += 1) {
        const angle = index / 72 * Math.PI * 2
        const point = projectPoint(Math.cos(angle) * radius, -69, Math.sin(angle) * radius)
        if (index === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      }
      context.strokeStyle = 'rgba(94,79,103,.13)'
      context.lineWidth = .8
      context.stroke()
    }
    const projected: ProjectedNode[] = graph.nodes.map((node) => {
      const position = projectPoint(node.x ?? 0, node.y ?? 0, node.z ?? 0)
      const degree = graph.relations.filter((relation) => relation.source === node.id || relation.target === node.id).length
      const radius = (node.kind === 'core' ? 11 : node.kind === 'project' ? 7 + degree * .35 : 3.5 + degree * .85) * position.perspective * Math.sqrt(view.zoom)
      return { node, x: position.x, y: position.y, z: position.z, radius }
    })
    const projectedById = new globalThis.Map(projected.map((point) => [point.node.id, point]))
    graph.relations.forEach((relation) => {
      const source = projectedById.get(relation.source); const target = projectedById.get(relation.target)
      if (!source || !target) return
      const active = selectedId === relation.source || selectedId === relation.target
      const depthOpacity = clamp(.2 + (source.z + target.z + 300) / 900, .12, .52)
      context.beginPath(); context.moveTo(source.x, source.y); context.lineTo(target.x, target.y)
      context.strokeStyle = active ? `rgba(81,64,95,${clamp(depthOpacity + .35, .5, .85)})` : `rgba(94,79,103,${depthOpacity})`
      context.lineWidth = active ? 1.45 : .65; context.stroke()
    })
    projected.sort((a, b) => a.z - b.z).forEach((point) => {
      const { node, x, y, radius } = point
      const active = node.id === selectedId
      const connected = graph.relations.some((relation) => (relation.source === selectedId && relation.target === node.id) || (relation.target === selectedId && relation.source === node.id))
      context.save(); context.globalAlpha = selectedId && !active && !connected ? .57 : 1
      if (active) { context.beginPath(); context.setLineDash([3, 4]); context.strokeStyle = '#51405f'; context.lineWidth = 1; context.arc(x, y, radius + 8, 0, Math.PI * 2); context.stroke(); context.setLineDash([]) }
      const gradient = context.createRadialGradient(x - radius * .35, y - radius * .4, .5, x, y, radius * 1.25)
      gradient.addColorStop(0, '#f6f2f5'); gradient.addColorStop(.34, groupColors[node.group]); gradient.addColorStop(1, node.kind === 'project' || node.kind === 'core' ? '#47374f' : '#706379')
      context.shadowColor = groupColors[node.group]; context.shadowBlur = active ? 24 : node.kind === 'project' ? 16 : 8
      context.beginPath(); context.fillStyle = gradient; context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0
      context.strokeStyle = 'rgba(255,255,255,.85)'; context.lineWidth = .8; context.stroke()
      if (node.kind === 'core' || node.kind === 'project' || active || view.zoom > 1.35) {
        context.font = `${node.kind === 'project' ? 12 : 11}px "Motif Archive CJK", serif`; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillStyle = active ? '#403348' : '#615664'
        context.fillText(node.kind === 'core' ? 'MOTIF · PROJECT FIELD' : node.shortLabel, x, y + radius + 7, node.kind === 'project' ? 150 : 100)
      }
      context.restore()
    })
    projectedRef.current = projected
  }, [graph, mode, selectedId, view])
  useEffect(() => {
    if (mode !== 'nebula') return
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(draw)
    observer.observe(canvas); draw()
    return () => observer.disconnect()
  }, [draw, mode])
  const selectAt = (clientX: number, clientY: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return
    const match = [...projectedRef.current].reverse().find((point) => Math.hypot(point.x - (clientX - bounds.left), point.y - (clientY - bounds.top)) <= Math.max(18, point.radius + 8))
    if (match) setSelectedId(match.node.id)
  }
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); gesture.current.moved = false
    if (gesture.current.pointers.size === 2) { const [first, second] = [...gesture.current.pointers.values()]; gesture.current.pinchDistance = Math.hypot(first.x - second.x, first.y - second.y) }
  }
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const previous = gesture.current.pointers.get(event.pointerId)
    if (!previous) return
    gesture.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const pointers = [...gesture.current.pointers.values()]
    if (pointers.length === 2) { const distance = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y); if (gesture.current.pinchDistance > 0 && distance > 0) changeZoom(distance / gesture.current.pinchDistance); gesture.current.pinchDistance = distance; gesture.current.moved = true; return }
    const dx = event.clientX - previous.x; const dy = event.clientY - previous.y
    if (Math.abs(dx) + Math.abs(dy) > 1) gesture.current.moved = true
    dragView(dx, dy)
  }
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => { if (gesture.current.pointers.size === 1 && !gesture.current.moved) selectAt(event.clientX, event.clientY); gesture.current.pointers.delete(event.pointerId); gesture.current.pinchDistance = 0 }
  const wheel = (event: WheelEvent<HTMLCanvasElement>) => { event.preventDefault(); changeZoom(Math.exp(-event.deltaY * .0012)) }
  const keyboard = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === '+' || event.key === '=') changeZoom(1.15)
    else if (event.key === '-') changeZoom(1 / 1.15)
    else if (event.key === '0') resetView()
    else if (event.key.startsWith('Arrow')) setView((current) => ({ ...current, yaw: current.yaw + (event.key === 'ArrowRight' ? .12 : event.key === 'ArrowLeft' ? -.12 : 0), pitch: current.pitch + (event.key === 'ArrowDown' ? .12 : event.key === 'ArrowUp' ? -.12 : 0) }))
    else return
    event.preventDefault()
  }

  return <div className="view-shell knowledge-atlas">
    <header className="atlas-heading"><div><h2>{t("项目星云")} <em>Project Nebula</em></h2></div><div className="atlas-mode-switch" role="group" aria-label={t("项目星云显示模式")}><button className={mode === 'nebula' ? 'active' : ''} onClick={() => setMode('nebula')} aria-pressed={mode === 'nebula'}><Orbit size={15} /> {t("星云")}</button><button className={mode === 'flat' ? 'active' : ''} onClick={() => setMode('flat')} aria-pressed={mode === 'flat'}><Map size={15} /> {t("架构图")}</button></div></header>
    {!items.length ? <div className="atlas-empty"><Orbit size={32} strokeWidth={1} /><h3>{t("还没有项目节点")}</h3><p>{t("新建项目并添加领域；项目内素材与文稿的手动标签会形成知识连接。")}</p><div><button onClick={() => onOpenProject(selected.kind === 'project' ? selected.id.slice(8) : undefined)}><FolderKanban size={15} /> {t("新建或管理项目")}</button></div></div> : <div className="atlas-layout">
      <section className={`atlas-visual atlas-mode-${mode}`} aria-label={mode === 'nebula' ? t("可旋转缩放的三维项目星云") : t("项目、领域与知识标签平面架构图")}>
        {mode === 'nebula' ? <><canvas ref={canvasRef} className="nebula-canvas" tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={wheel} onKeyDown={keyboard} aria-label={isEnglish ? "3D project atlas. Drag or use the arrow keys to orbit, scroll to zoom, or select a node to see its links." : "三维项目星云。拖拽旋转，滚轮缩放，点击节点查看关联。方向键旋转，加减键缩放，数字零复位。"} /><div className="nebula-topline"><span>PROJECT–DOMAIN–KNOWLEDGE · 3D</span><output>{Math.round(view.zoom * 100)}%</output></div><div className="nebula-controls"><button onClick={() => changeZoom(1.2)} aria-label={t("放大星云")}><Plus size={16} /></button><button onClick={() => changeZoom(1 / 1.2)} aria-label={t("缩小星云")}><Minus size={16} /></button><button onClick={resetView} aria-label={t("重置星云视角")}><RotateCcw size={15} /></button></div><div className="nebula-instruction"><span>DRAG TO ORBIT · SCROLL TO ZOOM</span><small>{t("拖拽旋转 · 滚轮缩放 · 点击节点")}</small></div></> : <FlatAtlas items={items} selectedId={selectedId} onSelect={setSelectedId} />}
        <div className="atlas-legend"><span><i className="legend-project" />{t("项目")}</span><span><i className="legend-shared" />{t("跨项目连接")}</span><span><i className="legend-single" />{t("领域与知识标签")}</span><b>{graph.nodes.length} NODES · {graph.relations.length} CONNECTIONS</b></div>
      </section>
      <aside className="atlas-inspector"><p className="workspace-kicker">SELECTED {selected.kind.toUpperCase()}</p><span className={`atlas-selected-kind kind-${selected.group}`}>{selected.subtitle}</span><h3>{selected.label}</h3><p className="atlas-description">{selected.kind === 'core' ? isEnglish ? `${projects.length} projects · ${domainNodes.length} fields · ${tagNodes.length} tags` : `${projects.length} 个项目 · ${domainNodes.length} 个领域 · ${tagNodes.length} 个知识标签` : selected.kind === 'project' ? selected.subtitle : selected.kind === 'domain' ? t("这是在项目中手动填写的领域，不是模型推断。") : t("来自项目内素材与文稿的手动主题标签。")}</p>{related.length > 0 && <div className="atlas-related"><span>DIRECT CONNECTIONS</span><div>{related.slice(0, 10).map((node) => <button key={node.id} onClick={() => setSelectedId(node.id)} className={selectedId === node.id ? 'active' : ''}>{node.shortLabel}<ArrowRight size={12} /></button>)}</div></div>}<button className="atlas-open-works" onClick={() => onOpenProject(selected.kind === 'project' ? selected.id.slice(8) : undefined)}><FolderKanban size={15} />{t("管理项目")}<ArrowRight size={14} /></button><section className="atlas-reading"><div><strong>{String(domainNodes.length).padStart(2, '0')}</strong><span>{t("项目领域")}</span></div><div><strong>{String(sharedCount).padStart(2, '0')}</strong><span>{t("跨项目连接")}</span></div><p>{t("只呈现真实项目、手动领域和项目内已有的标签，不推断创作母题或思维局限。")}</p></section><div className="atlas-keyboard-note">{t("方向键旋转 · + / − 缩放 · 0 复位")}</div></aside>
    </div>}
  </div>
}

function FlatAtlas({ items, selectedId, onSelect }: { items: SourceItem[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="flat-atlas"><div className="flat-topline"><span>PROJECT–DOMAIN–KNOWLEDGE</span><small>{t("点击项目、领域或标签查看直接关联")}</small></div><div className="flat-tree"><button className={`flat-root ${selectedId === 'self' ? 'active' : ''}`} onClick={() => onSelect('self')}><span>LOCAL</span><strong>Projects</strong><small>{items.length} PROJECTS</small></button><div className="flat-branches">{items.map((item, index) => <section className="flat-branch" key={item.id}><button className={`flat-project ${selectedId === item.id ? 'active' : ''}`} onClick={() => onSelect(item.id)}><small>{String(index + 1).padStart(2, '0')} · PROJECT</small><strong>{item.label}</strong><span>{item.domains.length + item.tags.length} CONNECTIONS</span></button><div className="flat-motifs">{item.domains.map((domain) => <button key={`domain:${domain}`} className={selectedId === `domain:${domain}` ? 'active' : ''} onClick={() => onSelect(`domain:${domain}`)}>{isEnglish ? "Field" : "领域"} · {domain}</button>)}{item.tags.map((tag) => { const shared = items.filter((candidate) => candidate.tags.includes(tag)).length > 1; return <button key={`tag:${tag}`} className={`${selectedId === `tag:${tag}` ? 'active' : ''} ${shared ? 'shared' : ''}`} onClick={() => onSelect(`tag:${tag}`)}>{tag}{shared && <small>×{items.filter((candidate) => candidate.tags.includes(tag)).length}</small>}</button> })}{!item.domains.length && !item.tags.length && <span className="flat-untagged">{t("尚未添加领域或项目内标签")}</span>}</div></section>)}</div></div><p className="flat-note"><span />{t("领域来自项目设置；知识标签只统计项目已引用的素材与文稿。")}</p></div>
}


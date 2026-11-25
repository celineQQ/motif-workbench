import { isEnglish, t } from '../data/language'
import { VisionMediaShelf } from './VisionMediaShelf'
import { frankensteinTitle } from '../data/frankenstein'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, DragEvent, FormEvent, SetStateAction } from 'react'
import { ArrowDownToLine, Check, Clock3, Database, FileText, Film, FolderOpen, FolderPlus, Image as ImageIcon, LayoutDashboard, Library, Play, Plus, Search, Tag, Trash2, Upload, X } from 'lucide-react'
import { BoardWorkspace } from './BoardWorkspace'
import { allSupportedAccept, assetExtension, createAssetFromFile, documentToLibraryAsset, downloadAsset, exportAssetsZip, kindFromFile, mediaKinds } from '../data/library'
import type { AssetKind, LibraryAsset } from '../data/library'
import type { Project } from '../data/projects'
import type { WorkDocument } from '../data/works'
import './LibraryPool.css'

type LibraryView = 'library' | 'board'
type KindFilter = AssetKind | 'all'
const kindIcons = { image: ImageIcon, video: Film, document: FileText, data: Database }
const dragMime = 'application/x-motif-assets'

const draggedIds = (event: DragEvent): string[] => {
  try {
    const value = JSON.parse(event.dataTransfer.getData(dragMime))
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}

function FolderVisual({ items, count, create = false }: { items: LibraryAsset[]; count: number; create?: boolean }) {
  const previews = items.slice(0, 3)
  return <span className={`folder-object-visual ${create ? 'folder-object-create' : ''}`} aria-hidden="true">
    <span className="folder-papers">{create || !previews.length ? <><i /><i /><i /></> : previews.map((asset) => {
      if (asset.kind === 'image') return <img key={asset.id} src={asset.src} alt="" draggable={false} />
      if (asset.kind === 'video') return <i className="folder-paper-special folder-paper-video" key={asset.id}><video src={asset.src} muted playsInline preload="metadata" /><Play size={13} /></i>
      const Icon = kindIcons[asset.kind]
      return <i className={`folder-paper-special folder-paper-${asset.kind}`} key={asset.id}><Icon size={18} strokeWidth={1.25} /></i>
    })}</span>
    <span className="folder-object-front">{create ? <Plus size={22} strokeWidth={1.2} /> : <b>{count.toString().padStart(2, '0')}</b>}</span>
  </span>
}

function FolderObjectButton({ name, meta, items, count, onOpen }: { name: string; meta: string; items: LibraryAsset[]; count: number; onOpen: () => void }) {
  return <button className="folder-open-button" onClick={onOpen} aria-label={isEnglish ? `Open ${name}, ${count} files` : `打开${name}，${count}项文件`}>
    <FolderVisual items={items} count={count} />
    <span className="folder-object-name">{name}<small>{meta} · {count} {isEnglish ? 'items' : '项'}</small></span>
  </button>
}

export function LibraryWorkspace({ assets: storedAssets, setAssets, documents, setDocuments, projects, setProjects, activeProjectId, onActiveProjectChange, onRequestNewProject, onDeleteProject, storageReady, annotations, onNotice, onViewChange, onEditDocument }: {
  assets: LibraryAsset[]
  setAssets: Dispatch<SetStateAction<LibraryAsset[]>>
  documents: WorkDocument[]
  setDocuments: Dispatch<SetStateAction<WorkDocument[]>>
  projects: Project[]
  setProjects: Dispatch<SetStateAction<Project[]>>
  activeProjectId?: string
  onActiveProjectChange: (id?: string) => void
  onRequestNewProject: () => void
  onDeleteProject: (id: string) => void
  storageReady: boolean
  annotations: boolean
  onNotice: (message: string) => void
  onViewChange: (view: LibraryView) => void
  onEditDocument: (id: string) => void
}) {
  const [view, setView] = useState<LibraryView>('library')
  const [kind, setKind] = useState<KindFilter>('all')
  const [recentOnly, setRecentOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [draggingIds, setDraggingIds] = useState<string[]>([])
  const [dropTarget, setDropTarget] = useState<string>()
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [tagRequest, setTagRequest] = useState<{ id: string; draft: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const documentAssets = useMemo(() => documents.map(documentToLibraryAsset), [documents])
  const assets = useMemo(() => [...storedAssets.filter((asset) => !documentAssets.some((document) => document.id === asset.id)), ...documentAssets], [storedAssets, documentAssets])
  const activeProject = projects.find((project) => project.id === activeProjectId)
  const existingAssets = (ids: string[]) => ids.map((id) => assets.find((asset) => asset.id === id)).filter((asset): asset is LibraryAsset => Boolean(asset))
  const projectIds = (project: Project) => [...new Set([...project.assetIds, ...project.documentIds])]
  const projectItems = (project: Project) => existingAssets(projectIds(project))
  const recentAssets = assets.filter((asset) => Date.now() - asset.createdAt < 30 * 24 * 60 * 60 * 1000)
  const scopedAssets = recentOnly ? recentAssets : activeProject ? projectItems(activeProject) : assets
  const locationAssets = [...scopedAssets].sort((a, b) => b.createdAt - a.createdAt)
  const visibleAssets = locationAssets.filter((asset) => (kind === 'all' || asset.kind === kind) && `${asset.name} ${asset.tags.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()))
  const selectedVisibleIds = visibleAssets.map((asset) => asset.id).filter((id) => selectedIds.includes(id))
  const locationName = recentOnly ? t("最近使用") : activeProject?.name || t("全部文件")
  const currentKind = kind === 'all' ? undefined : mediaKinds.find((item) => item.id === kind)

  useEffect(() => { onViewChange(view) }, [onViewChange, view])
  useEffect(() => {
    if (!deleteIds.length && !tagRequest) return
    const closeOnEscape = () => { setDeleteIds([]); setTagRequest(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [deleteIds, tagRequest])

  const openProject = (id?: string) => { onActiveProjectChange(id); setRecentOnly(false); setSelectedIds([]) }
  const openRecent = () => { onActiveProjectChange(undefined); setRecentOnly(true); setSelectedIds([]) }
  const changeKind = (next: KindFilter) => { setKind(next); setSelectedIds([]) }
  const changeView = (next: LibraryView) => { setView(next); setSelectedIds([]) }
  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || busy) return
    setBusy(true)
    const uploaded: LibraryAsset[] = []
    const rejected: string[] = []
    try {
      for (const file of Array.from(files)) {
        const detectedKind = kindFromFile(file)
        if (!detectedKind) { rejected.push(file.name); continue }
        uploaded.push(await createAssetFromFile(file, detectedKind))
      }
      if (uploaded.length) {
        const ids = uploaded.map((asset) => asset.id)
        setAssets((current) => [...uploaded, ...current])
        if (activeProject) setProjects((current) => current.map((project) => project.id === activeProject.id ? { ...project, assetIds: [...new Set([...ids, ...project.assetIds])], updatedAt: Date.now() } : project))
        setSelectedIds(ids)
        setKind('all')
        const counts = mediaKinds.map((item) => ({ label: item.label, count: uploaded.filter((asset) => asset.kind === item.id).length })).filter((item) => item.count).map((item) => `${item.label} ${item.count} 项`).join('，')
        onNotice(`已上传${counts}${activeProject ? `，并放入「${activeProject.name}」` : ''}。${rejected.length ? ` ${rejected.length} 个不支持的文件未导入。` : ''}`)
      } else onNotice(`没有可导入的文件。${rejected.length ? `不支持：${rejected.slice(0, 3).join('、')}` : ''}`)
    } catch (error) {
      uploaded.forEach((asset) => URL.revokeObjectURL(asset.src))
      onNotice(error instanceof Error ? error.message : t("文件读取失败，请重试。"))
    } finally { setBusy(false) }
  }

  const deleteAssetsFromLibrary = (ids: string[]) => {
    storedAssets.filter((asset) => ids.includes(asset.id) && asset.src.startsWith('blob:')).forEach((asset) => URL.revokeObjectURL(asset.src))
    setAssets((current) => current.filter((asset) => !ids.includes(asset.id)))
    setDocuments((current) => current.filter((document) => !ids.includes(document.id)))
    setSelectedIds([])
    setDeleteIds([])
    onNotice(`已从整个档案室删除 ${ids.length} 项文件。`)
  }
  const removeAssets = (ids: string[]) => {
    if (!ids.length) return
    if (activeProject) { setDeleteIds(ids); return }
    const names = assets.filter((asset) => ids.includes(asset.id)).map((asset) => asset.name)
    if (!window.confirm(`确定从档案室删除 ${ids.length} 项文件吗？\n${names.slice(0, 3).join('、')}${names.length > 3 ? '…' : ''}\n所有项目中的对应引用也会移除。`)) return
    deleteAssetsFromLibrary(ids)
  }
  const removeFromCurrentProject = () => {
    if (!activeProject || !deleteIds.length) return
    setProjects((current) => current.map((project) => project.id === activeProject.id ? { ...project, assetIds: project.assetIds.filter((id) => !deleteIds.includes(id)), documentIds: project.documentIds.filter((id) => !deleteIds.includes(id)), updatedAt: Date.now() } : project))
    onNotice(`已从「${activeProject.name}」移除 ${deleteIds.length} 项引用，文件仍保留在档案室。`)
    setSelectedIds([])
    setDeleteIds([])
  }
  const exportVisible = async () => {
    setBusy(true)
    try {
      await exportAssetsZip(visibleAssets, kind)
      onNotice(`${visibleAssets.length} 项文件已按原格式打包为 ZIP，附文件索引。`)
    } catch (error) { onNotice(error instanceof Error ? error.message : t("导出失败，请重试。")) }
    finally { setBusy(false) }
  }
  const moveToProject = (target: Project, ids: string[]) => {
    const validIds = ids.filter((id) => assets.some((asset) => asset.id === id))
    if (!validIds.length) return
    const documentIds = validIds.filter((id) => documents.some((document) => document.id === id))
    const assetIds = validIds.filter((id) => !documentIds.includes(id))
    setProjects((current) => current.map((project) => {
      const remainingAssets = project.assetIds.filter((id) => !validIds.includes(id))
      const remainingDocuments = project.documentIds.filter((id) => !validIds.includes(id))
      if (project.id !== target.id) return remainingAssets.length !== project.assetIds.length || remainingDocuments.length !== project.documentIds.length ? { ...project, assetIds: remainingAssets, documentIds: remainingDocuments } : project
      return { ...project, assetIds: [...new Set([...remainingAssets, ...assetIds])], documentIds: [...new Set([...remainingDocuments, ...documentIds])], updatedAt: Date.now() }
    }))
    setSelectedIds([])
    onNotice(isEnglish ? `Moved ${validIds.length} file(s) to ${target.name}.` : `已将 ${validIds.length} 项文件移入「${target.name}」。文件类型保持不变。`)
  }
  const removeFromAllProjects = (ids: string[]) => {
    if (!ids.length) return
    setProjects((current) => current.map((project) => ({ ...project, assetIds: project.assetIds.filter((id) => !ids.includes(id)), documentIds: project.documentIds.filter((id) => !ids.includes(id)) })))
    setSelectedIds([])
    onNotice(`已将 ${ids.length} 项文件移出项目，文件仍保留在档案室。`)
  }
  const saveTags = (event: FormEvent) => {
    event.preventDefault()
    if (!tagRequest) return
    const tags = [...new Set(tagRequest.draft.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean))]
    if (documents.some((document) => document.id === tagRequest.id)) setDocuments((current) => current.map((document) => document.id === tagRequest.id ? { ...document, tags, updatedAt: Date.now() } : document))
    else setAssets((current) => current.map((asset) => asset.id === tagRequest.id ? { ...asset, tags } : asset))
    setTagRequest(null)
    onNotice(t("主题标签已手动更新。"))
  }

  const beginDrag = (event: DragEvent<HTMLElement>, id: string) => {
    const ids = selectedIds.includes(id) ? selectedIds : [id]
    event.dataTransfer.setData(dragMime, JSON.stringify(ids))
    event.dataTransfer.effectAllowed = 'move'
    setDraggingIds(ids)
  }
  const finishDrag = () => { setDraggingIds([]); setDropTarget(undefined) }
  const allowDrop = (event: DragEvent, target: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes('Files') ? 'copy' : 'move'
    if (dropTarget !== target) setDropTarget(target)
  }
  const dropOnProject = (event: DragEvent, project?: Project) => {
    event.preventDefault()
    event.stopPropagation()
    const ids = draggedIds(event)
    if (project) moveToProject(project, ids)
    else removeFromAllProjects(ids)
    finishDrag()
  }
  const dropOnPool = (event: DragEvent) => {
    event.preventDefault()
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files)
    finishDrag()
  }

  return (
    <div className="library-workspace">
      {view === 'library' ? <section className="material-library-view">
        <div className="library-pool-topbar">
          <nav className="media-kind-tabs" aria-label={t("文件类型文件夹")}>
            <button className={kind === 'all' ? 'active' : ''} aria-pressed={kind === 'all'} onClick={() => changeKind('all')}><Library size={17} strokeWidth={1.4} /><span>{t("全部类型")}<small>{locationAssets.length} FILES</small></span></button>
            {mediaKinds.map((item) => { const Icon = kindIcons[item.id]; return <button key={item.id} className={kind === item.id ? 'active' : ''} aria-pressed={kind === item.id} onClick={() => changeKind(item.id)}><Icon size={17} strokeWidth={1.4} /><span>{item.label}<small>{locationAssets.filter((asset) => asset.kind === item.id).length} FILES</small></span></button> })}
          </nav>
        </div>

        <div className="library-pool-layout">
          <main className={`asset-pool ${dropTarget === 'pool' ? 'is-drop-target' : ''}`} onDragOver={(event) => allowDrop(event, 'pool')} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(undefined) }} onDrop={dropOnPool}>
            <div className="asset-pool-heading">
              <div><span>{recentOnly ? 'RECENT FILES' : activeProject ? 'PROJECT FILES' : 'COMPLETE ARCHIVE'}</span><h3>{activeProject ? <FolderOpen size={21} strokeWidth={1.3} /> : <Library size={21} strokeWidth={1.3} />}{locationName}</h3></div>
              <strong>{visibleAssets.length.toString().padStart(2, '0')}<small>{currentKind ? currentKind.label : t("全部类型")}</small></strong>
            </div>
            <div className="library-pool-toolbar">
              <label className="material-search"><Search size={14} /><span className="sr-only">{t("搜索当前文件")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("搜索文件名或标签")} />{search && <button onClick={() => setSearch('')} aria-label={t("清空搜索")}><X size={13} /></button>}</label>
              <button className="select-all" disabled={!visibleAssets.length} onClick={() => setSelectedIds(selectedVisibleIds.length === visibleAssets.length ? selectedIds.filter((id) => !selectedVisibleIds.includes(id)) : [...new Set([...selectedIds, ...visibleAssets.map((asset) => asset.id)])])}><Check size={14} />{selectedVisibleIds.length === visibleAssets.length && visibleAssets.length ? t("取消全选") : t("全选")}</button>
              <button disabled={!selectedIds.length || busy} onClick={() => removeAssets(selectedIds)}><Trash2 size={14} />{t("删除")}{selectedIds.length ? ` (${selectedIds.length})` : ''}</button>
              <button disabled={!visibleAssets.length || busy} onClick={() => void exportVisible()}><ArrowDownToLine size={14} />{t("导出")}</button>
              <button onClick={() => changeView('board')}><LayoutDashboard size={14} />{t("视觉板")}</button>
            </div>
            {activeProject?.name === frankensteinTitle && kind === 'all' && <VisionMediaShelf />}
            <div className="library-result-line"><span>{activeProject ? `${activeProject.name} · ${currentKind?.label || t("混合文件")}` : recentOnly ? t("近 30 天文件") : t("全部项目与未归档文件")}</span><span>{draggingIds.length ? isEnglish ? `Moving ${draggingIds.length} file(s)` : `正在移动 ${draggingIds.length} 项` : t("拖到右侧项目文件夹完成整理")}</span></div>
            <div className={`material-grid material-grid-${kind}`}>
              {visibleAssets.map((asset, index) => { const Icon = kindIcons[asset.kind]; return <article draggable onDragStart={(event) => beginDrag(event, asset.id)} onDragEnd={finishDrag} className={`material-card material-${asset.kind} ${selectedIds.includes(asset.id) ? 'is-selected' : ''} ${draggingIds.includes(asset.id) ? 'is-dragging' : ''}`} key={asset.id} style={{ '--deal-index': Math.min(index, 12) } as React.CSSProperties}>
                <label className="asset-select"><input type="checkbox" checked={selectedIds.includes(asset.id)} onChange={() => toggleSelected(asset.id)} /><span>{selectedIds.includes(asset.id) && <Check size={12} />}</span><b className="sr-only">{isEnglish ? 'Select ' : '选择'}{asset.name}</b></label>
                <span className="asset-kind-mark"><Icon size={12} />{mediaKinds.find((item) => item.id === asset.kind)?.label}</span>
                {asset.kind === 'image' && <div className="material-image-wrap"><img src={asset.src} alt={asset.name} loading="lazy" draggable={false} />{annotations && <span>{asset.origin === 'upload' ? t("我的素材") : t("示例素材")}</span>}</div>}
                {asset.kind === 'video' && <div className="material-video-wrap"><video src={asset.src} poster={asset.id === 'frankenstein-source-frankenstein-1910-film.ogv' ? import.meta.env.BASE_URL + 'frankenstein/frankenstein-1910-still.jpg' : undefined} controls playsInline preload="metadata" aria-label={asset.name} /></div>}
                {(asset.kind === 'document' || asset.kind === 'data') && <div className="document-preview">{asset.kind === 'data' ? <Database size={29} strokeWidth={1} /> : <FileText size={29} strokeWidth={1} />}<span>{assetExtension(asset)} · {asset.content ? 'READABLE TEXT' : 'ORIGINAL FILE'}</span><p>{asset.content?.slice(0, 180) || t("保留原文件与本地下载。")}</p></div>}
                <div className="material-card-copy"><div><h3>{asset.kind === 'document' && asset.content !== undefined
                  ? <button className="archive-document-open" type="button" onClick={() => onEditDocument(asset.id)}>{asset.name}</button>
                  : asset.name}</h3><p>{asset.tags.length ? asset.tags.join(' · ') : t("未添加主题标签")}</p></div><span>{asset.size}</span></div>
                <div className="material-card-actions"><button onClick={() => setTagRequest({ id: asset.id, draft: asset.tags.join('，') })} aria-label={isEnglish ? `Edit tags for ${asset.name}` : `编辑${asset.name}的主题标签`}><Tag size={13} />{t("标签")}</button><button onClick={() => void downloadAsset(asset).catch((error: unknown) => onNotice(error instanceof Error ? error.message : t("下载失败")))} aria-label={isEnglish ? `${t("下载")} ${asset.name}` : `下载${asset.name}`}><ArrowDownToLine size={13} />{t("下载")}</button><button onClick={() => removeAssets([asset.id])} aria-label={isEnglish ? `${t("删除")} ${asset.name}` : `删除${asset.name}`}><Trash2 size={13} />{t("删除")}</button></div>
              </article> })}
            </div>
            {!visibleAssets.length && <div className="library-empty"><FolderPlus size={25} strokeWidth={1} /><h3>{search ? t("没有匹配的文件") : activeProject ? t("这个项目还没有此类文件") : recentOnly ? t("近期没有使用文件") : t("档案室还是空的")}</h3><p>{search ? t("试试其他关键词，或切换文件类型。") : t("上传文件，或从其他项目拖入文件。")}</p></div>}
          </main>

          <aside className="library-folder-rail" aria-label={t("项目文件夹")}>
            <div className="folder-rail-heading"><div><h3>{t("项目文件夹")}</h3><p>{t("项目与类型可组合筛选")}</p></div><input ref={inputRef} className="sr-only" type="file" accept={allSupportedAccept} multiple onChange={(event) => { void addFiles(event.target.files); event.target.value = '' }} /><button className="rail-upload" disabled={busy || !storageReady} onClick={() => inputRef.current?.click()}><Upload size={14} /><span>{t("上传")}</span></button></div>
            <div className="folder-rail-list">
              <div className={`library-folder-item folder-root ${!activeProject && !recentOnly ? 'active' : ''} ${dropTarget === 'all-files' ? 'is-drop-target' : ''}`} onDragOver={(event) => allowDrop(event, 'all-files')} onDragLeave={() => setDropTarget(undefined)} onDrop={(event) => dropOnProject(event)}><FolderObjectButton name={t("全部文件")} meta={t("完整档案室")} items={assets} count={assets.length} onOpen={() => openProject()} /></div>
              <div className={`library-folder-item folder-tone-2 ${recentOnly ? 'active' : ''}`}><FolderObjectButton name={t("最近使用")} meta={t("近 30 天")} items={recentAssets} count={recentAssets.length} onOpen={openRecent} /></div>
              <div className="project-folder-divider"><span>{t("全部项目")}</span><b>{projects.length.toString().padStart(2, '0')}</b></div>
              {projects.map((project, folderIndex) => { const items = projectItems(project); return <div key={project.id} className={`library-folder-item folder-tone-${folderIndex % 4} ${activeProject?.id === project.id ? 'active' : ''} ${dropTarget === project.id ? 'is-drop-target' : ''}`} onDragOver={(event) => allowDrop(event, project.id)} onDragLeave={() => setDropTarget(undefined)} onDrop={(event) => dropOnProject(event, project)}>
                <FolderObjectButton name={project.name || t("未命名项目")} meta={t("混合文件")} items={items} count={items.length} onOpen={() => openProject(project.id)} />
                <button className="folder-delete-button" onClick={() => { if (window.confirm(`删除项目文件夹「${project.name}」吗？文件、文稿和对话都会保留。`)) onDeleteProject(project.id) }} aria-label={isEnglish ? `Delete project folder ${project.name} and keep files` : `删除项目文件夹${project.name}，保留文件`}><X size={12} /></button>
              </div> })}
            </div>
            <button type="button" className="folder-drop-create" onClick={onRequestNewProject} aria-label={t("新建项目文件夹")}>
              <FolderVisual items={[]} count={0} create />
              <span className="folder-object-name">{t("新建文件夹")}<small>{t("创建项目并收纳文件")}</small></span>
            </button>
            <p className="folder-rail-note"><Clock3 size={11} />{t("项目可混装图片、视频、文稿和数据；切换项目不会清除类型筛选。")}</p>
          </aside>
        </div>
      </section> : <><BoardWorkspace assets={assets} annotations={annotations} onNotice={onNotice} /><div className="board-bottom-actions"><button onClick={() => changeView('library')}><Library size={15} /> {t("返回档案室")}</button></div></>}
      {deleteIds.length > 0 && activeProject && <div className="work-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteIds([]) }}><section className="work-modal deletion-scope-modal" role="dialog" aria-modal="true" aria-labelledby="deletion-scope-title"><button className="work-modal-close" onClick={() => setDeleteIds([])} aria-label={t("取消删除")}><X size={16} /></button><span>REMOVE · CHOOSE A SCOPE</span><h2 id="deletion-scope-title">{t("选择移除范围")}</h2><p>所选 {deleteIds.length} 项文件正在项目「{activeProject.name}」中。可以只移除项目引用，或删除档案室中的原文件。</p><div className="deletion-file-list">{assets.filter((asset) => deleteIds.includes(asset.id)).slice(0, 3).map((asset) => <span key={asset.id}>{asset.name}</span>)}</div><div className="deletion-scope-actions"><button autoFocus onClick={removeFromCurrentProject}><FolderOpen size={15} />{t("仅从当前项目移除")}<small>{t("文件仍保留在整个档案室")}</small></button><button className="delete-everywhere" onClick={() => deleteAssetsFromLibrary(deleteIds)}><Trash2 size={15} />{t("从整个档案室删除")}<small>{t("同时移除所有项目引用")}</small></button></div></section></div>}
      {tagRequest && <div className="work-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTagRequest(null) }}><section className="work-modal folder-name-modal" role="dialog" aria-modal="true" aria-labelledby="asset-tag-title"><button className="work-modal-close" onClick={() => setTagRequest(null)} aria-label={t("关闭标签编辑")}><X size={16} /></button><span>MANUAL TAGS · LOCAL</span><h2 id="asset-tag-title">{t("主题标签")}</h2><form onSubmit={saveTags}><label htmlFor="asset-tags">{t("用逗号分隔多个标签")}</label><input id="asset-tags" autoFocus value={tagRequest.draft} onChange={(event) => setTagRequest({ ...tagRequest, draft: event.target.value })} placeholder={t("例如：人造生命，影像，亲密")} /><p>{t("标签完全由你填写，不会自动生成，可用于检索和项目星云。")}</p><div><button type="button" onClick={() => setTagRequest(null)}>{t("取消")}</button><button type="submit" className="workspace-primary"><Check size={15} />{t("保存标签")}</button></div></form></section></div>}
    </div>
  )
}




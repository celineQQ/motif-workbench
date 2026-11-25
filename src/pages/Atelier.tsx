import { DisplayMenu } from '../components/DisplayMenu'
import { isEnglish, t } from '../data/language'
import { demoModel, portfolioDemo } from '../data/portfolioDemo'
import { frankensteinDescription, frankensteinTitle, loadFrankensteinAssets, visionTask } from '../data/frankenstein'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Check, Lightbulb, ListTodo, Plus, X } from 'lucide-react'
import { DocumentEditor } from '../components/DocumentEditor'
import { NotesWorkspace } from '../components/CreativeWorkspaces'
import type { StickyNote } from '../components/CreativeWorkspaces'
import { AgentWorkspace } from '../components/AgentWorkspace'
import type { AgentProjectLink, AgentProjectOpen } from '../components/AgentWorkspace'
import { FloatingNav } from '../components/FloatingNav'
import type { ActivePanel } from '../components/FloatingNav'
import { SettingsDrawer } from '../components/SettingsDrawer'
import { LibraryWorkspace } from '../components/LibraryWorkspace'
import { ProjectNetwork } from '../components/ProductionWorkspaces'
import { useLibraryAssets } from '../data/libraryStore'
import { useLocalStorage } from '../data/useLocalStorage'
import { useWorksDocuments } from '../data/works'
import type { WorkDocument } from '../data/works'
import { createAssetFromFile, documentToLibraryAsset } from '../data/library'
import { taskStatusOf, useProjects } from '../data/projects'
import type { Project, Task } from '../data/projects'
import type { AgentConfig } from '../data/agent'
import { downloadOnlineMedia } from '../data/media'
import type { AgentMediaResult } from '../data/media'
import '../App.css'
import '../Workspace.css'
import '../CreativeFlow.css'
import '../RealWorkbench.css'
import '../WorkbenchLayout.css'
import '../ProjectWorkspace.css'
import '../AtelierFinal.css'

const pageTitles: Record<ActivePanel, { title: string; english: string }> = {
  agent: { title: t("对话"), english: 'Agent' },
  library: { title: t("档案室"), english: 'Archive' },
  network: { title: t("项目星云"), english: 'Nebula' },
}

type UtilityPanel = 'notes' | 'today' | null

export default function Atelier() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [importingSample, setImportingSample] = useState(false)
  const [panel, setPanel] = useState<ActivePanel>('agent')
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel>(null)
  const [libraryView, setLibraryView] = useState<'library' | 'board'>('library')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tasks, setTasks] = useLocalStorage<Task[]>('motif-tasks-v2', [])
  const [notes, setNotes] = useLocalStorage<StickyNote[]>('motif-notes-v2', [])
  const [documents, setDocuments] = useWorksDocuments()
  const [projects, setProjects] = useProjects()
  const [storedProjectId, setStoredProjectId] = useLocalStorage('motif-active-project-v1', '')
  const activeProjectId = storedProjectId || undefined
  const [projectComposerOpen, setProjectComposerOpen] = useState(false)
  const [projectThreadId, setProjectThreadId] = useState<string>()
  const [projectDraft, setProjectDraft] = useState({ name: '', description: '', domains: '' })
  const [taskComposer, setTaskComposer] = useState<{ open: boolean; projectId: string; label: string }>({ open: false, projectId: '', label: '' })
  const [notice, setNotice] = useState('')
  const { assets: storedAssets, setAssets: setLibraryAssets, storageReady } = useLibraryAssets(setNotice)
  const libraryAssets = useMemo(() => [...storedAssets.filter((asset) => !documents.some((document) => document.id === asset.id)), ...documents.map(documentToLibraryAsset)], [storedAssets, documents])
  const [annotations, setAnnotations] = useState(() => localStorage.getItem('motif-annotations') !== 'false')
  const [quietMotion, setQuietMotion] = useLocalStorage('motif-quiet-motion', false)
  const [agentLaunch, setAgentLaunch] = useState<{ id: number; text: string } | null>(null)
  const [projectLink, setProjectLink] = useState<AgentProjectLink>(null)
  const [projectOpen, setProjectOpen] = useState<AgentProjectOpen>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(() => ({
    baseUrl: portfolioDemo ? 'https://api.openai.com/v1' : localStorage.getItem('motif-agent-url') || 'https://api.moonshot.cn/v1',
    model: portfolioDemo ? demoModel : localStorage.getItem('motif-agent-model') || 'kimi-k3.1-pro',
    apiKey: '',
  }))

  const setActiveProject = useCallback((id?: string) => setStoredProjectId(id ?? ''), [setStoredProjectId])
  const handleCurrentThreadChange = useCallback(() => { /* The selected thread owns its own project relation. */ }, [])
  const onThreadProjectChange = useCallback((threadId: string, projectId?: string) => {
    setProjects((current) => {
      let changed = false
      const next = current.map((project) => {
        const without = project.conversationIds.filter((id) => id !== threadId)
        const conversationIds = project.id === projectId ? [...without, threadId] : without
        const projectChanged = conversationIds.length !== project.conversationIds.length || (project.id === projectId && !project.conversationIds.includes(threadId))
        if (projectChanged) changed = true
        return projectChanged ? { ...project, conversationIds, updatedAt: Date.now() } : project
      })
      return changed ? next : current
    })
  }, [setProjects])

  useEffect(() => { localStorage.setItem('motif-annotations', String(annotations)) }, [annotations])
  useEffect(() => {
    if (!storageReady) return
    const assetIds = new Set(libraryAssets.map((asset) => asset.id))
    const documentIds = new Set(documents.map((document) => document.id))
    setProjects((current) => {
      let changed = false
      const next = current.map((project) => {
        const nextAssets = project.assetIds.filter((id) => assetIds.has(id))
        const nextDocuments = project.documentIds.filter((id) => documentIds.has(id))
        if (nextAssets.length !== project.assetIds.length || nextDocuments.length !== project.documentIds.length) {
          changed = true
          return { ...project, assetIds: nextAssets, documentIds: nextDocuments }
        }
        return project
      })
      return changed ? next : current
    })
  }, [documents, libraryAssets, setProjects, storageReady])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProjectComposerOpen(false)
        setTaskComposer((current) => ({ ...current, open: false }))
        setUtilityPanel(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const openPanel = (next: ActivePanel) => {
    setPanel(next)
    setUtilityPanel(null)
    setNotice('')
  }
  const openLibrary = (projectId?: string) => {
    if (projectId) setActiveProject(projectId)
    openPanel('library')
  }
  const openProjectConversation = (projectId?: string, fresh = false) => {
    if (projectId) {
      setActiveProject(projectId)
      setProjectOpen({ id: Date.now(), projectId, fresh })
    }
    openPanel('agent')
  }
  const saveAgentConfig = (next: AgentConfig) => {
    setAgentConfig(next)
    localStorage.setItem('motif-agent-url', next.baseUrl)
    localStorage.setItem('motif-agent-model', next.model)
  }
  const clearAgentKey = () => {
    setAgentConfig((current) => ({ ...current, apiKey: '' }))
    setNotice(t("API Key 已从当前页面内存清除，项目创作流程已暂停。"))
  }
  const toggleTask = (id: number) => setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done, status: task.done ? 'todo' : 'done' } : task))
  const addTask = (label: string, projectId?: string, dueDate?: string) => {
    if (label.trim()) setTasks((current) => [...current, { id: current.reduce((id, task) => Math.max(id, task.id + 1), Date.now()), label: label.trim(), done: false, status: 'todo', projectId, dueDate, createdAt: Date.now() }])
  }
  const removeTask = (id: number) => setTasks((current) => current.filter((task) => task.id !== id))
  const completedTasks = tasks.filter((task) => task.done).length
  const openProjectComposer = (threadId?: string) => {
    setProjectThreadId(threadId)
    setProjectDraft({ name: '', description: '', domains: '' })
    setProjectComposerOpen(true)
  }
  const createProject = (event: FormEvent) => {
    event.preventDefault()
    if (!projectDraft.name.trim()) return
    const now = Date.now()
    const project: Project = { id: crypto.randomUUID(), name: projectDraft.name.trim(), description: projectDraft.description.trim(), stage: 'inspiration', domains: [...new Set(projectDraft.domains.split(/[，,]/).map((item) => item.trim()).filter(Boolean))], assetIds: [], documentIds: [], conversationIds: [], createdAt: now, updatedAt: now }
    setProjects((current) => [project, ...current])
    setActiveProject(project.id)
    if (projectThreadId) setProjectLink({ id: now, threadId: projectThreadId, projectId: project.id })
    setProjectComposerOpen(false)
    setNotice(projectThreadId ? `项目「${project.name}」已创建，并关联到当前对话。` : `项目文件夹「${project.name}」已创建。`)
  }
  const deleteProject = (id: string) => {
    setProjects((current) => current.filter((project) => project.id !== id))
    setTasks((current) => current.map((task) => task.projectId === id ? { ...task, projectId: undefined } : task))
    if (activeProjectId === id) setActiveProject(undefined)
    setNotice(t("项目文件夹已删除，文件、文稿与对话仍保留。"))
  }
  const openTaskComposer = (projectId?: string, draft = '') => setTaskComposer({ open: true, projectId: projectId ?? '', label: draft })
  const createTask = (event: FormEvent) => {
    event.preventDefault()
    if (!taskComposer.label.trim()) return
    addTask(taskComposer.label, taskComposer.projectId || undefined)
    setNotice(taskComposer.projectId ? t("任务已加入项目。") : t("独立任务已加入待办清单。"))
    setTaskComposer({ open: false, projectId: '', label: '' })
  }
  const createDocumentForProject = (projectId?: string) => {
    const project = projects.find((item) => item.id === projectId)
    const document: WorkDocument = { id: crypto.randomUUID(), title: t("未命名文稿"), content: '', tags: project?.domains ?? [], updatedAt: Date.now() }
    setDocuments((current) => [document, ...current])
    if (projectId) setProjects((current) => current.map((item) => item.id === projectId ? { ...item, documentIds: [document.id, ...item.documentIds], updatedAt: Date.now() } : item))
    return document
  }
  const saveAgentDocument = (text: string, projectId?: string) => {
    const project = projects.find((item) => item.id === projectId)
    const title = text.split('\n').map((line) => line.replace(/^#+\s*/, '').trim()).find(Boolean)?.slice(0, 80) || 'Agent 文稿'
    const existing = portfolioDemo && documents.find((item) => item.title === title && project?.documentIds.includes(item.id))
    if (existing) return existing
    const document: WorkDocument = { id: crypto.randomUUID(), title, content: text, tags: project?.domains ?? [], updatedAt: Date.now() }
    setDocuments((current) => [document, ...current])
    if (projectId) setProjects((current) => current.map((item) => item.id === projectId ? { ...item, documentIds: [document.id, ...item.documentIds], updatedAt: Date.now() } : item))
    setNotice(project ? isEnglish ? `Draft saved to ${project.name}.` : `文稿已保存，并归入「${project.name}」。` : t("文稿已保存到档案室。"))
    return document
  }
  const saveAgentMedia = async (media: AgentMediaResult, projectId?: string) => {
    const project = projects.find((item) => item.id === projectId)
    const existing = portfolioDemo ? storedAssets.find((item) => item.id.startsWith('frankenstein-source-') && item.sourceUrl === media.sourceUrl && item.kind === media.kind) : undefined
    const asset = existing ?? {
      ...await createAssetFromFile(await downloadOnlineMedia(media), media.kind),
      tags: project?.domains ?? [], sourceUrl: media.sourceUrl, license: media.license,
    }
    if (!existing) setLibraryAssets((current) => [asset, ...current])
    if (projectId) setProjects((current) => current.map((item) => item.id === projectId ? { ...item, assetIds: [...new Set([asset.id, ...item.assetIds])], updatedAt: Date.now() } : item))
    setNotice(project ? isEnglish ? `Media saved to ${project.name}.` : `素材已收入「${project.name}」，可前往档案室整理。` : t("素材已保存到档案室。"))
    return asset
  }

  const importFrankenstein = async () => {
    setImportingSample(true)
    try {
      const assets = await loadFrankensteinAssets()
      const id = projects.find((project) => project.name === frankensteinTitle || project.name === t("从弗兰肯斯坦到幻视") || project.name === 'From Frankenstein to Vision')?.id ?? 'frankenstein-to-vision'
      const now = Date.now()
      const duplicateIds = new Map<string, string>()
      if (portfolioDemo) {
        for (const saved of storedAssets) {
          if (!saved.id.startsWith('upload-') || !saved.file || ![t("公版标记见来源页"), 'See source for public-domain status'].includes(saved.license ?? '')) continue
          const match = assets.find((item) => item.sourceUrl === saved.sourceUrl && (
            (item.name === t(saved.name) && item.file?.size === saved.file?.size) ||
            (item.kind === 'video' && saved.name === '1910 年《弗兰肯斯坦》完整短片.ogv' && saved.file?.size === 55188484)
          ))
          if (match) duplicateIds.set(saved.id, match.id)
        }
      }
      setLibraryAssets((current) => [
        ...current.filter((asset) => !duplicateIds.has(asset.id) && !assets.some((incoming) => incoming.id === asset.id)),
        ...assets,
      ])
      setProjects((current) => {
        current = current.map((project) => project.assetIds.some((assetId) => duplicateIds.has(assetId))
          ? { ...project, assetIds: [...new Set(project.assetIds.map((assetId) => duplicateIds.get(assetId) ?? assetId))] }
          : project)
        const existing = current.find((project) => project.id === id)
        const assetIds = [...new Set([...(existing?.assetIds ?? []), ...assets.map((asset) => asset.id)])]
        if (existing) return current.map((project) => project.id === id ? { ...project, name: frankensteinTitle, domains: portfolioDemo ? [t("文学"), t("电影"), t("人造生命")] : project.domains, description: portfolioDemo || project.description === "比较创造者的责任、被造物的自主选择与归属。以雪莱原著、1910 年电影及 Marvel 的幻视资料为研究起点。" ? frankensteinDescription : project.description, assetIds, updatedAt: now } : project)
        return [{
          id, name: frankensteinTitle, description: frankensteinDescription,
          stage: 'collecting', domains: [t("文学"), t("电影"), t("人造生命")], assetIds, documentIds: [], conversationIds: [],
          createdAt: now, updatedAt: now,
        }, ...current]
      })
      setTasks((current) => {
        const previous = current.find((task) => task.projectId === id && /^(幻视研究：|Vision research:)/.test(task.label))
        if (previous) return previous.label === visionTask ? current : current.map((task) => task.id === previous.id ? { ...task, label: visionTask } : task)
        const taskId = current.reduce((max, task) => Math.max(max, task.id + 1), now)
        return [...current, { id: taskId, label: visionTask, done: false, status: 'todo', projectId: id, createdAt: now }]
      })
      if (portfolioDemo) openProjectConversation(id, true)
      else openLibrary(id)
      setNotice(t("研究项目已入档：3 张图片、1 部完整短片和 3 份研究资料。"))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("导入失败，请重试。"))
    } finally {
      setImportingSample(false)
    }
  }

  const editingId = searchParams.get('document')
  const editingDocument = documents.find((document) => document.id === editingId)
  const openDocument = (id: string) => {
    const upload = storedAssets.find((asset) => asset.id === id)
    if (upload && upload.kind === 'document' && upload.content !== undefined) {
      setDocuments((current) => current.some((item) => item.id === id) ? current : [...current, {
        id, title: upload.name.replace(/\.(md|markdown|txt)$/i, ''), content: upload.content ?? '', tags: upload.tags, updatedAt: Date.now(),
      }])
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('document', id)
      return next
    }, { replace: true })
  }
  const closeDocument = () => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    next.delete('document')
    return next
  }, { replace: true })
  const currentTitle = panel === 'library' && libraryView === 'board' ? { title: t("视觉板"), english: 'Vision Board' } : pageTitles[panel]

  return (
    <div className={`atelier has-active-panel ${annotations ? '' : 'hide-annotations'} ${quietMotion ? 'quiet-motion' : ''}`}>
      <div className="wash wash-iris" aria-hidden="true" /><div className="wash wash-pond" aria-hidden="true" /><div className="paper-grain" aria-hidden="true" />
      <header className="topbar" aria-label={t("工作台悬浮导航")}>
        <div className="topbar-leading">
          <button className="brand" onClick={() => navigate('/')} aria-label={t("返回房间首页")}><span className="brand-name">MOTIF</span></button>
          <FloatingNav activePanel={panel} onSelect={openPanel} />
        </div>
        <div className="topbar-page-title" aria-live="polite"><strong>{currentTitle.title}</strong>{currentTitle.title !== currentTitle.english && <span>{currentTitle.english}</span>}</div>
        <div className="topbar-right">
          {(portfolioDemo || new URLSearchParams(window.location.search).has('frankenstein')) && <button type="button" className="topbar-utility-button" disabled={!storageReady || importingSample} onClick={() => void importFrankenstein()}>{importingSample ? t("正在导入真实素材…") : portfolioDemo ? t("打开《从弗兰肯斯坦到幻视》") : t("导入《从弗兰肯斯坦到幻视》")}</button>}
          <button className={`topbar-utility-button ${utilityPanel === 'notes' ? 'active' : ''}`} onClick={() => setUtilityPanel((current) => current === 'notes' ? null : 'notes')} aria-label={t("即时灵感")} aria-expanded={utilityPanel === 'notes'} aria-controls="motif-utility-drawer"><Lightbulb size={15} /><span>{t("即时灵感")}</span><b>{notes.length || ''}</b></button>
          <button className={`topbar-utility-button ${utilityPanel === 'today' ? 'active' : ''}`} onClick={() => setUtilityPanel((current) => current === 'today' ? null : 'today')} aria-label={t("待办清单")} aria-expanded={utilityPanel === 'today'} aria-controls="motif-utility-drawer"><ListTodo size={15} /><span>{t("待办清单")}</span><b>{tasks.filter((task) => !task.done).length || ''}</b></button>
          <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} trigger={<button type="button" className="settings-trigger" aria-label={t("打开设置")} aria-expanded={settingsOpen} aria-controls="motif-settings-drawer" title={t("设置")}><span className="transparent-pen" aria-hidden="true"><i /><b /></span></button>} annotations={annotations} onToggleAnnotations={() => setAnnotations((value) => !value)} quietMotion={quietMotion} onToggleQuietMotion={() => setQuietMotion((value) => !value)} config={agentConfig} onSave={saveAgentConfig} onClearKey={clearAgentKey} onNotice={setNotice} />
          <DisplayMenu />
        </div>
      </header>

      <main className={`studio-main atelier-function-main workspace-${panel}`} id="atelier-workspace">
        <div className="atelier-function-surface" aria-label={`${currentTitle.title} ${t("工作区")}`}>
          {panel === 'library' && <LibraryWorkspace assets={storedAssets} setAssets={setLibraryAssets} documents={documents} setDocuments={setDocuments} projects={projects} setProjects={setProjects} activeProjectId={activeProjectId} onActiveProjectChange={setActiveProject} onRequestNewProject={() => openProjectComposer()} onDeleteProject={deleteProject} storageReady={storageReady} annotations={annotations} onNotice={setNotice} onViewChange={setLibraryView} onEditDocument={openDocument} />}
          {panel === 'network' && <ProjectNetwork assets={libraryAssets} documents={documents} projects={projects} onOpenProject={openProjectConversation} />}
          {panel === 'agent' && <AgentWorkspace assets={libraryAssets} config={agentConfig} launch={agentLaunch} onLaunchHandled={() => setAgentLaunch(null)} onOpenLibrary={openLibrary} onOpenSettings={() => setSettingsOpen(true)} projects={projects} onActiveProjectChange={setActiveProject} onRequestNewProject={openProjectComposer} onRequestNewTask={openTaskComposer} onSaveDocument={saveAgentDocument} onSaveMedia={saveAgentMedia} onCreateDocument={createDocumentForProject} onThreadProjectChange={onThreadProjectChange} onCurrentThreadChange={handleCurrentThreadChange} projectLink={projectLink} onProjectLinkHandled={() => setProjectLink(null)} projectOpen={projectOpen} onProjectOpenHandled={() => setProjectOpen(null)} documents={documents} onEditDocument={openDocument} onNotice={setNotice} />}
        </div>
      </main>

      {utilityPanel && <div className="utility-layer">
        <button className="utility-backdrop" onClick={() => setUtilityPanel(null)} aria-label={t("收起浮层")} />
        <aside id="motif-utility-drawer" className={`utility-drawer utility-${utilityPanel}`} aria-label={utilityPanel === 'notes' ? t("即时灵感") : t("待办清单")}>
          <header><div><span>{utilityPanel === 'notes' ? 'QUICK NOTES' : 'YOUR TASKS'}</span><h2>{utilityPanel === 'notes' ? t("即时灵感") : t("待办清单")}</h2></div><button onClick={() => setUtilityPanel(null)} aria-label={t("收起浮层")}><X size={17} /></button></header>
          <div className="utility-drawer-content">
            {utilityPanel === 'notes' ? <NotesWorkspace notes={notes} setNotes={setNotes} onNotice={setNotice} onCreateTask={addTask} /> : <><div className="utility-task-progress"><span>{completedTasks}/{tasks.length} {t("已完成")}</span><i><b style={{ width: `${tasks.length ? completedTasks / tasks.length * 100 : 0}%` }} /></i></div><TaskList tasks={tasks} toggleTask={toggleTask} addTask={addTask} removeTask={removeTask} projects={projects} updateTask={(id, details) => setTasks((current) => current.map((task) => task.id === id ? { ...task, ...details } : task))} restoreTask={(task) => setTasks((current) => current.some((item) => item.id === task.id) ? current : [...current, task])} /></>}
          </div>
        </aside>
      </div>}

      {editingDocument && <DocumentEditor key={editingDocument.id} document={editingDocument}
        onUpdate={(patch) => setDocuments((current) => current.map((item) => item.id === editingId ? { ...item, ...patch, updatedAt: Date.now() } : item))}
        onDelete={() => {
          setDocuments((current) => current.filter((item) => item.id !== editingId))
          setLibraryAssets((current) => current.filter((item) => item.id !== editingId))
          closeDocument()
        }}
        onClose={closeDocument} onNotice={setNotice} />}
      {projectComposerOpen && <div className="work-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProjectComposerOpen(false) }}><section className="work-modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title"><button className="work-modal-close" onClick={() => setProjectComposerOpen(false)} aria-label={t("关闭新建项目")}><X size={16} /></button><span>NEW PROJECT · LOCAL</span><h2 id="new-project-title">{projectThreadId ? t("新建并关联项目") : t("新建项目文件夹")}</h2><form onSubmit={createProject}><label>{t("项目名称")}<input autoFocus value={projectDraft.name} onChange={(event) => setProjectDraft((current) => ({ ...current, name: event.target.value }))} placeholder={t("例如：人造生命与数字亲密")} required /></label><label>{t("项目说明")}<textarea value={projectDraft.description} onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))} placeholder={t("目标、问题或下一步…")} rows={3} /></label><label>{t("领域")}<input value={projectDraft.domains} onChange={(event) => setProjectDraft((current) => ({ ...current, domains: event.target.value }))} placeholder={t("文学，影像，人机传播")} /></label><button className="workspace-primary" type="submit" disabled={!projectDraft.name.trim()}><Plus size={15} />{projectThreadId ? t("创建并关联对话") : t("创建文件夹")}</button></form></section></div>}
      {taskComposer.open && <div className="work-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTaskComposer((current) => ({ ...current, open: false })) }}><section className="work-modal work-modal-task" role="dialog" aria-modal="true" aria-labelledby="new-task-title"><button className="work-modal-close" onClick={() => setTaskComposer((current) => ({ ...current, open: false }))} aria-label={t("关闭新建任务")}><X size={16} /></button><span>NEW TASK · LOCAL</span><h2 id="new-task-title">{t("新建任务")}</h2><form onSubmit={createTask}><label>{t("任务内容")}<textarea autoFocus value={taskComposer.label} onChange={(event) => setTaskComposer((current) => ({ ...current, label: event.target.value }))} placeholder={t("写下一个可以执行的动作…")} rows={4} required /></label><label>{t("归入项目")}<select value={taskComposer.projectId} onChange={(event) => setTaskComposer((current) => ({ ...current, projectId: event.target.value }))}><option value="">{t("独立待办，不归入项目")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><button className="workspace-primary" type="submit" disabled={!taskComposer.label.trim()}><Plus size={15} />{t("创建任务")}</button></form></section></div>}
      <div className="notice" aria-live="polite">{notice}</div>
    </div>
  )
}


type TaskDetails = Pick<Task, 'label' | 'projectId' | 'dueDate'>
type TaskListProps = {
  tasks: Task[]
  projects: Project[]
  toggleTask: (id: number) => void
  addTask: (label: string, projectId?: string, dueDate?: string) => void
  removeTask: (id: number) => void
  updateTask: (id: number, details: TaskDetails) => void
  restoreTask: (task: Task) => void
}

function TaskList({ tasks, toggleTask, addTask, removeTask, projects, updateTask, restoreTask }: TaskListProps) {
  const [draft, setDraft] = useState('')
  const [projectId, setProjectId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all')
  const [removed, setRemoved] = useState<Task | null>(null)
  const date = new Date()
  const today = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part) => String(part).padStart(2, '0')).join('-')
  const visibleTasks = tasks.filter((task) => filter === 'all' || (taskStatusOf(task) === 'done') === (filter === 'done'))
  const reset = () => {
    setDraft('')
    setProjectId('')
    setDueDate('')
    setEditingId(null)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const label = draft.trim()
    if (!label) return
    if (editingId === null) {
      addTask(label, projectId || undefined, dueDate || undefined)
      if (filter === 'done') setFilter('open')
    } else {
      updateTask(editingId, { label, projectId: projectId || undefined, dueDate: dueDate || undefined })
    }
    reset()
  }
  return <div className="task-list utility-task-list">
    <form className="utility-task-form" onSubmit={submit}>
      <div className="task-add">
        <label className="sr-only" htmlFor="new-task">{editingId === null ? t("新任务") : t("任务名称")}</label>
        <input id="new-task" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={editingId === null ? t("添加一项任务…") : t("修改任务…")} />
        <button type="submit" disabled={!draft.trim()} aria-label={editingId === null ? t("添加任务") : t("保存任务")}>{editingId === null ? <Plus size={14} /> : <Check size={14} />}</button>
      </div>
      <div className="task-details-fields">
        <label>{t("所属项目")}<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{t("独立任务")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label>{t("截止日期")}<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      </div>
      {editingId !== null && <button type="button" onClick={reset}>{t("取消编辑")}</button>}
    </form>
    <div className="utility-filters" role="group" aria-label={t("按任务状态筛选")}>
      {([['all', t("全部")], ['open', t("未完成")], ['done', t("已完成")]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
    </div>
    {removed && <div className="utility-undo" role="status">{t("任务已删除")} <button type="button" onClick={() => { restoreTask(removed); setRemoved(null) }}>{t("撤销删除任务")}</button></div>}
    {visibleTasks.map((task) => {
      const done = taskStatusOf(task) === 'done'
      const overdue = !done && task.dueDate && task.dueDate < today
      return <div className={done ? 'task-item done' : 'task-item'} key={task.id}>
        <label><input type="checkbox" checked={done} onChange={() => toggleTask(task.id)} /><span className="custom-check">{done && <Check size={12} />}</span>
          <span>{task.label}{task.projectId && <small className="task-project-mark">{projects.find((project) => project.id === task.projectId)?.name || t("项目")}</small>}{task.dueDate && <small className="task-project-mark" data-overdue={Boolean(overdue)}>{overdue ? t('已逾期 ·') + ' ' : t('截止 ·') + ' '}{task.dueDate}</small>}</span>
        </label>
        <button type="button" className="utility-edit-task" aria-label={t("编辑任务：") + task.label} onClick={() => { setEditingId(task.id); setDraft(task.label); setProjectId(task.projectId || ''); setDueDate(task.dueDate || ''); document.getElementById('new-task')?.focus() }}>{t("编辑")}</button>
        <button type="button" aria-label={t("删除任务：") + task.label} onClick={() => { setRemoved(task); removeTask(task.id); if (editingId === task.id) reset() }}><X size={12} /></button>
      </div>
    })}
    {!visibleTasks.length && <p className="task-empty">{tasks.length ? t("当前筛选下没有任务。") : t("还没有任务，在上方添加第一项。")}</p>}
  </div>
}



import { t } from '../data/language'
import { useState } from 'react'
import type { Dispatch, DragEvent, SetStateAction } from 'react'
import { ArrowDownToLine, Bot, Check, ChevronRight, Circle, FileText, FolderKanban, Image as ImageIcon, Library, Link2, Loader, MessageCircle, Plus, Trash2, X } from 'lucide-react'
import type { LibraryAsset } from '../data/library'
import { downloadText } from '../data/library'
import type { Project, ProjectStage, Task, TaskStatus } from '../data/projects'
import { projectStages, taskStatusOf } from '../data/projects'
import type { WorkDocument } from '../data/works'

const taskColumns: { id: TaskStatus; label: string; icon: typeof Circle }[] = [
  { id: 'todo', label: t("待办"), icon: Circle },
  { id: 'doing', label: t("进行中"), icon: Loader },
  { id: 'done', label: t("已完成"), icon: Check },
]

type ProjectWorkspaceProps = {
  projects: Project[]
  setProjects: Dispatch<SetStateAction<Project[]>>
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[]>>
  assets: LibraryAsset[]
  documents: WorkDocument[]
  setDocuments: Dispatch<SetStateAction<WorkDocument[]>>
  activeProjectId?: string
  onActiveProjectChange: (id: string) => void
  onRequestNewProject: () => void
  onRequestNewTask: (projectId?: string) => void
  onOpenAgent: () => void
  onOpenLibrary: () => void
  onEditDocument: (id: string) => void
  onNotice: (message: string) => void
}

export function ProjectWorkspace({ projects, setProjects, tasks, setTasks, assets, documents, setDocuments, activeProjectId, onActiveProjectChange, onRequestNewProject, onRequestNewTask, onOpenAgent, onOpenLibrary, onEditDocument, onNotice }: ProjectWorkspaceProps) {
  const [assetToAdd, setAssetToAdd] = useState('')
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const active = projects.find((project) => project.id === activeProjectId) ?? projects[0]
  const projectTasks = active ? tasks.filter((task) => task.projectId === active.id) : []
  const completed = projectTasks.filter((task) => taskStatusOf(task) === 'done').length
  const progress = projectTasks.length ? Math.round(completed / projectTasks.length * 100) : 0
  const projectAssets = active ? assets.filter((asset) => active.assetIds.includes(asset.id)) : []
  const projectDocuments = active ? documents.filter((document) => active.documentIds.includes(document.id)) : []
  const availableAssets = active ? assets.filter((asset) => !active.assetIds.includes(asset.id)) : []

  const updateActive = (patch: Partial<Project>) => {
    if (!active) return
    setProjects((current) => current.map((project) => project.id === active.id ? { ...project, ...patch, updatedAt: Date.now() } : project))
  }
  const updateTaskStatus = (id: number, status: TaskStatus) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status, done: status === 'done' } : task))
    if (active) setProjects((current) => current.map((project) => project.id === active.id ? { ...project, updatedAt: Date.now() } : project))
  }
  const dropTask = (event: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    event.preventDefault()
    setDragOver(null)
    const id = Number(event.dataTransfer.getData('application/x-motif-task'))
    if (id) updateTaskStatus(id, status)
  }
  const removeProject = () => {
    if (!active || !window.confirm(`删除项目「${active.name}」吗？项目任务会移到独立待办；素材、文稿与对话内容不会删除。`)) return
    setProjects((current) => current.filter((project) => project.id !== active.id))
    setTasks((current) => current.map((task) => task.projectId === active.id ? { ...task, projectId: undefined } : task))
    const next = projects.find((project) => project.id !== active.id)
    if (next) onActiveProjectChange(next.id)
    onNotice('项目已删除，原始素材与文稿仍保留。')
  }
  const addAsset = () => {
    if (!assetToAdd) return
    updateActive({ assetIds: [...new Set([...active!.assetIds, assetToAdd])] })
    setAssetToAdd('')
    onNotice('素材引用已加入项目，原文件仍只保存一份。')
  }
  const createDocument = () => {
    if (!active) return
    const document: WorkDocument = { id: crypto.randomUUID(), title: t("未命名文稿"), content: '', tags: active.domains, updatedAt: Date.now() }
    setDocuments((current) => [document, ...current])
    updateActive({ documentIds: [document.id, ...active.documentIds] })
    onEditDocument(document.id)
  }
  const exportProject = () => {
    if (!active) return
    const lines = [
      `# ${active.name}`, '', active.description || t("尚未填写项目说明。"), '',
      `阶段：${projectStages.find((stage) => stage.id === active.stage)?.label}`,
      `领域：${active.domains.join('、') || t("未设置")}`,
      `进度：${progress}%（${completed}/${projectTasks.length} 项任务）`, '',
      t("## 任务"), ...(projectTasks.length ? projectTasks.map((task) => `- [${taskStatusOf(task) === 'done' ? 'x' : ' '}] ${task.label}｜${taskColumns.find((column) => column.id === taskStatusOf(task))?.label}`) : [t("- 暂无")]), '',
      t("## 素材引用"), ...(projectAssets.length ? projectAssets.map((asset) => `- ${asset.name}｜${asset.kind}｜${asset.tags.join('、') || t("无标签")}`) : [t("- 暂无")]), '',
      t("## 文稿"), ...(projectDocuments.length ? projectDocuments.map((document) => `- ${document.title || t("未命名文稿")}｜${document.content.length} 字符`) : [t("- 暂无")]),
    ]
    downloadText(`${active.name || 'MOTIF 项目'}-项目索引.md`, lines.join('\n'))
    onNotice('项目索引已导出为 Markdown；素材与文稿可从各自工作区导出原文件。')
  }

  return (
    <div className="projects-workspace">
      <aside className="projects-overview">
        <header><div><h2>{t("项目")} <em>Projects</em></h2><span>{projects.length.toString().padStart(2, '0')} ACTIVE ARCHIVES</span></div></header>
        <button className="project-create-main" onClick={onRequestNewProject}><Plus size={15} /> {t("新建项目")}</button>
        <div className="projects-overview-list">
          {projects.map((project) => {
            const ownTasks = tasks.filter((task) => task.projectId === project.id)
            const ownDone = ownTasks.filter((task) => taskStatusOf(task) === 'done').length
            const ownProgress = ownTasks.length ? Math.round(ownDone / ownTasks.length * 100) : 0
            return <button key={project.id} className={active?.id === project.id ? 'active' : ''} onClick={() => onActiveProjectChange(project.id)}>
              <span className="project-list-top"><small>{projectStages.find((stage) => stage.id === project.stage)?.english}</small><b>{ownProgress}%</b></span>
              <strong>{project.name || t("未命名项目")}</strong>
              <span className="project-list-meta">{project.assetIds.length} 素材 · {project.documentIds.length} 文稿 · {ownTasks.length} {t("任务")}</span>
              <i><b style={{ width: `${ownProgress}%` }} /></i>
            </button>
          })}
        </div>
        {!projects.length && <div className="projects-empty-shelf"><FolderKanban size={26} strokeWidth={1} /><p>{t("从一个真实项目开始。")}</p><small>{t("任务、素材、文稿和 Agent 对话会在这里汇合。")}</small></div>}
        <button className="projects-independent-tasks" onClick={() => onRequestNewTask()}><Plus size={13} /> {t("独立任务")}</button>
      </aside>

      {active ? <section className="project-canvas">
        <header className="project-canvas-heading">
          <div className="project-title-block"><span>PROJECT CANVAS · LOCAL</span><input value={active.name} onChange={(event) => updateActive({ name: event.target.value })} aria-label={t("项目名称")} placeholder={t("未命名项目")} /><input className="project-domain-input" value={active.domains.join('，')} onChange={(event) => updateActive({ domains: [...new Set(event.target.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean))] })} aria-label={t("项目领域，用逗号分隔")} placeholder={t("添加领域，用逗号分隔")} /></div>
          <div className="project-heading-actions"><label><span className="sr-only">{t("项目阶段")}</span><select value={active.stage} onChange={(event) => updateActive({ stage: event.target.value as ProjectStage })}>{projectStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label} · {stage.english}</option>)}</select></label><button onClick={onOpenAgent}><Bot size={14} />{t("对话")}</button><button onClick={exportProject} aria-label={t("导出项目索引")} title={t("导出项目索引")}><ArrowDownToLine size={15} /></button><button onClick={removeProject} aria-label={t("删除项目")} title={t("删除项目")}><Trash2 size={15} /></button></div>
        </header>

        <div className="project-brief-strip"><label><span>{t("项目说明")}</span><input value={active.description} onChange={(event) => updateActive({ description: event.target.value })} placeholder={t("记录目标、下一步或当前问题…")} /></label><div className="project-progress-summary"><strong>{progress}<small>%</small></strong><span>{completed}/{projectTasks.length} {t("任务完成")}</span><i><b style={{ width: `${progress}%` }} /></i></div></div>

        <section className="project-task-canvas" aria-label={t("可拖动的项目任务画布")}>
          <div className="project-section-heading"><div><span>VISUAL WORKFLOW</span><h3>{t("任务画布")}</h3></div><button onClick={() => onRequestNewTask(active.id)}><Plus size={14} /> {t("新建任务")}</button></div>
          <div className="project-task-columns">
            {taskColumns.map((column) => {
              const Icon = column.icon
              const columnTasks = projectTasks.filter((task) => taskStatusOf(task) === column.id)
              return <div key={column.id} className={`project-task-column ${dragOver === column.id ? 'drag-over' : ''}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOver(column.id) }} onDragLeave={() => setDragOver(null)} onDrop={(event) => dropTask(event, column.id)}>
                <header><Icon size={13} /><strong>{column.label}</strong><span>{columnTasks.length}</span></header>
                <div className="project-task-card-list">{columnTasks.map((task) => <article className="project-task-card" key={task.id} draggable onDragStart={(event) => { event.dataTransfer.setData('application/x-motif-task', String(task.id)); event.dataTransfer.effectAllowed = 'move' }}>
                  <span className="task-drag-handle" aria-hidden="true">⠿</span><p>{task.label}</p>
                  <div><label><span className="sr-only">{t("更改任务状态")}</span><select value={taskStatusOf(task)} onChange={(event) => updateTaskStatus(task.id, event.target.value as TaskStatus)}>{taskColumns.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label><button onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))} aria-label={`删除任务${task.label}`} title={t("删除任务")}><X size={12} /></button></div>
                </article>)}{!columnTasks.length && <button className="project-task-empty" onClick={() => onRequestNewTask(active.id)}><Plus size={14} />{t("添加任务")}</button>}</div>
              </div>
            })}
          </div>
        </section>

        <div className="project-resource-grid">
          <section className="project-resource-panel">
            <div className="project-section-heading"><div><span>REFERENCES, NOT COPIES</span><h3>{t("项目素材")} <b>{projectAssets.length}</b></h3></div><button onClick={onOpenLibrary}><Library size={14} />{t("素材库")}</button></div>
            <div className="project-reference-picker"><label><span className="sr-only">{t("选择要加入项目的素材")}</span><select value={assetToAdd} onChange={(event) => setAssetToAdd(event.target.value)}><option value="">{t("选择素材…")}</option>{availableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.kind}</option>)}</select></label><button disabled={!assetToAdd} onClick={addAsset}><Link2 size={13} />{t("加入项目")}</button></div>
            <div className="project-asset-strip">{projectAssets.map((asset) => <article key={asset.id}>{asset.kind === 'image' ? <img src={asset.src} alt="" /> : <span><ImageIcon size={19} /></span>}<div><strong>{asset.name}</strong><small>{asset.kind === 'image' ? t("图片") : asset.kind === 'video' ? t("视频") : asset.kind === 'data' ? t("数据") : t("文稿")} · {asset.size}</small></div><button onClick={() => updateActive({ assetIds: active.assetIds.filter((id) => id !== asset.id) })} aria-label={`从项目移除${asset.name}的引用`} title={t("移出项目")}><X size={12} /></button></article>)}{!projectAssets.length && <p className="project-resource-empty">{t("从素材库加入图片、视频、文稿或数据，不复制原文件。")}</p>}</div>
          </section>
          <section className="project-resource-panel">
            <div className="project-section-heading"><div><span>DRAFTS & OUTCOMES</span><h3>{t("文稿与成果")} <b>{projectDocuments.length}</b></h3></div><button onClick={createDocument}><Plus size={14} />{t("新建文稿")}</button></div>
            <div className="project-document-list">{projectDocuments.map((document) => <button key={document.id} onClick={() => onEditDocument(document.id)}><FileText size={18} strokeWidth={1.2} /><span><strong>{document.title || t("未命名文稿")}</strong><small>{document.content.length} {t("字符")}</small></span><ChevronRight size={14} /></button>)}{!projectDocuments.length && <p className="project-resource-empty">{t("新建文稿后会自动归入当前项目，可编辑并导出 Markdown。")}</p>}</div>
          </section>
        </div>
        <footer className="project-canvas-footer"><span><MessageCircle size={13} />{active.conversationIds.length} 条项目对话</span></footer>
      </section> : <section className="project-canvas-empty"><FolderKanban size={42} strokeWidth={.9} /><h3>{t("让工作有一个可见的容器")}</h3><p>{t("新建项目后，可拖动任务、引用素材、写文稿，并继续 Agent 对话。")}</p><button className="workspace-primary" onClick={onRequestNewProject}><Plus size={15} /> {t("新建第一个项目")}</button></section>}
    </div>
  )
}

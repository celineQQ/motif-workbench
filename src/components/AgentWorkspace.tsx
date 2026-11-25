import { isEnglish, t } from '../data/language'
import { demoPrompt, portfolioDemo } from '../data/portfolioDemo'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { ArrowRight, ArrowUp, Check, ChevronDown, ExternalLink, FilePlus2, FileText, FolderKanban, Globe2, Image as ImageIcon, Library, ListPlus, MessageSquarePlus, PanelLeft, PanelRightClose, PanelRightOpen, Paperclip, PenLine, Plus, Settings2, Square, X } from 'lucide-react'
import { isAgentConfigured, streamAgent } from '../data/agent'
import type { AgentConfig, AgentSource } from '../data/agent'
import { searchOnlineMedia } from '../data/media'
import type { AgentMediaResult } from '../data/media'
import type { LibraryAsset } from '../data/library'
import type { Project } from '../data/projects'
import type { WorkDocument } from '../data/works'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { AgentMediaResults } from './AgentMediaResults'
import { StageActions, WorkflowSteps } from './AgentWorkflow'
import type { WorkflowStage } from './AgentWorkflow'

type StoredMessage = { id: number; role: 'assistant' | 'user'; text: string; referenceIds?: string[]; documentIds?: string[]; sources?: AgentSource[]; searched?: boolean; searchQueries?: string[]; error?: boolean; stage?: WorkflowStage; approved?: boolean; mediaResults?: AgentMediaResult[]; mediaQuery?: string }
type AgentThread = { id: string; title: string; projectId?: string; messages: StoredMessage[]; updatedAt: number }
type AgentStatus = 'submitted' | 'searching' | 'streaming' | 'ready' | 'error'
type AgentLaunch = { id: number; text: string } | null
export type AgentProjectLink = { id: number; threadId: string; projectId?: string } | null
export type AgentProjectOpen = { id: number; projectId: string; fresh?: boolean } | null

const prompts = [t("我要做一个研究项目"), t("我要策划一支短片"), t("我要做一张视觉板")]
const welcome = t("告诉我你想做什么。我们会按“预案 → 文稿 → 图片与视频”一步步完成，每一步都由你确认。")
const createThread = (projectId?: string): AgentThread => ({ id: crypto.randomUUID(), title: t("新对话"), projectId, messages: [{ id: 1, role: 'assistant', text: welcome }], updatedAt: Date.now() })

function suggestedMediaQuery(value: string) {
  const cleaned = value.trim()
    .replace(/^我要(?:做|策划|写|研究|创作)(?:一个|一份|一支|一张|一部)?/u, '')
    .replace(/^关于/u, '')
    .replace(/的(?:研究|项目|短片|视觉板|文稿|策划|创作)$/u, '')
    .replace(/[。！？!?]+$/g, '').trim()
  return cleaned || value.trim()
}

function plannedMediaQuery(text: string) {
  const match = text.match(/(?:媒体检索词|素材检索词|Media search)\s*[:：]\s*([^\n]+)/i)
  return match?.[1].split(/[;；，,]/).map((item) => item.trim()).find(Boolean)
}

function loadThreads(): AgentThread[] {
  try {
    const saved = localStorage.getItem('motif-agent-threads-v2')
    if (saved) {
      const threads = JSON.parse(saved) as AgentThread[]
      if (Array.isArray(threads) && threads.length) return threads
    }
    const previous = localStorage.getItem('motif-agent-current-thread-v1')
    if (previous) {
      const thread = JSON.parse(previous) as AgentThread
      if (thread.id && Array.isArray(thread.messages)) return [thread]
    }
  } catch { /* A damaged local cache should not block the workbench. */ }
  return [createThread()]
}

export function AgentWorkspace({ assets, config, launch, onLaunchHandled, onOpenLibrary, onOpenSettings, projects, onActiveProjectChange, onRequestNewProject, onRequestNewTask, onSaveDocument, onSaveMedia, onCreateDocument, onThreadProjectChange, onCurrentThreadChange, projectLink, onProjectLinkHandled, projectOpen, onProjectOpenHandled, documents, onEditDocument, onNotice }: {
  assets: LibraryAsset[]
  config: AgentConfig
  launch: AgentLaunch
  onLaunchHandled: () => void
  onOpenLibrary: (projectId?: string) => void
  onOpenSettings: () => void
  projects: Project[]
  onActiveProjectChange: (id?: string) => void
  onRequestNewProject: (threadId?: string) => void
  onRequestNewTask: (projectId?: string, draft?: string) => void
  onSaveDocument: (text: string, projectId?: string) => WorkDocument
  onSaveMedia: (media: AgentMediaResult, projectId?: string) => Promise<LibraryAsset>
  onCreateDocument: (projectId?: string) => WorkDocument
  onThreadProjectChange: (threadId: string, projectId?: string) => void
  onCurrentThreadChange: (threadId: string, projectId?: string) => void
  projectLink: AgentProjectLink
  onProjectLinkHandled: () => void
  projectOpen: AgentProjectOpen
  onProjectOpenHandled: () => void
  documents: WorkDocument[]
  onEditDocument: (id: string) => void
  onNotice: (message: string) => void
}) {
  const configured = isAgentConfigured(config)
  const [threads, setThreads] = useState<AgentThread[]>(loadThreads)
  const [activeThreadId, setActiveThreadId] = useState(() => localStorage.getItem('motif-agent-active-thread-v2') || threads[0].id)
  const [input, setInput] = useState('')
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const [threadsOpen, setThreadsOpen] = useState(() => window.matchMedia('(min-width: 641px)').matches)
  const [projectOnly, setProjectOnly] = useState(true)
  const [status, setStatus] = useState<AgentStatus>('ready')
  const [activeAssistantId, setActiveAssistantId] = useState<number | null>(null)
  const [savingMediaId, setSavingMediaId] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const handledLaunch = useRef<number | null>(null)
  const thread = threads.find((item) => item.id === activeThreadId) ?? threads[0]
  const busy = status === 'submitted' || status === 'searching' || status === 'streaming'
  const messages = thread.messages
  const currentProject = projects.find((project) => project.id === thread.projectId)
  const sortedThreads = [...threads].sort((a, b) => b.updatedAt - a.updatedAt)
  const projectAssets = currentProject ? assets.filter((asset) => currentProject.assetIds.includes(asset.id) && !currentProject.documentIds.includes(asset.id)) : []
  const projectDocuments = currentProject ? documents.filter((document) => currentProject.documentIds.includes(document.id)) : []
  const contextAssets = currentProject && projectOnly
    ? assets.filter((asset) => currentProject.assetIds.includes(asset.id) || currentProject.documentIds.includes(asset.id))
    : assets

  useEffect(() => { localStorage.setItem('motif-agent-threads-v2', JSON.stringify(threads)) }, [threads])
  useEffect(() => { localStorage.setItem('motif-agent-active-thread-v2', thread.id) }, [thread.id])
  useEffect(() => {
    onCurrentThreadChange(thread.id, thread.projectId)
    onActiveProjectChange(thread.projectId)
  }, [thread.id, thread.projectId, onActiveProjectChange, onCurrentThreadChange])
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100
    if (nearBottom) element.scrollTo({ top: element.scrollHeight, behavior: status === 'streaming' ? 'auto' : 'smooth' })
  }, [messages, status, thread.id])
  useEffect(() => () => abortRef.current?.abort(), [])

  const updateMessages = useCallback((threadId: string, updater: (current: StoredMessage[]) => StoredMessage[]) => {
    setThreads((current) => current.map((item) => item.id === threadId ? { ...item, messages: updater(item.messages), updatedAt: Date.now() } : item))
  }, [])
  const activateThread = useCallback((next: AgentThread) => {
    abortRef.current?.abort()
    abortRef.current = null
    setActiveThreadId(next.id)
    setInput('')
    setActiveAssistantId(null)
    setStatus('ready')
    onActiveProjectChange(next.projectId)
    onCurrentThreadChange(next.id, next.projectId)
  }, [onActiveProjectChange, onCurrentThreadChange])
  const linkProject = useCallback((projectId?: string) => {
    setThreads((current) => current.map((item) => item.id === thread.id ? { ...item, projectId, updatedAt: Date.now() } : item))
    onThreadProjectChange(thread.id, projectId)
    onCurrentThreadChange(thread.id, projectId)
    onActiveProjectChange(projectId)
  }, [onActiveProjectChange, onCurrentThreadChange, onThreadProjectChange, thread.id])

  useEffect(() => {
    if (thread.projectId && !projects.some((project) => project.id === thread.projectId)) linkProject(undefined)
  }, [projects, thread.projectId, linkProject])
  useEffect(() => {
    if (!projectLink) return
    setThreads((current) => current.map((item) => item.id === projectLink.threadId ? { ...item, projectId: projectLink.projectId, updatedAt: Date.now() } : item))
    onThreadProjectChange(projectLink.threadId, projectLink.projectId)
    if (projectLink.threadId === thread.id) {
      onCurrentThreadChange(thread.id, projectLink.projectId)
      onActiveProjectChange(projectLink.projectId)
    }
    onProjectLinkHandled()
  }, [projectLink, thread.id, onActiveProjectChange, onCurrentThreadChange, onProjectLinkHandled, onThreadProjectChange])
  useEffect(() => {
    if (!projectOpen) return
    const existing = projectOpen.fresh ? undefined : threads.filter((item) => item.projectId === projectOpen.projectId).sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (existing) activateThread(existing)
    else {
      const next = createThread(projectOpen.projectId)
      setThreads((current) => [next, ...current])
      onThreadProjectChange(next.id, projectOpen.projectId)
      activateThread(next)
    }
    setFilesOpen(true)
    onProjectOpenHandled()
  }, [projectOpen, threads, activateThread, onProjectOpenHandled, onThreadProjectChange])

  const runModel = useCallback(async (value: string, stage: 'plan' | 'draft', baseMessages: StoredMessage[]) => {
    const text = value.trim()
    if (!text || busy) return
    const threadId = thread.id
    const projectId = thread.projectId
    const stamp = Date.now()
    const answerId = stamp + 1
    const nextMessages: StoredMessage[] = [...baseMessages, { id: stamp, role: 'user', text }]
    setThreads((current) => current.map((item) => item.id === threadId ? { ...item, title: item.messages.some((message) => message.role === 'user') ? item.title : baseMessages.find((message) => message.role === 'user')?.text.slice(0, 32) || text.slice(0, 32), messages: nextMessages, updatedAt: stamp } : item))
    onThreadProjectChange(threadId, projectId)
    setInput('')
    if (!configured) {
      updateMessages(threadId, (current) => [...current, { id: answerId, role: 'assistant', text: isEnglish ? 'Connect a model in Settings to generate a plan and draft. Existing materials are available in Archive.' : '这个创作流程需要模型先给出预案和文稿。请在设置中连接模型接口；已有素材仍可在档案室直接管理。', error: true }])
      return
    }

    updateMessages(threadId, (current) => [...current, { id: answerId, role: 'assistant', text: '', stage }])
    setActiveAssistantId(answerId)
    setStatus('submitted')
    const controller = new AbortController()
    abortRef.current = controller
    let received = false
    const instruction = stage === 'plan'
      ? isEnglish ? 'Write a specific, actionable plan with the goal, steps and expected output. Do not draft the document yet. End with Media search: followed by an English search term.' : '【工作流指令】用户正在启动或修改一个创作／研究项目。只给出具体、可执行的预案，不要写完整文稿，不要声称已经检索或保存素材。预案包含目标、3—5 个步骤、预期文稿形式和后续图片／视频方向；如用户提出修改，吸收反馈并给出修订版。最后一行写“媒体检索词：关键词”，使用适合 Wikimedia Commons 的作品英文名、作者名或视觉主题词，不要添加其他后缀。'
      : isEnglish ? 'Write the approved draft in English Markdown with an H1 title. Do not search for media, invent references or ask for approval again.' : '【工作流指令】用户已经明确确认预案。现在根据已确认预案写一份可继续编辑的中文 Markdown 文稿初稿，标题使用一级标题。不要寻找图片或视频，不要编造来源链接，不要重复预案，也不要再询问是否确认。'
    try {
      const result = await streamAgent(config, [...nextMessages, { id: answerId + 2, role: 'user', text: instruction }], contextAssets, false, controller.signal, (delta) => {
        if (!received) {
          received = true
          setStatus('streaming')
        }
        updateMessages(threadId, (current) => current.map((message) => message.id === answerId ? { ...message, text: message.text + delta } : message))
      })
      let documentIds: string[] | undefined
      if (stage === 'draft' && result.text.trim()) {
        const document = onSaveDocument(result.text, projectId)
        documentIds = [document.id]
      }
      updateMessages(threadId, (current) => current.map((message) => message.id === answerId ? { ...message, stage, approved: false, sources: result.sources, searched: false, documentIds, mediaQuery: stage === 'plan' ? plannedMediaQuery(result.text) : message.mediaQuery } : message))
    } catch (error) {
      if (controller.signal.aborted) {
        if (!received) updateMessages(threadId, (current) => current.filter((message) => message.id !== answerId))
      } else {
        const detail = error instanceof Error ? error.message : t("模型请求失败，请检查接口配置。")
        setStatus('error')
        updateMessages(threadId, (current) => current.map((message) => message.id === answerId ? { ...message, text: detail, error: true } : message))
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setActiveAssistantId(null)
      setStatus((current) => current === 'error' ? 'error' : 'ready')
    }
  }, [busy, config, configured, contextAssets, onSaveDocument, onThreadProjectChange, thread, updateMessages])

  const send = useCallback(async (value = input) => {
    if (!value.trim() || busy) return
    const pending = [...messages].reverse().find((message) => message.stage && !message.approved && message.stage !== 'media')
    await runModel(value, pending?.stage === 'draft' ? 'draft' : 'plan', messages)
  }, [busy, input, messages, runModel])

  const runMediaSearch = useCallback(async (threadId: string, answerId: number, query: string, baseMessages?: StoredMessage[]) => {
    const text = query.trim()
    if (!text || savingMediaId) return
    if (baseMessages) setThreads((current) => current.map((item) => item.id === threadId ? { ...item, messages: baseMessages, updatedAt: Date.now() } : item))
    else updateMessages(threadId, (current) => current.map((message) => message.id === answerId ? { ...message, mediaQuery: text, text: t("正在重新检索开放媒体库…") } : message))
    setSavingMediaId('$search')
    setActiveAssistantId(answerId)
    setStatus('searching')
    try {
      const results = await searchOnlineMedia(text)
      const images = results.filter((item) => item.kind === 'image').length
      const videos = results.filter((item) => item.kind === 'video').length
      updateMessages(threadId, (current) => current.map((message) => message.id === answerId ? { ...message, stage: 'media', approved: false, mediaQuery: text, mediaResults: results, searched: true, searchQueries: [text], text: results.length ? isEnglish ? `Found ${images} images and ${videos} videos. Preview them here and save the materials you want to use. Check each source for credits and terms.` : `找到 ${images} 张图片、${videos} 段视频。你可以先在对话里预览，再决定哪些收入项目；授权与署名要求请打开来源页核对。` : t("这次没有找到匹配的开放媒体。可以修改检索词后再找，不会自动收入任何文件。") } : message))
    } catch (error) {
      updateMessages(threadId, (current) => current.map((message) => message.id === answerId ? { ...message, stage: 'media', mediaQuery: text, mediaResults: [], text: `素材检索未完成：${error instanceof Error ? error.message : '请稍后重试。'}` } : message))
    } finally {
      setSavingMediaId('')
      setActiveAssistantId(null)
      setStatus('ready')
    }
  }, [savingMediaId, updateMessages])

  const approveStage = useCallback(async (message: StoredMessage) => {
    if (busy || message.approved) return
    const approvedMessages = messages.map((item) => item.id === message.id ? { ...item, approved: true } : item)
    if (message.stage === 'plan') {
      await runModel(t("确认预案。请根据以上预案生成文稿。"), 'draft', approvedMessages)
      return
    }
    if (message.stage !== 'draft') return
    const stamp = Date.now()
    const answerId = stamp + 1
    const plannedQuery = [...approvedMessages].reverse().find((item) => item.stage === 'plan' && item.mediaQuery)?.mediaQuery
    const query = plannedQuery || suggestedMediaQuery(currentProject?.name || thread.title)
    const nextMessages: StoredMessage[] = [...approvedMessages,
      { id: stamp, role: 'user', text: t("确认文稿。请继续寻找图片和视频。") },
      { id: answerId, role: 'assistant', text: t("正在从开放媒体库寻找图片和视频…"), stage: 'media', mediaQuery: query, mediaResults: [] },
    ]
    await runMediaSearch(thread.id, answerId, query, nextMessages)
  }, [busy, currentProject?.name, messages, runMediaSearch, runModel, thread.id, thread.title])

  const saveMediaItems = useCallback(async (message: StoredMessage, items: AgentMediaResult[]) => {
    if (savingMediaId) return
    for (const media of items) {
      if (media.savedAssetId) continue
      setSavingMediaId(media.id)
      try {
        const asset = await onSaveMedia(media, thread.projectId)
        updateMessages(thread.id, (current) => current.map((item) => item.id === message.id ? { ...item, mediaResults: item.mediaResults?.map((result) => result.id === media.id ? { ...result, savedAssetId: asset.id } : result) } : item))
      } catch (error) {
        onNotice(`「${media.title}」保存失败：${error instanceof Error ? error.message : '请稍后重试。'}`)
        break
      }
    }
    setSavingMediaId('')
  }, [onNotice, onSaveMedia, savingMediaId, thread.id, thread.projectId, updateMessages])

  useEffect(() => {
    if (!launch || handledLaunch.current === launch.id) return
    handledLaunch.current = launch.id
    onLaunchHandled()
    void send(launch.text)
  }, [launch, onLaunchHandled, send])

  const newThread = () => {
    const next = createThread()
    setThreads((current) => [next, ...current])
    activateThread(next)
    setFilesOpen(true)
  }
  const removeThread = (id: string) => {
    const target = threads.find((item) => item.id === id)
    if (!target || !window.confirm(`删除对话「${target.title}」吗？项目、素材与文稿都会保留。`)) return
    const remaining = threads.filter((item) => item.id !== id)
    const next = remaining[0] ?? createThread()
    setThreads(remaining.length ? remaining : [next])
    if (id === thread.id) activateThread(next)
  }
  const stop = () => {
    abortRef.current?.abort()
    setStatus('ready')
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void send() }
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }
  const saveMessageDocument = (message: StoredMessage) => {
    const document = onSaveDocument(message.text, thread.projectId)
    updateMessages(thread.id, (current) => current.map((item) => item.id === message.id ? { ...item, documentIds: [...new Set([...(item.documentIds ?? []), document.id])] } : item))
    onEditDocument(document.id)
  }
  const saveSource = (message: StoredMessage, source: AgentSource) => {
    if (source.saved) return
    const content = `# ${source.title}\n\n原始链接：${source.url}\n\n> 由 MOTIF 联网检索保存的网页入口。此处保存来源链接与相关回答，不代表已抓取网页全文。\n\n## 相关回答\n\n${message.text}`
    const document = onSaveDocument(content, thread.projectId)
    updateMessages(thread.id, (current) => current.map((item) => item.id === message.id ? {
      ...item,
      sources: item.sources?.map((itemSource) => itemSource.id === source.id ? { ...itemSource, saved: true } : itemSource),
      documentIds: [...new Set([...(item.documentIds ?? []), document.id])],
    } : item))
    onNotice(currentProject ? `来源已存入「${currentProject.name}」，并同步到档案室。` : '来源已存入档案室。')
  }
  const createDocument = () => {
    const document = onCreateDocument(thread.projectId)
    onEditDocument(document.id)
  }
  const activeStageMessage = [...messages].reverse().find((message) => message.stage)

  return (
    <div className={`agent-conversation-workspace ${filesOpen ? 'with-project-files' : ''} ${threadsOpen ? 'with-thread-drawer' : ''}`}>
      {threadsOpen && <aside className="agent-thread-sidebar" aria-label={t("对话列表")}>
        <div className="thread-sidebar-heading"><span>CONVERSATIONS</span><b>{threads.length.toString().padStart(2, '0')}</b></div>
        <button className="new-thread-button" onClick={newThread}><MessageSquarePlus size={16} />{t("新建对话")}<Plus size={14} /></button>
        <div className="agent-thread-list">
          {sortedThreads.map((item) => {
            const project = projects.find((candidate) => candidate.id === item.projectId)
            return <div className={`agent-thread-item ${item.id === thread.id ? 'active' : ''}`} key={item.id}>
              <button className="thread-select-button" onClick={() => { activateThread(item); if (window.matchMedia('(max-width: 640px)').matches) setThreadsOpen(false) }} aria-current={item.id === thread.id ? 'page' : undefined}>
                <strong>{item.title || t("新对话")}</strong>
                <small>{project?.name || t("独立对话")} · {new Date(item.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</small>
              </button>
              <button className="thread-delete-button" onClick={() => removeThread(item.id)} aria-label={`删除对话${item.title}`} title={t("删除对话，保留项目文件")}><X size={13} /></button>
            </div>
          })}
        </div>
        <p className="thread-sidebar-note">{t("对话与项目各自保留。删除对话不会删除任何文件。")}</p>
      </aside>}

      <section className="conversation-panel" aria-label={t("Agent 对话")}>
        <header>
          <button className="conversation-thread-toggle" type="button" aria-label={isEnglish ? (threadsOpen ? "Hide conversations" : "Show conversations") : (threadsOpen ? "收起对话列表" : "展开对话列表")} aria-expanded={threadsOpen} onClick={() => setThreadsOpen((value) => !value)}><PanelLeft size={17} /></button>
          <div className="conversation-identity"><span className={`status-dot status-${status}`} /><div><strong>{thread.title}</strong><small>{configured ? config.model : t("未连接模型")} · {status === 'submitted' ? t("等待响应") : status === 'searching' ? t("正在联网检索") : status === 'streaming' ? t("正在输出") : status === 'error' ? t("请求失败") : t("就绪")}</small></div></div>
          <div className="conversation-header-actions">
            <label className="agent-project-select"><FolderKanban size={14} /><span className="sr-only">{t("当前对话关联项目")}</span><select aria-label={t("当前对话关联项目")} value={thread.projectId ?? ''} onChange={(event) => linkProject(event.target.value || undefined)}><option value="">{t("独立对话")}</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name || t("未命名项目")}</option>)}</select></label>
            <Popover open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
              <PopoverTrigger asChild><button aria-expanded={createMenuOpen}><Plus size={14} /> {t("新建")} <ChevronDown size={12} /></button></PopoverTrigger>
              <PopoverContent className="agent-create-menu" align="end" sideOffset={8}>
                <button onClick={() => { setCreateMenuOpen(false); onRequestNewProject(thread.id) }}><FolderKanban size={15} /><span>{t("新建项目")}<small>{t("并关联到当前对话")}</small></span></button>
                <button onClick={() => { setCreateMenuOpen(false); onRequestNewTask(thread.projectId) }}><ListPlus size={15} /><span>{t("新建任务")}<small>{currentProject ? `归入「${currentProject.name}」` : t("加入独立待办")}</small></span></button>
              </PopoverContent>
            </Popover>
            <button onClick={() => setFilesOpen((value) => !value)} aria-label={filesOpen ? t("收起当前项目文件") : t("展开当前项目文件")} title={t("当前项目文件")}>{filesOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}</button>
          </div>
        </header>
        <div className="conversation-project-line"><span>{currentProject ? <>{currentProject.name} · {projectAssets.length + projectDocuments.length} {t("项文件")}</> : t("独立对话 · 需要时再关联项目")}</span>{currentProject && <button onClick={() => onOpenLibrary(currentProject.id)}>{t("在档案室查看")} <ArrowRight size={12} /></button>}</div>
        <WorkflowSteps stage={activeStageMessage?.stage} approved={activeStageMessage?.stage === 'media' ? Boolean(activeStageMessage.mediaResults?.length && activeStageMessage.mediaResults.every((item) => item.savedAssetId)) : activeStageMessage?.approved} />
        <div className="conversation-scroll" ref={scrollRef} tabIndex={0} aria-label={isEnglish ? "Conversation messages" : "对话消息"} aria-live="polite">
          {messages.length === 1 && <div className="agent-quick-tasks" aria-label={t("快捷任务")}>{prompts.map((prompt) => <button key={prompt} onClick={() => void send(prompt)} disabled={busy}>{prompt}<ArrowRight size={13} /></button>)}</div>}
          {messages.map((message) => {
            const references = (message.referenceIds ?? []).map((id) => assets.find((asset) => asset.id === id)).filter((asset): asset is LibraryAsset => Boolean(asset))
            const outcomes = (message.documentIds ?? []).map((id) => documents.find((document) => document.id === id)).filter((document): document is WorkDocument => Boolean(document))
            return <article key={message.id} className={`message message-${message.role} ${message.stage ? `message-stage-${message.stage}` : ''} ${message.error ? 'message-error' : ''}`}>
              <span className="message-label">{message.role === 'assistant' ? message.error ? 'REQUEST ERROR' : <>MOTIF{message.searched && <b className="web-search-badge"><Globe2 size={10} />ONLINE MEDIA</b>}</> : 'YOU'}</span>
              {!!message.searchQueries?.length && <div className="message-search-queries" aria-label={t("本次联网检索词")}><Globe2 size={13} /><span>{t("检索")}</span>{message.searchQueries.map((query) => <q key={query}>{query}</q>)}</div>}
              <div className="message-content"><MessageMarkdown text={message.text} hasSources={Boolean(message.sources?.length)} />{message.id === activeAssistantId && status === 'streaming' && <i className="stream-caret" aria-label={t("正在输出")} />}</div>
              {message.stage === 'media' && message.id !== activeAssistantId && <AgentMediaResults results={message.mediaResults ?? []} query={message.mediaQuery ?? thread.title} savingId={savingMediaId} disabled={busy || Boolean(savingMediaId)} onQueryChange={(value) => updateMessages(thread.id, (current) => current.map((item) => item.id === message.id ? { ...item, mediaQuery: value } : item))} onSearch={() => void runMediaSearch(thread.id, message.id, message.mediaQuery ?? thread.title)} onSave={(media) => void saveMediaItems(message, [media])} onSaveAll={() => void saveMediaItems(message, message.mediaResults ?? [])} onOpenLibrary={() => onOpenLibrary(thread.projectId)} />}
              {!!message.sources?.length && <section className="agent-source-list" aria-label={t("网页来源")}><header><span>{t("网页来源")}</span><small>{message.sources.length} {isEnglish ? 'links · Save to organize' : '条链接 · 保存后可继续整理'}</small></header>{message.sources.map((source) => {
                let hostname = source.url
                try { hostname = new URL(source.url).hostname } catch { /* Keep the model-provided URL visible for inspection. */ }
                return <div className={`agent-source-card ${source.saved ? 'saved' : ''}`} key={source.id}>
                  <Globe2 size={18} />
                  <div><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={12} /></a><small>{hostname}</small></div>
                  <button onClick={() => saveSource(message, source)} disabled={source.saved} aria-label={`${source.saved ? t("已保存") : currentProject ? t("存入项目") : t("存入档案")}：${source.title}`}>{source.saved ? <><Check size={13} />{t("已入档")}</> : <><FilePlus2 size={13} />{currentProject ? t("存入项目") : t("存入档案")}</>}</button>
                </div>
              })}</section>}
              {references.length > 0 && <ol className="retrieval-results">{references.map((asset) => <li key={asset.id}><button onClick={() => onOpenLibrary()}><span>{asset.kind === 'image' ? t("图片") : asset.kind === 'video' ? t("视频") : asset.kind === 'data' ? t("数据") : t("文稿")}</span><strong>{asset.name}</strong><small>{asset.tags.length ? asset.tags.join(' · ') : t("未添加主题标签")}</small><ArrowRight size={13} /></button>{asset.content && <p>{asset.content.replace(/^#+\s*/gm, '').slice(0, 130)}</p>}</li>)}</ol>}
              {outcomes.length > 0 && <div className="message-outcomes">{outcomes.map((document) => <button key={document.id} onClick={() => onEditDocument(document.id)}><FileText size={18} /><span><strong>{document.title || t("未命名文稿")}</strong><small>{t("点击编辑文稿 · 自动保存")}</small></span><PenLine size={14} /></button>)}</div>}
              {activeStageMessage?.id === message.id && (message.stage === 'plan' || message.stage === 'draft') && !message.approved && !message.error && message.id !== activeAssistantId && <StageActions stage={message.stage} busy={busy} onApprove={() => void approveStage(message)} onRevise={() => { setInput(message.stage === 'plan' ? t("请修改预案：") : t("请修改文稿：")); document.getElementById('agent-message')?.focus() }} />}
              {message.role === 'assistant' && !message.stage && message.text && message.text !== welcome && !message.error && message.id !== activeAssistantId && <div className="message-work-actions"><button onClick={() => onRequestNewTask(thread.projectId, message.text.slice(0, 160))}><Check size={13} />{t("转为任务")}</button>{outcomes.length ? <button onClick={() => onEditDocument(outcomes[0].id)}><PenLine size={13} />{t("编辑文稿")}</button> : <button onClick={() => saveMessageDocument(message)}><FilePlus2 size={13} />{t("存为文稿")}</button>}</div>}
              {message.error && <button onClick={onOpenSettings}><Settings2 size={14} /> {t("检查配置")} <ArrowRight size={13} /></button>}
            </article>
          })}
          {(status === 'submitted' || status === 'searching') && <div className="thinking-message"><Globe2 size={status === 'searching' ? 14 : 0} /><span>{status === 'searching' ? t("正在联网检索") : t("正在连接模型")}</span><i /><i /><i /></div>}
        </div>
        <form className="conversation-composer" onSubmit={submit}>
          {portfolioDemo && <div className="portfolio-demo-guide"><span>{t("作品集试玩 · 示例流式回复")}</span><button type="button" onClick={() => setInput(demoPrompt)}>{t("填入研究问题")}</button></div>}
          <label className="sr-only" htmlFor="agent-message">{t("给 Agent 写下任务")}</label>
          <textarea id="agent-message" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={keyDown} placeholder={configured ? t("写下新项目，或告诉 Agent 如何修改当前步骤…") : t("连接模型后，从项目预案开始…")} rows={2} />
          <div>
            <div className="composer-context-tools">
              <button type="button" className={`composer-toggle ${currentProject && projectOnly ? 'active' : ''}`} onClick={() => setProjectOnly((value) => !value)} disabled={!currentProject || busy} aria-pressed={Boolean(currentProject && projectOnly)} title={currentProject ? projectOnly ? t("只向模型提供当前项目资料") : t("向模型提供全部档案索引") : t("关联项目后可限定资料范围")}><FolderKanban size={14} />{t("项目资料")}</button>
              <button type="button" className="attach-button" onClick={() => onOpenLibrary(thread.projectId)} disabled={busy}><Paperclip size={15} />{t("添加素材")}</button>
              <button type="button" className="attach-button" onClick={createDocument}><FilePlus2 size={15} />{t("新建文稿")}</button>
            </div>
            <span>{t("Enter 发送 · Shift + Enter 换行")}</span>
            {busy ? <button type="button" className="stop-message" onClick={stop} aria-label={t("停止生成")}><Square size={14} fill="currentColor" /> {t("停止")}</button> : <button className="send-message" type="submit" disabled={!input.trim()} aria-label={t("发送消息")}><ArrowUp size={17} /></button>}
          </div>
        </form>
      </section>

      {filesOpen && <aside className="agent-project-files" aria-label={t("当前项目文件")}>
        <header><div><span>PROJECT FILES</span><h3>{currentProject?.name || t("当前项目文件")}</h3></div><button onClick={() => setFilesOpen(false)} aria-label={t("收起项目文件")}><X size={14} /></button></header>
        {currentProject ? <>
          <div className="project-file-summary"><FolderKanban size={18} /><span>{projectAssets.length + projectDocuments.length} {t("项文件")}<small>{t("引用同一份档案，不创建副本")}</small></span></div>
          <section className="project-file-section"><div><h4>{t("文稿与成果")}</h4><button onClick={createDocument} aria-label={t("在当前项目新建文稿")}><Plus size={14} /></button></div><div className="project-file-list">{projectDocuments.map((document) => <button key={document.id} onClick={() => onEditDocument(document.id)}><FileText size={17} /><span><strong>{document.title || t("未命名文稿")}</strong><small>{document.content.length} {t("字符 · 点击编辑")}</small></span><ArrowRight size={13} /></button>)}{!projectDocuments.length && <p>{t("对话回复可存为文稿，也可以新建空白文稿。")}</p>}</div></section>
          <section className="project-file-section"><div><h4>{t("项目素材")}</h4><button onClick={() => onOpenLibrary(currentProject.id)} aria-label={t("在档案室整理当前项目素材")}><Plus size={14} /></button></div><div className="project-file-list">{projectAssets.map((asset) => <button key={asset.id} onClick={() => onOpenLibrary(currentProject.id)}>{asset.kind === 'image' ? <img src={asset.src} alt="" /> : <ImageIcon size={17} />}<span><strong>{asset.name}</strong><small>{asset.kind === 'image' ? t("图片") : asset.kind === 'video' ? t("视频") : asset.kind === 'data' ? t("数据") : t("文稿")} · {asset.size}</small></span><ArrowRight size={13} /></button>)}{!projectAssets.length && <p>{t("在档案室把图片、视频或数据拖入此项目。")}</p>}</div></section>
          <button className="project-files-open-library" onClick={() => onOpenLibrary(currentProject.id)}><Library size={15} />{t("整理项目文件")}<ArrowRight size={14} /></button>
        </> : <div className="project-files-empty"><FolderKanban size={29} strokeWidth={1.1} /><h3>{t("这段对话还未关联项目")}</h3><p>{t("关联后，对话成果和项目文件会在右侧汇合；不关联也能正常使用。")}</p><button onClick={() => onRequestNewProject(thread.id)}><Plus size={14} />{t("新建并关联项目")}</button></div>}
      </aside>}
    </div>
  )
}

function MessageMarkdown({ text, hasSources }: { text: string; hasSources: boolean }) {
  const sourceStart = hasSources ? text.search(/(?:^|\n)\s*#{1,6}\s*(?:来源|参考资料|Sources?|References?)\s*(?:\n|$)/i) : -1
  const content = sourceStart >= 0 ? text.slice(0, sourceStart) : text
  return <div className="message-rich-text"><ReactMarkdown skipHtml components={{
    a: ({ href, children }) => href?.startsWith('http') ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <a href={href}>{children}</a>,
  }}>{content}</ReactMarkdown></div>
}




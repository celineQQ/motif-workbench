import { t } from '../data/language'
import { useEffect, useState } from 'react'
import { ArrowDownToLine, FileText, PenLine, Trash2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { downloadText } from '../data/library'
import type { WorkDocument } from '../data/works'

export function DocumentEditor({ document, onUpdate, onDelete, onClose, onNotice }: {
  document: WorkDocument
  onUpdate: (patch: Partial<WorkDocument>) => void
  onDelete: () => void
  onClose: () => void
  onNotice: (message: string) => void
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [tagInput, setTagInput] = useState(() => document.tags.join(', '))
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  const remove = () => {
    if (window.confirm(t("删除这份文稿及其项目引用？"))) onDelete()
  }
  return <div className="work-modal-backdrop document-editor-backdrop">
    <section className="document-editor-dialog" role="dialog" aria-modal="true" aria-label={t("编辑项目文稿")}>
      <header><div><span>{t("文稿编辑器 · 自动保存")}</span><input value={document.title} onChange={(event) => onUpdate({ title: event.target.value })} aria-label={t("文稿标题")} placeholder={t("未命名文稿")} /></div><button onClick={onClose} aria-label={t("关闭文稿编辑器")}><X size={17} /></button></header>
      <div className="document-editor-toolbar">
        <div>
          <button aria-pressed={mode === 'edit'} className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}><PenLine size={14} />{t("编辑")}</button>
          <button aria-pressed={mode === 'preview'} className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}><FileText size={14} />{t("预览")}</button>
        </div>
        <input value={tagInput} onChange={(event) => {
          const value = event.target.value
          setTagInput(value)
          onUpdate({ tags: [...new Set(value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean))] })
        }} aria-label={t("文稿标签")} placeholder={t("主题标签，用逗号分隔")} />
        <button onClick={() => { downloadText((document.title.trim() || 'Untitled') + '.md', document.content); onNotice(t("文稿已导出为 Markdown。")) }}><ArrowDownToLine size={14} />{t("导出")}</button>
        <button className="document-delete" onClick={remove}><Trash2 size={14} />{t("删除")}</button>
      </div>
      {mode === 'edit' ? <textarea className="document-dialog-editor" value={document.content} onChange={(event) => onUpdate({ content: event.target.value })} aria-label={t("文稿正文")} placeholder={t("在这里继续写作…")} autoFocus /> : <article className="document-dialog-preview"><ReactMarkdown>{document.content}</ReactMarkdown></article>}
      <footer><span>{document.content.length} <span>{t("字符 · 自动保存")}</span></span><span>{t("对话和档案室共享这份文稿")}</span></footer>
    </section>
  </div>
}


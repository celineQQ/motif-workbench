import { t } from '../data/language'
import { useRef, useState } from 'react'
import type { Dispatch, FormEvent, KeyboardEvent, PointerEvent, SetStateAction } from 'react'
import { Plus, X } from 'lucide-react'

export type NoteCategory = '灵感' | '研究' | '文字' | '图像'
export type StickyNote = {
  id: number
  text: string
  category: NoteCategory
  x: number
  y: number
  rotation: number
  tone: 'iris' | 'sage' | 'pearl'
}

const categories: ('全部' | NoteCategory)[] = ['全部', '灵感', '研究', '文字', '图像']
const noteTone = (category: NoteCategory): StickyNote['tone'] => category === '研究' ? 'sage' : category === '文字' ? 'pearl' : 'iris'
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function NotesWorkspace({ notes, setNotes, onNotice, onCreateTask }: { notes: StickyNote[]; setNotes: Dispatch<SetStateAction<StickyNote[]>>; onNotice: (message: string) => void; onCreateTask: (label: string) => void }) {
  const [draft, setDraft] = useState('')
  const [category, setCategory] = useState<NoteCategory>('灵感')
  const [filter, setFilter] = useState<'全部' | NoteCategory>('全部')
  const [search, setSearch] = useState('')
  const [listView, setListView] = useState(() => window.matchMedia('(max-width: 640px)').matches)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [removed, setRemoved] = useState<StickyNote | null>(null)
  const resetDraft = () => {
    setDraft('')
    setEditingId(null)
  }
  const wallRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; clientX: number; clientY: number; x: number; y: number } | null>(null)

  const addNote = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) {
      onNotice(t("先留下几个字，再让灵感落到桌面。"))
      return
    }
    if (editingId !== null) {
      setNotes((current) => current.map((note) => note.id === editingId ? { ...note, text: draft.trim(), category, tone: noteTone(category) } : note))
      resetDraft()
      setFilter('全部')
      setSearch('')
      onNotice(t("灵感已更新。"))
      return
    }
    const index = notes.length
    setNotes((current) => [...current, {
      id: current.reduce((id, note) => Math.max(id, note.id + 1), Date.now()),
      text: draft.trim(),
      category,
      x: 7 + (index * 19) % 66,
      y: 8 + (index * 27) % 55,
      rotation: index % 2 ? 2 : -2,
      tone: noteTone(category),
    }])
    setDraft('')
    setFilter('全部')
    setSearch('')
    onNotice(t("新的玻璃便签已放上灵感墙，可以拖动或重新分类。"))
  }

  const beginDrag = (event: PointerEvent<HTMLElement>, note: StickyNote) => {
    if (listView || (event.target as HTMLElement).closest('button, select')) return
    drag.current = { id: note.id, clientX: event.clientX, clientY: event.clientY, x: note.x, y: note.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current || !wallRef.current) return
    const bounds = wallRef.current.getBoundingClientRect()
    const { id, clientX, clientY, x, y } = drag.current
    setNotes((current) => current.map((note) => note.id === id ? {
      ...note,
      x: clamp(x + (event.clientX - clientX) / bounds.width * 100, 1, 75),
      y: clamp(y + (event.clientY - clientY) / bounds.height * 100, 1, 76),
    } : note))
  }

  const nudgeNote = (event: KeyboardEvent<HTMLElement>, note: StickyNote) => {
    if (listView || event.target !== event.currentTarget) return
    const delta = event.shiftKey ? 5 : 2
    let x = note.x
    let y = note.y
    if (event.key === 'ArrowLeft') x -= delta
    else if (event.key === 'ArrowRight') x += delta
    else if (event.key === 'ArrowUp') y -= delta
    else if (event.key === 'ArrowDown') y += delta
    else return
    event.preventDefault()
    setNotes((current) => current.map((item) => item.id === note.id ? { ...item, x: clamp(x, 1, 75), y: clamp(y, 1, 76) } : item))
  }

  const query = search.trim().toLocaleLowerCase()
  const visibleNotes = notes.filter((note) => (filter === '全部' || note.category === filter) && note.text.toLocaleLowerCase().includes(query))

  return (
    <div className="notes-workspace">
      <aside className="notes-composer">
        <h2>{t("即时灵感")} <em>Notes</em></h2>
        <form onSubmit={addNote}>
          <label htmlFor="workspace-note">{editingId === null ? t("写下灵感") : t("编辑灵感")}</label>
          <textarea id="workspace-note" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("写下一句话、一个画面，或还没有答案的问题…")} />
          <label htmlFor="workspace-note-category">{t("分类")}</label>
          <select id="workspace-note-category" value={category} onChange={(event) => setCategory(event.target.value as NoteCategory)}>
            {categories.slice(1).map((item) => <option key={item} value={item}>{t(item)}</option>)}
          </select>
          <button className="workspace-primary" type="submit" disabled={!draft.trim()}>{editingId === null ? t("添加便签") : t("保存便签")} <Plus size={15} /></button>
          {editingId !== null && <button type="button" onClick={resetDraft}>{t("取消编辑")}</button>}
        </form>
        <div className="notes-legend"><span>{notes.length.toString().padStart(2, '0')} NOTES</span><p>{t("拖动便签整理位置；聚焦后可用方向键移动。内容保存在当前浏览器。")}</p></div>
      </aside>
      <section className="notes-wall-section" aria-label={t("可整理的玻璃便利贴墙")}>
        <div className="notes-search">
          <input type="search" aria-label={t("搜索灵感")} placeholder={t("搜索灵感…")} value={search} onChange={(event) => setSearch(event.target.value)} />
          <button type="button" onClick={() => setListView(!listView)}>{listView ? t("切换到便签墙") : t("切换到列表")}</button>
        </div>
        {removed && <div className="utility-undo" role="status">{t("便签已删除")} <button type="button" onClick={() => {
          setNotes((current) => current.some((note) => note.id === removed.id) ? current : [...current, removed])
          setRemoved(null)
          setSearch('')
          setFilter('全部')
        }}>{t("撤销删除便签")}</button></div>}
        <div className="notes-toolbar">
          <div role="group" aria-label={t("按分类筛选便签")}>
            {categories.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} aria-pressed={filter === item}>{t(item)}<small>{item === '全部' ? notes.length : notes.filter((note) => note.category === item).length}</small></button>)}
          </div>

        </div>
        <div className={listView ? 'notes-wall notes-list-view' : 'notes-wall'} ref={wallRef}>
          <span className="wall-pencil-line" aria-hidden="true" />
          {visibleNotes.map((note) => (
            <article
              key={note.id}
              className={`draggable-note tone-${note.tone}`}
              style={listView ? undefined : { left: `${note.x}%`, top: `${note.y}%`, transform: `rotate(${note.rotation}deg)` }}
              tabIndex={0}
              aria-label={`${t(note.category)} · ${note.text}`}
              onPointerDown={(event) => beginDrag(event, note)}
              onPointerMove={moveDrag}
              onPointerUp={() => { drag.current = null }}
              onPointerCancel={() => { drag.current = null }}
              onKeyDown={(event) => nudgeNote(event, note)}
            >
              <span className="note-pearl" aria-hidden="true" />
              <button className="note-delete" aria-label={`删除便签：${note.text}`} onClick={() => { setRemoved(note); setNotes((current) => current.filter((item) => item.id !== note.id)); if (editingId === note.id) resetDraft() }}><X size={13} /></button>
              <p>{note.text}</p>
              <div className="note-actions">
                <button type="button" aria-label={t("编辑便签：") + note.text} onClick={() => {
                  setEditingId(note.id)
                  setDraft(note.text)
                  setCategory(note.category)
                  document.getElementById('workspace-note')?.focus()
                }}>{t("编辑")}</button>
                <button type="button" aria-label={t("转为待办：") + note.text} onClick={() => {
                  onCreateTask(note.text)
                  onNotice(t("已加入待办清单，原便签已保留。"))
                }}>{t("转为待办")}</button>
              </div>
              <div className="note-meta">
                <select aria-label={t("修改便签分类")} value={note.category} onChange={(event) => setNotes((current) => current.map((item) => item.id === note.id ? { ...item, category: event.target.value as NoteCategory, tone: noteTone(event.target.value as NoteCategory) } : item))}>
                  {categories.slice(1).map((item) => <option key={item} value={item}>{t(item)}</option>)}
                </select>
                <span>№ {String(note.id).slice(-2)}</span>
              </div>
            </article>
          ))}
          {visibleNotes.length === 0 && <div className="notes-empty">{query ? t("没有找到匹配的灵感。") : t("这个分类还没有便签。")}</div>}
        </div>
      </section>
    </div>
  )
}

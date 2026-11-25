import { DisplayMenu } from '../components/DisplayMenu'
import { t } from '../data/language'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, MousePointer2, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import RoomScene from '../components/RoomScene'
import type { RoomObject } from '../components/RoomScene'
import '../Room.css'

export default function Room() {
  const navigate = useNavigate()
  const [materialized, setMaterialized] = useState(false)
  const [lightOn, setLightOn] = useState(false)
  const [woolf, setWoolf] = useState(false)
  const [windowOpen, setWindowOpen] = useState(false)
  const [wardrobeOpen, setWardrobeOpen] = useState(false)
  const [activeObject, setActiveObject] = useState<RoomObject | null>(null)
  const [journalOpen, setJournalOpen] = useState(false)
  const [written, setWritten] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const leaveTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!journalOpen) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setWritten(true), reduced ? 0 : 2100)
    return () => window.clearTimeout(timer)
  }, [journalOpen])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setJournalOpen(false)
      setActiveObject(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    }
  }, [])

  const activate = useCallback((object: RoomObject) => {
    if (object === 'lamp') {
      setMaterialized(true)
      setLightOn((value) => !value)
      setActiveObject('lamp')
    } else if (object === 'bookcase') {
      setMaterialized(true)
      setWoolf(true)
      setActiveObject('bookcase')
    } else if (object === 'window') {
      setWindowOpen((value) => !value)
      setActiveObject('window')
    } else if (object === 'wardrobe') {
      setWardrobeOpen((value) => !value)
      setActiveObject('wardrobe')
    } else {
      setActiveObject(null)
      setJournalOpen(true)
    }
  }, [])

  const enterAtelier = () => {
    if (!written) return
    setLeaving(true)
    leaveTimer.current = window.setTimeout(() => navigate('/atelier'), 620)
  }

  return (
    <main className={`room-page ${materialized ? 'is-materialized' : ''} ${lightOn ? 'is-lit' : ''} ${woolf ? 'era-woolf' : 'era-illustrated'} ${windowOpen ? 'window-is-open' : ''} ${leaving ? 'is-leaving' : ''}`}>
      <header className="room-header">
        <div className="room-wordmark"><span>MOTIF</span><small>A ROOM FOR LIVING IDEAS</small></div>
        <div className="room-header-actions"><button className="room-skip" onClick={() => navigate('/atelier')}>Skip to the atelier <ArrowRight size={14} /></button><DisplayMenu /></div>
      </header>

      <section className="room-intro" aria-labelledby="room-title">
        <p>AN INTERACTIVE LITERARY SPACE</p>
        <h1 id="room-title">A Room of<br /><em>One’s Own.</em></h1>
      </section>

      <div className="room-viewport" aria-label={t("可360度拖动环绕的三维房间")}>
        <RoomScene
          materialized={materialized}
          lightOn={lightOn}
          woolf={woolf}
          windowOpen={windowOpen}
          wardrobeOpen={wardrobeOpen}
          journalOpen={journalOpen}
          onActivate={activate}
        />
      </div>

      <div className="room-drag-hint"><MousePointer2 size={13} /><span>{t("360° 拖动环绕 · 滚轮靠近 · 点击物件")}</span></div>

      <div className="chapter-rail" aria-label={t("房间叙事章节")}>
        <div className={!materialized ? 'current' : 'visited'}><span>I</span><p>The Illustrated Room<small>{t("浪漫主义的纸上房间")}</small></p></div>
        <div className={materialized && !woolf ? 'current' : woolf ? 'visited' : ''}><span>II</span><p>A Room of One’s Own<small>{t("伍尔夫时期的房间")}</small></p></div>
        <div className={journalOpen ? 'current' : ''}><span>III</span><p>The Living Atelier<small>{t("由你重新书写的房间")}</small></p></div>
      </div>

      <div className="room-guidance" aria-live="polite">
        {!materialized && t("点亮台灯，让插画获得重量。")}
        {materialized && !woolf && t("光已经进来。去书柜，取出那本书。")}
        {woolf && !journalOpen && t("现在，房间属于你。点击书桌，开始书写。")}
        {journalOpen && t("一个故事，正在变成你的实践。")}
      </div>

      {activeObject && activeObject !== 'desk' && (
        <aside className={`object-note note-${activeObject}`} aria-live="polite">
          <button onClick={() => setActiveObject(null)} aria-label={t("关闭物件注释")}><X size={14} /></button>
          {activeObject === 'lamp' && <><small>THE LAMP</small><p>{lightOn ? t("光扫过纸面，插画里的物件开始拥有重量。") : t("灯熄灭了，房间还保留着已经获得的质感。")}</p></>}
          {activeObject === 'bookcase' && <><small>THE BOOKCASE · 1929</small><p>{t("抽出《一间自己的房间》。繁复的装饰退去，独立书写的空间逐渐清晰。")}</p></>}
          {activeObject === 'window' && <><small>THE WINDOW</small><p>{windowOpen ? t("窗已推开。花园沿着窗台生长，远处山丘与天空也终于清晰可见。") : t("窗合上了，花园仍在窗外，房间重新安静。")}</p></>}
          {activeObject === 'wardrobe' && <><small>THE WARDROBE</small><p>{wardrobeOpen ? t("柜门后收藏着陶瓷、珠光、缎带与尚未成形的 Vision Board。") : t("再点一次衣柜，看看古典房间里收藏的新材质。")}</p><div className="material-swatches"><i /><i /><i /><i /></div></>}
        </aside>
      )}

      {journalOpen && (
        <section className="journal-overlay" aria-label={t("翻开的工作日记")}>
          <button className="journal-close" onClick={() => setJournalOpen(false)} aria-label={t("合上日记")}><X size={18} /></button>
          <div className="journal-scene">
            <div
              className={`journal-book ${written ? 'is-ready' : ''}`}
              role="button"
              tabIndex={written ? 0 : -1}
              aria-label={t("打开我的工作台")}
              aria-disabled={!written}
              onClick={enterAtelier}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                enterAtelier()
              }}
            >
              <div className="journal-page journal-left">
                <span className="journal-folio">MOTIF · PERSONAL WORKSPACE</span>
                <p>{t("对话、素材、文稿，")}<br />{t("以及每一张视觉板。")}</p>
                <small>Agent · Library · Works</small>
                <span className="journal-number">01</span>
              </div>
              <div className="journal-page journal-right">
                <span className="journal-folio">YOUR DESK IS READY</span>
                <h2 className={written ? 'is-written' : ''}>A room for<br /><em>your work.</em></h2>
                <p className={written ? 'is-written' : ''}>{t("点击纸页，进入工作台")} <ArrowRight size={16} /></p>
                <span className="journal-number">02</span>
              </div>
              <div className="turning-page" aria-hidden="true" />
              <div className={`writing-pen ${written ? 'has-finished' : ''}`} aria-hidden="true"><i /></div>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

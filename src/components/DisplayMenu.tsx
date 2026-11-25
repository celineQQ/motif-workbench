import { useRef } from 'react'
import { Ellipsis, Globe2, Images, RotateCcw, Square } from 'lucide-react'
import { changeLanguage, isEnglish } from '../data/language'
import { portfolioDemo } from '../data/portfolioDemo'

export function DisplayMenu() {
  const menu = useRef<HTMLDetailsElement>(null)
  const title = isEnglish ? 'Display options' : '显示选项'
  const controlTour = (action: 'replay' | 'stop') => {
    if (menu.current) menu.current.open = false
    window.dispatchEvent(new CustomEvent('motif-tour-action', { detail: action }))
  }
  return (
    <details className="display-menu" ref={menu}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.currentTarget.open = false
        event.currentTarget.querySelector('summary')?.focus()
      }}>
      <summary aria-label={title} title={title}><Ellipsis size={17} aria-hidden="true" /></summary>
      <div className="display-menu-content">
        <a href={import.meta.env.BASE_URL + (isEnglish ? 'guide/en.html#gallery' : 'guide/index.html#gallery')}><Images size={14} />{isEnglish ? 'Screenshots' : '静态截图'}</a>
        <button type="button" onClick={changeLanguage}><Globe2 size={14} />{isEnglish ? '切换至中文' : 'Switch to English'}</button>
        {portfolioDemo && isEnglish && <>
          <button type="button" onClick={() => controlTour('replay')}><RotateCcw size={14} />Replay walkthrough</button>
          <button type="button" onClick={() => controlTour('stop')}><Square size={14} />Take control</button>
        </>}
      </div>
    </details>
  )
}

import { t } from '../data/language'
import { Archive, MessagesSquare, Orbit } from 'lucide-react'

export type ActivePanel = 'agent' | 'library' | 'network'

const navItems = [
  { id: 'agent' as const, label: t("对话"), english: 'Agent', icon: MessagesSquare },
  { id: 'library' as const, label: t("档案室"), english: 'Archive', icon: Archive },
  { id: 'network' as const, label: t("项目星云"), english: 'Nebula', icon: Orbit },
]

export function FloatingNav({ activePanel, onSelect }: { activePanel: ActivePanel; onSelect: (panel: ActivePanel) => void }) {
  return (
    <nav className="direct-workspace-nav" aria-label={t("工作台功能")}>
      {navItems.map((item) => {
        const Icon = item.icon
        const active = activePanel === item.id
        return (
          <button
            type="button"
            key={item.id}
            className={active ? 'active' : ''}
            onClick={() => onSelect(item.id)}
            aria-current={active ? 'page' : undefined}
            aria-controls="atelier-workspace"
          >
            <Icon size={15} strokeWidth={1.45} />
            <span>{item.label}</span>
            <small>{item.english}</small>
          </button>
        )
      })}
    </nav>
  )
}

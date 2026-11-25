import { portfolioDemo } from '../data/portfolioDemo'
import { isEnglish, t } from '../data/language'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { KeyRound, Save } from 'lucide-react'
import type { AgentConfig } from '../data/agent'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet'

type SettingsDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
  annotations: boolean
  onToggleAnnotations: () => void
  quietMotion: boolean
  onToggleQuietMotion: () => void
  config: AgentConfig
  onSave: (config: AgentConfig) => void
  onClearKey: () => void
  onNotice: (message: string) => void
}

export function SettingsDrawer({
  open,
  onOpenChange,
  trigger,
  annotations,
  onToggleAnnotations,
  quietMotion,
  onToggleQuietMotion,
  config,
  onSave,
  onClearKey,
  onNotice,
}: SettingsDrawerProps) {
  const [draft, setDraft] = useState(config)
  const [feedback, setFeedback] = useState('')
  const wasOpen = useRef(open)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(config)
      setFeedback('')
    }
    wasOpen.current = open
  }, [open, config])

  const save = (event: FormEvent) => {
    event.preventDefault()
    try {
      const url = new URL(draft.baseUrl.trim())
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      setFeedback(t("请输入有效的 HTTP(S) Base URL 或完整 chat/completions 地址。"))
      return
    }

    const next = { ...draft, baseUrl: draft.baseUrl.trim(), model: draft.model.trim() }
    onSave(next)
    const message = next.apiKey
      ? t("接口配置已保留在当前页面，可在对话中验证真实响应。")
      : t("接口地址与模型名已保存；未填写密钥，项目创作流程暂不可用。")
    setFeedback(message)
    onNotice(message)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent id="motif-settings-drawer" className="settings-drawer" side="right">
        <SheetHeader className="settings-drawer-header">
          <span className="settings-drawer-kicker">ATELIER PREFERENCES</span>
          <SheetTitle>{t("设置")} <em>Settings</em></SheetTitle>
          <SheetDescription>{t("显示、动效与模型连接。")}</SheetDescription>
        </SheetHeader>

        <div className="settings-drawer-scroll">
          <section className="settings-section" aria-labelledby="display-settings-title">
            <h3 id="display-settings-title">{t("显示与动效")}</h3>
            <button type="button" className="setting-row" onClick={onToggleAnnotations} aria-pressed={annotations}>
              <span>{t("显示藏品标注")}<small>{t("素材主题标签与画板图片题名")}</small></span>
              <b>{annotations ? 'ON' : 'OFF'}</b>
            </button>
            <button type="button" className="setting-row" onClick={onToggleQuietMotion} aria-pressed={quietMotion}>
              <span>{t("减少动态")}<small>{t("减少页面过渡与动态反馈")}</small></span>
              <b>{quietMotion ? 'ON' : 'OFF'}</b>
            </button>
          </section>

          <form className="agent-api-settings settings-section" onSubmit={save}>
            <p><KeyRound size={15} /> OPENAI-COMPATIBLE API</p>
            <h3>{t("模型接口")}</h3>
            <label>Base URL
              <input type="url" required value={draft.baseUrl} onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))} placeholder={portfolioDemo ? "https://api.openai.com/v1" : "https://api.moonshot.cn/v1"} />
            </label>
            <label>{t("模型名")}
              <input required value={draft.model} onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))} placeholder={t("例如 kimi-k3.1-pro")} />
            </label>
            <label>API Key
              <input type="password" autoComplete="off" spellCheck={false} value={draft.apiKey} onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))} placeholder={t("仅保留在当前页面内存")} />
            </label>
            <div>
              <button className="workspace-primary" type="submit"><Save size={14} /> {t("保存配置")}</button>
              {config.apiKey && <button type="button" onClick={() => {
                onClearKey()
                setDraft((current) => ({ ...current, apiKey: '' }))
                setFeedback(t("API Key 已清除，项目创作流程已暂停。"))
              }}>{t("清除密钥")}</button>}
            </div>
            <small>{isEnglish && portfolioDemo ? "Demo configuration only. The walkthrough uses sample replies." : t("请通过 npm run dev 或 npm run preview 启动。模型请求由本地服务转发，API Key 仅保留在页面内存，刷新后需重新输入。模型调用可能产生费用；图片与视频检索使用 Wikimedia Commons 开放接口，无需 API Key，文件授权以来源页为准。")}</small>
          </form>
          <p className="settings-feedback" aria-live="polite">{feedback}</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}


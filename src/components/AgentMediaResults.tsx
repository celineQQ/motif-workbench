import { t } from '../data/language'
import { ArrowDownToLine, ArrowRight, Check, ExternalLink, Image as ImageIcon, LoaderCircle, Search, Video } from 'lucide-react'
import type { AgentMediaResult } from '../data/media'

export function AgentMediaResults({ results, query, savingId, disabled, onQueryChange, onSearch, onSave, onSaveAll, onOpenLibrary }: {
  results: AgentMediaResult[]
  query: string
  savingId: string
  disabled: boolean
  onQueryChange: (value: string) => void
  onSearch: () => void
  onSave: (media: AgentMediaResult) => void
  onSaveAll: () => void
  onOpenLibrary: () => void
}) {
  const unsaved = results.filter((item) => !item.savedAssetId)
  const official = results.some((item) => item.provider === 'Marvel')
  return <section className="agent-media-results" aria-label={t("联网图片与视频结果")}>
    <header><div><span>{official ? 'OFFICIAL STILLS · MARVEL' : 'OPEN MEDIA · WIKIMEDIA COMMONS'}</span><strong>{official ? t("电视剧官方剧照") : t("图片与视频")}</strong></div>{results.length > 0 && <button onClick={onSaveAll} disabled={disabled || !unsaved.length}>{unsaved.length ? <><ArrowDownToLine size={13} />{t("全部收入项目")}</> : <><Check size={13} />{t("已全部入档")}</>}</button>}</header>
    <form onSubmit={(event) => { event.preventDefault(); onSearch() }}>
      <Search size={14} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} aria-label={t("图片与视频检索词")} placeholder={t("输入素材检索词…")} /><button type="submit" disabled={disabled || !query.trim()}>{disabled && savingId === '$search' ? <LoaderCircle className="spin" size={13} /> : <Search size={13} />}{t("重新检索")}</button>
    </form>
    {results.length > 0 ? <div className="agent-media-grid">{results.map((media) => <article key={media.id} className="agent-media-card">
      <div className="agent-media-preview">{media.kind === 'image' ? <img src={media.thumbUrl || media.url} alt={media.title} loading="lazy" /> : <video src={media.url} poster={media.thumbUrl || undefined} controls preload="metadata" aria-label={media.title} />}<span>{media.kind === 'image' ? <ImageIcon size={12} /> : <Video size={12} />}{media.kind === 'image' ? t("图片") : t("视频")}</span></div>
      <div className="agent-media-caption"><strong>{media.title}</strong><small>{media.license} · {media.provider === 'Marvel' ? t("仅供研究参考") : t("授权与署名以来源页为准")}</small><div><a href={media.sourceUrl} target="_blank" rel="noreferrer">{t("来源")}<ExternalLink size={11} /></a><button onClick={() => onSave(media)} disabled={disabled || Boolean(media.savedAssetId)}>{savingId === media.id ? <LoaderCircle className="spin" size={12} /> : media.savedAssetId ? <Check size={12} /> : <ArrowDownToLine size={12} />}{media.savedAssetId ? t("已入档") : t("收入项目")}</button></div></div>
    </article>)}</div> : <p className="agent-media-empty">{t("没有找到匹配的图片或视频。可以缩短检索词，或改用作品中英文名、作者名重新检索。")}</p>}
    <footer><span>{official ? t("图片来自 Marvel 官方剧集页面，不是开放授权素材。") : t("结果来自开放媒体库，不是模型生成的图片。")}</span>{results.some((item) => item.savedAssetId) && <button onClick={onOpenLibrary}>{t("去档案室整理")}<ArrowRight size={12} /></button>}</footer>
  </section>
}

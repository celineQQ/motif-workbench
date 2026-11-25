import { t } from './language'
import { portfolioDemo } from './portfolioDemo'

export type AgentMediaResult = {
  id: string
  title: string
  kind: 'image' | 'video'
  url: string
  thumbUrl: string
  sourceUrl: string
  license: string
  creator?: string
  provider?: 'Wikimedia Commons' | 'Marvel'
  bytes?: number
  savedAssetId?: string
}

async function errorMessage(response: Response) {
  const data = await response.json().catch(() => null) as { error?: { message?: string } } | null
  return data?.error?.message || `媒体服务返回 HTTP ${response.status}。`
}

export async function searchOnlineMedia(query: string, signal?: AbortSignal): Promise<AgentMediaResult[]> {
  if (portfolioDemo) {
    signal?.throwIfAborted()
    const root = import.meta.env.BASE_URL + 'frankenstein/'
    const still = root + 'frankenstein-1910-still.jpg'
    return [
      { id: 'portfolio-still', title: t("1910 年电影剧照.jpg"), kind: 'image', url: still, thumbUrl: still, license: t("公版标记见来源页"), sourceUrl: 'https://commons.wikimedia.org/wiki/File:Frankenstein1910.jpg' },
      { id: 'portfolio-film', title: t("1910 年《弗兰肯斯坦》完整短片.mp4"), kind: 'video', url: root + 'frankenstein-1910-film.mp4', thumbUrl: still, license: t("公版标记见来源页"), sourceUrl: 'https://commons.wikimedia.org/wiki/File:Frankenstein_(1910)_-_Full_Movie.ogv' },
    ]
  }
  const response = await fetch(`/api/motif/media?q=${encodeURIComponent(query)}`, { signal })
  if (!response.ok) throw new Error(await errorMessage(response))
  const data = await response.json() as { results?: AgentMediaResult[] }
  return data.results || []
}

export async function downloadOnlineMedia(media: AgentMediaResult): Promise<File> {
  const response = await fetch(portfolioDemo ? media.url : `/api/motif/media/download?url=${encodeURIComponent(media.url)}`)
  if (!response.ok) throw new Error(await errorMessage(response))
  const blob = await response.blob()
  return new File([blob], media.title, { type: blob.type || (media.kind === 'image' ? 'image/jpeg' : 'video/ogg') })
}


import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const MEDIA_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org', 'cdn.marvel.com'])
const MAX_DOWNLOAD = 180 * 1024 * 1024

const MARVEL_STILLS = [
  {
    id: 'marvel-wandavision-09-vision-wanda',
    title: '《旺达幻视》第 9 集｜幻视与旺达',
    url: 'https://cdn.marvel.com/content/1x/cds1550_109_comp_v040_20210130_r709.1015_0.webp',
    sourceUrl: 'https://www.marvel.com/articles/tv-shows/wandavision-paul-bettany-two-visions',
  },
  {
    id: 'marvel-wandavision-06-family',
    title: '《旺达幻视》第 6 集｜幻视的万圣节造型',
    url: 'https://cdn.marvel.com/content/1x/brd-106-04150_r.webp',
    sourceUrl: 'https://www.marvel.com/articles/tv-shows/wandavision-episode-6-recap',
  },
  {
    id: 'marvel-wandavision-05-home',
    title: '《旺达幻视》第 5 集｜幻视、旺达与阿加莎',
    url: 'https://cdn.marvel.com/content/1x/brd-105-04848_c.webp',
    sourceUrl: 'https://www.marvel.com/articles/tv-shows/wandavision-explore-new-images-from-episode-5',
  },
  {
    id: 'marvel-wandavision-09-westview',
    title: '《旺达幻视》第 9 集｜旺达与幻视在西景镇',
    url: 'https://cdn.marvel.com/content/1x/wfh3095_109_comp_v010_20210130_r709.1031.webp',
    sourceUrl: 'https://www.marvel.com/articles/tv-shows/wandavision-images-episode-9',
  },
]

type CommonsPage = {
  pageid: number
  title: string
  index?: number
  imageinfo?: {
    url: string
    thumburl?: string
    descriptionurl: string
    mime: string
    size: number
    extmetadata?: Record<string, { value?: string }>
  }[]
}

type MediaKind = 'image' | 'video'

function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(data))
}

function plain(value?: string) {
  return (value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim()
}

function safeMediaUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !MEDIA_HOSTS.has(url.hostname)) throw new Error('只允许下载已核验的媒体文件。')
  return url
}

function isWandaVisionQuery(query: string) {
  return /wandavision|旺达幻视|幻视|marvel.{0,12}vision|vision.{0,12}marvel/i.test(query)
}

function searchMarvelStills() {
  return MARVEL_STILLS.map((item) => ({
    ...item,
    kind: 'image',
    thumbUrl: item.url,
    license: '© Marvel / Disney · 官方剧照',
    creator: 'Marvel Studios',
    provider: 'Marvel',
  }))
}

async function searchCommons(query: string, kind: MediaKind): Promise<unknown[]> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', generator: 'search',
    gsrsearch: `filetype:${kind === 'image' ? 'bitmap' : 'video'} ${query}`,
    gsrnamespace: '6', gsrlimit: '4', gsrsort: 'relevance',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '720',
  })
  const response = await fetch(`${COMMONS_API}?${params}`, {
    headers: { 'User-Agent': 'MOTIF-Personal-Workbench/1.0 (local research tool)' },
    signal: AbortSignal.timeout(30000),
  })
  if (response.status === 429) throw new Error('开放媒体库当前请求较多，请稍后重试或缩小检索范围。')
  if (!response.ok) throw new Error(`开放媒体库返回 HTTP ${response.status}。`)
  const data = await response.json() as { query?: { pages?: CommonsPage[] } }
  return (data.query?.pages || []).sort((a, b) => (a.index || 0) - (b.index || 0)).flatMap((page) => {
    const info = page.imageinfo?.[0]
    if (!info || !info.mime.startsWith(`${kind}/`) || info.size > MAX_DOWNLOAD) return []
    try { safeMediaUrl(info.url) } catch { return [] }
    return [{
      id: `commons-${page.pageid}`,
      title: page.title.replace(/^File:/i, ''),
      kind,
      url: info.url,
      thumbUrl: info.thumburl || '',
      sourceUrl: info.descriptionurl,
      license: plain(info.extmetadata?.LicenseShortName?.value) || '以来源页为准',
      creator: plain(info.extmetadata?.Artist?.value),
      bytes: info.size,
      provider: 'Wikimedia Commons',
    }]
  })
}

async function handleSearch(url: URL, response: ServerResponse) {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 140)
  if (!query) return json(response, 400, { error: { message: '请输入素材检索词。' } })
  if (isWandaVisionQuery(query)) return json(response, 200, { query, provider: 'Marvel', results: searchMarvelStills() })
  const requested = url.searchParams.get('kind')
  const kinds: MediaKind[] = requested === 'image' || requested === 'video' ? [requested] : ['image', 'video']
  const groups = await Promise.all(kinds.map((kind) => searchCommons(query, kind)))
  json(response, 200, { query, provider: 'Wikimedia Commons', results: groups.flat() })
}

async function handleDownload(url: URL, response: ServerResponse) {
  const target = safeMediaUrl(url.searchParams.get('url') || '')
  const upstream = await fetch(target, {
    headers: { 'User-Agent': 'MOTIF-Personal-Workbench/1.0 (local research tool)' },
    signal: AbortSignal.timeout(60000),
  })
  if (upstream.status === 429) throw new Error('媒体来源当前限流，请等待片刻后重试，或打开来源页手动下载。')
  if (!upstream.ok) throw new Error(`媒体文件下载失败：HTTP ${upstream.status}。`)
  const length = Number(upstream.headers.get('content-length') || 0)
  if (length > MAX_DOWNLOAD) throw new Error('媒体文件超过 180 MB，请打开来源页另行下载。')
  const buffer = Buffer.from(await upstream.arrayBuffer())
  if (buffer.byteLength > MAX_DOWNLOAD) throw new Error('媒体文件超过 180 MB，已停止保存。')
  response.writeHead(200, {
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Content-Length': buffer.byteLength,
    'Cache-Control': 'no-store',
  })
  response.end(buffer)
}

async function handleMedia(request: IncomingMessage, response: ServerResponse) {
  try {
    if (request.method !== 'GET') return json(response, 405, { error: { message: 'Method not allowed' } })
    const url = new URL(request.url || '/', 'http://localhost')
    if (url.pathname === '/download') await handleDownload(url, response)
    else await handleSearch(url, response)
  } catch (error) {
    if (response.destroyed) return
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? '开放媒体库响应超时，请稍后重试。'
      : error instanceof Error ? error.message : '媒体检索失败，请稍后重试。'
    json(response, 400, { error: { message } })
  }
}

export function motifMediaPlugin(): Plugin {
  return {
    name: 'motif-open-media-api',
    configureServer(server) { server.middlewares.use('/api/motif/media', handleMedia) },
    configurePreviewServer(server) { server.middlewares.use('/api/motif/media', handleMedia) },
  }
}

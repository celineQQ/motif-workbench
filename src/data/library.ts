import { t } from './language'
import JSZip from 'jszip'
import type { WorkDocument } from './works'

export type AssetKind = 'image' | 'video' | 'document' | 'data'
export type LibraryFolder = {
  id: string
  name: string
  kind?: AssetKind
  assetIds: string[]
  createdAt: number
}
export type LibraryAsset = {
  id: string
  name: string
  kind: AssetKind
  src: string
  tags: string[]
  origin: 'personal' | 'upload'
  size: string
  mime: string
  createdAt: number
  content?: string
  file?: File
  sourceUrl?: string
  license?: string
}

const image = (id: string, name: string, tags: string[]): LibraryAsset => ({
  id, name, kind: 'image', src: `${import.meta.env.BASE_URL}assets/library/${id}.webp`, tags,
  origin: 'personal', size: '个人素材库', mime: 'image/webp', createdAt: 0,
})


const publicLibraryAssets: LibraryAsset[] = [
  { ...image('c_gothic', t("哥特式门廊"), [t("建筑"), t("版画")]), src: import.meta.env.BASE_URL + 'assets/collage/c_gothic.webp' },
  { ...image('c_gallery', t("古典拱廊"), [t("建筑"), t("绘画")]), src: import.meta.env.BASE_URL + 'assets/collage/c_gallery.webp' },
  { ...image('s_teapot', t("装饰茶壶"), [t("器物"), t("陶瓷")]), src: import.meta.env.BASE_URL + 'assets/collage/s_teapot.webp' },
]

export const initialLibraryAssets = publicLibraryAssets

export const mediaKinds: { id: AssetKind; label: string; accept: string }[] = [
  { id: 'image', label: t("图片"), accept: 'image/*' },
  { id: 'video', label: t("视频"), accept: 'video/*,.mkv' },
  { id: 'document', label: t("文稿"), accept: '.txt,.md,.markdown,.pdf,.doc,.docx,.rtf,.odt,.ppt,.pptx' },
  { id: 'data', label: t("数据"), accept: '.csv,.tsv,.json,.xml,.xls,.xlsx' },
]

export const allSupportedAccept = mediaKinds.map((item) => item.accept).join(',')

export function documentToLibraryAsset(document: WorkDocument): LibraryAsset {
  return {
    id: document.id,
    name: `${document.title.trim() || t("未命名文稿")}.md`,
    kind: 'document',
    src: '',
    tags: document.tags,
    origin: 'personal',
    size: `${document.content.length} ${t("字符")}`,
    mime: 'text/markdown',
    createdAt: document.updatedAt,
    content: document.content,
  }
}

export const formatSize = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`

export function assetExtension(asset: LibraryAsset) {
  return asset.name.split('.').pop()?.toUpperCase() || (asset.kind === 'image' ? 'WEBP' : 'FILE')
}

export function kindFromFile(file: File): AssetKind | null {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (file.type.startsWith('image/') || /^(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(extension)) return 'image'
  if (file.type.startsWith('video/') || /^(mp4|webm|mov|m4v|ogv|mkv|avi)$/.test(extension)) return 'video'
  if (/^(csv|tsv|json|xml|xlsx?)$/.test(extension) || /^(application\/(json|xml)|text\/(csv|xml))$/.test(file.type)) return 'data'
  if (/^(txt|md|markdown|pdf|docx?|rtf|odt|pptx?)$/.test(extension) || file.type.startsWith('text/')) return 'document'
  return null
}

export async function createAssetFromFile(file: File, kind: AssetKind): Promise<LibraryAsset> {
  const readableDocument = kind === 'document' && (/\.(txt|md|markdown)$/i.test(file.name) || /^text\/(plain|markdown)/.test(file.type))
  const readableData = kind === 'data' && /\.(csv|tsv|json|xml)$/i.test(file.name)
  const readable = readableDocument || readableData
  return {
    id: `upload-${crypto.randomUUID()}`,
    name: file.name,
    kind,
    src: URL.createObjectURL(file),
    tags: [],
    origin: 'upload',
    size: formatSize(file.size),
    mime: file.type || 'application/octet-stream',
    createdAt: Date.now(),
    content: readable ? await file.text() : undefined,
    file,
  }
}

export function fileNameForAsset(asset: LibraryAsset) {
  if (/\.[a-z0-9]+$/i.test(asset.name)) return asset.name
  const extension = asset.kind === 'document' ? '.md' : asset.src.match(/\.[a-z0-9]+$/i)?.[0] || (asset.kind === 'video' ? '.mp4' : asset.kind === 'data' ? '.csv' : '.webp')
  return `${asset.name}${extension}`
}

export function downloadFile(url: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  downloadBlob(blob, filename)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  downloadFile(url, filename)
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function assetBlob(asset: LibraryAsset): Promise<Blob> {
  if (asset.file) return asset.file
  if (asset.content !== undefined) return new Blob([asset.content], { type: 'text/markdown;charset=utf-8' })
  if (!asset.src) throw new Error(`「${asset.name}」的原文件不可用，请重新上传。`)
  const response = await fetch(asset.src)
  if (!response.ok) throw new Error(`无法读取「${asset.name}」。`)
  return response.blob()
}

export async function downloadAsset(asset: LibraryAsset) {
  downloadBlob(await assetBlob(asset), fileNameForAsset(asset))
}

export async function exportAssetsZip(assets: LibraryAsset[], kind: AssetKind | 'all') {
  if (!assets.length) throw new Error('当前视图还没有可导出的素材。')
  const zip = new JSZip()
  const usedNames = new Set<string>()
  for (const asset of assets) {
    const original = fileNameForAsset(asset)
    let filename = original
    let suffix = 2
    while (usedNames.has(filename)) {
      const dot = original.lastIndexOf('.')
      filename = dot > 0 ? `${original.slice(0, dot)}-${suffix}${original.slice(dot)}` : `${original}-${suffix}`
      suffix += 1
    }
    usedNames.add(filename)
    zip.file(filename, await assetBlob(asset))
  }
  zip.file('MOTIF-index.md', ['# MOTIF 素材索引', '', ...assets.map((asset) => `- ${fileNameForAsset(asset)}｜${mediaKinds.find((item) => item.id === asset.kind)?.label || asset.kind}`)].join('\n'))
  const blob = await zip.generateAsync({ type: 'blob' })
  const label = kind === 'all' ? '全部素材' : mediaKinds.find((item) => item.id === kind)?.label || kind
  downloadBlob(blob, `MOTIF-${label}-${new Date().toISOString().slice(0, 10)}.zip`)
}


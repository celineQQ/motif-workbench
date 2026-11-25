import { isEnglish, t } from './language'
import { createAssetFromFile } from './library'
import type { AssetKind } from './library'

export const frankensteinTitle = t("从弗兰肯斯坦到幻视")

export const visionTask = isEnglish ? 'Vision research: Compare agency and belonging in the comics and WandaVision' : '幻视研究：对照漫画与《旺达幻视》，各选一条自主选择或家庭归属的证据'

export const frankensteinTheme = t("当造物有了感情，人类该如何回应？")
export const frankensteinDescription = isEnglish ? 'When our creations feel, how should we respond? Compare Mary Shelley, the 1910 and 2025 films, and Vision across comics and television.' : '当造物有了感情，人类该如何回应？比较雪莱原著、1910 年与 2025 年两版电影，以及幻视的漫画与剧集。'

const sources = [
  ["人造物情感研究提纲.md", t("人造物情感研究提纲.md"), 'text/markdown', 'document', ''],
  ['frankenstein-1831-frontispiece.jpg', t("1831 年卷首插画.jpg"), 'image/jpeg', 'image', 'Frontispiece_to_Frankenstein_1831.jpg'],
  ['frankenstein-1910-poster.jpg', t("1910 年电影海报.jpg"), 'image/jpeg', 'image', 'Poster_Frankenstein_film_1910.jpg'],
  ['frankenstein-1910-still.jpg', t("1910 年电影剧照.jpg"), 'image/jpeg', 'image', 'Frankenstein1910.jpg'],
  ['frankenstein-1910-film.mp4', t("1910 年《弗兰肯斯坦》完整短片.mp4"), 'video/mp4', 'video', 'Frankenstein_(1910)_-_Full_Movie.ogv'],
  ["幻视研究任务与资料.md", t("幻视研究任务与资料.md"), 'text/markdown', 'document', ''],
  ["来源索引｜从弗兰肯斯坦到幻视.md", t("来源索引｜从弗兰肯斯坦到幻视.md"), 'text/markdown', 'document', ''],
] as const satisfies readonly (readonly [string, string, string, AssetKind, string])[]

export async function loadFrankensteinAssets() {
  return Promise.all(sources.map(async ([filename, title, mime, kind, commons]) => {
    const filePath = isEnglish && kind === 'document' ? title : filename
    const response = await fetch(import.meta.env.BASE_URL + 'frankenstein/' + encodeURIComponent(filePath))
    if (!response.ok || response.headers.get('Content-Type')?.startsWith('text/html')) throw new Error('无法加载 ' + title)
    const file = new File([await response.blob()], title, { type: mime })
    return {
      ...await createAssetFromFile(file, kind),
      // Keep the original ID so existing projects retain their link to the film.
      id: 'frankenstein-source-' + (kind === 'video' ? 'frankenstein-1910-film.ogv' : filename),
      tags: [t("人造生命"), t("造物与自主性")],
      sourceUrl: commons ? 'https://commons.wikimedia.org/wiki/File:' + commons : undefined,
      license: commons ? t("公版标记及适用地区见来源页") : undefined,
    }
  }))
}


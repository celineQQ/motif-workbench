import { t } from '../data/language'
import { useState } from 'react'
import './VisionMediaShelf.css'

const references = [
  { title: t("《弗兰肯斯坦》（2025）· 造物剧照"), category: t("德尔·托罗版 · Ken Woroner / Netflix"), image: 'https://dnm.nflximg.net/api/v6/a01MIaQTUgSJoLaS_OCn68Eg3hU/AAAAQdAE5GfnqcXYAcjNmdi9x7AqiXy5w4aqEgN2hEiE1mjG5I0mq840Wqh9aNkKrq86P9-1rv_xrp1ng4AhuHxdJ-UEvXSUqAMb7AD4cCMwP5uVEc-xXlt0C4M0dkEi7--xzAmyEae6oa76MDCd0mwkl6mx.jpg?r=15b', source: 'https://www.netflix.com/tudum/articles/frankenstein-trailer-guillermo-del-toro' },
  { title: t("VisionQuest 剧照 · 幻视"), category: t("2026 新剧 · Disney+"), image: 'https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/7BAF6982D2A600C6A95F5BFAE641696BF794AB7BFE1DB3DA67A164420B55E30C/compose?format=webp&width=2560', source: 'https://www.disneyplus.com/en-gb/explore/articles/marvel-visionquest' },
  {
    title: t("VisionQuest 官方海报"), category: t("2026 新剧 · Disney+"),
    image: 'https://lumiere-a.akamaihd.net/v1/images/vq_poster_7dd3795f.jpeg?region=0%2C0%2C560%2C800',
    source: 'https://press.disney.co.uk/press-kit/visionquest-press-kit',
  },
  {
    title: t("《旺达幻视》剧照"), category: t("剧照 · Marvel Studios / Inverse"),
    image: 'https://imgix.bustle.com/uploads/image/2021/1/20/0580c94e-d19e-4736-a587-b4514962f8f2-wbb0110_102_comp_v017_20201119_r709126540.jpg',
    source: 'https://www.inverse.com/entertainment/wandavision-tom-kim-the-vision',
  },
  {
    title: t("《旺达幻视》官方海报"), category: t("海报 · Disney+"),
    image: 'https://lumiere-a.akamaihd.net/v1/images/br_digital_payoff_keyart_v3_lg_44751099.jpeg?region=0%2C0%2C1688%2C2500',
    source: 'https://press.disneyplus.com/media-kits/wandavision',
  },
  {
    title: t("《Vision》2015 年第 1 期封面"), category: t("漫画 · Marvel"),
    image: 'https://image.keycollectorcomics.com/media/404ad47f-d516-4fb4-bce5-b97b82d17d3a.jpg',
    source: 'https://share.marvel.com/comics/discover/702/declan-shalveys-top-picks',
    imageSource: 'https://www.keycollectorcomics.com/series/vision%2C6914/',
  },
]

const trailers = [
  { id: '9WZllcEgWrM', title: t("《弗兰肯斯坦》（2025）最终预告"), category: t("Netflix 官方视频") },
  { id: 'sXKnmgmbkoE', title: t("VisionQuest 官方正式预告"), category: t("2026 新剧 · Marvel") },
  { id: 'sj9J2ecsSpo', title: t("《旺达幻视》官方预告"), category: t("2021 剧集 · Disney+") },
]

function TrailerCard({ id, title, category }: (typeof trailers)[number]) {
  const [play, setPlay] = useState(false)
  return <figure>
    {play ? <iframe src={'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1'} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      : <button type="button" onClick={() => setPlay(true)} aria-label={t("播放") + title}><img src={'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'} alt="" loading="lazy" /><span aria-hidden="true">▶</span></button>}
    <figcaption><small>{category}</small><a href={'https://www.youtube.com/watch?v=' + id} target="_blank" rel="noreferrer">{title} {t("· 在 YouTube 打开")}</a></figcaption>
  </figure>
}

export function VisionMediaShelf() {
  return <section className="vision-media-shelf" aria-labelledby="vision-media-title">
    <header><h3 id="vision-media-title">{t("弗兰肯斯坦与幻视 · 影像资料")}</h3><p>{t("从漫画与《旺达幻视》，追到 2026 年新剧《VisionQuest》。比较幻视如何面对创造者留下的用途。")}</p><p><a href="https://lumiere-a.akamaihd.net/v1/documents/vq_uk_final_production_notes_and_bios_7240745b.pdf" target="_blank" rel="noreferrer">{t("VisionQuest 官方制作资料 PDF")}</a></p></header>
    <div className="vision-media-grid">
      {references.map((reference) => <figure key={reference.title}>
        <a href={reference.imageSource ?? reference.source} target="_blank" rel="noreferrer">
          <img src={reference.image} alt={reference.title} loading="lazy" referrerPolicy="no-referrer" />
        </a>
        <figcaption><small>{reference.category}</small><a href={reference.source} target="_blank" rel="noreferrer">{reference.title}</a></figcaption>
      </figure>)}
      {trailers.map((trailer) => <TrailerCard key={trailer.id} {...trailer} />)}
    </div>
  </section>
}



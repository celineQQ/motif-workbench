# MOTIF — Asset and interaction credits

## Reference study

MOTIF studies the interaction mechanics of **Trianon** by qimingjiu:
https://github.com/qimingjiu/Trianon

The implementation in this project is written for React. It translates the reference's staggered dealing, layered peel, ruler slider, pointer capture, keyboard control, and independent hanging-tag navigation into a different purple-and-green personal atelier. No Trianon page or generated portrait is embedded.

Trianon's code is MIT licensed. Its copyright notice is preserved at `public/licenses/TRIANON-MIT.txt`. Images and fonts have separate terms, listed below and in the upstream `ASSETS.md`.

## Museum images — public domain / CC0

The following recoloured derivative assets were obtained from Trianon's `src/e5v/out/`. The upstream project releases these derivatives under CC0. Original collection credits:

- `c_gothic.webp`: John Sell Cotman, *Doorway, Heckingham Church*, 1816–18. The Met 53.510.1, CC0. https://www.metmuseum.org/art/collection/search/363010
- `c_gallery.webp`: Francesco Guardi, *Architectural Capriccio: Vaulted Colonnade of a Palace*. The Met 338938, CC0. https://www.metmuseum.org/art/collection/search/338938
- `s_teapot.webp`: Barthélemy Decourchelle, *Teapot*, c. 1752. The Met 200375, CC0. https://www.metmuseum.org/art/collection/search/200375
- `s_plate.webp`: Chelsea Porcelain, *Botanical dish with spray of lilies*, c. 1755. The Met / Wikimedia Commons, CC0. https://commons.wikimedia.org/wiki/File:Botanical_dish_with_spray_of_lilies_MET_DP-1687-039.jpg
- `s_arch.webp`: Paul Letarouilly, *Édifices de Rome moderne* (plate). Wikimedia Commons, public domain. https://commons.wikimedia.org/wiki/File:Edifices_de_Rome_moderne_1944_(142374199).jpg
- `crest.webp`: *Bookplate – William, Duke of Bedford*. Wikimedia Commons, public domain. https://commons.wikimedia.org/wiki/File:Bookplate-William_Duke_of_Bedford.jpg

## Hanging-tag icons — CC0 upstream assets

`t_browser.png`, `t_new.png`, `t_files.png`, `t_fav.png`, `t_history.png`, `t_terminal.png`, and `t_settings.png` come from Trianon's `src/r2v/gen/`. They are existing upstream assets, not images generated for MOTIF. Trianon explicitly provides this folder under CC0 1.0.

## Fonts — SIL OFL 1.1

- `play.woff2`: Playfair Display subset, renamed TrianonPlayfair upstream.
- `corm.woff2`: Cormorant Garamond Light Italic.
- `pinyon.woff2`: Pinyon Script.
- `motif-archive-cjk.woff`: a web subset of **香萃打字机体 W35** (XiangcuiDazijitiW35), supplied from the owner's font library. The subset is renamed **Motif Archive CJK** and retains the original copyright and license metadata. It is used for Chinese tasks, notes, and interface copy alongside the English display faces.

The corresponding OFL texts are preserved in `public/licenses/`, including `OFL-xiangcui-dazijiti.txt`.

## Interface icons

Small action icons (close, check, arrow, moon, and similar controls) are from `lucide-react`, licensed under ISC. The main navigation destinations use distinct bitmap tags above; Settings uses a CSS-rendered transparent dip pen.

## Knowledge atlas

The atlas's force-directed three-dimensional layout uses **d3-force-3d** by Vasco Asturiano, MIT licensed: https://github.com/vasturiano/d3-force-3d . Canvas projection, node interaction, the flat project–motif tree, and all project data are implemented for MOTIF. The structural reference is Acemap's article on knowledge nebulae, supplied by the owner: https://zhuanlan.zhihu.com/p/186297757 . No Acemap images or datasets are embedded.

## Local files and export

ZIP packaging uses **JSZip**, MIT licensed: https://github.com/Stuk/jszip . Uploaded files, readable text, and manual tags are stored locally with the browser's IndexedDB. Vision Board PNG export is drawn with the native Canvas API from the editor's actual item geometry. No external export service is used.

Historical materials are credited in the case-study source index. Marvel and Disney materials use external references. Third-party media retain their own terms.

# 中华艺术博物馆 · Museum of Chinese Art (3D)

A **3D virtual museum** of historical Chinese art that you can walk through in
your browser. Built with [three.js](https://threejs.org/); every artwork and its
metadata are sourced from **Wikimedia Commons** and **Wikidata**.

> **▶ Live site:** https://ekzhu.github.io/art-museum/
>
> *(If the link 404s, the first deploy may still be running — see
> [Deployment](#deployment).)*

---

## What it is

Arrive on the plaza, climb the steps through a columned **portico** (sweeping
tiled roof, gilded signboard, guardian lions), cross the **grand lobby**
(reception desk, velvet rope) into a skylit central **atrium**, and wander, in
first person, through **nine themed exhibition halls**, a **documentary
theatre**, and a **scholar's-garden courtyard**. Low-poly **visitors** stroll
the galleries and pause to view the art. Each hall has its own palette,
lighting, dimensional mouldings, ornament and chronological wall of works:

| 馆 Hall | Theme |
|---|---|
| 绘画 **Painting** | Ink-and-brush landscapes, bird-and-flower & literati painting |
| 书法 **Calligraphy** | Seal, clerical, regular, running & cursive scripts |
| 陶瓷 **Ceramics & Porcelain** | Tang sancai, Song celadon, blue-and-white, famille rose |
| 青铜器 **Ritual Bronzes** | Shang & Zhou vessels, taotie masks, mirrors & bells |
| 玉器 **Jade** | Neolithic Liangzhu *cong* & *bi*, Hongshan dragons, later carvings |
| 佛造像 **Buddhist Sculpture** | Yungang, Longmen & cave-temple icons, gilt Buddhas |
| 陶俑 **Tomb Figures** | The Terracotta Army, Tang sancai horses, *mingqi* |
| 织绣 **Silk & Textiles** | Kesi tapestry, embroidery, dragon robes |
| 工艺 **Decorative Arts** | Lacquer, cloisonné, snuff bottles, fans, furniture, inkstones |

Walk up to any piece and press **E** (or click) to see a high-resolution image
and full catalogue details — title, artist, dynasty, medium, collection,
description and a link to its Wikimedia source. In the theatre, press **E** at
the screen to watch curated, embeddable documentaries (Terracotta Army, the
Forbidden City, Dunhuang, bronzes, porcelain, jade) in an in-app player.

The collection is **curated**, not dumped: a denylist + provenance gate removes
stray photos, and quality-weighted scoring keeps the best of each hall, drawing
on museum collections (the Met, British Museum, Cleveland) — so you'll find real
masterpieces like Han Gan's *Night-Shining White* and Huang Tingjian's
calligraphy rather than tourist snapshots.

## Controls

| Key | Action |
|---|---|
| **W A S D** / arrows | Walk |
| **Mouse** | Look around |
| **Shift** | Stride (run) |
| **E** / click | View the artwork you're facing |
| **M** | Open the hall directory (click a hall to walk there) |
| **Esc** | Release the mouse |

## How it works

The project is split into a **build-time data pipeline** and a **runtime 3D
client** — exactly as the brief asked: *build the database first.*

### 1. The database (`scripts/fetch-data.mjs`)

A Node script assembles `data/artworks.json` from two complementary Wikimedia
sources, with **no API keys**:

- **Wikidata SPARQL** — structured records (creator, inception, material,
  collection, genre) for art forms Wikidata covers well (paintings, ritual
  bronzes, sculpture, silk).
- **Wikimedia Commons category crawl** — a breadth-first walk of curated,
  file-rich category trees for the art forms Wikidata is thin on (ceramics,
  jade, calligraphy, cave sculpture, tomb figures, textiles, lacquer…).

Every distinct image is then enriched (batched `imageinfo`) with a **direct
CDN thumbnail URL**, original-resolution URL, real pixel dimensions and
license/attribution. Records are de-duplicated, assigned a single hall, dated to
a dynasty/period, titles are cleaned (timestamps, accession codes and
museum-photo filenames stripped; sensible titles synthesised where needed), and
balanced per hall — yielding **~1,700 works** spanning the Neolithic to the 20th
century.

```bash
npm run fetch-data                        # full rebuild (Wikidata + Commons crawl + enrich)
node scripts/fetch-data.mjs --reenrich    # refresh just the wall-texture URLs
node scripts/fetch-data.mjs --refinalize  # re-run cleanup from the raw cache
```

### 2. The 3D client (`js/`)

Pure ES modules; three.js is **vendored** in `js/vendor/` (no runtime CDN
dependency). Module map:

| Module | Role |
|---|---|
| `curation.js` | Hall themes: bilingual names, palettes, lighting, motifs, intros |
| `building.js` | Procedural architecture from a grid floor-plan: the portico/plaza/steps, grand lobby, halls, theatre, walls, ornate doorways, dimensional mouldings, columns, the atrium's caisson skylight, sky dome, collision map |
| `decor.js` | Ornament: palace lanterns, name-banners, lattice screens, vitrines with lathed vases, lobby reception |
| `garden.js` | Scholar's garden: faux Taihu-rock mountain, reflecting pond, moon-bridge, pavilion, moon gate, lantern, plantings |
| `theatre.js` | Documentary screening room: glowing screen, seating, posters, the embeddable film program |
| `furniture.js` | Benches, reception desk, rope stanchions, sign panels (with collision) |
| `npc.js` | Wandering low-poly visitors that stroll, pause and view the art |
| `textures.js` | Procedural canvas textures (marble, wood, lattice, key-fret, motifs) — no external image assets |
| `artworks.js` | Lays out every piece on walls/partitions; frustum-prioritised texture streaming with an LRU memory cap |
| `player.js` | Pointer-lock mouselook + WASD with wall-sliding collision |
| `ui.js` | Start screen, HUD, the detail panel, hall directory and cinema modal |
| `main.js` | Bootstrap, render loop, per-hall visibility + light culling, interaction |

**Performance.** Artwork images are unlit (`MeshBasicMaterial`) for perfect
colour at zero lighting cost; only the player's current hall and its neighbours
are rendered (per-hall visibility culling); wall textures are small (~500 px),
streamed by proximity and capped by an LRU so GPU memory stays bounded. The
result stays smooth as you navigate. Images hot-link Wikimedia's global CDN, so
the repository stays tiny.

## Running locally

No build step. Serve the folder over HTTP (ES modules need it) and open it:

```bash
python3 -m http.server 8000   # or: npm run serve
# then visit http://localhost:8000/
```

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) publishes the
site to **GitHub Pages from `main`** on every push, and attempts to enable Pages
automatically. If Pages isn't on yet, enable it once at
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Credits & licensing

- **Artworks & metadata:** [Wikimedia Commons](https://commons.wikimedia.org/)
  and [Wikidata](https://www.wikidata.org/). Each work keeps its own
  license / public-domain status and attribution, shown in the detail panel and
  linked to its Commons page. Please respect those terms for any reuse.
- **Engine:** [three.js](https://threejs.org/) (MIT), vendored.
- **This project's code:** MIT — see [`LICENSE`](LICENSE).

Made as an educational, non-commercial celebration of five thousand years of
Chinese art.

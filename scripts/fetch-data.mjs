#!/usr/bin/env node
/**
 * fetch-data.mjs — builds the museum's artwork database from Wikimedia.
 * ------------------------------------------------------------------
 * Two complementary harvesters feed one merged, de-duplicated database:
 *
 *   A. Wikidata SPARQL  — structured records (creator, inception, material,
 *      collection, genre) for art forms Wikidata covers well: paintings,
 *      ritual bronzes, sculpture, silk.
 *
 *   B. Commons category crawl — a breadth-first walk of curated, file-rich
 *      Commons category trees for the art forms Wikidata is thin on:
 *      ceramics, jade, calligraphy, Buddhist sculpture, tomb figures,
 *      textiles, lacquer / cloisonné and other decorative arts.
 *
 * Every distinct image is then enriched once via the Commons `imageinfo`
 * API (direct CDN thumbnail + original URL, real pixel size, license and
 * attribution). Records are assigned a single exhibition hall and a dynasty
 * / period, capped per hall for a balanced layout, and written to
 * ../data/artworks.json (+ ../data/stats.json).
 *
 * No API keys. Polite User-Agent + modest pacing per Wikimedia etiquette.
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

const UA =
  'ChineseArtMuseum/1.0 (https://github.com/ekzhu/art-museum; educational virtual museum) node';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WALL_WIDTH = 500;    // px width of in-world wall textures (honored exactly by the API)
const WALL_DISPLAY = 500;  // px width used by the --reenrich path; 500 is honored exactly

// Per-hall display cap (keeps the museum balanced + performant). Quality-ranked.
const HALL_CAP = {
  painting: 130,
  calligraphy: 90,
  ceramics: 130,
  bronze: 110,
  jade: 100,
  sculpture: 120,
  tomb: 110,
  textiles: 100,
  decorative: 120,
};

// ----------------------------------------------------------------------------
// Generic helpers
// ----------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url, opts = {}, tries = 5) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: { 'User-Agent': UA, Accept: 'application/json', ...(opts.headers || {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(Math.min(1500 * attempt, 10000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === tries) throw err;
      await sleep(Math.min(1500 * attempt, 10000));
    }
  }
}

async function runSparql(query) {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  return (await fetchJSON(url)).results.bindings;
}

// POST variant — used for imageinfo where long file names blow the GET URL limit.
async function postJSON(url, params, tries = 5) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      if (res.status === 429 || res.status >= 500) { await sleep(Math.min(1500 * attempt, 10000)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === tries) throw err;
      await sleep(Math.min(1500 * attempt, 10000));
    }
  }
}

function stripHtml(s) {
  if (!s) return '';
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const qid = (uri) => (uri && uri.match(/Q\d+$/) ? uri.match(/Q\d+$/)[0] : null);

function normFile(name) {
  // Normalize a Commons file title to a stable key (no "File:" prefix, spaces).
  let n = name.replace(/^File:/i, '').trim();
  try { n = decodeURIComponent(n); } catch { /* keep */ }
  return n.replace(/_/g, ' ');
}

function fileNameFromImageUri(uri) {
  if (!uri) return null;
  const idx = uri.indexOf('Special:FilePath/');
  let name = idx >= 0 ? uri.slice(idx + 'Special:FilePath/'.length) : uri.split('/').pop();
  return normFile(name);
}

// ----------------------------------------------------------------------------
// Dynasty / period
// ----------------------------------------------------------------------------
const PERIODS = [
  { name: 'Neolithic', zh: '新石器时代', from: -10000, to: -2071, order: 0 },
  { name: 'Shang & Western Zhou', zh: '商 · 西周', from: -2070, to: -771, order: 1 },
  { name: 'Eastern Zhou', zh: '东周', from: -770, to: -222, order: 2 },
  { name: 'Qin', zh: '秦', from: -221, to: -207, order: 3 },
  { name: 'Han', zh: '汉', from: -206, to: 220, order: 4 },
  { name: 'Six Dynasties', zh: '魏晋南北朝', from: 221, to: 580, order: 5 },
  { name: 'Sui & Tang', zh: '隋 · 唐', from: 581, to: 906, order: 6 },
  { name: 'Five Dynasties', zh: '五代', from: 907, to: 959, order: 7 },
  { name: 'Song', zh: '宋', from: 960, to: 1278, order: 8 },
  { name: 'Yuan', zh: '元', from: 1271, to: 1368, order: 9 },
  { name: 'Ming', zh: '明', from: 1368, to: 1644, order: 10 },
  { name: 'Qing', zh: '清', from: 1644, to: 1911, order: 11 },
  { name: 'Modern', zh: '近现代', from: 1912, to: 2100, order: 12 },
];
const periodOrder = Object.fromEntries(PERIODS.map((p) => [p.name, p.order]));

const ORIGIN_QID_TO_PERIOD = {
  Q9683: 'Sui & Tang', Q156588: 'Sui & Tang', Q7462: 'Song', Q7209: 'Han',
  Q42211: 'Han', Q9903: 'Ming', Q8733: 'Qing', Q7350: 'Yuan', Q1142960: 'Five Dynasties',
};

function periodForYear(year) {
  if (year == null || Number.isNaN(year)) return null;
  for (const p of PERIODS) if (year >= p.from && year <= p.to) return p.name;
  return null;
}
function parseYear(inception) {
  if (!inception) return null;
  const m = inception.match(/^(-?)(\d{1,6})-/);
  if (!m) return null;
  return (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10);
}
// Parse a dynasty/period out of free text (category names, titles, descriptions).
function periodFromText(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/liangzhu|hongshan|neolithic|majiayao|longshan|yangshao/.test(t)) return 'Neolithic';
  if (/shang dynasty|\bshang\b|western zhou/.test(t)) return 'Shang & Western Zhou';
  if (/eastern zhou|spring and autumn|warring states|\bzhou dynasty\b/.test(t)) return 'Eastern Zhou';
  if (/qin dynasty|terracotta/.test(t)) return /terracotta/.test(t) ? 'Qin' : 'Qin';
  if (/han dynasty|\bhan\b/.test(t)) return 'Han';
  if (/(northern|southern) dynast|six dynasties|jin dynasty|wei dynasty|northern wei/.test(t)) return 'Six Dynasties';
  if (/tang dynasty|\btang\b|sui dynasty/.test(t)) return 'Sui & Tang';
  if (/five dynasties/.test(t)) return 'Five Dynasties';
  if (/song dynasty|\bsong\b/.test(t)) return 'Song';
  if (/yuan dynasty|\byuan\b/.test(t)) return 'Yuan';
  if (/ming dynasty|\bming\b/.test(t)) return 'Ming';
  if (/qing dynasty|\bqing\b|qianlong|kangxi|yongzheng|jiaqing/.test(t)) return 'Qing';
  if (/republic of china|20th century|19[0-9]\d/.test(t)) return 'Modern';
  return null;
}

// ----------------------------------------------------------------------------
// Master record store, keyed by normalized Commons file name.
// ----------------------------------------------------------------------------
/** @type {Map<string, any>} */
const records = new Map();
function getRecord(file) {
  const key = normFile(file);
  let rec = records.get(key);
  if (!rec) {
    rec = {
      file: key, halls: new Set(), periodHints: new Set(), sourceCats: new Set(),
      types: new Set(), creators: new Set(), materials: new Set(), collections: new Set(),
      genres: new Set(), originQids: new Set(), originLabels: new Set(),
      title: null, inception: null,
    };
    records.set(key, rec);
  }
  return rec;
}

// ----------------------------------------------------------------------------
// PART A — Wikidata SPARQL harvest
// ----------------------------------------------------------------------------
const CHINESE_ORIGIN = `{ ?item wdt:P495 wd:Q29520 . } UNION { ?item wdt:P495 ?ori . ?ori wdt:P17 wd:Q29520 . }`;

function buildQuery(whereBody, limit = 800) {
  return `
SELECT ?item ?itemLabel ?typeLabel ?creatorLabel ?inception ?materialLabel
       ?collectionLabel ?genreLabel ?img ?originLabel ?origin WHERE {
  ${whereBody}
  ?item wdt:P18 ?img .
  OPTIONAL { ?item wdt:P31 ?type . }
  OPTIONAL { ?item wdt:P170 ?creator . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P186 ?material . }
  OPTIONAL { ?item wdt:P195 ?collection . }
  OPTIONAL { ?item wdt:P136 ?genre . }
  OPTIONAL { ?item wdt:P495 ?origin . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,zh,zh-hans,zh-hant,mul". }
}
LIMIT ${limit}`;
}

const WIKIDATA_QUERIES = [
  { hall: 'painting', q: buildQuery(`${CHINESE_ORIGIN}\n  ?item wdt:P31/wdt:P279* wd:Q3305213 .`, 1000) },
  { hall: 'painting', q: buildQuery(`${CHINESE_ORIGIN}\n  ?item wdt:P31 ?type .`, 1500) }, // catch-all (mostly paintings)
  { hall: 'bronze', q: buildQuery(`?item wdt:P31/wdt:P279* wd:Q4167876 .`, 400) }, // Chinese ritual bronzes (inherently Chinese)
  { hall: 'sculpture', q: buildQuery(`${CHINESE_ORIGIN}\n  ?item wdt:P31/wdt:P279* wd:Q860861 .`, 400) },
  { hall: 'sculpture', q: buildQuery(`${CHINESE_ORIGIN}\n  ?item wdt:P31/wdt:P279* wd:Q179700 .`, 400) },
  { hall: 'textiles', q: buildQuery(`?item wdt:P186 wd:Q37681 . ${CHINESE_ORIGIN}`, 400) }, // silk
  { hall: 'textiles', q: buildQuery(`${CHINESE_ORIGIN}\n  ?item wdt:P31/wdt:P279* wd:Q28823 .`, 400) }, // textile
  { hall: 'ceramics', q: buildQuery(`?item wdt:P186 wd:Q130693 . ${CHINESE_ORIGIN}`, 400) }, // porcelain
  { hall: 'ceramics', q: buildQuery(`?item wdt:P31/wdt:P279* wd:Q1074328 . ?item wdt:P18 ?x`, 400) }, // Chinese ceramics class
];

function ingestWikidata(rows, hall) {
  for (const r of rows) {
    const file = fileNameFromImageUri(r.img?.value);
    if (!file) continue;
    const rec = getRecord(file);
    rec.halls.add(hall);
    rec.wikidata = qid(r.item?.value) || rec.wikidata;
    if (!rec.title && r.itemLabel?.value && !/^Q\d+$/.test(r.itemLabel.value)) rec.title = r.itemLabel.value;
    const add = (set, v) => { if (v && !/^Q\d+$/.test(v)) set.add(v); };
    add(rec.types, r.typeLabel?.value);
    add(rec.creators, r.creatorLabel?.value);
    add(rec.materials, r.materialLabel?.value);
    add(rec.collections, r.collectionLabel?.value);
    add(rec.genres, r.genreLabel?.value);
    add(rec.originLabels, r.originLabel?.value);
    if (!rec.inception && r.inception?.value) rec.inception = r.inception.value;
    const oq = qid(r.origin?.value);
    if (oq) rec.originQids.add(oq);
  }
}

async function harvestWikidata() {
  for (let i = 0; i < WIKIDATA_QUERIES.length; i++) {
    const { hall, q } = WIKIDATA_QUERIES[i];
    process.stderr.write(`▶ Wikidata [${i + 1}/${WIKIDATA_QUERIES.length}] ${hall} ... `);
    try {
      const rows = await runSparql(q);
      ingestWikidata(rows, hall);
      process.stderr.write(`${rows.length} rows\n`);
    } catch (err) {
      process.stderr.write(`FAILED: ${err.message}\n`);
    }
    await sleep(500);
  }
}

// ----------------------------------------------------------------------------
// PART B — Commons category crawl (breadth-first, capped)
// ----------------------------------------------------------------------------
// roots: array of {hall, cat, period?} curated, file-rich category trees.
const COMMONS_ROOTS = [
  // Ceramics & porcelain
  { hall: 'ceramics', cat: 'Ceramics of China' },
  { hall: 'ceramics', cat: 'Porcelain of China' },
  { hall: 'ceramics', cat: 'Longquan celadon', period: 'Song' },
  { hall: 'ceramics', cat: 'Ru ware', period: 'Song' },
  { hall: 'ceramics', cat: 'Chinese export porcelain', period: 'Qing' },
  // Bronze
  { hall: 'bronze', cat: 'Chinese ritual bronzes' },
  { hall: 'bronze', cat: 'Bronze objects in China' },
  // Jade
  { hall: 'jade', cat: 'Chinese jade' },
  { hall: 'jade', cat: 'Liangzhu culture', period: 'Neolithic' },
  { hall: 'jade', cat: 'Hongshan culture', period: 'Neolithic' },
  // Calligraphy
  { hall: 'calligraphy', cat: 'Chinese calligraphy' },
  // Buddhist & stone sculpture
  { hall: 'sculpture', cat: 'Buddhist statues in China' },
  { hall: 'sculpture', cat: 'Buddhist statues from China' },
  { hall: 'sculpture', cat: 'Longmen Grottoes', period: 'Sui & Tang' },
  { hall: 'sculpture', cat: 'Yungang Grottoes', period: 'Six Dynasties' },
  // Tomb figures
  { hall: 'tomb', cat: 'Terracotta Army', period: 'Qin' },
  { hall: 'tomb', cat: 'Ceramic statues of the Tang Dynasty', period: 'Sui & Tang' },
  { hall: 'tomb', cat: 'Mingqi' },
  // Textiles
  { hall: 'textiles', cat: 'Textiles of China' },
  { hall: 'textiles', cat: 'Chinese silk' },
  { hall: 'textiles', cat: 'Chinese embroidery' },
  // Decorative arts
  { hall: 'decorative', cat: 'Lacquerware of China' },
  { hall: 'decorative', cat: 'Carved lacquer from China' },
  { hall: 'decorative', cat: 'Cloisonné of China' },
  { hall: 'decorative', cat: 'Snuff bottles' },
  { hall: 'decorative', cat: 'Chinese fans' },
  { hall: 'decorative', cat: 'Chinese furniture' },
  { hall: 'decorative', cat: 'Inkstones' },
  // A little more painting depth from Commons (well-curated museum scans)
  { hall: 'painting', cat: 'Paintings in the Palace Museum' },

  // High-provenance museum collections — well-catalogued, museum-quality scans
  // (the curation pass strongly rewards these).
  { hall: 'painting', cat: 'Chinese paintings in the Metropolitan Museum of Art' },
  { hall: 'painting', cat: 'Chinese paintings in the Cleveland Museum of Art' },
  { hall: 'calligraphy', cat: 'Chinese calligraphy in the Metropolitan Museum of Art' },
  { hall: 'calligraphy', cat: 'Calligraphy by Wang Xizhi' },
  { hall: 'calligraphy', cat: 'Calligraphy by Dong Qichang' },
  { hall: 'calligraphy', cat: 'Calligraphy by Mi Fu' },
  { hall: 'calligraphy', cat: 'Calligraphy by Su Shi' },
  { hall: 'calligraphy', cat: 'Lantingji Xu' },
  { hall: 'bronze', cat: 'Chinese bronzes in the Metropolitan Museum of Art' },
  { hall: 'bronze', cat: 'Chinese bronzes in the British Museum' },
  { hall: 'ceramics', cat: 'Chinese ceramics in the British Museum' },
];

const MAX_FILES_PER_ROOT = 220;
const MAX_CATS_PER_ROOT = 36;
const MAX_DEPTH = 3;
const visitedCats = new Set();

// Skip subcategories that tend to hold non-artwork media.
const SUBCAT_SKIP = /\b(museum|gallery|exhibition|photographs by|maps|plans|diagrams|signs|stamps|logos|videos|panoramic|views of|interior of|building|architecture|reconstruction|replica|book|publication|people|by year)\b/i;

async function fetchCategoryMembers(catTitle) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', list: 'categorymembers',
    cmtitle: catTitle, cmlimit: '500', cmtype: 'file|subcat',
  });
  const json = await fetchJSON(`${COMMONS_API}?${params.toString()}`);
  const members = json?.query?.categorymembers || [];
  const files = [], subcats = [];
  for (const m of members) {
    if (m.ns === 6) files.push(m.title);
    else if (m.ns === 14) subcats.push(m.title);
  }
  return { files, subcats };
}

async function crawlRoot(root) {
  const rootPeriod = root.period || periodFromText(root.cat) || null;
  let collected = 0, catsVisited = 0;
  // BFS queue of {title, depth, period}
  const queue = [{ title: `Category:${root.cat}`, depth: 0, period: rootPeriod }];
  while (queue.length && collected < MAX_FILES_PER_ROOT && catsVisited < MAX_CATS_PER_ROOT) {
    const { title, depth, period } = queue.shift();
    if (visitedCats.has(title)) continue;
    visitedCats.add(title);
    catsVisited++;
    let res;
    try { res = await fetchCategoryMembers(title); }
    catch (err) { process.stderr.write(`  ! ${title}: ${err.message}\n`); continue; }
    await sleep(45);
    const catPeriod = periodFromText(title.replace('Category:', '')) || period;
    for (const f of res.files) {
      if (collected >= MAX_FILES_PER_ROOT) break;
      const rec = getRecord(f);
      rec.halls.add(root.hall);
      rec.sourceCats.add(title.replace('Category:', ''));
      if (catPeriod) rec.periodHints.add(catPeriod);
      collected++;
    }
    if (depth < MAX_DEPTH) {
      for (const sc of res.subcats) {
        const bare = sc.replace('Category:', '');
        if (SUBCAT_SKIP.test(bare)) continue;
        if (!visitedCats.has(sc)) queue.push({ title: sc, depth: depth + 1, period: catPeriod });
      }
    }
  }
  return { collected, catsVisited };
}

async function harvestCommons() {
  for (const root of COMMONS_ROOTS) {
    process.stderr.write(`▶ Commons crawl ${root.hall} / ${root.cat} ... `);
    try {
      const { collected, catsVisited } = await crawlRoot(root);
      process.stderr.write(`${collected} files (${catsVisited} cats)\n`);
    } catch (err) {
      process.stderr.write(`FAILED: ${err.message}\n`);
    }
  }
}

// ----------------------------------------------------------------------------
// PART C — imageinfo enrichment (batched 50)
// ----------------------------------------------------------------------------
async function enrichImages() {
  const titles = [...records.keys()].map((f) => `File:${f}`);
  process.stderr.write(`Enriching ${titles.length} images via Commons imageinfo...\n`);
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({
      action: 'query', format: 'json', prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(WALL_WIDTH),
      iiextmetadatafilter: 'Artist|LicenseShortName|Credit|ImageDescription|ObjectName|DateTimeOriginal|UsageTerms',
      titles: batch.join('|'),
    });
    let json;
    try { json = await postJSON(COMMONS_API, params); }
    catch (err) { process.stderr.write(`  imageinfo batch ${i} failed: ${err.message}\n`); continue; }
    const pages = json?.query?.pages || {};
    const norm = {};
    for (const n of json?.query?.normalized || []) norm[n.to] = n.from;
    for (const pid in pages) {
      const page = pages[pid];
      const ii = page.imageinfo?.[0];
      const key = normFile((norm[page.title] || page.title));
      const rec = records.get(key);
      if (!ii || !rec) continue;
      const em = ii.extmetadata || {};
      rec.thumb = ii.thumburl || null;
      rec.full = ii.url || null;
      rec.w = ii.width || null;
      rec.h = ii.height || null;
      rec.mime = ii.mime || null;
      rec.descriptionurl = ii.descriptionurl || null;
      rec.license = stripHtml(em.LicenseShortName?.value) || stripHtml(em.UsageTerms?.value) || 'See Commons';
      rec.attribution = stripHtml(em.Artist?.value) || stripHtml(em.Credit?.value) || '';
      rec.emDescription = stripHtml(em.ImageDescription?.value);
      rec.objectName = stripHtml(em.ObjectName?.value);
      rec.emDate = stripHtml(em.DateTimeOriginal?.value);
    }
    if ((i / 50) % 15 === 0) process.stderr.write(`  ...${Math.min(i + 50, titles.length)}/${titles.length}\n`);
    await sleep(70);
  }
}

// Re-enrich: replace each record's wall thumbnail with one the API generates at
// WALL_DISPLAY px (guaranteed valid + CORS on the CDN — arbitrary URL widths 400).
async function reenrichThumbs(rawArr) {
  const byFile = new Map();
  for (const r of rawArr) byFile.set(r.file, r);
  const titles = rawArr.map((r) => `File:${r.file}`);
  process.stderr.write(`Re-enriching ${titles.length} wall thumbs at ${WALL_DISPLAY}px...\n`);
  let updated = 0;
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({
      action: 'query', format: 'json', prop: 'imageinfo',
      iiprop: 'url|size', iiurlwidth: String(WALL_DISPLAY), titles: batch.join('|'),
    });
    let json;
    try { json = await postJSON(COMMONS_API, params); } catch { continue; }
    const pages = json?.query?.pages || {};
    const norm = {};
    for (const n of json?.query?.normalized || []) norm[n.to] = n.from;
    for (const pid in pages) {
      const p = pages[pid];
      const ii = p.imageinfo?.[0];
      const r = byFile.get(normFile(norm[p.title] || p.title));
      if (ii && ii.thumburl && r) { r.thumb = ii.thumburl; updated++; }
    }
    if ((i / 50) % 20 === 0) process.stderr.write(`  ...${Math.min(i + 50, titles.length)}/${titles.length}\n`);
    await sleep(60);
  }
  process.stderr.write(`Updated ${updated} wall thumbs.\n`);
}

// ----------------------------------------------------------------------------
// PART D — finalize
// ----------------------------------------------------------------------------
const HALL_PRIORITY = ['painting', 'calligraphy', 'bronze', 'jade', 'ceramics', 'tomb', 'sculpture', 'textiles', 'decorative'];
const HALL_WORD = {
  painting: 'Painting', calligraphy: 'Calligraphy', ceramics: 'Ceramic Ware',
  bronze: 'Ritual Bronze', jade: 'Jade Carving', sculpture: 'Buddhist Sculpture',
  tomb: 'Tomb Figure', textiles: 'Silk Textile', decorative: 'Decorative Object',
};

function serialize(rec) {
  return {
    file: rec.file, wikidata: rec.wikidata || null, label: rec.title || null,
    inception: rec.inception || null,
    types: [...rec.types], creators: [...rec.creators], materials: [...rec.materials],
    collections: [...rec.collections], genres: [...rec.genres],
    originQids: [...rec.originQids], originLabels: [...rec.originLabels],
    halls: [...rec.halls], periodHints: [...rec.periodHints], sourceCats: [...rec.sourceCats],
    thumb: rec.thumb || null, full: rec.full || null, w: rec.w || null, h: rec.h || null,
    mime: rec.mime || null, descriptionurl: rec.descriptionurl || null,
    license: rec.license || 'See Commons', attribution: rec.attribution || '',
    emDescription: rec.emDescription || '', objectName: rec.objectName || '', emDate: rec.emDate || '',
  };
}

function pickHall(r) {
  for (const h of HALL_PRIORITY) if (r.halls.includes(h)) return h;
  return r.halls[0] || 'decorative';
}

function sanitizeTitle(t) {
  if (!t) return '';
  return t
    .replace(/\.(jpe?g|png|tiff?|gif|svg|webp)$/i, '')
    .replace(/\b\d{4}[.\-_/]\d{1,2}[.\-_/]\d{1,2}\b/g, ' ')        // dates
    .replace(/\b\d{1,2}[-:]\d{2}[-:]\d{2}\b/g, ' ')                  // times
    .replace(/\s*[-–—]\s*(Google Art Project|Google Cultural Institute|Web Gallery of Art)\b.*$/i, '')
    .replace(/\b(DP|DT|SF|LC|RES|GG)\d{3,}[a-z]?\b/gi, ' ')         // accession codes
    .replace(/\b(IMG|DSC|DSCN|DSCF|CIMG|SAM|MG)[ _-]?\d{2,}\b/gi, ' ')
    .replace(/\b\d{2,4}\s?px\b/gi, ' ')
    .replace(/[（(][^)）]*\d[^)）]*[)）]/g, ' ')                     // bracketed codes w/ digits
    .replace(/[_]+/g, ' ')
    .replace(/[-–]\s?[A-Z]{1,3}\s?\d{2,6}[a-z]?\s*$/, '')           // trailing "-MA 3878", "-EO 1582"
    .replace(/^\s*\d{3,6}\s*[-–]\s*/, '')                            // leading "51900-"
    .replace(/[-–]\s?[A-Z]{2,3}\s*$/, '')                           // trailing "-AA", "-MA"
    .replace(/\s+\d{1,3}$/, '')                                      // trailing counter
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:。·\-–—]+|[\s,;:。·\-–—]+$/g, '')
    .trim();
}

function looksJunky(t) {
  if (!t || t.length < 3) return true;
  const digits = (t.match(/\d/g) || []).length;
  if (digits / t.length > 0.32) return true;
  if (/[A-Z]{8,}/.test(t)) return true;                              // gibberish caps
  if (/\b(bowuguan|bowuyuan|bowu|exhibition|exhibit|\bmuseum\b|gallery|collection of)\b/i.test(t)) return true;
  if (/\bcmoc\b|abu dhabi|treasures of ancient|art from asia|art institute|world tour/i.test(t)) return true;
  if (/^(img|dsc|dscn|dscf|cimg|sam|p)[ _-]?\d/i.test(t)) return true;
  return false;
}

function toRoman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return s;
}

function singular(w) { return /ss$/.test(w) ? w : w.replace(/s$/, ''); }

function niceType(r) {
  // Prefer a clean, specific source category as the object descriptor.
  const cands = r.sourceCats
    .map((c) => c.replace(/\b(of|from|in)\s+China\b/i, '').replace(/\bby (dynasty|collection|type|country)\b/i, '')
      .replace(/\bChinese\b/i, '').replace(/\s{2,}/g, ' ').trim())
    .filter((c) => c && c.length <= 26 && !/\d/.test(c) && !/museum|collection|wikimedia|category|grottoes|caves|army/i.test(c));
  cands.sort((a, b) => a.length - b.length);
  if (cands[0]) return singular(cands[0]);
  return HALL_WORD[pickHall(r)] || 'Artwork';
}

function titleFromDesc(desc) {
  if (!desc) return '';
  let s = desc.split(/[.;]|，|。|\n/)[0];
  s = s.replace(/^(this is|this|here is|a photograph of|photograph of|image of|view of|picture of|detail of)\s+/i, '');
  s = sanitizeTitle(s);
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 13 || looksJunky(s)) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function deriveTitle(r, period) {
  let t = r.label && !/^Q\d+$/.test(r.label) ? sanitizeTitle(r.label) : '';
  if (looksJunky(t)) t = '';
  if (!t && r.objectName && r.objectName.length <= 80) { t = sanitizeTitle(r.objectName); if (looksJunky(t)) t = ''; }
  if (!t) t = titleFromDesc(r.emDescription);
  if (!t) { const f = sanitizeTitle(r.file); if (!looksJunky(f)) t = f; }
  if (!t) {
    const base = niceType(r);
    t = period ? `${base}, ${period} period` : base;
  }
  if (t.length > 110) t = t.slice(0, 107) + '…';
  return t || 'Untitled';
}

function derivePeriod(r) {
  const year = parseYear(r.inception);
  let period = periodForYear(year);
  if (!period) for (const oq of r.originQids) if (ORIGIN_QID_TO_PERIOD[oq]) { period = ORIGIN_QID_TO_PERIOD[oq]; break; }
  if (!period && r.periodHints.length)
    period = [...r.periodHints].sort((a, b) => (periodOrder[a] ?? 99) - (periodOrder[b] ?? 99))[0];
  if (!period)
    period = periodFromText(r.sourceCats.join(' ') + ' ' + r.objectName + ' ' + r.emDescription + ' ' + r.emDate);
  return { period: period || null, year: year ?? null };
}

function cleanCredit(s) {
  if (!s) return '';
  s = s.replace(/https?:\/\/\S+/g, '').replace(/\b(own work)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  return s.length > 120 ? s.slice(0, 117) + '…' : s;
}

function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; }

function qualityScore(r, hasCreator, period, description) {
  let s = 0;
  if (hasCreator) s += 3;
  if (period) s += 2;
  if (description) s += 1;
  if (r.collections.length) s += 1;
  if (r.wikidata) s += 1;
  if (r.label && !/^Q\d+$/.test(r.label)) s += 1.5;   // a real catalogued title
  s += Math.min((r.w || 0), 2200) / 1100;
  return s;
}

// Curation score — heavily favours items with real museum provenance so the
// per-hall cap keeps the best, not the most.
function curationScore(r, hasCreator, period, strongArt, title, collection) {
  let s = 0;
  if (collection) s += 4;                      // held in a named collection
  if (hasCreator) s += 4;                      // attributed to an artist
  if (period) s += 2.5;
  if (r.wikidata) s += 2;                       // catalogued on Wikidata
  if (r.label && !/^Q\d+$/.test(r.label)) s += 2; // a catalogued title (not filename-derived)
  if (strongArt) s += 1;
  if (r.emDescription && r.emDescription.length > 40) s += 1;
  if (looksJunky(title) || /,\s*[A-Za-z &]+ period$/.test(title)) s -= 2.5; // generic/synthesised
  s += Math.min((r.w || 0), 2600) / 1300;       // prefer higher resolution
  return s;
}

// Keyword → hall, used to de-pollute the Wikidata catch-all (which was tagged
// 'painting' but actually returns every kind of Chinese-origin object).
const HALL_KW = [
  ['ceramics', /porcelain|ceramic|stoneware|pottery|celadon|sancai|\bvase\b|\bbowl\b|\bdish\b|\bjar\b|ewer|\bcup\b|\bplate\b|\bguan\b|ru ware|kiln|famille|\bware\b/],
  ['bronze', /bronze|ritual vessel|\bding\b|\bgui\b|\bzun\b|\byou\b|\bjue\b|\bgu\b|\bhu\b|\bbell\b|mirror|taotie|\bge\b|\byan\b|\bhe\b/],
  ['jade', /\bjade\b|nephrite|jadeite|\bcong\b|bi disc|jadework/],
  ['sculpture', /buddha|bodhisattva|guanyin|maitreya|\bstele\b|statue|sculptur|grotto|\bcave\b|votive|luohan|arhat|figure of a/],
  ['tomb', /terracotta|tomb figure|mingqi|\bwarrior\b|tomb guardian|bingmayong|burial|funerary/],
  ['textiles', /\bsilk\b|textile|embroider|\brobe\b|kesi|tapestry|brocade|\bbanner\b|fabric|garment|costume/],
  ['calligraphy', /calligraph|seal script|running script|cursive script|regular script|clerical script|oracle bone/],
  ['decorative', /lacquer|cloisonn|enamel|snuff|folding fan|\bfan\b|furniture|inkstone|\bchair\b|\btable\b|cabinet|\bbox\b|carv/],
  ['painting', /\bpaint|scroll|ink on|album leaf|hanging|handscroll|landscape|\bhua\b/],
];
function reclassify(blob) {
  for (const [h, re] of HALL_KW) if (re.test(blob)) return h;
  return null;
}
const isBadCreator = (c) => !c || /^Q\d+$/.test(c) || /genid|https?:|\.well-known|^_:/.test(c);

// Infer the holding collection from a Commons source category when Wikidata
// doesn't supply one (Met / British Museum / Cleveland etc. crawl roots).
const MUSEUMS = [
  [/metropolitan museum/i, 'The Metropolitan Museum of Art'],
  [/british museum/i, 'The British Museum'],
  [/cleveland museum/i, 'Cleveland Museum of Art'],
  [/national palace museum/i, 'National Palace Museum, Taipei'],
  [/palace museum/i, 'Palace Museum, Beijing'],
  [/freer|smithsonian/i, 'Smithsonian (Freer|Sackler)'],
  [/victoria and albert/i, 'Victoria and Albert Museum'],
  [/musée guimet|guimet/i, 'Musée Guimet'],
  [/musée cernuschi|cernuschi/i, 'Musée Cernuschi'],
  [/shanghai museum/i, 'Shanghai Museum'],
  [/nanjing museum/i, 'Nanjing Museum'],
  [/hunan museum/i, 'Hunan Museum'],
  [/national museum of china/i, 'National Museum of China'],
  [/louvre/i, 'Musée du Louvre'],
];
function deriveCollection(r) {
  if (r.collections.length) return r.collections[0];
  const cats = r.sourceCats.join(' ');
  for (const [re, name] of MUSEUMS) if (re.test(cats)) return name.replace('|', ' / ');
  return '';
}

// High-confidence NON-artwork signals (modern photos, activities, places, people,
// commerce, transport, tools/process). Terms here essentially never title a real
// historical artwork, so a match is a hard reject.
const DENY = /\b(boeing|airbus|airline|aircraft|airport|aviation|locomotive|railway|railroad|\bsubway\b|metro station|automobile|motorcycle|\bhighway\b|skyscraper|stadium|\bhotel\b|restaurant|\bcafe\b|supermarket|\bmall\b|cityscape|skyline|downtown|\bfactory\b|\bairfield\b|\bschool\b|classroom|university campus|\blesson\b|\bclass\b|\bworkshop\b|demonstration|\brehearsal\b|performance|performing|competition|\bfestival\b|\bparade\b|\bceremony\b|\bwedding\b|conference|delegation|\btourist\b|tourism|\bselfie\b|cosplay|reenact|\bprotest\b|\brally\b|\bpresident\b|\bminister\b|politician|\belection\b|advertis|billboard|\blogo\b|\bpassport\b|banknote|postage|infographic|floor plan|former residence|\bsignboard\b|\bstorefront\b|\bshop\b|\bstore\b|writing brush|calligraphy brush|inkstick making|making of|\bhow to\b|\btutorial\b|\bmuseum exterior\b|\bstreet\b|\bmarket\b)\b|總統|合影|留念|总统|議員|纪念|紀念/i;

// Positive artwork-type signal (object kinds we actually exhibit).
const STRONG_ART = /\b(painting|scroll|album leaf|calligraph|porcelain|celadon|stoneware|pottery|ceramic|vase|bowl|\bjar\b|\bdish\b|\bcup\b|ewer|\bware\b|sancai|bronze|ritual|\bding\b|\bgui\b|\bzun\b|mirror|\bbell\b|\bjade\b|\bcong\b|lacquer|cloisonn|enamel|snuff|\bfan\b|inkstone|furniture|\bchair\b|\btable\b|cabinet|\bscreen\b|embroider|\bsilk\b|kesi|tapestry|brocade|\brobe\b|buddha|bodhisattva|guanyin|\bstele\b|statue|sculptur|relief|terracotta|tomb figure|mingqi|figurine|vessel|incense|teapot|\bseal\b|carving|hanging scroll|handscroll)\b/i;

function finalize(rawArr) {
  const out = [];
  for (const r of rawArr) {
    if (!r.thumb || !r.full) continue;
    if (r.w && r.w < 320) continue;                          // require a reasonably sized image
    if (r.mime && !/^image\//.test(r.mime)) continue;
    if (/\b(map|diagram|chart|logo|signature|coat of arms|location|locator|graph)\b/i.test(r.file)) continue;

    const blob = (r.types.join(' ') + ' ' + r.objectName + ' ' + r.sourceCats.join(' ') + ' ' +
      r.genres.join(' ') + ' ' + r.materials.join(' ') + ' ' + (r.label || '') + ' ' + r.emDescription).toLowerCase();
    if (DENY.test(blob) || DENY.test(r.file)) continue;       // hard-reject non-artworks

    const { period, year } = derivePeriod(r);
    const realCreator = r.creators.find((c) => !isBadCreator(c)) || null;  // Wikidata P170 only
    const creator = realCreator || 'Unknown';

    const collection = deriveCollection(r);
    // Provenance gate: drop items with no dynasty, no collection, no Wikidata id
    // AND no artwork-type signal — these are the stray photos that pollute halls.
    const strongArt = STRONG_ART.test(blob);
    if (!r.wikidata && !collection && !period && !strongArt) continue;

    // Hall assignment, with catch-all de-pollution.
    let hall = pickHall(r);
    if (hall === 'painting') {
      const kw = reclassify(blob);
      if (kw && kw !== 'painting') hall = kw;
      else if (!kw) {
        // No type signal: keep in painting only if it plausibly is one.
        const plausible = realCreator || (r.label && !/^Q\d+$/.test(r.label) && !looksJunky(sanitizeTitle(r.label)));
        if (!plausible) continue;
      }
    }

    let description = r.emDescription || '';
    if (/^\s*(own work|self-?photograph)/i.test(description)) description = '';
    if (description.length > 560) description = description.slice(0, 557) + '…';

    const title = deriveTitle(r, period);
    out.push({
      id: r.wikidata || 'F' + Math.abs(hashCode(r.file)),
      title,
      hall,
      type: r.types[0] || niceType(r),
      creator,
      year,
      period,
      origin: r.originLabels[0] || '',
      materials: r.materials.slice(0, 4),
      collection,
      genre: r.genres[0] || '',
      file: r.file,
      thumb: r.thumb, full: r.full, w: r.w, h: r.h,
      license: r.license,
      credit: cleanCredit(r.attribution) || 'Wikimedia Commons',
      source: r.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r.file)}`,
      description,
      _q: curationScore(r, !!realCreator, period, strongArt, title, collection),
    });
  }

  // De-dupe by image URL.
  const seen = new Set();
  const deduped = out.filter((a) => (seen.has(a.full) ? false : (seen.add(a.full), true)));

  // Per-hall cap, keeping highest-quality items.
  const byHall = {};
  for (const a of deduped) (byHall[a.hall] ??= []).push(a);
  const capped = [];
  for (const h in byHall) capped.push(...byHall[h].sort((a, b) => b._q - a._q).slice(0, HALL_CAP[h] ?? 200));

  capped.forEach((a) => delete a._q);
  capped.sort((a, b) => {
    if (a.hall !== b.hall) return a.hall < b.hall ? -1 : 1;
    const pa = periodOrder[a.period] ?? 50, pb = periodOrder[b.period] ?? 50;
    if (pa !== pb) return pa - pb;
    return (a.title || '').localeCompare(b.title || '');
  });

  // Disambiguate exact-duplicate titles within a hall (… · II, · III).
  const seenT = new Map();
  for (const a of capped) {
    const k = a.hall + '|' + a.title.toLowerCase();
    const n = (seenT.get(k) || 0) + 1;
    seenT.set(k, n);
    if (n > 1) a.title = `${a.title} · ${toRoman(n)}`;
  }
  return capped;
}

// ----------------------------------------------------------------------------
async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const REFINAL = process.argv.includes('--refinalize');
  const REENRICH = process.argv.includes('--reenrich');
  let rawArr;
  if (REFINAL || REENRICH) {
    rawArr = JSON.parse(await readFile(resolve(DATA_DIR, '_raw.json'), 'utf8'));
    process.stderr.write(`Loaded cache: ${rawArr.length} raw records\n`);
    if (REENRICH) { await reenrichThumbs(rawArr); await writeFile(resolve(DATA_DIR, '_raw.json'), JSON.stringify(rawArr)); }
  } else {
    await harvestWikidata();
    process.stderr.write(`\nAfter Wikidata: ${records.size} files\n\n`);
    await harvestCommons();
    process.stderr.write(`\nAfter Commons: ${records.size} files\n\n`);
    await enrichImages();
    rawArr = [...records.values()].map(serialize).filter((r) => r.thumb && r.full);
    await writeFile(resolve(DATA_DIR, '_raw.json'), JSON.stringify(rawArr));
    process.stderr.write(`Cached ${rawArr.length} enriched records to _raw.json\n`);
  }

  const artworks = finalize(rawArr);
  const hallCounts = {}, periodCounts = {};
  for (const a of artworks) {
    hallCounts[a.hall] = (hallCounts[a.hall] || 0) + 1;
    if (a.period) periodCounts[a.period] = (periodCounts[a.period] || 0) + 1;
  }

  await writeFile(resolve(DATA_DIR, 'artworks.json'), JSON.stringify(artworks));
  await writeFile(resolve(DATA_DIR, 'stats.json'), JSON.stringify({
    total: artworks.length, hallCounts,
    periodCounts: Object.fromEntries(PERIODS.map((p) => [p.name, periodCounts[p.name] || 0]).filter(([, c]) => c)),
  }, null, 2));

  process.stderr.write(`\n✔ Wrote ${artworks.length} artworks.\n`);
  process.stderr.write(`Halls: ${JSON.stringify(hallCounts)}\n`);
  process.stderr.write(`Periods: ${JSON.stringify(periodCounts)}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });

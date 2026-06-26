/**
 * curation.js — the museum's curatorial & design backbone.
 *
 * Defines the building concept, the dynasty/period notes shown on placards,
 * and—for every exhibition hall—its bilingual name, theme, intro text, colour
 * palette, lighting mood, ornamental motifs and how its objects are displayed.
 *
 * Colours are '#rrggbb' strings (consumed via new THREE.Color(str)).
 */

export const BUILDING = {
  name: 'Museum of Chinese Art',
  nameZh: '中华艺术博物馆',
  tagline: 'Five thousand years of art, from Neolithic jade to the imperial court',
  // Shared architectural palette (atrium + corridors + structure).
  palette: {
    marble: '#e8e2d4',     // polished floor stone
    marbleDark: '#c9c0ab',
    wall: '#efe9dc',        // neutral plaster
    column: '#7c1f17',      // red-lacquered columns 朱柱
    columnGold: '#caa64a',  // gilt capitals / trim
    beam: '#3f2a1d',        // dark timber beams
    ceiling: '#f3eee2',
    accent: '#b8902f',      // brass / gold accents
  },
};

// Dynasty / period notes — surfaced on placards and the timeline.
export const PERIOD_INFO = {
  'Neolithic': '新石器时代 · before 2070 BCE — Jade ritual objects and painted pottery of the Liangzhu, Hongshan and Yangshao cultures.',
  'Shang & Western Zhou': '商 · 西周 · 1600–771 BCE — The great age of ritual bronze casting and oracle-bone script.',
  'Eastern Zhou': '东周 · 770–256 BCE — Spring & Autumn and Warring States: inlaid bronzes, lacquer and the rise of regional arts.',
  'Qin': '秦 · 221–206 BCE — Unification of China and the Terracotta Army of the First Emperor.',
  'Han': '汉 · 206 BCE–220 CE — Tomb arts, jade burial suits, lacquer and the opening of the Silk Road.',
  'Six Dynasties': '魏晋南北朝 · 220–589 — Buddhism flowers; the first great cave temples at Yungang and Dunhuang.',
  'Sui & Tang': '隋 · 唐 · 581–907 — Cosmopolitan golden age: sancai pottery, gilt Buddhas, and figure painting.',
  'Five Dynasties': '五代 · 907–960 — Monumental landscape painting takes form.',
  'Song': '宋 · 960–1279 — Classical refinement: celadon and Ru ware, literati painting, ink landscapes.',
  'Yuan': '元 · 1271–1368 — Blue-and-white porcelain and scholar-painters of the Mongol era.',
  'Ming': '明 · 1368–1644 — Imperial kilns, garden culture, fine furniture and decorative arts.',
  'Qing': '清 · 1644–1911 — Court splendour: famille-rose porcelain, cloisonné, jade and embroidery.',
  'Modern': '近现代 · 1912– — Twentieth-century masters bridging tradition and the modern world.',
};

/**
 * Hall definitions. `order` sets the wayfinding sequence. `display`:
 *   'wall'     → framed pictures on walls (paintings, calligraphy, textiles)
 *   'pedestal' → objects on plinths down the room (bronze, jade, tomb)
 *   'mixed'    → both
 */
export const HALLS = [
  {
    id: 'painting',
    name: 'Painting',
    nameZh: '绘 画',
    subtitle: 'Ink & Brush · Landscapes and the Four Gentlemen',
    intro:
      'Chinese painting prizes the trace of the brush over mere likeness. From monumental Song landscapes to the bird-and-flower and literati traditions, ink on silk and paper carries the painter’s breath and spirit (qiyun).',
    palette: { wall: '#efe7d6', floor: '#d8cfb8', wainscot: '#5a4632', accent: '#5d7a6f' },
    light: { mood: 'soft', sky: '#fff6e2', ground: '#6b5a3e', intensity: 0.95, accent: '#ffe9c4' },
    motifs: ['plum-bamboo-orchid-chrysanthemum', 'mounted-scroll', 'misty-mountain'],
    display: 'wall',
  },
  {
    id: 'calligraphy',
    name: 'Calligraphy',
    nameZh: '书 法',
    subtitle: 'The Art of the Brush · Seal to Cursive Script',
    intro:
      'Revered as the highest of the visual arts, calligraphy turns the written character into abstract movement. Five great scripts—seal, clerical, regular, running and cursive—reveal a writer’s discipline and temperament in a single line.',
    palette: { wall: '#2c2a27', floor: '#3a352f', wainscot: '#1c1a18', accent: '#b3382c' },
    light: { mood: 'dramatic', sky: '#cfd6e0', ground: '#15130f', intensity: 0.6, accent: '#fff0d8' },
    motifs: ['seal-stamp', 'brushstroke', 'four-treasures'],
    display: 'wall',
  },
  {
    id: 'ceramics',
    name: 'Ceramics & Porcelain',
    nameZh: '陶 瓷',
    subtitle: 'Glaze & Fire · Celadon to Blue-and-White',
    intro:
      'For two millennia China led the world in ceramics. Tang sancai, the quiet celadons and Ru ware of the Song, Yuan and Ming blue-and-white, and Qing famille-rose trace an unbroken pursuit of perfect form and glaze.',
    palette: { wall: '#dde6e4', floor: '#cdd2cf', wainscot: '#385a6a', accent: '#2552a0' },
    light: { mood: 'bright', sky: '#ffffff', ground: '#9aa6a4', intensity: 1.15, accent: '#eaf2ff' },
    motifs: ['blue-white-scroll', 'lotus-panel', 'vitrine'],
    display: 'mixed',
  },
  {
    id: 'bronze',
    name: 'Ritual Bronzes',
    nameZh: '青铜器',
    subtitle: 'Bronze Age · Vessels for Gods and Ancestors',
    intro:
      'Cast for ritual offerings to ancestors, the bronzes of the Shang and Zhou are among the supreme achievements of early metalwork. Their surfaces teem with the taotie monster-mask, coiled dragons and thunder-pattern frets.',
    palette: { wall: '#27322d', floor: '#242926', wainscot: '#14201b', accent: '#7ea58c' },
    light: { mood: 'dramatic', sky: '#cfe0d4', ground: '#0c100d', intensity: 0.55, accent: '#ffdf9e' },
    motifs: ['taotie-mask', 'kui-dragon', 'leiwen-fret'],
    display: 'pedestal',
  },
  {
    id: 'jade',
    name: 'Jade',
    nameZh: '玉 器',
    subtitle: 'The Stone of Heaven · Bi Discs and Cong Tubes',
    intro:
      'Worked in China since the Neolithic, jade was valued above gold as the very substance of virtue and immortality. From Liangzhu cong and Hongshan dragons to imperial carvings, it joins heaven and earth.',
    palette: { wall: '#d9ded0', floor: '#c6cbbb', wainscot: '#4d5f45', accent: '#3f7d54' },
    light: { mood: 'serene', sky: '#f0fff2', ground: '#8f9a85', intensity: 1.0, accent: '#e9ffe6' },
    motifs: ['bi-disc', 'cong-tube', 'cloud-scroll'],
    display: 'pedestal',
  },
  {
    id: 'sculpture',
    name: 'Buddhist Sculpture',
    nameZh: '佛造像',
    subtitle: 'Cave Temples & Gilded Icons',
    intro:
      'Buddhism transformed Chinese art. In the cliffs of Yungang, Longmen and Mogao, and in gilt-bronze and stone icons, sculptors gave serene form to Buddhas, bodhisattvas and the flying apsaras of paradise.',
    palette: { wall: '#d9c9a4', floor: '#bca87f', wainscot: '#7a5c33', accent: '#c79a3c' },
    light: { mood: 'warm', sky: '#fff1d2', ground: '#6e5733', intensity: 0.95, accent: '#ffdb99' },
    motifs: ['lotus-throne', 'mandorla-halo', 'apsara'],
    display: 'mixed',
  },
  {
    id: 'tomb',
    name: 'Tomb Figures',
    nameZh: '陶 俑',
    subtitle: 'Spirits of the Afterlife · The Terracotta Army',
    intro:
      'The Chinese furnished their tombs with whole worlds in miniature. The First Emperor’s terracotta army, Han attendants and the lively sancai horses and camels of the Tang were made to serve the dead for eternity.',
    palette: { wall: '#b89a7c', floor: '#9a7f63', wainscot: '#5e4a37', accent: '#b9742e' },
    light: { mood: 'excavation', sky: '#ffe9c8', ground: '#5a4634', intensity: 0.8, accent: '#ffcf8a' },
    motifs: ['terracotta-warrior', 'sancai-horse', 'tomb-guardian'],
    display: 'pedestal',
  },
  {
    id: 'textiles',
    name: 'Silk & Textiles',
    nameZh: '织 绣',
    subtitle: 'The Thread of Empire · Dragon Robes & Kesi',
    intro:
      'Silk was China’s gift to the world and the very emblem of its civilisation. Woven kesi tapestry, fine embroidery and the dragon robes of the court turned cloth into a canvas of rank, myth and auspicious wish.',
    palette: { wall: '#6f1f1d', floor: '#7a5a3c', wainscot: '#48110f', accent: '#e0b955' },
    light: { mood: 'warm', sky: '#ffe7cf', ground: '#3a1412', intensity: 0.85, accent: '#ffd98f' },
    motifs: ['dragon-medallion', 'cloud-and-bat', 'phoenix'],
    display: 'wall',
  },
  {
    id: 'decorative',
    name: 'Decorative & Scholar’s Arts',
    nameZh: '工 艺',
    subtitle: 'Lacquer, Cloisonné & the Scholar’s Studio',
    intro:
      'Beyond the great traditions lies a world of refined craft: carved cinnabar lacquer, glowing cloisonné enamel, snuff bottles, folding fans, hardwood furniture and the inkstones and rocks of the scholar’s desk.',
    palette: { wall: '#3a221d', floor: '#4a3326', wainscot: '#23130f', accent: '#c8502f' },
    light: { mood: 'intimate', sky: '#ffe2c4', ground: '#1c0f0b', intensity: 0.75, accent: '#ffcf9a' },
    motifs: ['carved-lacquer', 'cloisonne-scroll', 'scholar-rock'],
    display: 'mixed',
  },
];

export const HALL_BY_ID = Object.fromEntries(HALLS.map((h) => [h.id, h]));

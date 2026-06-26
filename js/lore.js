/**
 * lore.js — the museum's storytelling layer.
 *
 * Most Wikimedia records arrive with little or no description, so the detail
 * panel would feel empty. This module composes an immersive, accurate "story"
 * for EVERY piece by combining three strands of real art history:
 *   1. the piece's own catalogue description (when Commons supplies one),
 *   2. the narrative of its dynasty/period, and
 *   3. the significance of its kind of object (celadon, ding, kesi, …).
 *
 * The text is grounded in standard art history and kept concise. Nothing here
 * depends on the network — it turns the metadata we already have into context a
 * visitor can learn from.
 */

// --- the age it was made in ---------------------------------------------------
export const periodLore = {
  'Neolithic':
    'Long before the first dynasties, Neolithic cultures along the Yellow and Yangzi rivers were already accomplished artists. The Yangshao painted bold spirals onto burnished red pottery, while the Liangzhu ground jade discs and tubes of astonishing precision using only stone tools and wet sand. Such objects were not ornaments but ritual instruments, binding the living to their ancestors and to the cosmos.',
  'Shang & Western Zhou':
    'This was China’s Bronze Age, when ruling houses cast great vessels to nourish the spirits of their ancestors with wine and grain. Shang kings read the future in heat-cracked oracle bones inscribed with the earliest Chinese writing; under the Zhou, bronzes carried long inscriptions recording royal gifts and victories. Power, religion and art were fused in metal.',
  'Eastern Zhou':
    'As the Zhou order fractured into the Spring-and-Autumn and Warring States eras, rival courts drove a burst of invention. Bronzes grew lighter and more intricate, inlaid with gold, silver and turquoise, while lacquer, jade and silk flourished in competing regional workshops. It was also the age of Confucius, Laozi and the “Hundred Schools” of thought.',
  'Qin':
    'In 221 BCE the king of Qin conquered the warring states and proclaimed himself First Emperor, standardising the script, coinage and measures of a unified China. To guard him in death he raised an underground army of thousands of life-size terracotta soldiers, each with individual features. The dynasty was brief, but its scale of ambition reshaped Chinese art forever.',
  'Han':
    'Over four centuries the Han forged the lasting template of Chinese civilisation and opened the Silk Road to the West. Their tombs were stocked with painted figures, bronze lamps, jade burial suits and glazed models of farms and towers — an entire world remade in miniature for the afterlife. Lacquer and silk reached new heights of luxury.',
  'Six Dynasties':
    'Amid centuries of division, Buddhism swept into China and transformed its art. The first colossal cave-temples were carved at Yungang and in the cliffs of Dunhuang, their walls alive with serene Buddhas and flying apsaras. In painting and calligraphy, figures such as Gu Kaizhi and Wang Xizhi set ideals that would be revered for a thousand years.',
  'Sui & Tang':
    'Reunified and outward-looking, the Tang presided over a cosmopolitan golden age whose capital Chang’an was the largest city on earth. Caravans brought Central Asian music, dress and faces, mirrored in lively three-colour (sancai) horses, camels and dancers. Gilt-bronze Buddhas, full-figured court ladies and the first masterpieces of figure painting embody the era’s confidence.',
  'Five Dynasties':
    'In the brief, turbulent decades between Tang and Song, landscape painting came of age. Masters such as Jing Hao and Dong Yuan turned mountains and rivers into vast, ordered visions of nature, establishing the monumental tradition that the Song would perfect.',
  'Song':
    'The Song refined Chinese art to its most quiet and classical. Connoisseur-emperors patronised kilns that produced the subtle celadons of Longquan and the crackled Ru ware prized above all else, while scholar-officials made ink landscape painting a vehicle for philosophy. Restraint, naturalism and the cult of the cultivated gentleman defined the age.',
  'Yuan':
    'Under Mongol rule China was joined to a Eurasian empire, and its arts absorbed new tastes and markets. Potters at Jingdezhen perfected blue-and-white porcelain, painting cobalt brought from Persia onto pure white bodies for buyers across Asia. Displaced scholar-painters such as the “Four Masters of the Yuan” retreated into intensely personal landscapes.',
  'Ming':
    'The native Ming dynasty restored Chinese rule and a love of order and ornament. Imperial kilns at Jingdezhen turned out porcelain of dazzling refinement, while cities bred a culture of gardens, connoisseurship and exquisite hardwood furniture. Carved lacquer, cloisonné enamel and the arts of the scholar’s studio reached classic perfection.',
  'Qing':
    'The Manchu emperors of the Qing ruled the largest and richest empire in Chinese history and lavished it on the arts. Court workshops produced famille-rose porcelain, jade carving of incredible virtuosity, glowing cloisonné, and embroidered dragon robes of imperial yellow. Technical brilliance and sheer opulence marked the last great flowering of the tradition.',
  'Modern':
    'The fall of the empire in 1911 thrust Chinese art into dialogue with the wider world. Twentieth-century masters reinvented ink painting, fused it with Western technique, and carried five thousand years of tradition into the modern age.',
};

// --- the kind of thing it is (first match wins; order specific → general) ----
// Each entry: [test-regex, short label, the lore]. Matched against a blob of the
// title, object type, materials, genre and hall id.
export const objectLore = [
  [/blue.?and.?white|青花|underglaze blue/, 'Blue-and-white porcelain',
    'Painted in cobalt blue beneath a clear glaze on a pure white body, blue-and-white porcelain was perfected at the Jingdezhen kilns in the fourteenth century. Cobalt imported from Persia gave the deepest blues; its designs ran from dragons and lotus scrolls to whole landscapes. It became China’s most famous and most widely traded ware, copied from Japan to Delft.'],
  [/celadon|longquan|\bru ware\b|\bguan\b|qingbai|greenware|青瓷/, 'Celadon',
    'Celadon is a high-fired ware under a translucent green-grey glaze, coloured by a trace of iron fired with little oxygen. The Song prized its jade-like depth above bright colour; the kilns of Longquan, and the rare imperial Ru and Guan wares with their deliberate fine crackle, are its summit.'],
  [/sancai|three.colou?r|three-color/, 'Sancai (three-colour) ware',
    'Sancai — “three colours” — is a lead-glazed earthenware splashed in amber, green and cream that defines Tang taste. Most surviving pieces are tomb figures: spirited horses, swaying camels, merchants and guardians made for the grave. The glazes were left to run and pool, giving each piece a lively, spontaneous glow.'],
  [/famille|\bdoucai\b|\bwucai\b|enamel.*porcelain|falangcai/, 'Painted enamel porcelain',
    'From the Ming onward, potters painted porcelain in coloured overglaze enamels fired at lower heat — the delicate doucai and wucai palettes, and the soft pinks of Qing famille-rose. These wares carried minutely detailed flowers, figures and auspicious emblems, the height of imperial refinement.'],
  [/porcelain|ceramic|stoneware|pottery|\bkiln\b|\bware\b|\bvase\b|\bbowl\b|\bdish\b|\bjar\b|ewer|\bcup\b|\bplate\b|teapot/, 'Ceramics',
    'China gave porcelain to the world — a white, translucent, ringing ceramic fired at extreme heat, so identified with the country that we still call it “china”. Each dynasty refined its own glazes and forms, from monochrome elegance to painted enamel, in an unbroken two-thousand-year pursuit of the perfect vessel.'],
  [/oracle.bone|甲骨/, 'Oracle bones',
    'On ox shoulder-blades and turtle shells, Shang diviners inscribed questions to the spirits, then applied heat until the bone cracked and “answered”. The carved graphs are the oldest known Chinese writing and the direct ancestor of the script still used today.'],
  [/\bding\b|鼎/, 'Ding (ritual cauldron)',
    'The ding is a ritual cauldron on three or four legs, used to offer cooked meat to the ancestors. As the central vessel of Bronze Age ritual it became a symbol of the state itself — to “ask the weight of the ding” meant to covet the throne. The greatest examples weigh hundreds of kilograms.'],
  [/taotie|ritual.*bronze|bronze.*ritual|\bgui\b|\bzun\b|\bjue\b|\byou\b|\bzhi\b|\bvessel\b|\bbronze\b|青铜/, 'Ritual bronze',
    'Cast by the piece-mould method for offerings to ancestral spirits, the bronzes of the Shang and Zhou are among the supreme achievements of early metalwork. Their dark surfaces crawl with the taotie monster-mask, coiled kui-dragons and the squared “thunder pattern” (leiwen). Many bear inscriptions — among the earliest Chinese writing — recording the rites they served.'],
  [/\bmirror\b|铜镜/, 'Bronze mirror',
    'Polished bright on one face and cast with elaborate ornament on the other, bronze mirrors were everyday luxuries from the Warring States onward. Their backs carry a compact cosmology — the animals of the four directions, deities and inscriptions wishing the owner long life and good fortune.'],
  [/\bjade\b|nephrite|jadeite|\bcong\b|\bbi\b disc|\bhuang\b|玉/, 'Jade',
    'For the Chinese, jade (yu) was the most precious of all materials — the very substance of virtue, purity and immortality, valued far above gold. Far too hard to cut, it is slowly ground with abrasive sand. The disc (bi) stood for heaven and the tube (cong) for earth; jade was laid in tombs to preserve the body and the soul.'],
  [/calligraph|seal script|running script|cursive|clerical script|regular script|书法/, 'Calligraphy',
    'Calligraphy is revered in China as the highest of the visual arts, where the written character becomes pure expressive movement. A line drawn once in ink and never corrected lays bare the writer’s training, energy and character. Connoisseurs trace five great scripts — seal, clerical, regular, running and cursive — across two thousand years.'],
  [/handscroll|hanging scroll|album leaf|\bscroll\b|ink on|landscape|shan.?shui|bird.and.flower|literati|山水|绘画|painting/, 'Chinese painting',
    'Chinese painting values the trace of the brush and the spirit of a thing over mere likeness. Landscapes (shanshui) are not views but ordered visions of nature to be wandered in the mind, and the literati painted bamboo, plum and rock as emblems of their own integrity. Works were mounted as handscrolls to unroll slowly, or as hanging scrolls and album leaves.'],
  [/buddha|bodhisattva|guanyin|maitreya|amitabha|luohan|arhat|\bstele\b|\bstela\b|votive|佛/, 'Buddhist sculpture',
    'Buddhism reached China around the first century and inspired a thousand years of sacred sculpture. Carved into living cliffs at Yungang, Longmen and Dunhuang, or cast in gilt bronze, the Buddha sits in serene meditation while compassionate bodhisattvas such as Guanyin attend him. Styles shifted from austere early icons to the full, graceful forms of the Tang.'],
  [/terracotta.*(warrior|army|soldier)|bingmayong|兵马俑/, 'The terracotta army',
    'Buried to guard the First Emperor of Qin, the terracotta army numbers thousands of life-size soldiers, each modelled with individual features, once brightly painted and bearing real weapons. Drawn up in battle order in pits near Xi’an, it is among the greatest archaeological finds ever made — an entire army to serve an emperor for eternity.'],
  [/tomb figure|\bmingqi\b|funerary|burial|tomb guardian|陶俑/, 'Tomb figures (mingqi)',
    'The Chinese furnished their tombs with mingqi — “spirit objects” — so the dead might enjoy in the afterlife the world they had known. Modelled servants, dancers, horses, camels, even granaries and watchtowers were placed in the grave. Tang tombs in particular brim with vivid sancai figures full of movement and life.'],
  [/kesi|k’o.?ssu|tapestry|缂丝/, 'Kesi silk tapestry',
    'Kesi — “cut silk” — is the most prized of Chinese weaving, in which coloured wefts are interlocked area by area to build an image thread by thread, like a woven painting. Slow and exacting, it was reserved for the finest robes, scroll mountings and pictorial hangings of the court.'],
  [/silk|embroider|brocade|\brobe\b|textile|garment|costume|damask|丝|绣|袍/, 'Silk & embroidery',
    'Silk was China’s great secret and its gift to the world — the thread that named the Silk Road. Woven, embroidered or worked as kesi tapestry, it turned cloth into a canvas of myth and rank: a court robe’s five-clawed dragons, mountains and waves form a map of the cosmos marking the wearer’s place within it.'],
  [/lacquer|cinnabar|漆/, 'Lacquer',
    'Lacquer is the refined sap of the lac tree, built up in dozens of thin coats — each hardened in damp air — into a glassy, durable surface. Carved cinnabar lacquer, cut through layers of red built up over months, was a Ming speciality; other wares were inlaid with mother-of-pearl or painted in gold. Few crafts demand more patience.'],
  [/cloisonn|景泰蓝|champlev/, 'Cloisonné enamel',
    'In cloisonné, fine metal wires are soldered to a metal body to outline a design, and the cells between are packed with coloured glass paste and fired, then ground smooth and gilded until they glow like jewels. Perfected under the Ming Jingtai emperor — hence its Chinese name jingtailan — it is among the most sumptuous of the decorative arts.'],
  [/snuff bottle|鼻烟壶/, 'Snuff bottles',
    'Tiny bottles for powdered tobacco became a passion among the Qing elite, who collected them in glass, jade, porcelain, agate and amber. The most ingenious are painted on the inside, through the narrow neck, with a bent bamboo brush. Each is a miniature stage for the carver’s or painter’s virtuosity.'],
  [/inkstone|ink.stone|\bduan\b|砚/, 'Inkstone',
    'The inkstone is the heart of the scholar’s desk and one of the “Four Treasures of the Study”. Solid ink is ground with a little water on its polished surface to make liquid ink for the brush. The finest stones, from Duan and She, were treasured for their fine grain, subtle markings and cool touch — and often beautifully carved.'],
  [/folding fan|\bfan\b|扇/, 'Fans',
    'The folding fan was both a useful object and a portable work of art. Painted or inscribed by scholars with landscapes, flowers or poetry, a fan leaf made a favourite gift and a compact field for the brush; many were later remounted as album leaves to be preserved.'],
  [/furniture|\bchair\b|\btable\b|cabinet|coffer|cupboard|canopy bed|\bstool\b|\bscreen\b|huanghuali|zitan|家具/, 'Hardwood furniture',
    'Ming furniture is celebrated for its pure line, perfect proportion and joinery so precise it needs neither nail nor glue. Cut from dense tropical hardwoods such as huanghuali and zitan, pieces like the horseshoe-back armchair achieve a restraint and elegance that still influence designers worldwide.'],
  [/\bseal\b|chop|印|獸/, 'Seals',
    'A carved seal, stamped in vermilion paste, served as a signature of authority and ownership; on paintings and calligraphy the red seal-marks of artist and later collectors became part of the work itself. Cut in stone, bronze or jade, seal-carving is itself a respected art allied to calligraphy.'],
  [/\bstele\b|rubbing|拓片/, 'Steles & rubbings',
    'Important texts and images were carved into upright stone steles, and ink rubbings taken from them spread famous calligraphy and Buddhist scriptures across the empire. The stone preserved a master’s brushwork for centuries after the original brush-written work was lost.'],
];

function pick(d) {
  const blob = [d.title, d.type, (d.materials || []).join(' '), d.genre, d.hall, d.description]
    .filter(Boolean).join(' ').toLowerCase();
  for (const [re, label, text] of objectLore) if (re.test(blob)) return { label, text };
  return null;
}

const escHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function clip(s, n) { s = s.trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
function junky(s) { return !s || s.length < 24 || /^(own work|self-?photograph|photograph|image|file)\b/i.test(s); }
// strip promo/cruft that some Commons descriptions carry
function cleanDesc(s) {
  return s
    .replace(/\s*Complete indexed photo collection[^.]*\.?/ig, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b[\w.-]+\.(com|org|net)\b/ig, '')
    .replace(/\s*All rights reserved\.?/ig, '')
    .replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1')
    .replace(/,\s*\./g, '.').replace(/[\s,;]+$/, '').trim();
}
// "Song" → "Song dynasty", but leave era-names that aren't single dynasties alone
function periodLabel(p) {
  if (!p) return '';
  if (/&|Dynasties|Neolithic|Modern/.test(p)) return p;   // "Shang & Western Zhou", "Six Dynasties", "Neolithic"…
  return p + ' dynasty';
}

/**
 * Compose the immersive story HTML for a piece's detail panel.
 * @param d        the artwork data record
 * @param periodInfo  the one-line PERIOD_INFO map (fallback)
 * @param hallsById   id → hall definition (for the per-hall fallback lore)
 */
export function composeStoryHTML(d, periodInfo, hallsById) {
  const out = [];
  const desc = cleanDesc((d.description || '').trim());
  if (!junky(desc)) out.push(`<p class="story-lead">${escHTML(clip(desc, 460))}</p>`);

  const pl = periodLore[d.period];
  if (pl) out.push(`<p><span class="story-h">${escHTML(periodLabel(d.period))}</span>${pl}</p>`);

  let obj = pick(d);
  if (!obj && hallsById && hallsById[d.hall]) obj = { label: hallsById[d.hall].name, text: hallsById[d.hall].intro };
  if (obj) out.push(`<p><span class="story-h">${escHTML(obj.label)}</span>${obj.text}</p>`);

  const prov = [];
  if (d.creator && d.creator !== 'Unknown') prov.push(`Attributed to ${escHTML(d.creator)}`);
  if (d.collection) prov.push(`Held in ${escHTML(d.collection)}`);
  if (prov.length) out.push(`<p class="story-prov">${prov.join(' · ')}.</p>`);

  if (!out.length) out.push(`<p>${escHTML(periodInfo[d.period] || d.type || '')}</p>`);
  return out.join('');
}

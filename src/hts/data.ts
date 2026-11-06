// The full Harmonized Tariff Schedule, as written by scripts/sync-hts.mjs to public/hts/hts.json.
// Pure functions here (no fetch, no React) so they can be unit tested against the real file.

/** One row of public/hts/hts.json: [code, indent, description, effectiveGeneralRate?, rate?] */
export type RawRow = [string, number, string, string?, number?]

export interface HtsFile {
  release: string
  title: string
  effective: string | null
  fetchedAt: string
  rows: RawRow[]
}

export interface HtsEntry {
  i: number
  code: string // '' for group labels without a code
  digits: string // code without dots
  indent: number
  desc: string
  general: string // effective general rate as printed ('' when the line has none)
  /** Fraction (0.165) when the rate is Free or a plain percent; null when it is per kg, compound, etc. */
  rate: number | null
  rated: boolean // an 8- or 10-digit line that carries a rate
  parent: number // index of the parent row, -1 for headings
  chapter: string // '61'
  children: number[]
  text: string // ' ' + lowercased words of this row and all ancestors + ' ', for keyword search
}

export interface HtsData {
  release: string
  title: string
  effective: string | null
  fetchedAt: string
  entries: HtsEntry[]
  byCode: Map<string, HtsEntry>
  headingsByChapter: Map<string, number[]>
}

const words = (s: string) => ' ' + s.toLowerCase().replace(/[^a-z0-9%$]+/g, ' ').trim() + ' '

export function buildHts(file: HtsFile): HtsData {
  const entries: HtsEntry[] = []
  const byCode = new Map<string, HtsEntry>()
  const headingsByChapter = new Map<string, number[]>()
  const stack: number[] = [] // row index by indent
  let chapter = ''
  for (const [code, indent, desc, general, rate] of file.rows) {
    const i = entries.length
    if (code) chapter = code.slice(0, 2)
    stack.length = indent
    let parent = -1
    for (let k = indent - 1; k >= 0 && parent < 0; k--) if (stack[k] !== undefined) parent = stack[k]
    stack[indent] = i
    const digits = code.replace(/\./g, '')
    const e: HtsEntry = {
      i,
      code,
      digits,
      indent,
      desc,
      general: general ?? '',
      rate: general ? (rate ?? null) : null,
      rated: !!general && digits.length >= 8,
      parent,
      chapter,
      children: [],
      text: words(desc) + (parent >= 0 ? entries[parent].text : ''),
    }
    entries.push(e)
    if (parent >= 0) entries[parent].children.push(i)
    else headingsByChapter.set(chapter, [...(headingsByChapter.get(chapter) ?? []), i])
    if (code) byCode.set(code, e)
  }
  return { release: file.release, title: file.title, effective: file.effective, fetchedAt: file.fetchedAt, entries, byCode, headingsByChapter }
}

/** Ancestors from the heading down to (not including) this row. */
export function ancestors(data: HtsData, e: HtsEntry): HtsEntry[] {
  const out: HtsEntry[] = []
  for (let p = e.parent; p >= 0; p = data.entries[p].parent) out.unshift(data.entries[p])
  return out
}

const trimColon = (s: string) => s.replace(/:\s*$/, '')
const GENERIC = /^(other|men's|boys'|women's|girls'|of [a-z -]+|valued .*|containing .*|.{0,24})$/i

/** A short, readable name for a line, e.g. "T-shirts, singlets... › Of cotton". */
export function labelFor(data: HtsData, e: HtsEntry, max = 90): string {
  const own = trimColon(e.desc).replace(/\s*\(\d{3}(, ?\d{3})*\)\s*$/, '') // drop textile category numbers
  const chain = ancestors(data, e).filter((a) => a.desc)
  if (!GENERIC.test(own) || chain.length === 0) return clip(own, max)
  const parent = chain[chain.length - 1]
  const heading = chain[0]
  const parts = [trimColon(heading.desc), parent !== heading ? trimColon(parent.desc) : '', own].filter(Boolean)
  return clip(parts.map((p) => clip(p, 40)).join(' › '), max)
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

const STOP = new Set(['of', 'and', 'or', 'the', 'for', 'a', 'an', 'in', 'with', 'to', 'not', 'other', 'hts', 'code', 'mens', "men's", 'womens'])

/**
 * Everyday words that the tariff schedule never uses, mapped to the words it does.
 * Keep this short and obvious; the LLM classifier (later) handles the long tail.
 */
const SYNONYMS: Record<string, string[]> = {
  sneaker: ['tennis shoe', 'training shoe'],
  trainer: ['training shoe', 'tennis shoe'],
  shoe: ['footwear'],
  boot: ['footwear'],
  sandal: ['footwear'],
  jean: ['trouser'],
  pant: ['trouser'],
  short: ['shorts'],
  hoodie: ['sweatshirt', 'pullover'],
  sweater: ['sweater', 'pullover', 'cardigan'],
  jacket: ['anorak', 'windbreaker', 'jacket'],
  coat: ['overcoat', 'coat', 'anorak'],
  tee: ['t shirt'],
  tshirt: ['t shirt'],
  dress: ['dresses'],
  bag: ['handbag', 'bag', 'case'],
  purse: ['handbag'],
  backpack: ['backpack', 'rucksack'],
  laptop: ['portable automatic data processing'],
  computer: ['automatic data processing'],
  phone: ['telephone'],
  smartphone: ['telephone', 'cellular'],
  tv: ['television'],
  headphone: ['headphone', 'earphone'],
  earbud: ['earphone'],
  charger: ['static converter'],
  sofa: ['seat'],
  couch: ['seat'],
  chair: ['seat', 'swivel seat'],
  desk: ['furniture'],
  table: ['furniture', 'table'],
  lamp: ['lamp', 'lighting'],
  mug: ['tableware', 'kitchenware'],
  cup: ['tableware', 'cup'],
  toy: ['toy'],
  doll: ['doll'],
  bike: ['bicycle'],
  watch: ['wrist watch'],
  sunglass: ['sunglasses'],
  candle: ['candle'],
  perfume: ['perfume'],
  makeup: ['make up', 'beauty'],
  cosmetic: ['beauty', 'make up'],
  supplement: ['food preparation'],
}

/** Normalise a search word: lowercase, simple plural strip so "shirts" also matches "shirt". */
function stem(t: string) {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y'
  if (t.length > 3 && t.endsWith('es') && /(sh|ch|x|s)es$/.test(t)) return t.slice(0, -2)
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1)
  return t
}

/** Where a search word first appears in a row's text, trying its synonyms too; -1 if nowhere. */
function findWord(text: string, alts: string[]) {
  let best = -1
  for (const a of alts) {
    const at = text.indexOf(' ' + a)
    if (at >= 0 && (best < 0 || at < best)) best = at
  }
  return best
}

/**
 * Search rated lines by code prefix ("6109", "6109.10.00", "610910") or by words ("cotton t-shirt").
 * Word search ranks lines by how many of the words they contain, then by where (own description
 * first) and by how specific the line is. Returns rated lines only.
 */
export function searchHts(data: HtsData, query: string, limit = 40): HtsEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const digits = q.replace(/[\s.]/g, '')
  if (/^\d{2,10}$/.test(digits)) {
    const out: HtsEntry[] = []
    for (const e of data.entries) {
      if (e.rated && e.digits.startsWith(digits)) {
        out.push(e)
        if (out.length >= limit) break
      }
    }
    return out
  }
  const tokens = q
    .replace(/\bt[\s-]?shirts?\b/g, 'tshirt')
    .split(/[^a-z0-9%$']+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => stem(t.replace(/'/g, '')))
  if (tokens.length === 0) return []
  const alts = tokens.map((t) => [...new Set([t, ...(SYNONYMS[t] ?? [])])])
  const need = tokens.length <= 2 ? 1 : tokens.length - 1
  const scored: { e: HtsEntry; score: number }[] = []
  for (const e of data.entries) {
    if (!e.rated) continue
    let score = 0
    let matched = 0
    for (let k = 0; k < alts.length; k++) {
      const at = findWord(e.text, alts[k])
      if (at < 0) continue
      matched++
      if (k === alts.length - 1 && alts.length > 1) score += 5 // the last word is usually the product itself
      // Words in the line's own description count most, then nearer ancestors.
      score += at < e.desc.length + 2 ? 3 : at < 120 ? 2 : 1
    }
    if (matched < need) continue
    score += matched * 10
    if (e.rate !== null) score += 1 // usable in estimates
    if (e.digits.length === 8) score += 0.5 // prefer the rate line over statistical suffixes
    score -= e.text.length / 400 // shorter, more specific paths first
    scored.push({ e, score })
  }
  scored.sort((a, b) => b.score - a.score || a.e.digits.localeCompare(b.e.digits))
  return scored.slice(0, limit).map((s) => s.e)
}

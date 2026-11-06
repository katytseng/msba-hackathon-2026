#!/usr/bin/env node
// Daily HTS sync. Pulls the current Harmonized Tariff Schedule from the USITC REST API
// (https://hts.usitc.gov/reststop, no key needed) and writes:
//   public/hts/hts.json      compact dataset the HTS code picker loads in the browser
//   public/hts/meta.json     release name, fetch time, counts
//   data/hts/chapter99.json  Chapter 99 (extra tariffs such as Section 301), kept for review in git diffs
// It does nothing when the USITC release has not changed, unless --force is passed.
// Only "Free" and plain "X%" rates are usable in estimates; anything else is kept but marked unsupported.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const API = 'https://hts.usitc.gov/reststop'
const force = process.argv.includes('--force')
const out = (name, value) => process.env.GITHUB_OUTPUT && writeFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' })

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return await res.json()
    } catch (err) {
      if (attempt >= 3) throw new Error(`GET ${url} failed: ${err.message}`)
      await new Promise((r) => setTimeout(r, 5000 * attempt))
    }
  }
}

/** "Free" -> 0, "16.5%" -> 0.165, anything else (per kg, compound, text) -> null. */
export function parseRate(general) {
  const g = general.trim()
  if (/^free$/i.test(g)) return 0
  const m = g.match(/^(\d+(?:\.\d+)?)%$/)
  return m ? Math.round(Number(m[1]) * 1e6) / 1e8 : null
}

const releases = await getJson(`${API}/releaseList`)
const current = releases.find((r) => r.status === 'current') ?? releases[0]
if (!current?.name) throw new Error('Could not find the current HTS release')

const prev = JSON.parse(await readFile('public/hts/meta.json', 'utf8').catch(() => '{}'))
if (!force && prev.release === current.name) {
  console.log(`HTS ${current.name} is already synced. Nothing to do.`)
  await out('changed', 'false')
  process.exit(0)
}

console.log(`Fetching HTS ${current.name} (${current.title})...`)
const all = await getJson(`${API}/exportList?from=0101&to=9999&format=JSON&styles=false`)
if (!Array.isArray(all) || all.length < 20000) throw new Error(`Export looks wrong: ${all?.length} rows`)

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim()
const rows = [] // [code, indent, description, effectiveGeneral?, rate?]
const chapter99 = []
const stack = [] // ancestors' effective general rate, by indent
let rated = 0, supported = 0

for (const r of all) {
  const code = clean(r.htsno)
  const indent = Number(r.indent) || 0
  const desc = clean(r.description)
  const own = clean(r.general)
  if (code.startsWith('99')) {
    chapter99.push({ htsno: code, indent, description: desc, general: own, footnotes: r.footnotes ?? [] })
    continue
  }
  if (code.startsWith('98')) continue // special classification provisions, not product codes
  if (!code && !desc) continue
  stack.length = indent
  const inherited = stack.findLast((g) => g) ?? ''
  const effective = own || (code.replace(/\./g, '').length >= 8 ? inherited : '')
  stack[indent] = own || inherited
  const digits = code.replace(/\./g, '').length
  if (digits >= 8 && effective) {
    const rate = parseRate(effective)
    rated++
    if (rate !== null) supported++
    rows.push(rate === null ? [code, indent, desc, effective] : [code, indent, desc, effective, rate])
  } else {
    rows.push([code, indent, desc])
  }
}

const fetchedAt = new Date().toISOString()
const meta = {
  release: current.name,
  title: current.title,
  effective: current.releaseStartDate ?? null,
  fetchedAt,
  source: 'USITC Harmonized Tariff Schedule REST API, https://hts.usitc.gov/reststop',
  rows: rows.length,
  ratedLines: rated,
  supportedLines: supported,
  chapter99Lines: chapter99.length,
  chapter99Hash: createHash('sha256').update(JSON.stringify(chapter99)).digest('hex').slice(0, 16),
}

await mkdir('public/hts', { recursive: true })
await mkdir('data/hts', { recursive: true })
await writeFile('public/hts/hts.json', JSON.stringify({ release: meta.release, title: meta.title, effective: meta.effective, fetchedAt, rows }))
await writeFile('public/hts/meta.json', JSON.stringify(meta, null, 2) + '\n')
await writeFile('data/hts/chapter99.json', JSON.stringify({ release: meta.release, rows: chapter99 }, null, 1) + '\n')

const ch99Changed = prev.chapter99Hash !== undefined && prev.chapter99Hash !== meta.chapter99Hash
console.log(`Wrote ${rows.length} rows: ${rated} rated lines, ${supported} with a percent or free rate. Chapter 99 ${ch99Changed ? 'CHANGED' : 'unchanged'}.`)
await out('changed', 'true')
await out('release', meta.release)
await out('ch99_changed', String(ch99Changed))

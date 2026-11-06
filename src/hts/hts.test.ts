import { describe, expect, it } from 'vitest'
import { buildHts, labelFor, searchHts, type HtsFile } from './data'
import { CHAPTERS, SECTIONS, pad2 } from './sections'
import rates from '../data/rates.json'

// Read with node:fs rather than importing the 2 MB JSON, which would slow down type checking.
const fs = (await import('node:' + 'fs')) as { readFileSync: (path: URL, encoding: 'utf8') => string }
const data = buildHts(JSON.parse(fs.readFileSync(new URL('../../public/hts/hts.json', import.meta.url), 'utf8')) as HtsFile)

describe('HTS dataset', () => {
  it('agrees with the curated base tariffs in rates.json', () => {
    for (const [code, t] of Object.entries(rates.baseTariffs)) {
      const e = data.byCode.get(code)
      if (!e?.rated) continue // 6201.40 is a subheading; its rates live on the lines under it
      expect(e.rate, code).toBeCloseTo(t.rate, 6)
    }
  })

  it('gives 10-digit lines the rate of their 8-digit line', () => {
    expect(data.byCode.get('6109.10.00.04')?.rate).toBeCloseTo(0.165, 6)
  })

  it('marks non-percent rates as unsupported instead of guessing', () => {
    const wool = data.byCode.get('6201.40.15.10')!
    expect(wool.rated).toBe(true)
    expect(wool.general).toContain('¢/kg')
    expect(wool.rate).toBeNull()
  })

  it('has a chapter title for every chapter in the data', () => {
    for (const ch of data.headingsByChapter.keys()) expect(CHAPTERS[Number(ch)], ch).toBeTruthy()
    const covered = SECTIONS.flatMap((s) => Array.from({ length: s.chapters[1] - s.chapters[0] + 1 }, (_, k) => pad2(s.chapters[0] + k)))
    for (const ch of data.headingsByChapter.keys()) expect(covered).toContain(ch)
  })
})

describe('searchHts', () => {
  it('finds codes by prefix with or without dots', () => {
    expect(searchHts(data, '6109.10')[0].code).toBe('6109.10.00')
    expect(searchHts(data, '61091000')[0].code).toBe('6109.10.00')
    expect(searchHts(data, '6404.11.90')[0].code).toBe('6404.11.90')
  })

  it('finds lines by words from the whole path', () => {
    const codes = searchHts(data, 'cotton t-shirts').map((e) => e.code)
    expect(codes.slice(0, 5)).toContain('6109.10.00')
    expect(searchHts(data, 'sneakers').length + searchHts(data, 'footwear textile uppers').length).toBeGreaterThan(0)
  })

  it('only returns lines that carry a rate', () => {
    for (const e of searchHts(data, 'shirts')) expect(e.rated).toBe(true)
  })

  it('labels generic lines with their parents', () => {
    expect(labelFor(data, data.byCode.get('6109.10.00')!)).toMatch(/T-shirts.*Of cotton/)
  })
})

describe('productBaseRate', () => {
  it('uses the rate picked from the full HTS, else rates.json', async () => {
    const { productBaseRate } = await import('../engine')
    const r = rates as unknown as import('../engine').Rates
    expect(productBaseRate(r, { htsCode: '6109.10.00' })).toBe(0.165)
    expect(productBaseRate(r, { htsCode: '8471.30.01.00', baseRate: 0 })).toBe(0)
    expect(() => productBaseRate(r, { htsCode: '8471.30.01.00' })).toThrow()
  })
})

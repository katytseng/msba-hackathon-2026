import { describe, expect, it } from 'vitest'
import { breakEven, cashTimeline, compareSuppliers } from '../engine'
import type { Inputs, Rates } from '../engine'
import ratesJson from '../data/rates.json'
import sampleJson from '../data/sample.json'
import suppliersJson from '../data/suppliers.json'
import { buildExplainPayload } from './payload'
import { unverifiedNumbers } from './guard'
import { explain, EXPLAIN_FIELDS } from './explain'
import { templateExplanation } from './fallback'

const rates = ratesJson as unknown as Rates
const inputs = { ...sampleJson, suppliers: suppliersJson } as Inputs
const ranked = compareSuppliers(inputs, rates)
const chosen = ranked[0]
const cash = cashTimeline(inputs, inputs.suppliers.find((s) => s.id === chosen.supplierId)!, rates, chosen)
const be = breakEven(ranked)
const payload = buildExplainPayload(inputs, ranked, chosen, cash, be, rates)

describe('explain payload', () => {
  it('copies engine results, rounded only for display', () => {
    const a = payload.suppliers_ranked[0]
    expect(a).toMatchObject({ rank: 1, name: 'Supplier A', country: 'China', landed_total_usd: 44744, landed_per_unit_usd: 12.43 })
    expect(a).toMatchObject({ tariffs_usd: 11318, base_tariff_usd: 5638, extra_tariff_usd: 5680, extra_tariff_rate_pct: 20 })
    expect(a).toMatchObject({ lead_time_days: 35, transit_days: 18, days_to_arrive: 53, gap_to_cheapest_usd: 0 })
    expect(payload.suppliers_ranked[1].gap_to_cheapest_usd).toBe(1454)
  })
  it('includes the cash dip and nulls the fields that do not apply', () => {
    expect(payload.cash).toMatchObject({ lowest_balance_usd: 6958, lowest_week: 5, below_buffer_usd: 3042, weeks_below_buffer: 3 })
    expect(payload.cash.headroom_usd).toBeNull()
    expect(payload.cash.extra_units_affordable).toBeNull()
    expect(payload.business.loan_apr_pct).toBe(6)
    expect(payload.rates_as_of).toBe('2026-11-05')
  })
})

describe('number check', () => {
  it('accepts figures that appear in the payload, in the allowed formats', () => {
    expect(unverifiedNumbers('Supplier A lands at $44,744, about $12.43 a unit ($12).', payload)).toEqual([])
    expect(unverifiedNumbers('The extra tariff is 20.0% (or 20%), and tariffs are 39.9% of product cost.', payload)).toEqual([])
    expect(unverifiedNumbers(`It could rise ${payload.tariff_risk!.break_even_extra_tariff_rise_pct} percentage points.`, payload)).toEqual([])
  })
  it('rejects figures the model calculated itself', () => {
    expect(unverifiedNumbers('You save $1,000 overall.', payload)).toEqual(['$1,000'])
    expect(unverifiedNumbers('That is a 15% markup.', payload)).toEqual(['15%'])
    // 44,744 + 46,197: a sum the engine never produced.
    expect(unverifiedNumbers('Together they cost $90,941.', payload)).toEqual(['$90,941'])
  })
})

const goodAnswer = Object.fromEntries(EXPLAIN_FIELDS.map((f) => [f, 'Use Supplier A at $44,744.']))
const fakeFetch = (status: number, body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), { status })

describe('explain()', () => {
  it('falls back when no Worker URL is configured', async () => {
    expect(await explain(payload, { url: '' })).toEqual({ source: 'fallback', reason: 'not_configured' })
  })
  it('returns the AI explanation when it passes the number check', async () => {
    const r = await explain(payload, { url: 'https://w.example/explain', fetchImpl: fakeFetch(200, { explanation: goodAnswer }) })
    expect(r.source).toBe('ai')
  })
  it('falls back when the AI uses a number that is not in the results', async () => {
    const p = { ...payload, rates_as_of: '2026-11-04' } // different payload, so no memo hit
    const r = await explain(p, {
      url: 'https://w.example/explain',
      fetchImpl: fakeFetch(200, { explanation: { ...goodAnswer, cash_outlook: 'You will be short $5,000.' } }),
    })
    expect(r).toMatchObject({ source: 'fallback', reason: 'unverified' })
  })
  it('falls back on a Worker error', async () => {
    const p = { ...payload, rates_as_of: '2026-11-03' }
    const r = await explain(p, { url: 'https://w.example/explain', fetchImpl: fakeFetch(429, { error: 'daily_budget_reached' }) })
    expect(r).toEqual({ source: 'fallback', reason: 'unavailable', detail: 'daily_budget_reached' })
  })
  it('gives up after the timeout', async () => {
    const p = { ...payload, rates_as_of: '2026-11-02' }
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    const r = await explain(p, { url: 'https://w.example/explain', timeoutMs: 30, fetchImpl: hang })
    expect(r).toEqual({ source: 'fallback', reason: 'timeout' })
  })
})

describe('template fallback', () => {
  it('fills every field except the headline from engine sentences', () => {
    const t = templateExplanation(inputs, ranked, chosen, cash, be, rates.lastReviewed)
    expect(t.supplier_choice).toContain('$44,743.88')
    expect(t.cash_outlook).toContain('$6,958')
    expect(t.caveat).toMatch(/Rates checked Nov 5, 2026\.$/)
  })
})

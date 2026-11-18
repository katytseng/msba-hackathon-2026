// The demo's numbers, locked. If any figure the presentation script quotes changes (a quote, a lead time, a tariff,
// the bank balance, the engine itself), these fail. If the change is on purpose, regenerate with:
//   npx vitest run --dir src demo -u
// which rewrites the snapshot and DEMO_NUMBERS.md. Then re-check the script and the saved AI explanation.
import { describe, expect, it } from 'vitest'
import { compareSuppliers, type Inputs } from '../engine'
import { explain } from '../ai/explain'
import { demoExplanation, demoFingerprint, DEMO_EXPLANATIONS } from '../ai/demoCache'
import { unverifiedNumbers } from '../ai/guard'
import { seedStore } from '../state'
import { DEMO_COMPANY, DEMO_ITEMS, DEMO_ORDER_DATE, DEMO_TODAY, SEED_ORDERS, demoOrderInputs, seedOrders } from './data'
import { computeDemoNumbers, demoExplainPayload, rates, DEMO_INDIA_SLIDER, DEMO_TYPED_CASH } from './numbers'
import { demoKeyFor, fillSampleItems, fillSampleQuotes } from './sample'
import { renderSheet } from './sheet'

const n = computeDemoNumbers()

describe('demo numbers are locked', () => {
  it('every number the script quotes', () => {
    expect(n).toMatchSnapshot()
  })

  it('DEMO_NUMBERS.md is the current sheet', async () => {
    await expect(renderSheet(n)).toMatchFileSnapshot('../../DEMO_NUMBERS.md')
  })
})

describe('the story the numbers must tell', () => {
  const c = n.compare

  it('one DEMO_TODAY drives every date', () => {
    expect(DEMO_TODAY).toBe('2026-11-18')
    expect(new Date(DEMO_TODAY + 'T00:00:00Z').getUTCDay()).toBe(3) // Wednesday
    expect(DEMO_ORDER_DATE).toBe('2026-11-19') // DEMO_TODAY + 1
    for (const o of seedOrders()) expect(o.inputs.business.orderDate <= DEMO_TODAY).toBe(true)
  })

  it('China quotes lowest but lands 40-60% above its quote; Vietnam quotes more but lands cheaper', () => {
    expect(c.china.productQuote).toBeLessThan(c.vietnam.productQuote)
    expect(c.china.productQuote).toBeLessThan(c.india.productQuote)
    expect(c.china.percentAboveQuote).toBeGreaterThanOrEqual(40)
    expect(c.china.percentAboveQuote).toBeLessThanOrEqual(60)
    expect(c.vietnamQuoteVsChina).toBeGreaterThan(0)
    expect(c.vietnamLandedVsChina).toBeLessThan(0)
    expect(c.recommended).toMatch(/Vietnam/)
    // India lands in between on cost.
    expect(c.india.landedTotal).toBeGreaterThan(c.vietnam.landedTotal)
    expect(c.india.landedTotal).toBeLessThan(c.china.landedTotal)
  })

  it('Vietnam arrives for last-minute Christmas shopping, China after Christmas, India in between', () => {
    const a = c.arrivals
    expect(a.vietnam.date <= '2026-12-23').toBe(true) // sales start inside the last week before Christmas
    expect(a.vietnam.firstSalesWeek <= '2026-12-23').toBe(true)
    expect(a.china.date > '2026-12-25').toBe(true)
    expect(a.vietnam.date < a.india.date && a.india.date < a.china.date).toBe(true)
  })

  it('the recommended supplier dips below the buffer in one week, with a small but nonzero interest cost', () => {
    expect(n.cashCheck.belowBufferBy).toBeGreaterThan(0)
    expect(n.cashCheck.interestToBridge).toBeGreaterThan(0)
    expect(n.cashCheck.interestToBridge).toBeLessThan(100)
    expect(n.cashCheck.lowestBalance).toBeGreaterThan(0)
  })

  it('Finances starts green and flips to amber at $5,000', () => {
    expect(n.finances.seedThreeOrders.verdict).toBe('No loan needed')
    expect(n.finances.seedThreeOrders.cashOnHand).toBe(DEMO_COMPANY.cash)
    expect(DEMO_TYPED_CASH).toBe(5000)
    expect(n.finances.afterTypingCash.verdict).toMatch(/^Borrow about \$/)
    expect(n.finances.afterSavingDemoOrderAndTypingCash.verdict).toBe('Borrow about $22,000')
  })

  it('the three existing orders look different: stage, supplier, products, units', () => {
    const [a, b, cc] = n.orders
    expect([a.stage, b.stage, cc.stage]).toEqual(['selling', 'transit', 'production'])
    expect(new Set([a.units, b.units, cc.units]).size).toBe(3)
    expect(new Set([a.supplier, b.supplier, cc.supplier]).size).toBe(3)
    const names = SEED_ORDERS.flatMap((o) => o.items.map((i) => i.name.toLowerCase()))
    expect(new Set(names).size).toBe(names.length)
    expect(n.orders).toHaveLength(4) // three existing orders plus the demo order once saved
  })

  it('Plan: some items are already cheaper elsewhere; a modest India drop flips the cashmere sweater, rain jacket and boots, not the poncho', () => {
    const p = n.plan
    expect(p.baseline.switching.length).toBeGreaterThanOrEqual(1)
    expect(p.sliderPct).toBeLessThan(p.indiaTodayPct)
    expect(p.indiaTodayPct - p.sliderPct).toBeLessThanOrEqual(5) // a believable drop
    const flips = p.atSlider.rows.filter((r) => r.switched && r.orderFrom.includes('(India)')).map((r) => r.item)
    expect(flips).toEqual(['Cashmere sweater', 'Rain jacket', 'Waterproof boots'])
    expect(p.atSlider.rows.find((r) => r.item === 'Poncho')!.switched).toBe(false)
    expect(p.atSlider.rows.find((r) => r.item === 'Poncho')!.baseRatePct).toBe(0)
    expect(DEMO_INDIA_SLIDER).toBe(0.06)
  })
})

describe('the fictional numbers look like a small importer', () => {
  const orders = [...SEED_ORDERS.map((o) => ({ name: o.name, items: o.items, suppliers: o.suppliers })), { name: 'Rainy day LA', items: DEMO_ITEMS, suppliers: [] as never[] }]

  it('quantities are low, round hundreds', () => {
    for (const o of orders) for (const i of o.items) {
      expect(i.qty, `${o.name} ${i.name}`).toBeLessThanOrEqual(300)
      expect(i.qty % 50, `${o.name} ${i.name}`).toBe(0)
    }
  })

  it('every order is $8k-$30k at quote value, whichever supplier; the demo order is upper middle', () => {
    const all = [...seedOrders().map((o) => o.inputs), demoOrderInputs()]
    for (const inp of all) {
      for (const r of compareSuppliers(inp, rates)) {
        expect(r.customsValue).toBeGreaterThanOrEqual(8000)
        expect(r.customsValue).toBeLessThanOrEqual(30000)
      }
    }
    expect(n.compare.vietnam.productQuote).toBeGreaterThanOrEqual(18000)
    expect(n.compare.vietnam.productQuote).toBeLessThanOrEqual(24000)
  })

  it('unit quotes are to the cent, and freight is a small-shipment figure', () => {
    for (const inp of [...seedOrders().map((o) => o.inputs), demoOrderInputs()]) {
      for (const s of inp.suppliers) {
        for (const price of Object.values(s.prices)) expect(Math.round(price * 100) / 100).toBe(price)
        expect(s.freight).toBeGreaterThanOrEqual(1000)
        expect(s.freight).toBeLessThanOrEqual(4000)
        expect(s.leadTimeDays + s.transitDays).toBeGreaterThanOrEqual(28)
        expect(s.leadTimeDays + s.transitDays).toBeLessThanOrEqual(60)
      }
    }
  })

  it('base tariffs are the real HTS rates (never invented): every item carries its picked HTS line', () => {
    for (const inp of [...seedOrders().map((o) => o.inputs), demoOrderInputs()]) {
      for (const p of inp.products) {
        expect(typeof p.baseRate).toBe('number')
        expect(p.htsRelease).toBe('2026HTSRev23')
      }
    }
    // The extra tariffs are untouched rates.json values.
    expect(n.extraTariffsPct).toEqual({ China: 20, Vietnam: 12.5, India: 10 })
  })

  it('cash, buffer and weekly sales are plausible for a business this size', () => {
    expect(DEMO_COMPANY.cash).toBeLessThanOrEqual(50000)
    expect(DEMO_COMPANY.buffer).toBeLessThan(DEMO_COMPANY.cash)
    expect(n.demoOrder.grossMarginAtFullSellThrough.marginPct).toBeGreaterThanOrEqual(50)
    expect(n.demoOrder.grossMarginAtFullSellThrough.marginPct).toBeLessThanOrEqual(70)
  })
})

describe('Fill sample', () => {
  const typed = (id: string, name: string) => ({ id, name, htsCode: '6109.10.00', qty: 100, sellPrice: 0, salesPerWeek: 10 })

  it('recognises the demo items from loose typing', () => {
    expect(demoKeyFor('Cashmere Sweater')).toBe('sweater')
    expect(demoKeyFor('cashmere sweaters')).toBe('sweater')
    expect(demoKeyFor('PONCHO')).toBe('poncho')
    expect(demoKeyFor('Rain jackets')).toBe('jacket')
    expect(demoKeyFor('waterproof boots')).toBe('boots')
    expect(demoKeyFor('Umbrellas')).toBe('umbrella')
    expect(demoKeyFor('Scarf')).toBeNull()
  })

  it('step 1 completes two hand-typed items to the script and adds the rest', () => {
    const out = fillSampleItems([typed('p1', 'Cashmere sweater'), typed('p2', 'Poncho')])
    expect(out.map((p) => p.name)).toEqual(['Cashmere sweater', 'Poncho', 'Rain jacket', 'Waterproof boots', 'Umbrella'])
    expect(out[0]).toMatchObject({ id: 'p1', htsCode: '6110.12.10', baseRate: 0.04, qty: 200, sellPrice: 149, salesPerWeek: 12 })
    expect(out[1]).toMatchObject({ id: 'p2', htsCode: '3926.20.60.00', baseRate: 0, qty: 300, sellPrice: 16, salesPerWeek: 30 })
  })

  it('is deterministic and idempotent', () => {
    const once = fillSampleItems([typed('p1', 'Cashmere sweater'), typed('p2', 'Poncho')])
    expect(fillSampleItems(once)).toEqual(once)
    expect(fillSampleItems([])).toEqual(fillSampleItems([]))
  })

  it('step 2 prices the typed items by id, with the scripted terms', () => {
    const products = fillSampleItems([typed('p1', 'Cashmere sweater'), typed('p2', 'Poncho')])
    const suppliers = fillSampleQuotes(products)
    expect(suppliers.map((s) => s.country)).toEqual(['China', 'Vietnam', 'India'])
    expect(suppliers[1].prices).toMatchObject({ p1: 44.9, p2: 3.7 })
    // Typing by hand and Fill sample give exactly the same engine results as the seeded demo order.
    const hand: Inputs = { business: { ...DEMO_COMPANY, orderDate: DEMO_ORDER_DATE }, products, suppliers }
    const seeded = demoOrderInputs()
    const a = compareSuppliers(hand, rates).map((r) => [r.country, r.total])
    const b = compareSuppliers(seeded, rates).map((r) => [r.country, r.total])
    expect(a).toEqual(b)
  })
})

describe('reset and seed', () => {
  it('the seed store is Sam: his bank balance and three orders, in a stable order', () => {
    const s = seedStore()
    expect(s.company).toEqual(DEMO_COMPANY)
    expect(s.orders.map((o) => o.name)).toEqual(['Fall essentials', 'Winter layers', 'Holiday party'])
    expect(seedStore()).toEqual(s) // same every time
  })
})

describe('the saved AI explanation', () => {
  const payload = demoExplainPayload()

  it('is keyed to the demo order and every figure in it matches the engine', () => {
    expect(DEMO_EXPLANATIONS).toHaveLength(1)
    // If this fails the numbers changed: regenerate the explanation (see demoCache.ts) and paste the new fingerprint.
    expect(demoFingerprint(payload)).toBe(DEMO_EXPLANATIONS[0].fingerprint)
    const saved = demoExplanation(payload)
    expect(saved).not.toBeNull()
    expect(unverifiedNumbers(Object.values(saved!).join('\n'), payload)).toEqual([])
  })

  it('is served instantly and offline, and marked as the AI answer', async () => {
    const r = await explain(payload, { url: '', fetchImpl: (() => Promise.reject(new Error('no network'))) as typeof fetch })
    expect(r).toMatchObject({ source: 'ai', cached: true })
  })

  it('is skipped (template fallback still works) when the numbers differ', async () => {
    const changed = { ...payload, business: { ...payload.business, cash_on_hand_usd: 5000 } }
    expect(demoExplanation(changed)).toBeNull()
    expect(await explain(changed, { url: '' })).toEqual({ source: 'fallback', reason: 'not_configured' })
  })

  it('is rejected if one of its figures no longer matches the engine', () => {
    // Same fingerprint, but the $30 interest the saved text quotes is no longer a number the engine produced.
    const tampered = structuredClone(payload)
    tampered.cash.interest_to_bridge_usd = 99
    expect(demoFingerprint(tampered)).toBe(demoFingerprint(payload))
    expect(demoExplanation(tampered)).toBeNull()
  })
})

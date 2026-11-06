import { describe, expect, it } from 'vitest'
import { cashTimeline, compareSuppliers, type Inputs, type Rates } from './index'
import { analyzeOrder, portfolioCash, portfolioStart, reorderAdvice, withExtraRates, type SavedOrder } from './portfolio'
import ratesJson from '../data/rates.json'
import sampleJson from '../data/sample.json'
import suppliersJson from '../data/suppliers.json'

const rates = ratesJson as unknown as Rates
const sample = { ...sampleJson, suppliers: suppliersJson } as Inputs
const order = (id: string, date: string, supplierId = 'A'): SavedOrder => ({
  id,
  name: id,
  savedAt: '',
  supplierId,
  inputs: { ...structuredClone(sample), business: { ...sample.business, orderDate: date } },
})
const company = { cash: sample.business.cash, buffer: sample.business.buffer, apr: sample.business.apr }

describe('portfolio cash', () => {
  it('one order matches the single-order cash timeline', () => {
    const o = order('o1', sample.business.orderDate)
    const a = analyzeOrder(o, rates, portfolioStart([o]))
    const pc = portfolioCash([a], company, portfolioStart([o]))
    const single = cashTimeline(sample, sample.suppliers[0], rates)
    expect(pc.lowest).toBeCloseTo(single.lowest, 6)
    expect(pc.lowestWeek).toBe(single.lowestWeek)
    expect(pc.shortfall).toBeCloseTo(single.shortfall, 6)
  })

  it('a second order draws on the same balance, so the low point is lower', () => {
    const o1 = order('o1', '2026-11-09')
    const o2 = order('o2', '2026-11-23')
    const start = portfolioStart([o1, o2])
    const one = portfolioCash([analyzeOrder(o1, rates, start)], company, start)
    const two = portfolioCash([o1, o2].map((o) => analyzeOrder(o, rates, start)), company, start)
    expect(two.lowest).toBeLessThan(one.lowest)
    expect(start).toBe('2026-11-09')
  })

  it('reorder advice re-ranks suppliers under the scenario tariffs', () => {
    const scenario = withExtraRates(rates, { China: 0.6 })
    const r = reorderAdvice(order('o1', '2026-11-09', 'A'), rates, scenario)
    expect(r.best.supplierId).toBe(compareSuppliers(sample, scenario)[0].supplierId)
    expect(r.best.supplierId).not.toBe('A')
    expect(r.same.supplierId).toBe('A')
    expect(r.savings).toBeCloseTo(r.same.total - r.best.total, 6)
  })

  it('placed orders ignore tariff scenarios (they are done deals)', () => {
    const a = analyzeOrder(order('o1', '2026-11-09', 'A'), rates, '2026-11-09')
    expect(a.placed.total).toBeCloseTo(compareSuppliers(sample, rates).find((x) => x.supplierId === 'A')!.total, 6)
  })
})

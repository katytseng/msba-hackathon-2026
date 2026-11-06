// These tests lock the engine to "Expected results" in CONTEXT.md, to the cent.
import { describe, expect, it } from 'vitest'
import { breakEven, cashTimeline, compareSuppliers, landedCost } from './index'
import type { Inputs, Rates } from './types'
import ratesJson from '../data/rates.json'
import sampleJson from '../data/sample.json'
import suppliersJson from '../data/suppliers.json'

const rates = ratesJson as unknown as Rates
const inputs = { ...sampleJson, suppliers: suppliersJson } as Inputs
const supplier = (id: string) => inputs.suppliers.find((s) => s.id === id)!
const cents = (x: number) => Math.round(x * 100) / 100

describe('landed cost', () => {
  it('matches the expected totals per supplier', () => {
    expect(cents(landedCost(inputs, supplier('A'), rates).total)).toBe(44743.88)
    expect(cents(landedCost(inputs, supplier('C'), rates).total)).toBe(46197.49)
    expect(cents(landedCost(inputs, supplier('B'), rates).total)).toBe(46721.58)
  })

  it('ranks China first, then India, then Vietnam', () => {
    const ranked = compareSuppliers(inputs, rates)
    expect(ranked.map((r) => r.country)).toEqual(['China', 'India', 'Vietnam'])
    expect(cents(ranked[1].gapToCheapest)).toBe(1453.61)
  })

  it('has 3,600 units at about $12.43 each from China', () => {
    const a = landedCost(inputs, supplier('A'), rates)
    expect(a.units).toBe(3600)
    expect(cents(a.avgUnit)).toBe(12.43)
  })

  it('matches per-unit landed cost from China', () => {
    const a = landedCost(inputs, supplier('A'), rates)
    const perUnit = Object.fromEntries(a.perProduct.map((p) => [p.productId, cents(p.landedUnit)]))
    expect(perUnit).toEqual({ tee: 5.86, shirt: 11.8, pants: 13.89, jacket: 29.77, sneaker: 22.08 })
  })

  it('per-product totals add back up to the landed total', () => {
    const a = landedCost(inputs, supplier('A'), rates)
    const sum = a.perProduct.reduce((s, p) => s + p.landedTotal, 0)
    expect(cents(sum)).toBe(cents(a.total))
  })

  it('applies the MPF minimum and maximum', () => {
    const tiny: Inputs = { ...inputs, products: [{ ...inputs.products[0], qty: 1 }] }
    expect(landedCost(tiny, supplier('A'), rates).mpf).toBe(34.58)
    const huge: Inputs = { ...inputs, products: inputs.products.map((p) => ({ ...p, qty: p.qty * 100 })) }
    expect(landedCost(huge, supplier('A'), rates).mpf).toBe(670.86)
  })
})

describe('break-even and scenarios', () => {
  it('China can take about 5.1 more points before India wins', () => {
    const be = breakEven(compareSuppliers(inputs, rates))!
    expect(be.cheapest.country).toBe('China')
    expect(be.runnerUp.country).toBe('India')
    expect(Math.round(be.rate * 100000) / 100000).toBe(0.05118)
  })

  it('+10 points on China makes India cheapest', () => {
    const ranked = compareSuppliers(inputs, rates, { A: 0.1 })
    expect(ranked[0].country).toBe('India')
  })

  it('just under the break-even China still wins, just over India wins', () => {
    const be = breakEven(compareSuppliers(inputs, rates))!
    expect(compareSuppliers(inputs, rates, { A: be.rate - 0.0001 })[0].country).toBe('China')
    expect(compareSuppliers(inputs, rates, { A: be.rate + 0.0001 })[0].country).toBe('India')
  })
})

describe('cash timeline with China', () => {
  const cash = cashTimeline(inputs, supplier('A'), rates)
  const ev = (label: string) => cash.events.find((e) => e.label === label)!

  it('pays on the expected days and amounts', () => {
    expect(ev('Deposit to supplier')).toMatchObject({ day: 0 })
    expect(cents(-ev('Deposit to supplier').amount)).toBe(8520)
    expect(ev('Balance to supplier').day).toBe(35)
    expect(cents(-ev('Balance to supplier').amount)).toBe(19880)
    expect(ev('Freight and insurance').day).toBe(35)
    expect(cents(-ev('Freight and insurance').amount)).toBe(4642)
    expect(cash.arrivalDay).toBe(53)
    expect(ev('Duty and customs fees').day).toBe(67)
    expect(cents(-ev('Duty and customs fees').amount)).toBe(11701.88)
  })

  it('dips to $6,958 in week 5, $3,042 below the buffer for 3 weeks', () => {
    expect(cents(cash.lowest)).toBe(6958)
    expect(cash.lowestWeek).toBe(5)
    expect(cents(cash.shortfall)).toBe(3042)
    expect(cash.weeksBelowBuffer).toBe(3)
    expect(cents(cash.interest)).toBe(10.5)
    expect(cash.headroom).toBe(0)
    expect(cash.extraUnits).toBe(0)
  })

  it('starts sales in week 8, the first week starting on or after arrival', () => {
    expect(cash.salesStartWeek).toBe(8)
    expect(cash.weeks[7].inflow).toBe(0)
    expect(cash.weeks[8].inflow).toBe(16280)
  })

  it('sells every unit by the end of the timeline', () => {
    const revenue = cash.weeks.reduce((s, w) => s + w.inflow, 0)
    const expected = inputs.products.reduce((s, p) => s + p.qty * p.sellPrice, 0)
    expect(revenue).toBe(expected)
  })

  it('shows headroom and extra units when cash is plentiful', () => {
    const rich: Inputs = { ...inputs, business: { ...inputs.business, cash: 60000 } }
    const c = cashTimeline(rich, supplier('A'), rates)
    expect(cents(c.headroom)).toBe(16958)
    expect(c.shortfall).toBe(0)
    expect(c.extraUnits).toBe(Math.floor(16958 / landedCost(rich, supplier('A'), rates).avgUnit))
  })
})

describe('India payment terms', () => {
  it('pays the balance 30 days after ship and arrives on day 77', () => {
    const c = cashTimeline(inputs, supplier('C'), rates)
    expect(c.events.find((e) => e.label === 'Balance to supplier')!.day).toBe(75)
    expect(c.arrivalDay).toBe(77)
  })
})

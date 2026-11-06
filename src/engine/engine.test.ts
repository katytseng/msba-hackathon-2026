// These tests lock the engine to "Expected results" in CONTEXT.md, to the cent.
import { describe, expect, it } from 'vitest'
import { breakEven, cashTimeline, compareSuppliers, costBreakdown, countryFlipRate, landedCost, orderMargin, tariffScenario } from './index'
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

describe('tariff scenario on China', () => {
  const today = tariffScenario(inputs, rates, 'China', 0.2)!

  it('at today\'s rate matches the locked landed and cash numbers', () => {
    expect(today.todayRate).toBe(0.2)
    expect(today.switched).toBe(false)
    expect(today.cheapest.country).toBe('China')
    expect(cents(today.cheapest.total)).toBe(44743.88)
    expect(today.runnerUp!.country).toBe('India')
    expect(cents(today.gapToRunnerUp)).toBe(1453.61)
    expect(cents(today.cash.lowest)).toBe(6958)
    expect(cents(today.cash.shortfall)).toBe(3042)
    expect(cents(today.cash.interest)).toBe(10.5)
  })

  it('at today\'s rate gives the gross margin on the full order', () => {
    expect(today.margin.revenue).toBe(203200)
    expect(cents(today.margin.landed)).toBe(44743.88)
    expect(cents(today.margin.margin)).toBe(158456.12)
    expect(Math.round(today.margin.marginPct * 10000) / 10000).toBe(0.7798)
    expect(today.margin.weeksToSellOut).toBe(15)
    expect(today.margin.unsoldUnits).toBe(0)
  })

  it('+10 points on China makes India cheapest, with India\'s margin and cash', () => {
    const s = tariffScenario(inputs, rates, 'China', 0.3)!
    expect(s.cheapest.country).toBe('India')
    expect(s.switched).toBe(true)
    expect(s.runnerUp!.country).toBe('Vietnam')
    expect(cents(s.cheapest.total)).toBe(46197.49)
    expect(s.cash.supplierId).toBe('C')
    expect(s.margin.landed).toBe(s.cheapest.total)
    expect(s.delta).toBeCloseTo(0.1, 10)
    expect(s.staying.supplierId).toBe('A')
    expect(cents(s.staying.total)).toBe(47583.88)
    expect(cents(s.savingsVsStaying)).toBe(1386.39)
  })

  it('has no savings when nothing changes', () => {
    expect(today.delta).toBe(0)
    expect(today.staying.supplierId).toBe(today.cheapest.supplierId)
    expect(today.savingsVsStaying).toBe(0)
  })

  it('tariff removed keeps China cheapest and lowers its landed cost', () => {
    const s = tariffScenario(inputs, rates, 'China', 0)!
    expect(s.cheapest.country).toBe('China')
    expect(s.cheapest.extraDuty).toBe(0)
    expect(s.cheapest.total).toBeLessThan(today.cheapest.total)
    expect(s.margin.margin).toBeGreaterThan(today.margin.margin)
  })

  it('flips to India at today\'s rate plus the break-even', () => {
    const flip = countryFlipRate(inputs, rates, 'China')!
    const be = breakEven(compareSuppliers(inputs, rates))!
    expect(flip).toBeCloseTo(0.2 + be.rate, 10)
    expect(tariffScenario(inputs, rates, 'China', flip - 0.0001)!.cheapest.country).toBe('China')
    expect(tariffScenario(inputs, rates, 'China', flip + 0.0001)!.cheapest.country).toBe('India')
  })
})

describe('order margin', () => {
  it('counts full sell-through, past the end of the cash timeline', () => {
    // 1,500 tees at 1 a week takes 1,500 weeks; the cash timeline stops at 156.
    const slow: Inputs = { ...inputs, products: inputs.products.map((p) => (p.id === 'tee' ? { ...p, salesPerWeek: 1 } : p)) }
    const lc = landedCost(slow, supplier('A'), rates)
    const m = orderMargin(slow, lc)
    const fullRevenue = slow.products.reduce((s, p) => s + p.qty * p.sellPrice, 0)
    const timelineRevenue = cashTimeline(slow, supplier('A'), rates, lc).weeks.reduce((s, w) => s + w.inflow, 0)
    expect(m.revenue).toBe(fullRevenue)
    expect(timelineRevenue).toBeLessThan(fullRevenue)
    expect(m.weeksToSellOut).toBe(1500)
  })

  it('leaves out products with no weekly sales', () => {
    const noJackets: Inputs = { ...inputs, products: inputs.products.map((p) => (p.id === 'jacket' ? { ...p, salesPerWeek: 0 } : p)) }
    const m = orderMargin(noJackets, landedCost(noJackets, supplier('A'), rates))
    expect(m.unsoldUnits).toBe(300)
    expect(m.revenue).toBe(noJackets.products.filter((p) => p.id !== 'jacket').reduce((s, p) => s + p.qty * p.sellPrice, 0))
  })
})

describe('order margin per product', () => {
  it('lists sales for each product and adds up to the revenue', () => {
    const m = orderMargin(inputs, landedCost(inputs, supplier('A'), rates))
    const tee = m.perProduct.find((p) => p.productId === 'tee')!
    expect(tee).toMatchObject({ qty: 1500, sellPrice: 28, salesPerWeek: 150, revenue: 42000, weeksToSellOut: 10 })
    expect(m.perProduct.reduce((s, p) => s + p.revenue, 0)).toBe(m.revenue)
  })
})

describe('cost breakdown', () => {
  it('matches China at today\'s rate, line by line', () => {
    const b = costBreakdown(landedCost(inputs, supplier('A'), rates))
    expect(b.total).toBe(44743.88)
    expect(b.lines.map((l) => l.key)).toEqual(['product', 'baseDuty', 'extraDuty', 'mpf', 'hmf', 'insurance', 'freight', 'broker'])
    const line = (k: string) => b.lines.find((l) => l.key === k)!.amount
    expect(line('product')).toBe(28400)
    expect(line('extraDuty')).toBe(5680)
    expect(line('freight')).toBe(4500)
    expect(line('broker')).toBe(250)
  })

  it('always adds up to the cent, within a cent of each raw amount', () => {
    for (const s of inputs.suppliers) {
      for (let d = -0.1; d <= 0.4; d += 0.0037) {
        const lc = landedCost(inputs, s, rates, d)
        const b = costBreakdown(lc)
        const sumCents = b.lines.reduce((acc, l) => acc + Math.round(l.amount * 100), 0)
        expect(sumCents).toBe(Math.round(lc.total * 100))
        const raws = [lc.customsValue, lc.baseDuty, lc.extraDuty, lc.mpf, lc.hmf, lc.insurance, lc.freight, lc.broker]
        b.lines.forEach((l, i) => expect(Math.abs(l.amount - raws[i])).toBeLessThan(0.0101))
      }
    }
  })
})

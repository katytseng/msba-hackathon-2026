// Dashboard math: several saved orders sharing one bank balance, under one set of tariff rates.
// Reuses the single-order engine (compareSuppliers, cashTimeline) so numbers match the steps.
import { addDays, cashTimeline, compareSuppliers } from './index'
import type { CashResult, Inputs, RankedResult, Rates } from './types'

export interface SavedOrder {
  id: string
  name: string
  savedAt: string // ISO timestamp
  inputs: Inputs // snapshot of steps 1-2
  supplierId: string // supplier picked in step 3
  color?: number // lane color slot, fixed when first saved
}

export interface Company {
  cash: number
  buffer: number
  apr: number
}

export interface OrderAnalysis {
  order: SavedOrder
  placed: RankedResult // the supplier the order was placed with, at today's tariffs
  cash: CashResult // timeline for the placed order, starting from $0
  offsetDays: number // order date relative to the dashboard start date
  lastPaymentDay: number // order-relative
  sellOutDay: number // order-relative, last week with sales
}

/** If the same order were placed again under `scenario` tariffs: who should supply it. */
export interface ReorderAdvice {
  order: SavedOrder
  ranked: RankedResult[] // every quoted supplier at the scenario tariffs
  best: RankedResult // cheapest at the scenario tariffs
  same: RankedResult // the last supplier again, at the scenario tariffs
  savings: number // same.total - best.total
  vsToday: number // best.total minus the placed order's total today
}

export interface PortfolioEvent {
  orderId: string
  label: string
  amount: number
  day: number // portfolio day
}

export interface PortfolioWeek {
  week: number
  startDay: number
  date: string
  inflow: number
  outflow: number
  balance: number
  events: PortfolioEvent[]
  salesByOrder: Record<string, number>
}

export interface PortfolioCash {
  startDate: string
  weeks: PortfolioWeek[]
  lowest: number
  lowestWeek: number
  weeksBelowBuffer: number
  shortfall: number // how much to borrow to stay at the buffer
  interest: number
  firstBelowWeek: number | null
  backAboveWeek: number | null // first week after the dip where the balance is back at the buffer
  goesNegative: boolean
}

/** A copy of rates with some countries' extra tariffs replaced. */
export function withExtraRates(rates: Rates, overrides: Record<string, number>): Rates {
  const extraTariffs = { ...rates.extraTariffs }
  for (const [country, rate] of Object.entries(overrides)) {
    if (extraTariffs[country]) extraTariffs[country] = { ...extraTariffs[country], rate }
  }
  return { ...rates, extraTariffs }
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + 'T00:00:00Z')
  const b = Date.parse(toIso + 'T00:00:00Z')
  return Math.round((b - a) / 86_400_000)
}

/** A placed order is a done deal: costed with the supplier it went to, at today's tariffs. */
export function analyzeOrder(order: SavedOrder, rates: Rates, startDate: string): OrderAnalysis {
  const ranked = compareSuppliers(order.inputs, rates)
  const placed = ranked.find((r) => r.supplierId === order.supplierId) ?? ranked[0]
  const supplier = order.inputs.suppliers.find((s) => s.id === placed.supplierId)!
  // Cash from $0: we only want this order's own money in and out.
  const zeroed: Inputs = { ...order.inputs, business: { ...order.inputs.business, cash: 0, buffer: 0 } }
  const cash = cashTimeline(zeroed, supplier, rates, placed)
  const lastSales = [...cash.weeks].reverse().find((w) => w.inflow > 0)
  return {
    order,
    placed,
    cash,
    offsetDays: daysBetween(startDate, order.inputs.business.orderDate),
    lastPaymentDay: Math.max(0, ...cash.events.map((e) => e.day)),
    sellOutDay: lastSales ? lastSales.startDay + 6 : cash.arrivalDay,
  }
}

/** Future state: the same products and quotes, re-ranked under the scenario tariffs. */
export function reorderAdvice(order: SavedOrder, today: Rates, scenario: Rates): ReorderAdvice {
  const ranked = compareSuppliers(order.inputs, scenario)
  const same = ranked.find((r) => r.supplierId === order.supplierId) ?? ranked[0]
  const placedToday = compareSuppliers(order.inputs, today).find((r) => r.supplierId === order.supplierId)
  const best = ranked[0]
  return { order, ranked, best, same, savings: same.total - best.total, vsToday: best.total - (placedToday?.total ?? same.total) }
}

/** Earliest order date among the saved orders. */
export function portfolioStart(orders: SavedOrder[]): string {
  return orders.map((o) => o.inputs.business.orderDate).sort()[0] ?? new Date().toISOString().slice(0, 10)
}

/**
 * One bank balance carrying every order. Supplier, freight and duty payments land on their
 * exact day; each week's sales land at the start of that order's week. Weeks are counted
 * from the earliest order date.
 */
export function portfolioCash(analyses: OrderAnalysis[], company: Company, startDate: string): PortfolioCash {
  const events: PortfolioEvent[] = []
  const sales: { orderId: string; day: number; amount: number }[] = []
  for (const a of analyses) {
    for (const e of a.cash.events) events.push({ orderId: a.order.id, label: e.label, amount: e.amount, day: a.offsetDays + e.day })
    for (const w of a.cash.weeks) if (w.inflow > 0) sales.push({ orderId: a.order.id, day: a.offsetDays + w.startDay, amount: w.inflow })
  }
  const lastDay = Math.max(0, ...events.map((e) => e.day), ...sales.map((s) => s.day))
  const nWeeks = Math.floor(lastDay / 7) + 2

  const weeks: PortfolioWeek[] = []
  let bal = company.cash
  for (let w = 0; w < nWeeks; w++) {
    const startDay = 7 * w
    const inWeek = (d: number) => d >= startDay && d <= startDay + 6
    const wkEvents = events.filter((e) => inWeek(e.day)).sort((a, b) => a.day - b.day)
    const salesByOrder: Record<string, number> = {}
    for (const s of sales) if (inWeek(s.day)) salesByOrder[s.orderId] = (salesByOrder[s.orderId] ?? 0) + s.amount
    const inflow = Object.values(salesByOrder).reduce((t, x) => t + x, 0)
    const outflow = -wkEvents.reduce((t, e) => t + e.amount, 0)
    bal += inflow - outflow
    weeks.push({ week: w, startDay, date: addDays(startDate, startDay), inflow, outflow, balance: bal, events: wkEvents, salesByOrder })
  }

  let lowest = company.cash
  let lowestWeek = 0
  for (const wk of weeks) if (wk.balance < lowest) [lowest, lowestWeek] = [wk.balance, wk.week]
  const below = weeks.filter((wk) => wk.balance < company.buffer)
  const shortfall = Math.max(0, company.buffer - lowest)
  const firstBelowWeek = below[0]?.week ?? null
  const backAbove =
    firstBelowWeek === null ? null : weeks.find((wk) => wk.week > lowestWeek && wk.balance >= company.buffer)?.week ?? null
  return {
    startDate,
    weeks,
    lowest,
    lowestWeek,
    weeksBelowBuffer: below.length,
    shortfall,
    interest: (shortfall * company.apr * below.length * 7) / 365,
    firstBelowWeek,
    backAboveWeek: backAbove,
    goesNegative: lowest < 0,
  }
}

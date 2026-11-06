// The one calculation engine. Every screen uses these functions.
// Formulas follow CONTEXT.md exactly. No rounding happens here; screens round for display.
import type {
  BreakEven,
  CashEvent,
  CashResult,
  CashWeek,
  Inputs,
  LandedResult,
  Rates,
  RankedResult,
  Supplier,
} from './types'

export * from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi)

export function baseRateFor(rates: Rates, htsCode: string): number {
  const entry = rates.baseTariffs[htsCode]
  if (!entry) throw new Error(`No base tariff in rates.json for HTS code ${htsCode}`)
  return entry.rate
}

export function extraRateFor(rates: Rates, country: string): number {
  const entry = rates.extraTariffs[country]
  if (!entry) throw new Error(`No extra tariff in rates.json for ${country}`)
  return entry.rate
}

/**
 * Full landed cost for one supplier.
 * @param extraDelta added to the country's extra tariff (0.10 = +10 points), for scenarios.
 */
export function landedCost(
  inputs: Inputs,
  supplier: Supplier,
  rates: Rates,
  extraDelta = 0,
): LandedResult {
  const { fees } = rates
  const extraRate = extraRateFor(rates, supplier.country) + extraDelta

  let customsValue = 0
  let baseDuty = 0
  let units = 0
  for (const p of inputs.products) {
    const price = supplier.prices[p.id] ?? 0
    customsValue += price * p.qty
    baseDuty += price * p.qty * baseRateFor(rates, p.htsCode)
    units += p.qty
  }

  const extraDuty = customsValue * extraRate
  const mpf = customsValue > 0 ? clamp(customsValue * fees.mpf.rate, fees.mpf.min, fees.mpf.max) : 0
  const hmf = customsValue * fees.hmf.rate
  const insurance = customsValue * fees.insurance.rate
  const freight = supplier.freight
  const broker = fees.broker.amount
  const total = customsValue + baseDuty + extraDuty + mpf + hmf + insurance + freight + broker

  // Fixed costs (freight, MPF, HMF, broker) spread by share of customs value.
  const fixed = freight + mpf + hmf + broker
  const perProduct = inputs.products.map((p) => {
    const price = supplier.prices[p.id] ?? 0
    const baseRate = baseRateFor(rates, p.htsCode)
    const landedUnit =
      customsValue > 0
        ? price * (1 + baseRate + extraRate + fees.insurance.rate) + (price / customsValue) * fixed
        : 0
    return {
      productId: p.id,
      name: p.name,
      qty: p.qty,
      unitPrice: price,
      baseRate,
      landedUnit,
      landedTotal: landedUnit * p.qty,
    }
  })

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    country: supplier.country,
    extraRate,
    customsValue,
    baseDuty,
    extraDuty,
    mpf,
    hmf,
    insurance,
    freight,
    broker,
    total,
    units,
    avgUnit: units > 0 ? total / units : 0,
    perProduct,
  }
}

/** All suppliers, cheapest first. deltas: supplier id -> extra tariff change. */
export function compareSuppliers(
  inputs: Inputs,
  rates: Rates,
  deltas: Record<string, number> = {},
): RankedResult[] {
  const results = inputs.suppliers
    .map((s) => landedCost(inputs, s, rates, deltas[s.id] ?? 0))
    .sort((a, b) => a.total - b.total)
  const cheapest = results[0]?.total ?? 0
  return results.map((r, i) => ({ ...r, rank: i + 1, gapToCheapest: r.total - cheapest }))
}

/** How far the cheapest supplier's extra tariff can rise before the runner-up wins. */
export function breakEven(ranked: RankedResult[]): BreakEven | null {
  if (ranked.length < 2) return null
  const [cheapest, runnerUp] = ranked
  const gap = runnerUp.total - cheapest.total
  return {
    cheapest,
    runnerUp,
    gap,
    rate: cheapest.customsValue > 0 ? gap / cheapest.customsValue : 0,
  }
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Weekly cash timeline for one supplier. Day 0 = order date. Week w covers days 7w..7w+6. */
export function cashTimeline(inputs: Inputs, supplier: Supplier, rates: Rates, landed?: LandedResult): CashResult {
  const lc = landed ?? landedCost(inputs, supplier, rates)
  const { business } = inputs
  const shipDay = supplier.leadTimeDays
  const arrivalDay = shipDay + supplier.transitDays
  const dutyDay = arrivalDay + rates.fees.dutyPaymentDays.days

  const deposit = lc.customsValue * supplier.depositPct
  const balance = lc.customsValue - deposit
  const events: CashEvent[] = [
    { day: 0, label: 'Deposit to supplier', amount: -deposit },
    { day: shipDay + supplier.balanceDays, label: 'Balance to supplier', amount: -balance },
    { day: shipDay, label: 'Freight and insurance', amount: -(lc.freight + lc.insurance) },
    {
      day: dutyDay,
      label: 'Duty and customs fees',
      amount: -(lc.baseDuty + lc.extraDuty + lc.mpf + lc.hmf + lc.broker),
    },
  ].filter((e) => e.amount !== 0)
  events.sort((a, b) => a.day - b.day)

  const salesStartWeek = Math.ceil(arrivalDay / 7)
  const stock: Record<string, number> = {}
  for (const p of inputs.products) stock[p.id] = p.qty

  const lastPaymentDay = Math.max(...events.map((e) => e.day), 0)
  const weeks: CashWeek[] = []
  let bal = business.cash
  for (let w = 0; w < 156; w++) {
    const startDay = 7 * w
    const endDay = startDay + 6
    const weekEvents = events.filter((e) => e.day >= startDay && e.day <= endDay)
    const outflow = -weekEvents.reduce((s, e) => s + e.amount, 0)

    let inflow = 0
    if (w >= salesStartWeek) {
      for (const p of inputs.products) {
        const sold = Math.min(p.salesPerWeek, stock[p.id])
        stock[p.id] -= sold
        inflow += sold * p.sellPrice
      }
    }
    bal += inflow - outflow
    weeks.push({ week: w, startDay, date: addDays(business.orderDate, startDay), inflow, outflow, balance: bal, events: weekEvents })

    const stockLeft = Object.values(stock).some((q) => q > 0)
    const salesPossible = inputs.products.some((p) => p.salesPerWeek > 0 && stock[p.id] > 0)
    if (endDay >= lastPaymentDay && w >= salesStartWeek && (!stockLeft || !salesPossible)) break
  }

  let lowest = Infinity
  let lowestWeek = 0
  for (const wk of weeks) {
    if (wk.balance < lowest) {
      lowest = wk.balance
      lowestWeek = wk.week
    }
  }
  const weeksBelowBuffer = weeks.filter((wk) => wk.balance < business.buffer).length
  const shortfall = Math.max(0, business.buffer - lowest)
  const interest = (shortfall * business.apr * weeksBelowBuffer * 7) / 365
  const headroom = Math.max(0, lowest - business.buffer)
  const extraUnits = lc.avgUnit > 0 ? Math.floor(headroom / lc.avgUnit) : 0

  return {
    supplierId: supplier.id,
    shipDay,
    arrivalDay,
    salesStartWeek,
    events,
    weeks,
    lowest,
    lowestWeek,
    weeksBelowBuffer,
    shortfall,
    interest,
    headroom,
    extraUnits,
  }
}

// The one calculation engine. Every screen uses these functions.
// Formulas follow CONTEXT.md exactly. No rounding happens in the calculations.
// costBreakdown() is the one display helper that rounds, so its lines add up to the cent.
import type {
  BreakEven,
  CashEvent,
  CashResult,
  CashWeek,
  CostBreakdown,
  CostLineKey,
  Inputs,
  LandedResult,
  OrderMargin,
  Product,
  ProductSales,
  Rates,
  RankedResult,
  Supplier,
  TariffScenario,
} from './types'

export * from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi)

export function baseRateFor(rates: Rates, htsCode: string): number {
  const entry = rates.baseTariffs[htsCode]
  if (!entry) throw new Error(`No base tariff in rates.json for HTS code ${htsCode}`)
  return entry.rate
}

/** The base tariff for one product: the rate picked from the full HTS, else the rates.json entry. */
export function productBaseRate(rates: Rates, p: Pick<Product, 'htsCode' | 'baseRate'>): number {
  return typeof p.baseRate === 'number' ? p.baseRate : baseRateFor(rates, p.htsCode)
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
    baseDuty += price * p.qty * productBaseRate(rates, p)
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
    const baseRate = productBaseRate(rates, p)
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

/**
 * Gross margin on the whole order, assuming full sell-through: every unit of a product
 * with weekly sales is sold at its sell price, however many weeks that takes.
 * This does not stop at the cash timeline's last week.
 */
export function orderMargin(inputs: Inputs, landed: LandedResult): OrderMargin {
  let revenue = 0
  let weeksToSellOut = 0
  let unsoldUnits = 0
  const perProduct: ProductSales[] = []
  for (const p of inputs.products) {
    const sells = p.salesPerWeek > 0
    const productRevenue = sells ? p.qty * p.sellPrice : 0
    const weeks = sells ? Math.ceil(p.qty / p.salesPerWeek) : null
    revenue += productRevenue
    if (weeks !== null) weeksToSellOut = Math.max(weeksToSellOut, weeks)
    else unsoldUnits += p.qty
    perProduct.push({
      productId: p.id,
      name: p.name,
      qty: p.qty,
      sellPrice: p.sellPrice,
      salesPerWeek: p.salesPerWeek,
      revenue: productRevenue,
      weeksToSellOut: weeks,
    })
  }
  const margin = revenue - landed.total
  return {
    revenue,
    landed: landed.total,
    margin,
    marginPct: revenue > 0 ? margin / revenue : 0,
    weeksToSellOut,
    unsoldUnits,
    perProduct,
  }
}

/**
 * The landed total split into its parts, rounded to cents so the lines add up exactly to
 * the rounded total. Any leftover cent goes to the lines that lost the most in rounding.
 */
export function costBreakdown(lc: LandedResult): CostBreakdown {
  const raw: [CostLineKey, number][] = [
    ['product', lc.customsValue],
    ['baseDuty', lc.baseDuty],
    ['extraDuty', lc.extraDuty],
    ['mpf', lc.mpf],
    ['hmf', lc.hmf],
    ['insurance', lc.insurance],
    ['freight', lc.freight],
    ['broker', lc.broker],
  ]
  const totalCents = Math.round(lc.total * 100)
  const cents = raw.map(([, x]) => Math.floor(x * 100 + 1e-7))
  let left = totalCents - cents.reduce((s, c) => s + c, 0)
  const order = raw.map(([, x], i) => ({ i, rem: x * 100 - cents[i] })).sort((a, b) => b.rem - a.rem)
  for (let k = 0; left > 0 && k < order.length; k++, left--) cents[order[k].i] += 1
  return {
    lines: raw.map(([key], i) => ({ key, amount: cents[i] / 100 })),
    total: totalCents / 100,
  }
}

/** Extra-tariff changes that set every supplier in `country` to `extraRate`. */
function countryDeltas(inputs: Inputs, rates: Rates, country: string, extraRate: number): Record<string, number> {
  const delta = extraRate - extraRateFor(rates, country)
  return Object.fromEntries(inputs.suppliers.filter((s) => s.country === country).map((s) => [s.id, delta]))
}

/**
 * What a new extra tariff on one country means for the next order: who is cheapest,
 * by how much, and the margin and cash picture for that cheapest supplier.
 * Returns null when there are no suppliers.
 */
export function tariffScenario(inputs: Inputs, rates: Rates, country: string, extraRate: number): TariffScenario | null {
  const today = compareSuppliers(inputs, rates)
  const ranked = compareSuppliers(inputs, rates, countryDeltas(inputs, rates, country, extraRate))
  if (ranked.length === 0) return null
  const [cheapest, runnerUp = null] = ranked
  const supplier = inputs.suppliers.find((s) => s.id === cheapest.supplierId)!
  const todayRate = extraRateFor(rates, country)
  const staying = ranked.find((r) => r.supplierId === today[0].supplierId)!
  return {
    country,
    todayRate,
    extraRate,
    delta: extraRate - todayRate,
    ranked,
    cheapest,
    runnerUp,
    gapToRunnerUp: runnerUp ? runnerUp.total - cheapest.total : 0,
    todayCheapest: today[0],
    staying,
    switched: staying.supplierId !== cheapest.supplierId,
    savingsVsStaying: staying.total - cheapest.total,
    margin: orderMargin(inputs, cheapest),
    cash: cashTimeline(inputs, supplier, rates, cheapest),
  }
}

/**
 * The extra-tariff rate on `country` where the cheapest supplier changes hands between
 * that country and everyone else. Below it a supplier from `country` is cheapest; above it,
 * a supplier from elsewhere is. Null when there is no supplier on both sides to compare.
 */
export function countryFlipRate(inputs: Inputs, rates: Rates, country: string): number | null {
  const ranked = compareSuppliers(inputs, rates)
  const inside = ranked.filter((r) => r.country === country && r.customsValue > 0)
  const outside = ranked.filter((r) => r.country !== country)
  if (inside.length === 0 || outside.length === 0) return null
  const bestOther = outside[0].total
  const today = extraRateFor(rates, country)
  return Math.max(...inside.map((r) => today + (bestOther - r.total) / r.customsValue))
}

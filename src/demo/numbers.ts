// Every number the demo script quotes, computed by the real engine from the demo data.
// Used by the snapshot test (demo.test.ts), which fails if any of them change, and by the markdown
// "demo numbers sheet" (DEMO_NUMBERS.md) that test writes. Nothing here is typed in by hand.
//
// The Plan tab's per-item table is built inside PlanTab.tsx; `planItems` below repeats the same rule
// (cheapest landed cost per unit across the quoted suppliers, at the slider tariffs) so it can run without React.
import {
  addDays,
  breakEven,
  cashTimeline,
  compareSuppliers,
  countryFlipRate,
  extraRateFor,
  orderMargin,
  type Inputs,
  type Rates,
} from '../engine'
import { analyzeOrder, portfolioCash, reorderAdvice, withExtraRates, type Company, type SavedOrder } from '../engine/portfolio'
import ratesJson from '../data/rates.json'
import { buildExplainPayload } from '../ai/payload'
import { trackOrder } from '../screens/dashboard/shared'
import { DEMO_COMPANY, DEMO_ITEMS, DEMO_ORDER_DATE, DEMO_TODAY, SEED_ORDERS, demoOrderInputs, seedOrders } from './data'

export const rates = ratesJson as unknown as Rates

/** The Plan tab's India slider for the demo: today India's extra tariff is 10%. */
export const DEMO_INDIA_SLIDER = 0.06
/** The cash typed into Finances to flip it from green to amber. */
export const DEMO_TYPED_CASH = 5000

const c2 = (x: number) => Math.round(x * 100) / 100
const p1 = (x: number) => Math.round(x * 1000) / 10 // 0.2345 -> 23.5 (percent, one decimal)

/** The order the presenter creates live, saved with the recommended (cheapest) supplier. */
export function demoOrder(): SavedOrder {
  const inputs = demoOrderInputs()
  const best = compareSuppliers(inputs, rates)[0]
  return { id: 'demo-live', name: 'Rainy day LA', savedAt: `${DEMO_ORDER_DATE}T12:00:00.000Z`, inputs, supplierId: best.supplierId, color: 3 }
}

function portfolio(orders: SavedOrder[], company: Company) {
  const analyses = orders.map((o) => analyzeOrder(o, rates, DEMO_TODAY))
  return { analyses, pc: portfolioCash(analyses, company, DEMO_TODAY) }
}

function verdict(orders: SavedOrder[], cash: number) {
  const { pc } = portfolio(orders, { ...DEMO_COMPANY, cash })
  const first = pc.firstBelowWeek === null ? null : pc.weeks[pc.firstBelowWeek].date
  return {
    cashOnHand: cash,
    verdict: pc.shortfall > 0 ? `Borrow about $${(Math.ceil(pc.shortfall / 1000) * 1000).toLocaleString('en-US')}` : 'No loan needed',
    lowestBalance: c2(pc.lowest),
    lowestWeekOf: pc.weeks[pc.lowestWeek].date,
    shortfall: c2(pc.shortfall),
    weeksUnderBuffer: pc.weeksBelowBuffer,
    interest: c2(pc.interest),
    firstWeekUnderBuffer: first,
    backAboveBufferWeekOf: pc.backAboveWeek === null ? null : pc.weeks[pc.backAboveWeek].date,
    cashGoesNegative: pc.goesNegative,
  }
}

interface ItemRow {
  order: string
  item: string
  hts: string
  baseRatePct: number
  lastSupplier: string
  orderFrom: string
  switched: boolean
  landedPerUnitNext: number
  landedPerUnitLast: number
  units: number
}

/** The Plan tab's "Who to order each item from": one row per item in every saved order, at the given extra-tariff overrides. */
export function planItems(orders: SavedOrder[], overrides: Record<string, number>) {
  const scenario = withExtraRates(rates, overrides)
  const rows: ItemRow[] = []
  const orderAdvice: { order: string; placed: string; best: string; savings: number; reorderCost: number; vsLastTimePlacedToday: number }[] = []
  const switchPoints: { order: string; country: string; rate: number | null; direction: 'passes' | 'drops under' | null }[] = []
  for (const o of orders) {
    const a = analyzeOrder(o, rates, DEMO_TODAY)
    const adv = reorderAdvice(o, rates, scenario)
    const label = (r: { supplierName: string; country: string }) => `${r.supplierName} (${r.country})`
    for (const prod of o.inputs.products) {
      const last = a.placed.perProduct.find((x) => x.productId === prod.id)
      if (!last || last.qty <= 0) continue
      let pick: { s: (typeof adv.ranked)[number]; unit: number } | null = null
      for (const s of adv.ranked) {
        const line = s.perProduct.find((x) => x.productId === prod.id)
        if (!line || line.unitPrice <= 0) continue
        if (!pick || line.landedUnit < pick.unit) pick = { s, unit: line.landedUnit }
      }
      rows.push({
        order: o.name,
        item: prod.name,
        hts: prod.htsCode,
        baseRatePct: p1(prod.baseRate ?? 0),
        lastSupplier: label(a.placed),
        orderFrom: pick ? label(pick.s) : 'No quote',
        switched: !!pick && pick.s.supplierId !== a.placed.supplierId,
        landedPerUnitNext: c2(pick?.unit ?? last.landedUnit),
        landedPerUnitLast: c2(last.landedUnit),
        units: last.qty,
      })
    }
    orderAdvice.push({
      order: o.name,
      placed: label(a.placed),
      best: label(adv.best),
      savings: adv.savings > 0.5 ? c2(adv.savings) : 0,
      reorderCost: c2(adv.best.total),
      vsLastTimePlacedToday: c2(adv.vsToday),
    })
    const flip = countryFlipRate(o.inputs, scenario, a.placed.country)
    switchPoints.push({
      order: o.name,
      country: a.placed.country,
      rate: flip === null ? null : p1(Math.max(0, flip)),
      direction: flip === null ? null : flip >= extraRateFor(scenario, a.placed.country) ? 'passes' : 'drops under',
    })
  }
  const itemsSwitching = rows.filter((r) => r.switched)
  return {
    rows,
    switching: itemsSwitching.map((r) => `${r.item} -> ${r.orderFrom}`),
    staying: rows.filter((r) => !r.switched).map((r) => r.item),
    orderAdvice,
    switchPoints,
    totals: {
      savedBySwitching: c2(orderAdvice.reduce((t, x) => t + x.savings, 0)),
      suppliersChanged: orderAdvice.filter((x) => x.savings > 0).length,
      reorderEverything: c2(orderAdvice.reduce((t, x) => t + x.reorderCost, 0)),
      itemLevelSavingIfSplit: c2(rows.reduce((t, r) => t + (r.landedPerUnitLast - r.landedPerUnitNext) * r.units, 0)),
    },
  }
}

/** The AI payload for the demo order exactly as the Summary step builds it. */
export function demoExplainPayload() {
  const inputs = demoOrderInputs()
  const ranked = compareSuppliers(inputs, rates)
  const chosen = ranked[0]
  const cash = cashTimeline(inputs, inputs.suppliers.find((s) => s.id === chosen.supplierId)!, rates, chosen)
  return buildExplainPayload(inputs, ranked, chosen, cash, breakEven(ranked), rates)
}

export function computeDemoNumbers() {
  const inputs: Inputs = demoOrderInputs()
  const ranked = compareSuppliers(inputs, rates)
  const byCountry = (country: string) => ranked.find((r) => r.country === country)!
  const china = byCountry('China')
  const vietnam = byCountry('Vietnam')
  const india = byCountry('India')
  const cashFor = (country: string) => {
    const r = byCountry(country)
    const s = inputs.suppliers.find((x) => x.id === r.supplierId)!
    return { r, s, cash: cashTimeline(inputs, s, rates, r) }
  }
  const arrival = (country: string) => {
    const { cash } = cashFor(country)
    return { date: addDays(DEMO_ORDER_DATE, cash.arrivalDay), day: cash.arrivalDay, firstSalesWeek: addDays(DEMO_ORDER_DATE, cash.salesStartWeek * 7) }
  }
  const supplierRow = (country: string) => {
    const { r, s, cash } = cashFor(country)
    return {
      supplier: `${r.supplierName} (${r.country})`,
      rank: r.rank,
      productQuote: c2(r.customsValue),
      baseTariff: c2(r.baseDuty),
      extraTariff: c2(r.extraDuty),
      freightAndInsurance: c2(r.freight + r.insurance),
      customsFeesAndBroker: c2(r.mpf + r.hmf + r.broker),
      landedTotal: c2(r.total),
      landedPerUnit: c2(r.avgUnit),
      percentAboveQuote: p1(r.total / r.customsValue - 1),
      leadDays: s.leadTimeDays,
      transitDays: s.transitDays,
      arrives: addDays(DEMO_ORDER_DATE, cash.arrivalDay),
    }
  }

  // Cash check for the recommended supplier (the wizard's step 4).
  const rec = ranked[0]
  const { cash: recCash, s: recSupplier } = cashFor(rec.country)
  const margin = orderMargin(inputs, rec)

  // Finances: the three seeded orders, then with the demo order saved.
  const seeds = seedOrders()
  const withDemo = [...seeds, demoOrder()]

  // Orders tab: where each seeded order is on DEMO_TODAY.
  const stages = withDemo.map((o) => {
    const a = analyzeOrder(o, rates, DEMO_TODAY)
    const t = trackOrder(a, DEMO_TODAY)
    return {
      order: o.name,
      supplier: `${a.placed.supplierName} (${a.placed.country})`,
      ordered: t.orderDate,
      ships: t.shipDate,
      arrives: t.arrivalDate,
      breaksEven: t.breakEvenDate,
      sellsOut: t.sellOutDate,
      stage: t.stage,
      units: a.placed.units,
      quoteValue: c2(a.placed.customsValue),
      landedTotal: c2(a.placed.total),
      salesSoFar: c2(t.salesToDate),
    }
  })

  const plan = (orders: SavedOrder[], india: number | null) => planItems(orders, india === null ? {} : { India: india })
  const slider = DEMO_INDIA_SLIDER
  const planWith = (india: number | null) => {
    const sc = withExtraRates(rates, india === null ? {} : { India: india })
    return {
      ...plan(withDemo, india),
      demoOrderFlips: ['China', 'Vietnam', 'India']
        .map((c) => ({ country: c, rate: countryFlipRate(inputs, sc, c) }))
        .filter((x): x is { country: string; rate: number } => x.rate !== null && x.rate >= 0)
        .map((x) => ({ country: x.country, rate: p1(x.rate) })),
    }
  }

  // Slider sweep: which items pick India at each step of the India slider (0.5-point steps, as the UI does).
  const sweep: { india: number; itemsFromIndia: string[]; itemsSwitchedFromLastTime: number }[] = []
  for (let k = 20; k >= 0; k--) {
    const india = k / 200 // 10.0% down to 0%
    const p = planItems(withDemo, { India: india })
    sweep.push({
      india: p1(india),
      itemsFromIndia: p.rows.filter((r) => r.orderFrom.includes('(India)')).map((r) => r.item),
      itemsSwitchedFromLastTime: p.rows.filter((r) => r.switched).length,
    })
  }
  // Items that go to India because of the slider (not already India at today's tariffs), and the slider range that gives exactly that set.
  const todayIndia = new Set(sweep[0].itemsFromIndia)
  const flipsAt = (s: (typeof sweep)[number]) => s.itemsFromIndia.filter((i) => !todayIndia.has(i))
  const sliderIdx = sweep.findIndex((s) => s.india === p1(slider))
  const sliderFlips = flipsAt(sweep[sliderIdx]).join('|')
  let lo = sliderIdx
  let hi = sliderIdx
  while (lo > 0 && flipsAt(sweep[lo - 1]).join('|') === sliderFlips) lo--
  while (hi < sweep.length - 1 && flipsAt(sweep[hi + 1]).join('|') === sliderFlips) hi++
  const demoFlipPoints = inputs.products.map((prod) => {
    const hit = sweep.find((s) => s.itemsFromIndia.includes(prod.name) && !todayIndia.has(prod.name))
    return { item: prod.name, baseTariffPct: p1(prod.baseRate ?? 0), flipsToIndiaAtOrBelowPct: hit ? hit.india : null }
  })

  return {
    demoToday: DEMO_TODAY,
    demoOrderDate: DEMO_ORDER_DATE,
    company: { ...DEMO_COMPANY },
    demoOrder: {
      units: rec.units,
      items: inputs.products.map((p) => {
        const sellerPrices = Object.fromEntries(
          inputs.suppliers.map((s) => [`${s.name} (${s.country})`, s.prices[p.id]]),
        )
        return {
          item: p.name,
          htsCode: p.htsCode,
          baseTariffPct: p1(p.baseRate ?? 0),
          qty: p.qty,
          sellPrice: p.sellPrice,
          salesPerWeek: p.salesPerWeek,
          quotes: sellerPrices,
        }
      }),
      grossMarginAtFullSellThrough: { revenue: c2(margin.revenue), margin: c2(margin.margin), marginPct: p1(margin.marginPct) },
    },
    compare: {
      china: supplierRow('China'),
      vietnam: supplierRow('Vietnam'),
      india: supplierRow('India'),
      vietnamQuoteVsChina: c2(vietnam.customsValue - china.customsValue),
      vietnamQuoteVsChinaPct: p1(vietnam.customsValue / china.customsValue - 1),
      vietnamLandedVsChina: c2(vietnam.total - china.total),
      indiaLandedVsVietnam: c2(india.total - vietnam.total),
      indiaLandedVsChina: c2(india.total - china.total),
      arrivals: { china: arrival('China'), vietnam: arrival('Vietnam'), india: arrival('India') },
      recommended: `${rec.supplierName} (${rec.country})`,
    },
    cashCheck: {
      supplier: `${rec.supplierName} (${rec.country})`,
      cashOnHandAtStart: DEMO_COMPANY.cash,
      lowestBalance: c2(recCash.lowest),
      lowestWeek: recCash.lowestWeek,
      lowestWeekStarts: addDays(DEMO_ORDER_DATE, recCash.lowestWeek * 7),
      belowBufferBy: c2(recCash.shortfall),
      weeksBelowBuffer: recCash.weeksBelowBuffer,
      interestToBridge: c2(recCash.interest),
      goodsArrive: addDays(DEMO_ORDER_DATE, recCash.arrivalDay),
      salesStartWeek: recCash.salesStartWeek,
      payments: recCash.events.map((e) => ({ what: e.label, day: e.day, date: addDays(DEMO_ORDER_DATE, e.day), amount: c2(-e.amount) })),
      weekBalances: recCash.weeks.slice(0, 8).map((w) => c2(w.balance)),
      supplierTerms: { depositPct: recSupplier.depositPct * 100, balanceDays: recSupplier.balanceDays },
    },
    finances: {
      seedThreeOrders: verdict(seeds, DEMO_COMPANY.cash),
      afterTypingCash: verdict(seeds, DEMO_TYPED_CASH),
      afterSavingDemoOrder: verdict(withDemo, DEMO_COMPANY.cash),
      afterSavingDemoOrderAndTypingCash: verdict(withDemo, DEMO_TYPED_CASH),
    },
    orders: stages,
    plan: {
      indiaTodayPct: p1(extraRateFor(rates, 'India')),
      sliderPct: p1(slider),
      threeSeedOrders: { baseline: plan(seeds, null).switching },
      baseline: planWith(null),
      atSlider: planWith(slider),
      sweep,
      sameFlipsFromPct: sweep[lo].india,
      sameFlipsToPct: sweep[hi].india,
      demoFlipPoints,
    },
    extraTariffsPct: { China: p1(extraRateFor(rates, 'China')), Vietnam: p1(extraRateFor(rates, 'Vietnam')), India: p1(extraRateFor(rates, 'India')) },
    seedItems: SEED_ORDERS.map((o) => ({ order: o.name, items: o.items.map((i) => ({ item: i.name, htsCode: i.htsCode, baseTariffPct: p1(i.baseRate), qty: i.qty })) })),
    demoItems: DEMO_ITEMS.map((i) => ({ item: i.name, htsCode: i.htsCode, baseTariffPct: p1(i.baseRate) })),
  }
}

export type DemoNumbers = ReturnType<typeof computeDemoNumbers>

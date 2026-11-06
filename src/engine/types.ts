export interface Business {
  cash: number
  buffer: number
  apr: number // 0.12 = 12%
  orderDate: string // ISO yyyy-mm-dd, day 0
}

export interface Product {
  id: string
  name: string
  htsCode: string
  qty: number
  sellPrice: number
  salesPerWeek: number
}

export interface Supplier {
  id: string
  name: string
  country: string
  prices: Record<string, number> // product id -> FOB $/unit
  freight: number
  depositPct: number // share of customs value paid on order day
  balanceDays: number // days after ship day that the balance is due
  leadTimeDays: number // order day -> ship day
  transitDays: number // ship day -> arrival
}

export interface Inputs {
  business: Business
  products: Product[]
  suppliers: Supplier[]
}

export interface RateEntry {
  source: string
  url?: string
  date: string
}

export interface Rates {
  lastReviewed: string
  baseTariffs: Record<string, RateEntry & { rate: number; description: string }>
  extraTariffs: Record<string, RateEntry & { rate: number; note: string; status?: string }>
  fees: {
    mpf: RateEntry & { rate: number; min: number; max: number; label: string }
    hmf: RateEntry & { rate: number; label: string }
    insurance: RateEntry & { rate: number; label: string }
    broker: RateEntry & { amount: number; label: string }
    dutyPaymentDays: RateEntry & { days: number; label: string }
  }
}

export interface ProductLanded {
  productId: string
  name: string
  qty: number
  unitPrice: number
  baseRate: number
  landedUnit: number
  landedTotal: number
}

export interface LandedResult {
  supplierId: string
  supplierName: string
  country: string
  extraRate: number
  customsValue: number
  baseDuty: number
  extraDuty: number
  mpf: number
  hmf: number
  insurance: number
  freight: number
  broker: number
  total: number
  units: number
  avgUnit: number
  perProduct: ProductLanded[]
}

export interface RankedResult extends LandedResult {
  rank: number
  gapToCheapest: number
}

export interface CashEvent {
  day: number
  label: string
  amount: number // negative = cash out
}

export interface CashWeek {
  week: number
  startDay: number
  date: string // ISO date of the week's first day
  inflow: number
  outflow: number
  balance: number // end-of-week balance
  events: CashEvent[]
}

export interface CashResult {
  supplierId: string
  shipDay: number
  arrivalDay: number
  salesStartWeek: number
  events: CashEvent[]
  weeks: CashWeek[]
  lowest: number
  lowestWeek: number
  weeksBelowBuffer: number
  shortfall: number
  interest: number
  headroom: number
  extraUnits: number
}

export interface BreakEven {
  cheapest: RankedResult
  runnerUp: RankedResult
  gap: number
  rate: number // extra-tariff rise (as a fraction) on the cheapest that makes runner-up win
}

export interface OrderMargin {
  revenue: number // every unit with weekly sales, sold at its sell price (full sell-through)
  landed: number
  margin: number // revenue - landed
  marginPct: number // margin / revenue, 0 when there is no revenue
  weeksToSellOut: number // weeks of sales needed to clear all stock that sells
  unsoldUnits: number // units of products with no weekly sales; never sold, not counted
  perProduct: ProductSales[]
}

export interface ProductSales {
  productId: string
  name: string
  qty: number
  sellPrice: number
  salesPerWeek: number
  revenue: number // qty * sellPrice, or 0 when salesPerWeek is 0
  weeksToSellOut: number | null // null when it never sells
}

export type CostLineKey = 'product' | 'baseDuty' | 'extraDuty' | 'mpf' | 'hmf' | 'insurance' | 'freight' | 'broker'

export interface CostBreakdown {
  lines: { key: CostLineKey; amount: number }[] // in dollars, rounded to cents
  total: number // landed total rounded to cents; equals the sum of lines exactly
}

export interface TariffScenario {
  country: string
  todayRate: number
  extraRate: number
  delta: number // extraRate - todayRate (0.1 = +10 points)
  ranked: RankedResult[]
  cheapest: RankedResult
  runnerUp: RankedResult | null
  gapToRunnerUp: number
  todayCheapest: RankedResult // cheapest at today's rates
  staying: RankedResult // today's cheapest supplier, costed at this tariff
  switched: boolean
  savingsVsStaying: number // staying.total - cheapest.total; 0 when not switched
  margin: OrderMargin // for the cheapest supplier at this tariff
  cash: CashResult // for the cheapest supplier at this tariff
}

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

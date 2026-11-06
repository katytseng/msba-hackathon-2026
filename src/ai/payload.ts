// Builds the JSON the AI explanation sees. Every number comes straight from the engine; nothing new is
// calculated here. Money is rounded to whole dollars (per-unit cost to cents) and rates are given as
// percentages with one decimal, so the model only has to copy numbers, never round or convert them.
import { addDays, type BreakEven, type CashResult, type Inputs, type RankedResult, type Rates } from '../engine'

const usd = (x: number) => Math.round(x)
const cents = (x: number) => Math.round(x * 100) / 100
const pct = (fraction: number) => Math.round(fraction * 1000) / 10

export interface ExplainPayload {
  rates_as_of: string
  business: { cash_on_hand_usd: number; safety_buffer_usd: number; loan_apr_pct: number; order_date: string }
  products: { name: string; quantity: number; sales_per_week: number }[]
  suppliers_ranked: {
    rank: number
    name: string
    country: string
    landed_total_usd: number
    landed_per_unit_usd: number
    gap_to_cheapest_usd: number
    product_cost_usd: number
    tariffs_usd: number
    tariffs_pct_of_product_cost: number | null
    base_tariff_usd: number
    extra_tariff_usd: number
    extra_tariff_rate_pct: number
    freight_and_insurance_usd: number
    customs_fees_usd: number
    lead_time_days: number | null
    transit_days: number | null
    days_to_arrive: number | null
  }[]
  chosen_supplier: string
  chosen_is_cheapest: boolean
  cash: {
    lowest_balance_usd: number
    lowest_week: number
    lowest_week_date: string
    below_buffer_usd: number | null
    weeks_below_buffer: number | null
    interest_to_bridge_usd: number | null
    headroom_usd: number | null
    extra_units_affordable: number | null
    goods_arrive_day: number
    goods_arrive_date: string
    sales_start_week: number
    payments: { what: string; day: number; date: string; amount_usd: number }[]
  }
  tariff_risk: {
    cheapest: string
    runner_up: string
    gap_usd: number
    break_even_extra_tariff_rise_pct: number
  } | null
}

const label = (r: { supplierName: string; country: string }) => `${r.supplierName} (${r.country})`

export function buildExplainPayload(
  inputs: Inputs,
  ranked: RankedResult[],
  chosen: RankedResult,
  cash: CashResult,
  be: BreakEven | null,
  rates: Rates,
): ExplainPayload {
  const { business } = inputs
  const short = cash.shortfall > 0
  return {
    rates_as_of: rates.lastReviewed,
    business: {
      cash_on_hand_usd: usd(business.cash),
      safety_buffer_usd: usd(business.buffer),
      loan_apr_pct: pct(business.apr),
      order_date: business.orderDate,
    },
    products: inputs.products.map((p) => ({ name: p.name, quantity: p.qty, sales_per_week: p.salesPerWeek })),
    suppliers_ranked: ranked.map((r) => {
      const s = inputs.suppliers.find((x) => x.id === r.supplierId)
      const tariffs = r.baseDuty + r.extraDuty
      return {
        rank: r.rank,
        name: r.supplierName,
        country: r.country,
        landed_total_usd: usd(r.total),
        landed_per_unit_usd: cents(r.avgUnit),
        gap_to_cheapest_usd: usd(r.gapToCheapest),
        product_cost_usd: usd(r.customsValue),
        tariffs_usd: usd(tariffs),
        tariffs_pct_of_product_cost: r.customsValue > 0 ? pct(tariffs / r.customsValue) : null,
        base_tariff_usd: usd(r.baseDuty),
        extra_tariff_usd: usd(r.extraDuty),
        extra_tariff_rate_pct: pct(r.extraRate),
        freight_and_insurance_usd: usd(r.freight + r.insurance),
        customs_fees_usd: usd(r.mpf + r.hmf + r.broker),
        lead_time_days: s ? s.leadTimeDays : null,
        transit_days: s ? s.transitDays : null,
        days_to_arrive: s ? s.leadTimeDays + s.transitDays : null,
      }
    }),
    chosen_supplier: label(chosen),
    chosen_is_cheapest: chosen.rank === 1,
    cash: {
      lowest_balance_usd: usd(cash.lowest),
      lowest_week: cash.lowestWeek,
      lowest_week_date: addDays(business.orderDate, cash.lowestWeek * 7),
      below_buffer_usd: short ? usd(cash.shortfall) : null,
      weeks_below_buffer: short ? cash.weeksBelowBuffer : null,
      interest_to_bridge_usd: short ? usd(cash.interest) : null,
      headroom_usd: short ? null : usd(cash.headroom),
      extra_units_affordable: short ? null : cash.extraUnits,
      goods_arrive_day: cash.arrivalDay,
      goods_arrive_date: addDays(business.orderDate, cash.arrivalDay),
      sales_start_week: cash.salesStartWeek,
      payments: cash.events.map((e) => ({
        what: e.label,
        day: e.day,
        date: addDays(business.orderDate, e.day),
        amount_usd: usd(-e.amount),
      })),
    },
    tariff_risk: be
      ? {
          cheapest: label(be.cheapest),
          runner_up: label(be.runnerUp),
          gap_usd: usd(be.gap),
          break_even_extra_tariff_rise_pct: pct(be.rate),
        }
      : null,
  }
}

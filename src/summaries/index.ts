// Template sentences built only from engine numbers. No AI, no invented figures.
// Style: plain, short sentences, no em dashes, "base tariff" and "extra tariff".
import type { BreakEven, CashResult, Inputs, RankedResult } from '../engine'
import { addDays } from '../engine'
import { niceDate, num, points, usd } from '../format'

export const DISCLAIMER = 'Estimates, not customs or legal advice.'

const label = (r: RankedResult) => `${r.supplierName} (${r.country})`

export function supplierSentence(ranked: RankedResult[]): string {
  if (ranked.length === 0) return 'Add at least one supplier quote to compare.'
  const [best, next] = ranked
  const s = `${label(best)} is cheapest at ${usd(best.total, true)} landed, about ${usd(best.avgUnit, true)} per unit across ${num(best.units)} units.`
  if (!next) return s
  return `${s} That is ${usd(next.gapToCheapest, true)} less than ${label(next)}.`
}

export function thisOrderSentences(inputs: Inputs, chosen: RankedResult, cash: CashResult): string[] {
  const { business } = inputs
  const lowDate = niceDate(addDays(business.orderDate, cash.lowestWeek * 7))
  if (cash.shortfall > 0) {
    return [
      `With ${label(chosen)}, your cash drops to ${usd(cash.lowest)} in week ${cash.lowestWeek} (week of ${lowDate}).`,
      `That is ${usd(cash.shortfall)} below your ${usd(business.buffer)} safety buffer, for ${cash.weeksBelowBuffer} week${cash.weeksBelowBuffer === 1 ? '' : 's'}.`,
      `Borrowing ${usd(cash.shortfall)} for that time costs about ${usd(cash.interest)} in interest at ${(business.apr * 100).toFixed(0)}% APR.`,
      `Other options: ask the supplier to take the balance later, or order a little less.`,
    ]
  }
  return [
    `With ${label(chosen)}, your cash stays above your ${usd(business.buffer)} safety buffer the whole time.`,
    `The lowest point is ${usd(cash.lowest)} in week ${cash.lowestWeek} (week of ${lowDate}), leaving ${usd(cash.headroom)} of headroom.`,
    cash.extraUnits > 0
      ? `You could afford about ${num(cash.extraUnits)} more units at today's average landed cost, without borrowing.`
      : `There is no room for extra units without dipping into the buffer.`,
  ]
}

export function nextOrderSentences(be: BreakEven | null): string[] {
  if (!be) return ['Add a second supplier quote to see how much tariffs could rise before your pick changes.']
  return [
    `If the extra tariff on ${be.cheapest.country} rises by more than ${points(be.rate)}, ${label(be.runnerUp)} becomes cheaper.`,
    `Today the gap is ${usd(be.gap, true)}. Keep ${be.runnerUp.supplierName}'s quote current so you can switch quickly.`,
  ]
}

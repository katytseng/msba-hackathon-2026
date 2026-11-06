// The no-AI version of the explanation: the same fields, filled from the template sentences in
// summaries/, which are built only from engine numbers. Shown whenever the AI call can't be used.
import type { BreakEven, CashResult, Inputs, RankedResult } from '../engine'
import { niceDate } from '../format'
import { DISCLAIMER, nextOrderSentences, supplierSentence, thisOrderSentences } from '../summaries'
import type { Explanation } from './explain'

export function templateExplanation(
  inputs: Inputs,
  ranked: RankedResult[],
  chosen: RankedResult,
  cash: CashResult,
  be: BreakEven | null,
  ratesAsOf: string,
): Omit<Explanation, 'headline'> {
  const order = thisOrderSentences(inputs, chosen, cash)
  const next = nextOrderSentences(be)
  return {
    supplier_choice: supplierSentence(ranked),
    cash_outlook: order.slice(0, cash.shortfall > 0 ? 3 : 2).join(' '),
    tariff_risk: next[0],
    next_steps: cash.shortfall > 0 ? order[order.length - 1] : (next[1] ?? order[order.length - 1]),
    caveat: `${DISCLAIMER} Rates checked ${niceDate(ratesAsOf)}.`,
  }
}

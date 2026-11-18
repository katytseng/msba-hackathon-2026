// A saved AI explanation for the demo order, so "Explain with AI" is instant and works offline on stage.
//
// - The text in DEMO_EXPLANATIONS was written by the real Worker (Claude) from the demo order's final numbers,
//   then copied here verbatim. To regenerate it after changing the demo data: reset the demo, run the wizard with
//   Fill sample, press "Explain with AI" on the Summary step, and replace the entry (demo.test.ts prints the new
//   fingerprint when it no longer matches).
// - It is matched by a fingerprint of the numbers it explains, not by product names, so it still applies
//   when the presenter types the two items by hand with slightly different wording.
// - It is NOT trusted blindly: every $ and % in it is re-checked against the live engine payload with the same
//   number check as a fresh AI answer. If any number differs (the data changed), the cache is skipped and the
//   normal Worker call / template fallback runs as before.
import { unverifiedNumbers } from './guard'
import type { Explanation } from './explain'
import type { ExplainPayload } from './payload'

/** The numbers an explanation depends on. Changes whenever the order date, bank figures, quotes or cash dip change. */
export function demoFingerprint(p: ExplainPayload): string {
  return JSON.stringify({
    date: p.business.order_date,
    cash: p.business.cash_on_hand_usd,
    buffer: p.business.safety_buffer_usd,
    chosen: p.chosen_supplier,
    ranked: p.suppliers_ranked.map((s) => [s.name, s.country, s.landed_total_usd, s.days_to_arrive]),
    low: [p.cash.lowest_balance_usd, p.cash.lowest_week],
  })
}

export const DEMO_EXPLANATIONS: { fingerprint: string; explanation: Explanation }[] = [
  {
    // Order date Nov 19, 2026, cash $24,000, buffer $8,000, Vietnam recommended at $27,156.
    fingerprint: "{\"date\":\"2026-11-19\",\"cash\":24000,\"buffer\":8000,\"chosen\":\"Mekong Textile Works (Vietnam)\",\"ranked\":[[\"Mekong Textile Works\",\"Vietnam\",27156,28],[\"Deccan Garments\",\"India\",27525,41],[\"Pearl Delta Outerwear\",\"China\",28087,51]],\"low\":[1470,2]}",
    explanation: {
      headline: "Order from Mekong Textile Works; it is the cheapest landed option at $27,156.",
      supplier_choice: "Mekong Textile Works is the lowest landed total, $369 under Deccan Garments. Its shorter transit also gets goods to you sooner.",
      cash_outlook: "Cash drops to $1,470 in week 2, well below your $8,000 safety buffer, for three weeks. Borrowing to cover the gap would cost about $30, or you could delay or reduce the order.",
      tariff_risk: "The extra tariff on Vietnam could rise 1.8 percentage points before Deccan Garments becomes cheaper. Watch Vietnam tariff news before placing your next order.",
      next_steps: "Ask Mekong whether the balance payment can be pushed back, or trim quantities to keep cash above the buffer. Confirm the duty and customs payment due on 2026-12-31 is covered by sales.",
      caveat: "These are estimates, not customs or legal advice; rates were checked on 2026-11-05.",
    },
  },
]

/** The saved explanation for this payload, or null if there is none or any figure in it no longer matches the engine. */
export function demoExplanation(payload: ExplainPayload): Explanation | null {
  const fp = demoFingerprint(payload)
  const hit = DEMO_EXPLANATIONS.find((e) => e.fingerprint === fp)
  if (!hit) return null
  return unverifiedNumbers(Object.values(hit.explanation).join('\n'), payload).length === 0 ? hit.explanation : null
}

import { useMemo, useState } from 'react'
import { buildExplainPayload } from '../ai/payload'
import { explain, EXPLAIN_URL, type Explanation, type ExplainResult } from '../ai/explain'
import { templateExplanation } from '../ai/fallback'
import { rates, useApp } from '../state'
import { Button, Card } from './ui'

const ROWS: { key: Exclude<keyof Explanation, 'headline' | 'caveat'>; label: string }[] = [
  { key: 'supplier_choice', label: 'Supplier' },
  { key: 'cash_outlook', label: 'Cash' },
  { key: 'tariff_risk', label: 'Tariff risk' },
  { key: 'next_steps', label: 'Next steps' },
]

const FALLBACK_NOTE: Record<Extract<ExplainResult, { source: 'fallback' }>['reason'], string> = {
  not_configured: 'AI explanations are not set up, so this is the standard summary.',
  timeout: 'The AI explanation took too long, so this is the standard summary.',
  unavailable: 'The AI explanation is unavailable right now, so this is the standard summary.',
  unverified: 'The AI explanation used a figure that is not in the calculation, so it was not shown. This is the standard summary.',
}

/**
 * Plain-English explanation of the results. The AI only rewords engine numbers; every $ and % it writes
 * is checked against the calculation, and any failure shows the template summary instead.
 */
export function AiExplanation() {
  const { inputs, ranked, chosen, cash, be } = useApp()
  const payload = useMemo(
    () => (chosen && cash ? buildExplainPayload(inputs, ranked, chosen, cash, be, rates) : null),
    [inputs, ranked, chosen, cash, be],
  )
  const key = payload ? JSON.stringify(payload) : ''
  // Remember which scenario the answer belongs to, so editing inputs resets the card.
  const [state, setState] = useState<{ key: string; status: 'loading' } | { key: string; status: 'done'; result: ExplainResult } | null>(null)
  const current = state?.key === key ? state : null

  if (!payload || !chosen || !cash) return null

  const run = async () => {
    setState({ key, status: 'loading' })
    const result = await explain(payload)
    setState((s) => (s?.key === key ? { key, status: 'done', result } : s))
  }

  const result = current?.status === 'done' ? current.result : null
  const shown: Partial<Explanation> | null = result
    ? result.source === 'ai'
      ? result.explanation
      : templateExplanation(inputs, ranked, chosen, cash, be, rates.lastReviewed)
    : null

  // Gradient outline + "AI" badge mark AI-written content. When the card shows the standard template
  // summary instead (AI off, too slow, or a figure failed the check), it drops back to the plain outline.
  const isAi = !!EXPLAIN_URL && result?.source !== 'fallback'

  return (
    <div
      className={`mb-5 rounded-xl p-[2px] shadow-sm transition-colors duration-300 motion-reduce:transition-none ${
        isAi ? 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sky-500' : 'bg-slate-200'
      }`}
    >
    <Card
      title={
        <span className="flex items-center gap-2">
          Our Recommendation
          {isAi && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sky-500 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
              <span aria-hidden>✦</span> AI
            </span>
          )}
        </span>
      }
      className="rounded-[10px] border-0! shadow-none!"
      actions={
        <Button variant={result ? 'secondary' : 'primary'} onClick={run}>
          {current?.status === 'loading' ? 'Writing…' : result ? 'Ask again' : EXPLAIN_URL ? 'Explain with AI' : 'Show summary'}
        </Button>
      }
    >
      {!current && (
        <p className="text-sm text-slate-600">
          {EXPLAIN_URL
            ? 'Get a short explanation of these results and what to do next. The AI only rewords the numbers the calculation produced; it does not calculate anything.'
            : 'Get a short summary of these results and what to do next.'}
        </p>
      )}

      {current?.status === 'loading' && (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          <p className="text-sm text-slate-600">Writing a plain-English explanation (up to 5 seconds)…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" style={{ width: `${90 - i * 15}%` }} />
          ))}
        </div>
      )}

      {result && shown && (
        <div aria-live="polite">
          {shown.headline && <p className="mb-3 text-base font-semibold text-slate-900">{shown.headline}</p>}
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
            {ROWS.map((r) => (
              <div key={r.key} className="contents">
                <dt className="font-medium text-slate-500">{r.label}</dt>
                <dd className="text-slate-800">{shown[r.key]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-500">{shown.caveat}</p>
          <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-400">
            {result.source === 'ai'
              ? 'Written by AI from the numbers on this page. Every dollar amount and percentage was checked against the calculation.'
              : FALLBACK_NOTE[result.reason]}
          </p>
        </div>
      )}
    </Card>
    </div>
  )
}

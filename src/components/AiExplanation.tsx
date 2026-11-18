import { useEffect, useMemo, useState } from 'react'
import { buildExplainPayload } from '../ai/payload'
import { explain, EXPLAIN_URL, type Explanation, type ExplainResult } from '../ai/explain'
import { templateExplanation } from '../ai/fallback'
import { rates, useApp } from '../state'
import { Button, Card } from './ui'
import type { ShownRecommendation } from './PrintReport'

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
export function AiExplanation({ onShown }: { onShown?: (r: ShownRecommendation | null) => void } = {}) {
  const { inputs, ranked, chosen, cash, be } = useApp()
  const payload = useMemo(
    () => (chosen && cash ? buildExplainPayload(inputs, ranked, chosen, cash, be, rates) : null),
    [inputs, ranked, chosen, cash, be],
  )
  const key = payload ? JSON.stringify(payload) : ''
  // Remember which scenario the answer belongs to, so editing inputs resets the card.
  const [state, setState] = useState<{ key: string; status: 'loading' } | { key: string; status: 'done'; result: ExplainResult } | null>(null)
  const current = state?.key === key ? state : null

  // Tell the page what is on screen (AI text or the standard summary) so the printed report matches it.
  const done = current?.status === 'done' ? current.result : null
  useEffect(() => {
    if (!onShown) return
    if (!done || !chosen || !cash) return onShown(null)
    onShown(
      done.source === 'ai'
        ? { explanation: done.explanation, ai: true }
        : { explanation: templateExplanation(inputs, ranked, chosen, cash, be, rates.lastReviewed), ai: false },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

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
      className={`mb-8 rounded-[1.0625rem] p-px shadow-ui transition-colors duration-300 motion-reduce:transition-none ${
        isAi ? 'bg-line-strong' : 'bg-line'
      }`}
    >
    <Card
      title={
        <span className="flex items-center gap-2">
          Our Recommendation
          {isAi && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 font-sans text-xs font-semibold text-white">
              <svg aria-hidden="true" viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
                <path d="M8 1.2 9.6 6.4 14.8 8 9.6 9.6 8 14.8 6.4 9.6 1.2 8 6.4 6.4Z" />
              </svg>
              AI
            </span>
          )}
        </span>
      }
      className="rounded-[1rem] border-0! shadow-none!"
      actions={
        <Button variant={result ? 'secondary' : 'primary'} onClick={run}>
          {current?.status === 'loading' ? 'Writing…' : result ? 'Ask again' : EXPLAIN_URL ? 'Explain with AI' : 'Show summary'}
        </Button>
      }
    >
      {!current && (
        <p className="text-sm text-muted">
          {EXPLAIN_URL
            ? 'Get a short explanation of these results and what to do next. The AI only rewords the numbers the calculation produced; it does not calculate anything.'
            : 'Get a short summary of these results and what to do next.'}
        </p>
      )}

      {current?.status === 'loading' && (
        <div className="space-y-3" aria-live="polite" aria-busy="true">
          <p className="text-sm text-muted">Writing a plain-English explanation (up to 5 seconds)…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 animate-pulse rounded-full bg-ink-soft motion-reduce:animate-none" style={{ width: `${90 - i * 15}%` }} />
          ))}
        </div>
      )}

      {result && shown && (
        <div aria-live="polite">
          {shown.headline && <p className="mb-5 max-w-[60ch] font-serif text-[1.375rem] leading-8 font-semibold tracking-tight text-ink">{shown.headline}</p>}
          <dl className="grid gap-x-6 gap-y-4 text-sm leading-6 sm:grid-cols-[8rem_1fr]">
            {ROWS.map((r) => (
              <div key={r.key} className="contents">
                <dt className="font-medium text-muted">{r.label}</dt>
                <dd className="text-ink">{shown[r.key]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs leading-5 text-muted">{shown.caveat}</p>
          <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">
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

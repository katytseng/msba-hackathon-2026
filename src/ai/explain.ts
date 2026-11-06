// Calls the Cloudflare Worker for an AI explanation, with a hard 5 s timeout.
// Any failure (not configured, timeout, error, a figure that fails the number check) returns a
// fallback result, and the UI shows the template summary built from the same engine numbers.
import { unverifiedNumbers } from './guard'
import type { ExplainPayload } from './payload'

export const EXPLAIN_FIELDS = ['headline', 'supplier_choice', 'cash_outlook', 'tariff_risk', 'next_steps', 'caveat'] as const
export type Explanation = Record<(typeof EXPLAIN_FIELDS)[number], string>

export type ExplainResult =
  | { source: 'ai'; explanation: Explanation; cached: boolean }
  | { source: 'fallback'; reason: 'not_configured' | 'timeout' | 'unavailable' | 'unverified'; detail?: string }

export const EXPLAIN_URL: string | undefined = import.meta.env.VITE_EXPLAIN_URL || undefined
export const TIMEOUT_MS = 5000

// Successful answers for this browser session, keyed by payload, so re-opening a page doesn't re-ask.
const memo = new Map<string, ExplainResult>()

export async function explain(
  payload: ExplainPayload,
  { url = EXPLAIN_URL, timeoutMs = TIMEOUT_MS, fetchImpl = fetch }: { url?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<ExplainResult> {
  if (!url) return { source: 'fallback', reason: 'not_configured' }
  const body = JSON.stringify(payload)
  const hit = memo.get(body)
  if (hit) return hit

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: ctrl.signal,
    })
    const data = (await res.json().catch(() => null)) as { explanation?: Record<string, unknown>; cached?: boolean; error?: string } | null
    if (!res.ok || !data?.explanation) return { source: 'fallback', reason: 'unavailable', detail: data?.error ?? `http_${res.status}` }

    const explanation = {} as Explanation
    for (const f of EXPLAIN_FIELDS) {
      const v = data.explanation[f]
      if (typeof v !== 'string' || !v.trim()) return { source: 'fallback', reason: 'unavailable', detail: 'bad_output' }
      explanation[f] = v.trim()
    }

    const bad = unverifiedNumbers(Object.values(explanation).join('\n'), payload)
    if (bad.length) {
      console.warn('AI explanation rejected: figures not in the engine results', bad)
      return { source: 'fallback', reason: 'unverified', detail: bad.join(', ') }
    }

    const result: ExplainResult = { source: 'ai', explanation, cached: !!data.cached }
    memo.set(body, result)
    return result
  } catch (e) {
    return { source: 'fallback', reason: (e as Error).name === 'AbortError' ? 'timeout' : 'unavailable' }
  } finally {
    clearTimeout(timer)
  }
}

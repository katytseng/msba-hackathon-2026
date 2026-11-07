// Cloudflare Worker: POST /explain turns engine results (JSON) into a short plain-English explanation.
// The engine does all of the math in the app; this Worker only asks Claude to put those numbers into words.
//
// Safeguards: CORS allowlist, per-IP hourly cap, daily dollar budget (KV), body size limit,
// response cache (KV), 4.5 s upstream timeout with no retries. The app adds a 5 s timeout of its own
// and falls back to its template sentences on any failure.

import Anthropic from '@anthropic-ai/sdk'
import { costMicroUsd, createLimits, type LimitsEnv } from './limits'
import { OUTPUT_FIELDS, OUTPUT_SCHEMA, PROMPT_VERSION, SYSTEM_PROMPT, type Explanation } from './prompt'
import { MAX_BODY_BYTES, sanitizePayload } from './sanitize'

export interface Env extends LimitsEnv {
  ANTHROPIC_API_KEY: string
  KV: KVNamespace
  /** Comma-separated origins allowed to call this Worker, e.g. "https://you.github.io,http://localhost:5173". */
  ALLOWED_ORIGINS?: string
  MODEL?: string
  EFFORT?: string
  MAX_OUTPUT_TOKENS?: string
  UPSTREAM_TIMEOUT_MS?: string
  CACHE_TTL_S?: string
}

const DEFAULT_MODEL = 'claude-haiku-5-5'
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
type Effort = (typeof EFFORTS)[number]

/** Models where the server-side refusal fallback ("default" form) is available on the Claude API. */
const supportsFallbacks = (model: string) => /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model)

export function corsHeaders(request: Request, env: Pick<Env, 'ALLOWED_ORIGINS'>) {
  const origin = request.headers.get('Origin')
  const allowedList = String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const allowed = !origin || allowedList.includes(origin)
  const headers: Record<string, string> = { Vary: 'Origin' }
  if (origin && allowed) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'content-type'
    headers['Access-Control-Max-Age'] = '86400'
  }
  return { allowed, headers }
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Pull the JSON answer out of the response and check every field is a non-empty string. */
export function parseExplanation(text: string): Explanation | null {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>
    const out = {} as Explanation
    for (const f of OUTPUT_FIELDS) {
      const v = obj[f]
      if (typeof v !== 'string' || !v.trim()) return null
      out[f] = v.trim()
    }
    return out
  } catch {
    return null
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { allowed, headers } = corsHeaders(request, env)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers })
    if (!allowed) return json({ error: 'origin_not_allowed' }, 403, headers)
    if (url.pathname === '/health') return json({ ok: true }, 200, headers)
    if (url.pathname !== '/explain' || request.method !== 'POST') return json({ error: 'not_found' }, 404, headers)

    // 1. Read and check the payload.
    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413, headers)
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ error: 'bad_json' }, 400, headers)
    }
    const payload = sanitizePayload(parsed)
    if (!payload) return json({ error: 'bad_payload' }, 400, headers)

    const model = env.MODEL || DEFAULT_MODEL
    const effort: Effort = (EFFORTS as readonly string[]).includes(env.EFFORT ?? '') ? (env.EFFORT as Effort) : 'low'
    const body = JSON.stringify(payload)

    // 2. Same scenario asked before? Serve it from cache: free and instant.
    const cacheKey = `explain:${PROMPT_VERSION}:${await sha256(`${model}|${effort}|${body}`)}`
    try {
      const hit = await env.KV.get(cacheKey)
      if (hit) return json({ explanation: JSON.parse(hit), cached: true }, 200, headers)
    } catch {
      // Cache miss on KV error; the limit check below decides whether to continue.
    }

    // 3. Spending cap and per-IP limit. Fail closed if KV is unavailable.
    const limits = createLimits(env.KV, env)
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    try {
      const verdict = await limits.check(ip)
      if (!verdict.ok) return json({ error: verdict.reason === 'budget' ? 'daily_budget_reached' : 'rate_limited' }, 429, headers)
    } catch {
      return json({ error: 'limits_unavailable' }, 503, headers)
    }

    // 4. Ask Claude. No retries: the app gives up at 5 s and shows its own summary instead.
    const client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      maxRetries: 0,
      timeout: Number(env.UPSTREAM_TIMEOUT_MS) || 4500,
    })
    const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: Number(env.MAX_OUTPUT_TOKENS) || 2000,
      // The prompt is identical on every call, so cache it.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: body }],
      output_config: { effort, format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    }
    // Rewording given numbers into a fixed JSON shape needs no reasoning step, and thinking costs
    // about a second, which matters under the app's 5 s limit. Haiku 5.5 accepts "disabled" at effort
    // high or below; other current models either reject it or default to it differently, so leave them.
    if (/^claude-haiku-5/.test(model) && effort !== 'xhigh' && effort !== 'max') {
      params.thinking = { type: 'disabled' }
    }
    if (supportsFallbacks(model)) {
      // If a safety classifier declines, the API re-runs the request on Anthropic's recommended fallback model.
      params.betas = ['server-side-fallback-2026-07-01']
      params.fallbacks = 'default'
    }

    let message: Anthropic.Beta.BetaMessage
    try {
      message = await client.beta.messages.create(params)
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionTimeoutError) return json({ error: 'timeout' }, 504, headers)
      if (error instanceof Anthropic.RateLimitError) return json({ error: 'upstream_rate_limited' }, 429, headers)
      if (error instanceof Anthropic.APIError) {
        console.error('anthropic_error', error.status, error.message)
        return json({ error: 'upstream_error' }, 502, headers)
      }
      console.error('unexpected_error', error)
      return json({ error: 'upstream_error' }, 502, headers)
    }

    // Count what this call cost, whether or not the answer turns out usable.
    ctx.waitUntil(limits.addSpend(costMicroUsd(model, message.usage, env)).catch(() => {}))

    if (message.stop_reason === 'refusal') return json({ error: 'refused' }, 502, headers)
    if (message.stop_reason === 'max_tokens') return json({ error: 'truncated' }, 502, headers)

    const text = message.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? ''
    const explanation = parseExplanation(text)
    if (!explanation) return json({ error: 'bad_output' }, 502, headers)

    const ttl = Math.max(60, Number(env.CACHE_TTL_S) || 7 * 24 * 3600)
    ctx.waitUntil(env.KV.put(cacheKey, JSON.stringify(explanation), { expirationTtl: ttl }).catch(() => {}))
    return json({ explanation, cached: false, model: message.model }, 200, headers)
  },
} satisfies ExportedHandler<Env>

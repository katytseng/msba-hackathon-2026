// Spending cap and abuse limits, kept in KV (same approach as the campus map chat).
// - Per-IP hourly request cap.
// - Daily dollar budget, tracked in micro-dollars from the real token usage of each call.
// KV is eventually consistent, so both caps are approximate (a burst can overshoot slightly).
// Pair this with a hard monthly spend limit on the Anthropic Console as the backstop.

export interface LimitsEnv {
  IP_PER_HOUR?: string
  DAILY_BUDGET_USD?: string
  PRICE_INPUT?: string
  PRICE_OUTPUT?: string
  PRICE_CACHE_READ?: string
  PRICE_CACHE_WRITE?: string
}

export interface KVLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

const positive = (v: string | undefined, dflt: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : dflt)
const nonNegative = (v: string | undefined, dflt: number) =>
  v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : dflt

export function createLimits(kv: KVLike, env: LimitsEnv = {}, now: () => Date = () => new Date()) {
  const cfg = {
    ipPerHour: positive(env.IP_PER_HOUR, 20),
    dailyBudgetMicro: positive(env.DAILY_BUDGET_USD, 1) * 1e6,
  }
  const iso = () => now().toISOString()
  const dayKey = () => iso().slice(0, 10)
  const hourKey = () => iso().slice(0, 13)
  const read = async (key: string) => parseInt((await kv.get(key)) ?? '0', 10) || 0
  const bump = async (key: string, ttl: number, by = 1) => {
    const next = (await read(key)) + by
    await kv.put(key, String(next), { expirationTtl: ttl })
    return next
  }

  return {
    cfg,
    /** Throws if KV is unavailable; the caller fails closed. */
    async check(ip: string): Promise<{ ok: true } | { ok: false; reason: 'budget' | 'ip' }> {
      if ((await read(`spend:${dayKey()}`)) >= cfg.dailyBudgetMicro) return { ok: false, reason: 'budget' }
      if ((await bump(`ip:${ip}:${hourKey()}`, 7200)) > cfg.ipPerHour) return { ok: false, reason: 'ip' }
      return { ok: true }
    },
    async addSpend(micro: number) {
      if (micro > 0) await bump(`spend:${dayKey()}`, 172800, Math.round(micro))
    },
  }
}

/** Micro-dollars per token, i.e. dollars per million tokens. Cache write = 5-minute TTL (1.25x input). */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
}

export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

/** Cost of one call in micro-dollars. Unknown models are priced as Opus, the safe (higher) side. */
export function costMicroUsd(model: string, usage: Usage, env: LimitsEnv = {}) {
  const base = PRICES[model] ?? PRICES['claude-opus-5-5']
  const p = {
    input: nonNegative(env.PRICE_INPUT, base.input),
    output: nonNegative(env.PRICE_OUTPUT, base.output),
    cacheRead: nonNegative(env.PRICE_CACHE_READ, base.cacheRead),
    cacheWrite: nonNegative(env.PRICE_CACHE_WRITE, base.cacheWrite),
  }
  return (
    usage.input_tokens * p.input +
    usage.output_tokens * p.output +
    (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
    (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite
  )
}

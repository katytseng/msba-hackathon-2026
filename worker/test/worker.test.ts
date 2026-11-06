import { describe, expect, it } from 'vitest'
import { corsHeaders, parseExplanation } from '../src/index'
import { costMicroUsd, createLimits, type KVLike } from '../src/limits'
import { sanitizePayload } from '../src/sanitize'
import { OUTPUT_FIELDS, SYSTEM_PROMPT } from '../src/prompt'

function memoryKV(): KVLike & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    async get(k) {
      return store.get(k) ?? null
    },
    async put(k, v) {
      store.set(k, v)
    },
  }
}

const req = (origin?: string) => new Request('https://w.example/explain', { method: 'POST', headers: origin ? { Origin: origin } : {} })

describe('CORS', () => {
  const env = { ALLOWED_ORIGINS: 'http://localhost:5173, https://katytseng.github.io' }
  it('echoes an allowed origin', () => {
    const { allowed, headers } = corsHeaders(req('https://katytseng.github.io'), env)
    expect(allowed).toBe(true)
    expect(headers['Access-Control-Allow-Origin']).toBe('https://katytseng.github.io')
  })
  it('blocks other origins and sends no allow header', () => {
    const { allowed, headers } = corsHeaders(req('https://evil.example'), env)
    expect(allowed).toBe(false)
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined()
  })
  it('treats an unset allowlist as allowing no browser origin', () => {
    expect(corsHeaders(req('http://localhost:5173'), {}).allowed).toBe(false)
  })
})

describe('spending cap and rate limit', () => {
  const at = new Date('2026-11-06T10:15:00Z')
  it('stops once the daily budget is spent', async () => {
    const kv = memoryKV()
    const limits = createLimits(kv, { DAILY_BUDGET_USD: '0.01' }, () => at)
    expect(await limits.check('1.1.1.1')).toEqual({ ok: true })
    await limits.addSpend(10_000) // $0.01
    expect(await limits.check('1.1.1.1')).toEqual({ ok: false, reason: 'budget' })
  })
  it('caps requests per IP per hour', async () => {
    const limits = createLimits(memoryKV(), { IP_PER_HOUR: '2' }, () => at)
    expect((await limits.check('2.2.2.2')).ok).toBe(true)
    expect((await limits.check('2.2.2.2')).ok).toBe(true)
    expect(await limits.check('2.2.2.2')).toEqual({ ok: false, reason: 'ip' })
    expect((await limits.check('3.3.3.3')).ok).toBe(true)
  })
})

describe('cost', () => {
  it('prices Opus 5.5 at $4 in / $20 out per million tokens', () => {
    expect(costMicroUsd('claude-opus-5-5', { input_tokens: 1_000_000, output_tokens: 0 })).toBe(4_000_000)
    expect(costMicroUsd('claude-opus-5-5', { input_tokens: 0, output_tokens: 1000 })).toBe(20_000)
  })
  it('prices unknown models as Opus, the safe side', () => {
    expect(costMicroUsd('claude-something-new', { input_tokens: 1000, output_tokens: 0 })).toBe(4000)
  })
})

describe('payload checks', () => {
  it('rejects payloads without rates_as_of or suppliers', () => {
    expect(sanitizePayload({ suppliers_ranked: [{}] })).toBeNull()
    expect(sanitizePayload({ rates_as_of: '2026-11-05', suppliers_ranked: [] })).toBeNull()
    expect(sanitizePayload('nope')).toBeNull()
  })
  it('caps long strings and drops odd keys', () => {
    const out = sanitizePayload({
      rates_as_of: '2026-11-05',
      suppliers_ranked: [{ name: 'x'.repeat(500), 'Bad Key': 1 }],
    })!
    const s = (out.suppliers_ranked as Record<string, unknown>[])[0]
    expect((s.name as string).length).toBe(80)
    expect('Bad Key' in s).toBe(false)
  })
})

describe('answer parsing', () => {
  const good = Object.fromEntries(OUTPUT_FIELDS.map((f) => [f, `${f} text.`]))
  it('accepts a complete answer', () => {
    expect(parseExplanation(JSON.stringify(good))).toEqual(good)
  })
  it('rejects missing or empty fields and non-JSON', () => {
    expect(parseExplanation(JSON.stringify({ ...good, caveat: '' }))).toBeNull()
    expect(parseExplanation('not json')).toBeNull()
  })
})

describe('prompt', () => {
  it('keeps the owner rules and explains the engine', () => {
    expect(SYSTEM_PROMPT).toContain('Use only numbers that appear in the input JSON')
    expect(SYSTEM_PROMPT).toContain('rates_as_of')
    expect(SYSTEM_PROMPT).toContain('How the input numbers were produced')
  })
})

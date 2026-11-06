// Shape checks on the incoming payload. The app builds it from engine results, but anyone can POST,
// so cap sizes and keep only JSON primitives. Strings are capped because supplier and product names
// are free text typed by the owner.

export const MAX_BODY_BYTES = 20_000
const MAX_DEPTH = 5
const MAX_ARRAY = 20
const MAX_KEYS = 40
const MAX_STRING = 80

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

function clean(value: unknown, depth: number): Json | undefined {
  if (value === null) return null
  if (typeof value === 'string') return value.slice(0, MAX_STRING)
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (depth >= MAX_DEPTH) return undefined
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY)
      .map((v) => clean(v, depth + 1))
      .filter((v): v is Json => v !== undefined)
  }
  if (typeof value === 'object') {
    const out: Record<string, Json> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      if (!/^[a-z0-9_]{1,40}$/.test(k)) continue
      const c = clean(v, depth + 1)
      if (c !== undefined) out[k] = c
    }
    return out
  }
  return undefined
}

/** Returns the cleaned payload, or null if it isn't the shape the app sends. */
export function sanitizePayload(raw: unknown): Record<string, Json> | null {
  const c = clean(raw, 0)
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null
  if (typeof c.rates_as_of !== 'string') return null
  if (!Array.isArray(c.suppliers_ranked) || c.suppliers_ranked.length === 0) return null
  return c
}

// Number check for AI text: every dollar amount, percentage and "points" figure in the explanation
// must match a number in the payload. If the model computed or invented a figure, the explanation is
// rejected and the app shows its standard template summary instead.

const MONEY = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g
const PERCENT = /(\d+(?:\.\d+)?)\s?%/g
const POINTS = /(\d+(?:\.\d+)?)\s+(?:percentage\s+)?points?\b/gi

const round1 = (x: number) => Math.round(x * 10) / 10

/** All money values (fields ending in _usd) and rates (fields ending in _pct) found anywhere in the payload. */
export function allowedNumbers(payload: unknown) {
  const money = new Set<number>()
  const rates = new Set<number>()
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'number') {
      if (key.endsWith('_usd')) {
        money.add(Math.round(v * 100) / 100)
        money.add(Math.round(v)) // "$12" for a $12.43 per-unit cost is formatting, not a new number
      } else if (key.endsWith('_pct') || key.endsWith('_pct_of_product_cost')) {
        rates.add(round1(v))
      }
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
  }
  walk(payload)
  return { money, rates }
}

/** Returns the figures in `text` that don't appear in the payload. Empty means the text is safe to show. */
export function unverifiedNumbers(text: string, payload: unknown): string[] {
  const { money, rates } = allowedNumbers(payload)
  const bad: string[] = []
  for (const m of text.matchAll(MONEY)) {
    const value = Number(m[1].replace(/,/g, '') + (m[2] ? `.${m[2]}` : ''))
    if (!money.has(Math.round(value * 100) / 100)) bad.push(m[0])
  }
  for (const re of [PERCENT, POINTS]) {
    for (const m of text.matchAll(re)) {
      if (!rates.has(round1(Number(m[1])))) bad.push(m[0])
    }
  }
  return bad
}

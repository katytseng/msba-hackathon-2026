const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** $44,744 (whole dollars) or $44,743.88 with cents=true */
export const usd = (x: number, cents = false) => (cents ? usd2 : usd0).format(x)
export const num = (x: number) => int.format(x)
/** 0.165 -> "16.5%" */
export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits).replace(/\.0+$/, '')}%`
/** 0.05118 -> "5.1 points" */
export const points = (x: number, digits = 1) => `${(x * 100).toFixed(digits)} points`

export function niceDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
export function shortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

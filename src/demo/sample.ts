// "Fill sample" for the new-order wizard. Pure functions: deterministic, offline, no randomness.
// The presenter types the first two items by hand (cashmere sweater, poncho); each step's button then
// completes that step to exactly the scripted state.
import type { Product, Supplier } from '../engine'
import { DEMO_COMPANY, DEMO_ITEMS, DEMO_ORDER_DATE, DEMO_SUPPLIERS, toProduct, toSupplier } from './data'

/** Which demo item a typed product name means, or null. Loose on purpose: "Cashmere Sweater", "poncho", "rain jackets". */
export function demoKeyFor(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('cashmere') || n.includes('sweater')) return 'sweater'
  if (n.includes('poncho')) return 'poncho'
  if (n.includes('jacket')) return 'jacket'
  if (n.includes('boot')) return 'boots'
  if (n.includes('umbrella')) return 'umbrella'
  return null
}

/**
 * Step 1: bring the items to the scripted list. A hand-typed product that matches a demo item keeps its id
 * and the text typed for its name, but takes the scripted HTS code, quantity, sell price and sales speed.
 * Demo items that are still missing are added. Anything else the presenter typed is left alone.
 */
export function fillSampleItems(products: Product[]): Product[] {
  const used = new Set<string>()
  const out = products.map((p) => {
    const key = demoKeyFor(p.name)
    const demo = key && !used.has(key) ? DEMO_ITEMS.find((it) => it.key === key) : undefined
    if (!demo) return p
    used.add(demo.key)
    return { ...toProduct(demo, p.id), name: p.name.trim() || demo.name }
  })
  for (const it of DEMO_ITEMS) if (!used.has(it.key)) out.push(toProduct(it, `demo-${it.key}`))
  return out
}

/** Step 2: the three scripted supplier quotes (China, Vietnam, India), priced against whatever product ids the order has. */
export function fillSampleQuotes(products: Product[]): Supplier[] {
  const idByKey = new Map<string, string>()
  for (const p of products) {
    const key = demoKeyFor(p.name)
    if (key && !idByKey.has(key)) idByKey.set(key, p.id)
  }
  return DEMO_SUPPLIERS.map((s) => toSupplier(s, (key) => idByKey.get(key)))
}

/** Step 4: the scripted company cash, safety buffer and loan rate. */
export const sampleCompany = () => ({ ...DEMO_COMPANY })

/** Order date for a new order: the day after DEMO_TODAY. */
export const sampleOrderDate = () => DEMO_ORDER_DATE

// Demo data for the Vibathon presentation. Everything here is FICTIONAL except the tariff rates:
//  - baseRate on every item is the real HTS general rate from public/hts/hts.json (release 2026HTSRev23),
//  - extra tariffs per country stay in rates.json and are never changed here.
// Supplier names, quotes, freight, lead times, quantities, sell prices, sales speeds, the bank balance and
// the buffer are made up, sized for a small clothing importer ("Sam").
//
// Every date is relative to DEMO_TODAY, so changing that one constant moves the whole story.
import { addDays, type Inputs, type Product, type Supplier } from '../engine'
import type { Company, SavedOrder } from '../engine/portfolio'

/** The day the demo "happens". Wednesday, Nov 18, 2026. Change it here and every seeded date follows. */
export const DEMO_TODAY = '2026-11-18'
/** The live demo order is placed the day after DEMO_TODAY. */
export const DEMO_ORDER_DATE = addDays(DEMO_TODAY, 1)

export const HTS_RELEASE = '2026HTSRev23'

/** Sam's company: bank balance on DEMO_TODAY, safety buffer and loan rate. */
export const DEMO_COMPANY: Company = { cash: 24000, buffer: 8000, apr: 0.08 }

// ---------------------------------------------------------------------------------------------------------
// Items

export interface DemoItem {
  key: string
  name: string
  htsCode: string
  baseRate: number // real HTS general rate, as a fraction
  htsDescription: string
  qty: number
  sellPrice: number
  salesPerWeek: number
}

const item = (
  key: string,
  name: string,
  htsCode: string,
  baseRate: number,
  htsDescription: string,
  qty: number,
  sellPrice: number,
  salesPerWeek: number,
): DemoItem => ({ key, name, htsCode, baseRate, htsDescription, qty, sellPrice, salesPerWeek })

export type Country = 'China' | 'Vietnam' | 'India'

export interface DemoSupplier {
  id: string
  name: string
  country: Country
  quotes: Record<string, number> // item key -> FOB $/unit
  freight: number
  depositPct: number
  balanceDays: number
  leadTimeDays: number
  transitDays: number
}

const supplier = (
  id: string,
  name: string,
  country: Country,
  quotes: Record<string, number>,
  freight: number,
  depositPct: number,
  balanceDays: number,
  leadTimeDays: number,
  transitDays: number,
): DemoSupplier => ({ id, name, country, quotes, freight, depositPct, balanceDays, leadTimeDays, transitDays })

// ---------------------------------------------------------------------------------------------------------
// The live demo order: rainy-day LA. Items 1 and 2 are typed by hand in the demo, the rest come from "Fill sample".

export const DEMO_ITEMS: DemoItem[] = [
  item('sweater', 'Cashmere sweater', '6110.12.10', 0.04, 'Sweaters and pullovers, knitted, of Kashmir (cashmere) goats, wholly of cashmere', 200, 149, 12),
  item('poncho', 'Poncho', '3926.20.60.00', 0, 'Plastic rainwear incl. ponchos, outer shell of PVC, valued not over $10 per unit', 300, 16, 30),
  item('jacket', 'Rain jacket', '6202.40.70.00', 0.071, "Women's anoraks and windbreakers, man-made fibers, water resistant", 300, 75, 25),
  item('boots', 'Waterproof boots', '6401.92.90.60', 0.375, 'Waterproof footwear covering the ankle, rubber or plastics soles and uppers, other', 200, 52, 15),
  item('umbrella', 'Umbrella', '6601.91.00.00', 0, 'Umbrellas having a telescopic shaft', 300, 16, 30),
]

export const DEMO_SUPPLIERS: DemoSupplier[] = [
  supplier('A', 'Pearl Delta Outerwear', 'China', { sweater: 43.85, poncho: 3.61, jacket: 20.93, boots: 12.54, umbrella: 3.31 }, 2350, 0.3, 0, 33, 18),
  supplier('B', 'Mekong Textile Works', 'Vietnam', { sweater: 44.9, poncho: 3.7, jacket: 21.4, boots: 12.75, umbrella: 3.4 }, 2350, 0.3, 7, 8, 20),
  supplier('C', 'Deccan Garments', 'India', { sweater: 45, poncho: 3.91, jacket: 21.61, boots: 12.93, umbrella: 3.55 }, 2950, 0.3, 14, 10, 31),
]

// ---------------------------------------------------------------------------------------------------------
// Sam's three existing orders

interface SeedOrder {
  id: string
  name: string
  daysAgo: number // order date = DEMO_TODAY minus this
  items: DemoItem[]
  suppliers: DemoSupplier[]
  placed: string // id of the supplier the order went to
}

const ORDER_A: SeedOrder = {
  id: 'demo-order-a',
  name: 'Fall essentials',
  daysAgo: 69,
  placed: 'A',
  items: [
    item('hoodie', 'Cotton hoodie', '6110.20.20', 0.165, 'Sweaters, pullovers, sweatshirts, knitted, of cotton, other', 300, 52, 25),
    item('tee', 'Cotton knit T-shirt', '6109.10.00', 0.165, 'T-shirts, singlets, tank tops, knitted, of cotton', 300, 24, 30),
    item('jeans', "Women's cotton jeans", '6204.62.80', 0.166, "Women's trousers and breeches, of cotton, other", 200, 64, 15),
  ],
  suppliers: [
    supplier('A', 'Ningbo Harbor Knits', 'China', { hoodie: 17.14, tee: 4.86, jeans: 13.77 }, 1650, 0.3, 0, 33, 18),
    supplier('B', 'Binh Duong Knitwear', 'Vietnam', { hoodie: 17.2, tee: 4.9, jeans: 14.8 }, 1650, 0.3, 7, 8, 20),
    supplier('C', 'Tiruppur Cotton House', 'India', { hoodie: 17.97, tee: 5.08, jeans: 15.57 }, 2050, 0.3, 14, 10, 31),
  ],
}

const ORDER_B: SeedOrder = {
  id: 'demo-order-b',
  name: 'Winter layers',
  daysAgo: 35,
  placed: 'C',
  items: [
    item('blazer', "Women's corduroy blazer", '6204.32.20', 0.094, "Women's suit-type jackets and blazers, of cotton, other", 150, 94, 8),
    item('scarf', 'Wool scarf', '6214.20.00.00', 0.067, 'Shawls, scarves, mufflers, of wool or fine animal hair', 300, 40, 20),
    item('flannel', "Men's cotton flannel shirt", '6205.20.20', 0.197, "Men's or boys' shirts, of cotton, other", 200, 50, 18),
  ],
  suppliers: [
    supplier('A', 'Hangzhou Loom & Co', 'China', { blazer: 31.82, scarf: 10.04, flannel: 11.28 }, 1750, 0.3, 0, 33, 18),
    supplier('B', 'Da Nang Apparel', 'Vietnam', { blazer: 32.6, scarf: 10.3, flannel: 11.3 }, 1750, 0.3, 7, 8, 20),
    supplier('C', 'Ludhiana Woolworks', 'India', { blazer: 31.51, scarf: 9.85, flannel: 11.69 }, 2150, 0.3, 14, 10, 31),
  ],
}

const ORDER_C: SeedOrder = {
  id: 'demo-order-c',
  name: 'Holiday party',
  daysAgo: 2,
  placed: 'B',
  items: [
    item('dress', "Women's party dress", '6204.43.40', 0.16, "Women's dresses, of synthetic fibers, other", 200, 98, 12),
    item('blouse', "Women's cotton blouse", '6206.30.30', 0.154, "Women's or girls' blouses and shirts, of cotton, other", 100, 54, 8),
    item('shawl', 'Evening shawl', '6214.30.00.00', 0.053, 'Shawls, scarves, mufflers, of synthetic fibers', 300, 26, 25),
  ],
  suppliers: [
    supplier('A', 'Guangzhou Festive Apparel', 'China', { dress: 28.27, blouse: 12.25, shawl: 5.68 }, 1450, 0.3, 0, 33, 18),
    supplier('B', 'Saigon Evening Wear', 'Vietnam', { dress: 28.6, blouse: 12.4, shawl: 5.8 }, 1450, 0.3, 7, 8, 20),
    supplier('C', 'Surat Textile Studio', 'India', { dress: 29.89, blouse: 12.78, shawl: 6.06 }, 1850, 0.3, 14, 10, 31),
  ],
}

export const SEED_ORDERS: SeedOrder[] = [ORDER_A, ORDER_B, ORDER_C]

// ---------------------------------------------------------------------------------------------------------
// Builders (also used by the wizard's "Fill sample" button)

export function toProduct(it: DemoItem, id = it.key): Product {
  return {
    id,
    name: it.name,
    htsCode: it.htsCode,
    baseRate: it.baseRate,
    htsDescription: it.htsDescription,
    htsRelease: HTS_RELEASE,
    qty: it.qty,
    sellPrice: it.sellPrice,
    salesPerWeek: it.salesPerWeek,
  }
}

/** A demo supplier as the engine wants it. `idOf` maps a demo item key to the product id in the order. */
export function toSupplier(s: DemoSupplier, idOf: (key: string) => string | undefined = (k) => k): Supplier {
  const prices: Record<string, number> = {}
  for (const [key, price] of Object.entries(s.quotes)) {
    const id = idOf(key)
    if (id !== undefined) prices[id] = price
  }
  return {
    id: s.id,
    name: s.name,
    country: s.country,
    prices,
    freight: s.freight,
    depositPct: s.depositPct,
    balanceDays: s.balanceDays,
    leadTimeDays: s.leadTimeDays,
    transitDays: s.transitDays,
  }
}

export function inputsFor(orderDate: string, items: DemoItem[], suppliers: DemoSupplier[], company: Company = DEMO_COMPANY): Inputs {
  return {
    business: { ...company, orderDate },
    products: items.map((it) => toProduct(it)),
    suppliers: suppliers.map((s) => toSupplier(s)),
  }
}

/** The live demo order exactly as the sample buttons would fill it in. */
export const demoOrderInputs = (): Inputs => inputsFor(DEMO_ORDER_DATE, DEMO_ITEMS, DEMO_SUPPLIERS)

/** Sam's three existing orders as saved orders. */
export function seedOrders(): SavedOrder[] {
  return SEED_ORDERS.map((o, i) => {
    const orderDate = addDays(DEMO_TODAY, -o.daysAgo)
    return {
      id: o.id,
      name: o.name,
      savedAt: `${orderDate}T12:00:00.000Z`,
      inputs: inputsFor(orderDate, o.items, o.suppliers),
      supplierId: o.placed,
      color: i,
    }
  })
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  breakEven,
  cashTimeline,
  compareSuppliers,
  type BreakEven,
  type CashResult,
  type Inputs,
  type RankedResult,
  type Rates,
} from './engine'
import ratesJson from './data/rates.json'
import type { Company, SavedOrder } from './engine/portfolio'
import sampleJson from './data/sample.json'
import suppliersJson from './data/suppliers.json'

export const rates = ratesJson as unknown as Rates
const sample = { ...sampleJson, suppliers: suppliersJson } as Inputs

export const DEFAULT_APR = 0.06
export const APR_PRESETS = [0.06, 0.08, 0.1, 0.12]

const DRAFT_KEY = 'landed-cost:draft:v1'

/** Restore the saved draft, or null if there is none or it doesn't look like Inputs. */
function loadDraft(): Inputs | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    const b = d?.business
    const ok =
      b && typeof b.cash === 'number' && typeof b.buffer === 'number' && typeof b.apr === 'number' &&
      typeof b.orderDate === 'string' && Array.isArray(d.products) && Array.isArray(d.suppliers)
    return ok ? (d as Inputs) : null
  } catch {
    return null
  }
}

function saveDraft(inputs: Inputs) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(inputs))
  } catch {
    // storage full or blocked: the app still works, it just won't remember
  }
}

const ORDERS_KEY = 'landed-cost:orders:v1'

interface OrderStore {
  company: Company | null
  orders: SavedOrder[]
}

function loadOrders(): OrderStore {
  try {
    const d = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? 'null')
    if (d && Array.isArray(d.orders)) return { company: d.company ?? null, orders: d.orders }
  } catch {
    // ignore broken storage
  }
  return { company: null, orders: [] }
}

function saveOrders(store: OrderStore) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(store))
  } catch {
    // storage full or blocked
  }
}

/** Smallest color slot not used by another order, so lanes keep their color when others are deleted. */
function freeColor(orders: SavedOrder[]): number {
  const used = new Set(orders.map((o) => o.color))
  let i = 0
  while (used.has(i)) i++
  return i
}

const today = () => new Date().toISOString().slice(0, 10)
export const emptyInputs = (): Inputs => ({
  business: { cash: 0, buffer: 0, apr: DEFAULT_APR, orderDate: today() },
  products: [],
  suppliers: [],
})

interface AppState {
  inputs: Inputs
  setInputs: (fn: (prev: Inputs) => Inputs) => void
  resetToSample: () => void
  reset: () => void
  selectedId: string | null
  setSelectedId: (id: string) => void
  ranked: RankedResult[]
  chosen: RankedResult | null
  cash: CashResult | null
  be: BreakEven | null
  error: string | null
  // Dashboard
  orders: SavedOrder[]
  company: Company // one bank balance shared by every order
  setCompany: (patch: Partial<Company>) => void
  editingId: string | null // saved order currently loaded into the steps
  saveOrder: (name: string, asNew?: boolean) => SavedOrder | null
  editOrder: (id: string) => void
  deleteOrder: (id: string) => void
  startNewOrder: () => void
  addSampleOrders: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputsRaw] = useState<Inputs>(() => loadDraft() ?? emptyInputs())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [store, setStore] = useState<OrderStore>(loadOrders)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => saveDraft(inputs), [inputs])
  useEffect(() => saveOrders(store), [store])

  const derived = useMemo(() => {
    try {
      const ranked = compareSuppliers(inputs, rates)
      const chosen = ranked.find((r) => r.supplierId === selectedId) ?? ranked[0] ?? null
      const supplier = chosen ? inputs.suppliers.find((s) => s.id === chosen.supplierId)! : null
      const cash = supplier && chosen ? cashTimeline(inputs, supplier, rates, chosen) : null
      return { ranked, chosen, cash, be: breakEven(ranked), error: null }
    } catch (e) {
      return { ranked: [], chosen: null, cash: null, be: null, error: (e as Error).message }
    }
  }, [inputs, selectedId])

  const value: AppState = {
    inputs,
    setInputs: (fn) => setInputsRaw((prev) => fn(prev)),
    resetToSample: () => {
      setInputsRaw(structuredClone(sample))
      setSelectedId(null)
      setEditingId(null)
    },
    reset: () => {
      setInputsRaw(emptyInputs())
      setSelectedId(null)
      setEditingId(null)
    },
    selectedId,
    setSelectedId,
    ...derived,
    orders: store.orders,
    company: store.company ?? { cash: inputs.business.cash, buffer: inputs.business.buffer, apr: inputs.business.apr },
    setCompany: (patch) =>
      setStore((st) => ({
        ...st,
        company: { ...(st.company ?? { cash: inputs.business.cash, buffer: inputs.business.buffer, apr: inputs.business.apr }), ...patch },
      })),
    editingId,
    saveOrder: (name, asNew = false) => {
      const chosen = derived.chosen
      if (!chosen || chosen.units === 0) return null
      const order: SavedOrder = {
        id: (!asNew && editingId) || `o${Date.now()}`,
        name: name.trim() || `Order ${store.orders.length + 1}`,
        savedAt: new Date().toISOString(),
        inputs: structuredClone(inputs),
        supplierId: chosen.supplierId,
        color: store.orders.find((o) => o.id === editingId && !asNew)?.color ?? freeColor(store.orders),
      }
      setStore((st) => ({
        // The first saved order sets the company's cash, buffer and APR.
        company: st.company ?? { cash: inputs.business.cash, buffer: inputs.business.buffer, apr: inputs.business.apr },
        orders: st.orders.some((o) => o.id === order.id)
          ? st.orders.map((o) => (o.id === order.id ? order : o))
          : [...st.orders, order],
      }))
      setEditingId(order.id)
      return order
    },
    editOrder: (id) => {
      const o = store.orders.find((x) => x.id === id)
      if (!o) return
      setInputsRaw(structuredClone(o.inputs))
      setSelectedId(o.supplierId)
      setEditingId(id)
    },
    deleteOrder: (id) => {
      setStore((st) => ({ ...st, orders: st.orders.filter((o) => o.id !== id) }))
      if (editingId === id) setEditingId(null)
    },
    addSampleOrders: () => {
      // Three orders from the sample, a month apart, so the dashboard has something to show.
      const plan = [
        { name: 'Holiday restock', date: '2026-11-09', scale: 1 },
        { name: 'Spring line', date: '2026-12-14', scale: 0.8 },
        { name: 'Summer basics', date: '2027-01-18', scale: 1.2 },
      ]
      setStore((st) => {
        const orders = [...st.orders]
        plan.forEach((p, i) => {
          const inp = structuredClone(sample)
          inp.business.orderDate = p.date
          inp.products = inp.products.map((x) => ({ ...x, qty: Math.round((x.qty * p.scale) / 10) * 10 }))
          const best = compareSuppliers(inp, rates)[0]
          orders.push({ id: `o${Date.now()}${i}`, name: p.name, savedAt: new Date().toISOString(), inputs: inp, supplierId: best.supplierId, color: freeColor(orders) })
        })
        return { company: st.company ?? { cash: sample.business.cash, buffer: sample.business.buffer, apr: sample.business.apr }, orders }
      })
    },
    startNewOrder: () => {
      // Keep the business and supplier list as a starting point; new order date is today.
      setInputsRaw((prev) => ({ ...structuredClone(prev), business: { ...prev.business, orderDate: today() } }))
      setSelectedId(null)
      setEditingId(null)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppProvider')
  return v
}

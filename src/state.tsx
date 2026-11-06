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
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputsRaw] = useState<Inputs>(() => loadDraft() ?? emptyInputs())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => saveDraft(inputs), [inputs])

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
    },
    reset: () => {
      setInputsRaw(emptyInputs())
      setSelectedId(null)
    },
    selectedId,
    setSelectedId,
    ...derived,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppProvider')
  return v
}

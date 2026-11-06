import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
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

export const rates = ratesJson as unknown as Rates
const sample = sampleJson as Inputs

const today = () => new Date().toISOString().slice(0, 10)
export const emptyInputs = (): Inputs => ({
  business: { cash: 0, buffer: 0, apr: 0.12, orderDate: today() },
  products: [],
  suppliers: [],
})

interface AppState {
  inputs: Inputs
  setInputs: (fn: (prev: Inputs) => Inputs) => void
  loadSample: () => void
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
  const [inputs, setInputsRaw] = useState<Inputs>(emptyInputs)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
    loadSample: () => {
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

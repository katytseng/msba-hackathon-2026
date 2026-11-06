import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { niceDate, usd } from '../format'
import { useApp } from '../state'
import { Button } from './ui'
import BusinessScreen from '../screens/BusinessScreen'
import SuppliersScreen from '../screens/SuppliersScreen'
import CompareScreen from '../screens/CompareScreen'
import CashScreen from '../screens/CashScreen'
import TariffScreen from '../screens/TariffScreen'
import SummaryScreen from '../screens/SummaryScreen'

export const ORDER_STEPS = [
  { key: 'business', label: 'Business', Screen: BusinessScreen },
  { key: 'suppliers', label: 'Supplier quotes', Screen: SuppliersScreen },
  { key: 'compare', label: 'Compare', Screen: CompareScreen },
  { key: 'cash', label: 'Cash check', Screen: CashScreen },
  { key: 'tariffs', label: 'Tariff what-if', Screen: TariffScreen },
  { key: 'summary', label: 'Summary', Screen: SummaryScreen },
] as const

const SAVE_FROM = 4 // the save controls appear from step 5 on

/** Steps 1-5 (plus the summary) in a pop-up over the dashboard. The step lives in the URL: /order/:step */
export default function OrderModal() {
  const { step } = useParams()
  const navigate = useNavigate()
  const { chosen, inputs, orders, editingId, saveOrder, resetToSample, reset } = useApp()
  const idx = Math.max(0, ORDER_STEPS.findIndex((s) => s.key === step))
  const current = ORDER_STEPS[idx]
  const editing = orders.find((o) => o.id === editingId) ?? null
  const body = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)

  const [name, setName] = useState(editing?.name ?? '')
  useEffect(() => {
    setName(editing?.name ?? '')
  }, [editing?.id, editing?.name])

  const close = () => navigate('/dashboard')
  const go = (i: number) => navigate(`/order/${ORDER_STEPS[i].key}`)

  // Esc closes; the page behind doesn't scroll; each step starts at the top.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role="note"]') && close()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [idx])

  const canSave = !!chosen && chosen.units > 0
  const placeholder = `Order ${orders.length + 1}, ${niceDate(inputs.business.orderDate)}`
  const save = (asNew: boolean) => {
    if (saveOrder(name || placeholder, asNew)) close()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-2 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        className="flex h-full max-h-[920px] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-slate-50 shadow-2xl outline-none"
      >
        {/* Header: title, stepper, close */}
        <div className="border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <h2 id="order-modal-title" className="text-lg font-bold text-slate-900">
              {editing ? `Edit order: ${editing.name}` : 'New order'}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" className="text-xs" onClick={resetToSample}>
                Load sample
              </Button>
              <Button variant="ghost" className="text-xs" onClick={reset}>
                Clear
              </Button>
              <button onClick={close} aria-label="Close" className="ml-1 flex h-8 w-8 items-center justify-center rounded-md text-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                ×
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3" aria-label="Order steps">
            {ORDER_STEPS.map((s, i) => (
              <button
                key={s.key}
                onClick={() => go(i)}
                aria-current={i === idx ? 'step' : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                  i === idx ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`mr-1.5 ${i === idx ? 'text-blue-700' : 'text-slate-400'}`}>{i + 1}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Current step */}
        <div ref={body} className="flex-1 overflow-y-auto px-5 py-5">
          <current.Screen />
        </div>

        {/* Footer: back / next, and save from step 5 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
          <div>
            {idx > 0 && (
              <Button variant="secondary" onClick={() => go(idx - 1)}>
                ← Back
              </Button>
            )}
          </div>
          {idx < SAVE_FROM ? (
            <Button onClick={() => go(idx + 1)}>Next: {ORDER_STEPS[idx + 1].label} →</Button>
          ) : canSave ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              <span className="hidden text-sm text-slate-600 md:inline">
                <b>{chosen!.supplierName} ({chosen!.country})</b>, {usd(chosen!.total)}
              </span>
              <input
                aria-label="Order name"
                className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                placeholder={placeholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save(false)}
              />
              {editing && (
                <Button variant="secondary" onClick={() => save(true)}>
                  Save as new
                </Button>
              )}
              <Button onClick={() => save(false)}>{editing ? 'Update order' : 'Save order'}</Button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Add products and at least one supplier quote to save this order.</p>
          )}
        </div>
      </div>
    </div>
  )
}

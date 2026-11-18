import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { niceDate, usd } from '../format'
import { useApp } from '../state'
import { Arrow, Button } from './ui'
import BusinessScreen from '../screens/BusinessScreen'
import SuppliersScreen from '../screens/SuppliersScreen'
import CompareScreen from '../screens/CompareScreen'
import CashScreen from '../screens/CashScreen'
import SummaryScreen from '../screens/SummaryScreen'
import { fillSampleItems, fillSampleQuotes, sampleCompany, sampleOrderDate } from '../demo/sample'

export const ORDER_STEPS = [
  { key: 'business', label: 'Order details', Screen: BusinessScreen },
  { key: 'suppliers', label: 'Supplier quotes', Screen: SuppliersScreen },
  { key: 'compare', label: 'Compare', Screen: CompareScreen },
  { key: 'cash', label: 'Cash check', Screen: CashScreen },
  { key: 'summary', label: 'Summary', Screen: SummaryScreen },
] as const

const SAVE_FROM = 4 // step 4 (Cash check) leads on to the summary; the save controls appear on step 5 (Summary)

/**
 * Steps 1-4 (plus the summary) in a pop-up over the dashboard. The step lives in the URL: /order/:step.
 * Company cash and the tariff what-if live on the dashboard's Finances and Plan tabs.
 */
export default function OrderModal({ returnTo = '/dashboard' }: { returnTo?: string }) {
  const { step } = useParams()
  const navigate = useNavigate()
  const { chosen, inputs, orders, editingId, saveOrder, reset, setInputs, setCompany, setSelectedId } = useApp()
  const idx = Math.max(0, ORDER_STEPS.findIndex((s) => s.key === step))
  const current = ORDER_STEPS[idx]
  const editing = orders.find((o) => o.id === editingId) ?? null
  const body = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)

  const [name, setName] = useState(editing?.name ?? '')
  useEffect(() => {
    setName(editing?.name ?? '')
  }, [editing?.id, editing?.name])

  // Quiet demo helper next to Clear: completes whichever step you are on (items, quotes or cash) to the scripted sample.
  const canFill = current.key === 'business' || current.key === 'suppliers' || current.key === 'cash'
  const fill = () => {
    if (current.key === 'business') setInputs((p) => ({ ...p, business: { ...p.business, orderDate: sampleOrderDate() }, products: fillSampleItems(p.products) }))
    else if (current.key === 'suppliers') {
      setInputs((p) => ({ ...p, suppliers: fillSampleQuotes(p.products) }))
      setSelectedId(null)
    } else if (current.key === 'cash') setCompany(sampleCompany())
  }

  const close = () => navigate(returnTo)
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-2 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        className="flex h-full max-h-[940px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-page shadow-pop outline-none"
      >
        {/* Header: title, stepper, close */}
        <div className="border-b border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5 sm:px-8">
            <p id="order-modal-title" className="font-serif text-lg font-semibold tracking-tight text-ink">
              {editing ? `Edit order: ${editing.name}` : 'New order'}
            </p>
            <div className="flex items-center gap-1">
              {canFill && (
                <Button variant="ghost" className="text-xs" onClick={fill}>
                  Fill sample
                </Button>
              )}
              <Button variant="ghost" className="text-xs" onClick={reset}>
                Clear
              </Button>
              <button onClick={close} aria-label="Close" className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink-soft hover:text-ink">
                <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
                </svg>
              </button>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto px-5 sm:px-7" aria-label="Order steps">
            {ORDER_STEPS.map((s, i) => (
              <button
                key={s.key}
                onClick={() => go(i)}
                aria-current={i === idx ? 'step' : undefined}
                className={`whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-sm transition-colors ${
                  i === idx ? 'border-ink font-semibold text-ink' : 'border-transparent font-medium text-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums ${i === idx ? 'bg-ink text-white' : 'bg-ink-soft text-muted'}`}>{i + 1}</span>
                <span className={i === idx ? '' : 'hidden sm:inline'}>{s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Current step */}
        <div ref={body} className="flex-1 overflow-y-auto px-6 py-8 sm:px-8 sm:py-9">
          <current.Screen />
        </div>

        {/* Footer: back / next, and save from the cash check on */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4 sm:px-8">
          <div>
            {idx > 0 && (
              <Button variant="secondary" onClick={() => go(idx - 1)}>
                <Arrow dir="left" /> Back
              </Button>
            )}
          </div>
          {idx < SAVE_FROM ? (
            <Button onClick={() => go(idx + 1)}>Next: {ORDER_STEPS[idx + 1].label} <Arrow dir="right" /></Button>
          ) : canSave ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              <span className="hidden text-sm text-muted md:inline">
                <b>{chosen!.supplierName} ({chosen!.country})</b>, {usd(chosen!.total)}
              </span>
              <input
                aria-label="Order name"
                className="w-60 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm transition-colors hover:border-faint focus:border-ink focus:ring-2 focus:ring-ink/15 focus:outline-none"
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
            <p className="text-sm text-muted">Add products and at least one supplier quote to save this order.</p>
          )}
        </div>
      </div>
    </div>
  )
}

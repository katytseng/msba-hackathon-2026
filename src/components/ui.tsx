import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useApp } from '../state'
import { glossary, type GlossaryKey } from '../glossary'

/**
 * ⓘ button that shows a plain-English definition from glossary.ts.
 * Hover to peek (hides when the cursor leaves); click to pin (stays until you click elsewhere or press Esc).
 * The popover renders in a portal with fixed position so table scroll areas can't clip it.
 */
export function Info({ term }: { term: GlossaryKey }) {
  const entry = glossary[term]
  const [mode, setMode] = useState<'hover' | 'pinned' | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | undefined>(undefined)
  const id = useId()
  const open = mode !== null
  const WIDTH = 272

  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8)
    setPos({ top: r.bottom + 6, left })
  }
  const cancelHide = () => window.clearTimeout(hideTimer.current)

  // Hover: show now, hide shortly after the cursor leaves (the grace period lets you move onto the popover).
  const peek = () => {
    cancelHide()
    if (mode === null) {
      place()
      setMode('hover')
    }
  }
  const unpeek = () => {
    cancelHide()
    hideTimer.current = window.setTimeout(() => setMode((m) => (m === 'hover' ? null : m)), 120)
  }

  const onClick = (e: ReactMouseEvent) => {
    // Don't let a click inside a <label> also focus the input.
    e.preventDefault()
    e.stopPropagation()
    cancelHide()
    if (mode === 'pinned') return setMode(null)
    place()
    setMode('pinned')
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMode(null)
        btn.current?.focus()
      }
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setMode(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => cancelHide, [])

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={onClick}
        onMouseEnter={peek}
        onMouseLeave={unpeek}
        aria-label={`What is ${entry.term}?`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={`ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-[-2px] text-[13px] leading-none normal-case transition ${
          mode === 'pinned' ? 'text-blue-700' : 'text-slate-400 hover:text-blue-700'
        } focus-visible:outline-2 focus-visible:outline-blue-600`}
      >
        ⓘ
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            id={id}
            role="note"
            onMouseEnter={cancelHide}
            onMouseLeave={() => mode === 'hover' && unpeek()}
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
            className="fixed z-50 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal normal-case tracking-normal text-slate-700 shadow-lg"
          >
            <p className="mb-1 text-sm font-semibold text-slate-900">{entry.term}</p>
            <p className="leading-relaxed">{entry.definition}</p>
          </div>,
          document.body,
        )}
    </>
  )
}

/** Small "Details" / "Hide details" link button for revealing a breakdown. */
export function DetailsToggle({ open, onToggle, label = 'details', controls }: { open: boolean; onToggle: () => void; label?: string; controls?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="text-xs font-medium text-blue-700 hover:underline"
    >
      {open ? `Hide ${label}` : `Show ${label}`} <span aria-hidden>{open ? '▴' : '▾'}</span>
    </button>
  )
}

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-base font-semibold text-slate-800">{title}</h2>}
      {children}
    </section>
  )
}

export function PageHeader({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Step {step}</p>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
    </div>
  )
}

/**
 * Number input that keeps what you type while you type.
 * scale=100 shows fractions as percentages (0.12 shows as 12).
 */
export function NumberField({
  label,
  value,
  onChange,
  scale = 1,
  prefix,
  suffix,
  step = 'any',
  className = '',
  compact = false,
  info,
}: {
  info?: GlossaryKey
  label?: string
  value: number
  onChange: (v: number) => void
  scale?: number
  prefix?: string
  suffix?: string
  step?: string
  className?: string
  compact?: boolean
}) {
  const shown = () => (Number.isFinite(value) ? String(+(value * scale).toFixed(6)) : '')
  const [text, setText] = useState(shown)
  useEffect(() => {
    if (parseFloat(text) / scale !== value) setText(shown())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const input = (
    <div className="flex items-center rounded-md border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
      {prefix && <span className="pl-2 text-sm text-slate-500">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        aria-label={label}
        className={`w-full min-w-0 bg-transparent px-2 ${compact ? 'py-1' : 'py-1.5'} text-right text-sm tabular-nums outline-none`}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = parseFloat(e.target.value)
          onChange(Number.isFinite(n) ? n / scale : 0)
        }}
      />
      {suffix && <span className="pr-2 text-sm text-slate-500">{suffix}</span>}
    </div>
  )
  if (!label || compact) return <div className={className}>{input}</div>
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-center text-sm font-medium text-slate-700">
        {label}
        {info && <Info term={info} />}
      </span>
      {input}
    </label>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
  type?: 'button' | 'submit'
}) {
  const styles = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800',
    secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'text-red-700 hover:bg-red-50',
  }[variant]
  return (
    <button type={type} onClick={onClick} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${styles} ${className}`}>
      {children}
    </button>
  )
}

/** Shown on result screens until there is data to calculate with. */
export function NeedsData({ children }: { children: ReactNode }) {
  const { ranked, resetToSample, error } = useApp()
  if (error)
    return (
      <Card>
        <p className="text-red-700">Something in the inputs doesn't match rates.json: {error}</p>
      </Card>
    )
  if (ranked.length === 0 || ranked[0].units === 0)
    return (
      <Card>
        <p className="mb-3 text-slate-700">Add products and at least one supplier quote first.</p>
        <div className="flex gap-2">
          <Button onClick={resetToSample}>Reset to sample</Button>
          <Link to="/business" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            Go to inputs
          </Link>
        </div>
      </Card>
    )
  return <>{children}</>
}

export function NextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <div className="mt-6 flex justify-end">
      <Link to={to} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
        {children} →
      </Link>
    </div>
  )
}

export function Callout({ tone, children }: { tone: 'good' | 'warn' | 'info'; children: ReactNode }) {
  const styles = {
    good: 'border-emerald-300 bg-emerald-50',
    warn: 'border-amber-300 bg-amber-50',
    info: 'border-blue-200 bg-blue-50',
  }[tone]
  const icon = { good: '✓', warn: '!', info: 'i' }[tone]
  const iconStyle = { good: 'bg-emerald-600', warn: 'bg-amber-500', info: 'bg-blue-600' }[tone]
  return (
    <div className={`flex gap-3 rounded-lg border p-4 ${styles}`}>
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${iconStyle}`}>
        {icon}
      </span>
      <div className="space-y-1 text-sm text-slate-800">{children}</div>
    </div>
  )
}

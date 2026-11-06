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

/**
 * Smoothly expands or collapses its content (height + fade, ~200 ms).
 * Collapsed content stays in the DOM but is inert, so it can't be focused or read out.
 */
export function Collapse({ open, children, id, className = '' }: { open: boolean; children: ReactNode; id?: string; className?: string }) {
  return (
    <div
      id={id}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      } ${className}`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/** True when the user asked the OS for less motion. */
export function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
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

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  /** Controls shown at the top right of the card, next to the title. */
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * Segmented switch: an outer track with the options, and a white pill that slides under the selected one.
 * Built on native radio buttons, so arrow keys and screen readers work.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const name = useId()
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative grid rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 rounded-md bg-white shadow-sm ring-1 ring-slate-200 transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <label key={o.value} className="relative z-10 cursor-pointer">
          <input
            type="radio"
            name={name}
            className="peer sr-only"
            checked={o.value === value}
            onChange={() => onChange(o.value)}
          />
          <span className="block whitespace-nowrap rounded-md px-2.5 py-1 text-center text-slate-500 transition-colors peer-checked:text-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 hover:text-slate-800">
            {o.label}
          </span>
        </label>
      ))}
    </div>
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

/** Click-to-expand section. Native details/summary: keyboard and screen reader friendly, closed by default. */
export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group mt-3 rounded-md border border-slate-200 bg-slate-50 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 font-medium text-blue-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
          ▸
        </span>
        {summary}
      </summary>
      <div className="px-3 pb-3 pt-1 text-slate-700">{children}</div>
    </details>
  )
}

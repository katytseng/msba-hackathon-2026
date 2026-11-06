import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state'

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
}: {
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
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
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
  const { ranked, loadSample, error } = useApp()
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
          <Button onClick={loadSample}>Load sample</Button>
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

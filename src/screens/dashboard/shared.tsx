import { useMemo, type ReactNode } from 'react'
import { addDays } from '../../engine'
import {
  analyzeOrder,
  daysBetween,
  portfolioCash,
  portfolioStart,
  type OrderAnalysis,
  type PortfolioCash,
  type SavedOrder,
} from '../../engine/portfolio'
import { rates, useApp } from '../../state'

// Categorical order colors, fixed order (dataviz reference palette, light mode).
const LANE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const laneColor = (o: SavedOrder, i: number) => LANE_COLORS[(o.color ?? i) % LANE_COLORS.length]

export const supplierLabel = (r: { supplierName: string; country: string }) => `${r.supplierName} (${r.country})`
export const todayIso = () => new Date().toISOString().slice(0, 10)

export interface Portfolio {
  startDate: string
  analyses: { a: OrderAnalysis; color: string }[]
  failed: { order: SavedOrder; error: string }[]
  pc: PortfolioCash
  colorOf: (orderId: string) => string
  nameOf: (orderId: string) => string
}

/** Every saved order costed at today's tariffs, and the one bank balance that carries them all. */
export function usePortfolio(): Portfolio {
  const { orders, company } = useApp()
  // "Cash on hand" is today's balance, so the plan starts today and only counts what is still to come.
  // If every order is in the future, it starts at the earliest one.
  const today = todayIso()
  const startDate = useMemo(() => {
    const first = portfolioStart(orders)
    return first > today ? first : today
  }, [orders, today])

  const { analyses, failed } = useMemo(() => {
    const analyses: { a: OrderAnalysis; color: string }[] = []
    const failed: { order: SavedOrder; error: string }[] = []
    orders.forEach((o, i) => {
      try {
        analyses.push({ a: analyzeOrder(o, rates, startDate), color: laneColor(o, i) })
      } catch (e) {
        failed.push({ order: o, error: (e as Error).message })
      }
    })
    return { analyses, failed }
  }, [orders, startDate])

  const { cash, buffer, apr } = company
  const pc = useMemo(() => portfolioCash(analyses.map((x) => x.a), { cash, buffer, apr }, startDate), [analyses, cash, buffer, apr, startDate])

  return {
    startDate,
    analyses,
    failed,
    pc,
    colorOf: (id) => analyses.find((x) => x.a.order.id === id)?.color ?? '#5b6678',
    nameOf: (id) => analyses.find((x) => x.a.order.id === id)?.a.order.name ?? '',
  }
}

export type Stage = 'production' | 'transit' | 'selling' | 'paidBack' | 'soldOut'

export interface OrderTrack {
  orderDate: string
  shipDate: string
  arrivalDate: string
  breakEvenDate: string | null // week the order's sales have paid back everything spent on it; null if it never does
  sellOutDate: string
  stage: Stage
  shipped: boolean
  landed: number
  salesToDate: number
  profitAtSellOut: number // gross profit once every unit sells
  nextPayment: { label: string; amount: number; date: string } | null
}

/** Where an order is today: its milestone dates, and how far its sales have paid it back. */
export function trackOrder(a: OrderAnalysis, today: string): OrderTrack {
  const orderDate = a.order.inputs.business.orderDate
  const c = a.cash
  const shipDate = addDays(orderDate, c.shipDay)
  const arrivalDate = addDays(orderDate, c.arrivalDay)
  const sellOutDate = addDays(orderDate, a.sellOutDay)

  // Cash for this order alone starts at $0, so the balance turns non-negative for good once sales cover every payment.
  let lastNeg = -1
  c.weeks.forEach((w, i) => {
    if (w.balance < -0.5) lastNeg = i
  })
  const be = lastNeg + 1 < c.weeks.length ? c.weeks[lastNeg + 1] : null
  const breakEvenDate = be ? be.date : null

  const day = daysBetween(orderDate, today)
  const salesToDate = c.weeks.filter((w) => w.startDay <= day).reduce((t, w) => t + w.inflow, 0)
  const next = c.events.filter((e) => e.day >= day).sort((x, y) => x.day - y.day)[0]

  const stage: Stage =
    today < shipDate ? 'production' : today < arrivalDate ? 'transit' : today > sellOutDate ? 'soldOut' : breakEvenDate && today >= breakEvenDate ? 'paidBack' : 'selling'

  return {
    orderDate,
    shipDate,
    arrivalDate,
    breakEvenDate,
    sellOutDate,
    stage,
    shipped: today >= shipDate,
    landed: a.placed.total,
    salesToDate,
    profitAtSellOut: c.weeks[c.weeks.length - 1]?.balance ?? 0,
    nextPayment: next ? { label: next.label, amount: -next.amount, date: addDays(orderDate, next.day) } : null,
  }
}

/** Weeks where the combined balance is under the buffer, as day ranges. */
export function belowRanges(pc: PortfolioCash, buffer: number): [number, number][] {
  const out: [number, number][] = []
  for (const w of pc.weeks) {
    if (w.balance >= buffer) continue
    const last = out[out.length - 1]
    if (last && last[1] === w.startDay) last[1] = w.startDay + 7
    else out.push([w.startDay, w.startDay + 7])
  }
  return out
}

/** Small number tile used across the dashboard tabs. */
export function Stat({ label, value, sub, tone = 'plain', children }: { label: ReactNode; value: string; sub?: ReactNode; tone?: 'plain' | 'warn' | 'good'; children?: ReactNode }) {
  const color = tone === 'warn' ? 'text-accent-ink' : tone === 'good' ? 'text-emerald-700' : 'text-ink'
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
      <dt className="flex items-center text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`text-2xl font-bold tabular-nums ${color}`}>{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
      {children}
    </div>
  )
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
}

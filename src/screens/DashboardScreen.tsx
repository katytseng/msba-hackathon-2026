import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addDays, extraRateFor } from '../engine'
import {
  analyzeOrder,
  portfolioCash,
  portfolioStart,
  reorderAdvice,
  withExtraRates,
  type OrderAnalysis,
  type ReorderAdvice,
  type PortfolioCash,
  type PortfolioWeek,
  type SavedOrder,
} from '../engine/portfolio'
import { niceDate, num, pct, shortDate, usd } from '../format'
import { rates, useApp } from '../state'
import { Button, Card, Details, NumberField } from '../components/ui'

// Categorical lane colors, fixed order (dataviz reference palette, light mode).
const LANE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const laneColor = (o: SavedOrder, i: number) => LANE_COLORS[(o.color ?? i) % LANE_COLORS.length]
const SAME = 0.0005
const RANGE_ABOVE_TODAY = 0.3

const supplierLabel = (r: { supplierName: string; country: string }) => `${r.supplierName} (${r.country})`

export default function DashboardScreen() {
  const { orders, company, setCompany, startNewOrder, addSampleOrders } = useApp()
  const navigate = useNavigate()
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const countries = useMemo(
    () => [...new Set(orders.flatMap((o) => o.inputs.suppliers.map((s) => s.country)))].filter((c) => rates.extraTariffs[c]),
    [orders],
  )
  const scenarioRates = useMemo(() => withExtraRates(rates, overrides), [overrides])
  const startDate = useMemo(() => portfolioStart(orders), [orders])

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

  // Future state only: placed orders don't change, this says who to use if you order the same thing again.
  const advice = useMemo(
    () => analyses.map(({ a, color }) => ({ r: reorderAdvice(a.order, rates, scenarioRates), color })),
    [analyses, scenarioRates],
  )

  const pc = useMemo(() => portfolioCash(analyses.map((x) => x.a), company, startDate), [analyses, company, startDate])
  const colorOf = (orderId: string) => analyses.find((x) => x.a.order.id === orderId)?.color ?? '#64748b'
  const nameOf = (orderId: string) => analyses.find((x) => x.a.order.id === orderId)?.a.order.name ?? ''

  const newOrder = () => {
    startNewOrder()
    navigate('/order/business')
  }

  if (orders.length === 0) {
    return (
      <div>
        <DashHeader onNew={newOrder} />
        <Card>
          <p className="mb-1 font-semibold text-slate-900">No saved orders yet.</p>
          <p className="mb-4 text-sm text-slate-600">
            Work through steps 1 to 5 for an order, pick a supplier, then click <b>Save order</b>. Each saved order shows up here as a lane, and all of
            them are checked against one bank balance.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={newOrder}>Start an order</Button>
            <Button variant="secondary" onClick={addSampleOrders}>
              Add 3 sample orders
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Shared time axis for the lanes: through the last payment or arrival, plus a month of sales.
  const horizon =
    Math.max(...analyses.map(({ a }) => a.offsetDays + Math.max(a.lastPaymentDay, a.cash.arrivalDay)), 28) + 35
  const committed = analyses.reduce((t, { a }) => t + a.placed.total, 0)

  return (
    <div>
      <DashHeader onNew={newOrder} />
      <Verdict pc={pc} company={company} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Swim lanes */}
        <section aria-label="Orders" className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-800">
              Orders <span className="font-normal text-slate-500">({analyses.length})</span>
            </h2>
            <p className="text-xs text-slate-500">{usd(committed)} committed, at today's tariffs</p>
          </div>
          <TimeAxis startDate={startDate} horizon={horizon} pc={pc} buffer={company.buffer} />
          {analyses.map(({ a, color }, i) => (
            <Lane key={a.order.id} a={a} index={i} color={color} startDate={startDate} horizon={horizon} pc={pc} buffer={company.buffer} />
          ))}
          {failed.map(({ order, error }) => (
            <div key={order.id} className="border-t border-slate-200 px-4 py-3 text-sm text-red-700">
              {order.name}: can't calculate ({error}).
            </div>
          ))}
          <div className="border-t border-slate-200 px-4 py-3">
            <button onClick={newOrder} className="text-sm font-medium text-blue-700 hover:underline">
              + Add another order
            </button>
          </div>
        </section>

        <div className="space-y-5">
          <TariffPanel countries={countries} overrides={overrides} setOverrides={setOverrides} advice={advice} />
          <CashPanel pc={pc} company={company} setCompany={setCompany} colorOf={colorOf} nameOf={nameOf} />
        </div>
      </div>
    </div>
  )
}

function DashHeader({ onNew }: { onNew: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Dashboard</p>
        <h1 className="text-2xl font-bold text-slate-900">Your orders and cash</h1>
        <p className="mt-1 text-slate-600">Your placed orders on one timeline and one bank balance, plus a tariff planner for what to order next.</p>
      </div>
      <Button onClick={onNew}>+ New order</Button>
    </div>
  )
}

/** The headline: do you need to borrow, how much, and by when. */
function Verdict({ pc, company }: { pc: PortfolioCash; company: { buffer: number; apr: number } }) {
  const wk = (w: number | null) => (w === null ? null : pc.weeks[w])
  const first = wk(pc.firstBelowWeek)
  const back = wk(pc.backAboveWeek)
  const low = pc.weeks[pc.lowestWeek]
  const basis = `Based on the orders you've placed, at today's tariffs. The tariff sliders don't change this; they plan your next orders.`

  if (pc.shortfall > 0) {
    const line = Math.ceil(pc.shortfall / 1000) * 1000
    return (
      <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-xl font-bold text-slate-900">
            <span aria-hidden className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-sm text-white">!</span>
            Borrow about {usd(line)}{first ? ` by ${niceDate(first.date)}` : ''}.
          </p>
          <p className="text-sm text-slate-700">Est. interest {usd(pc.interest)} at {pct(company.apr, 0)} APR</p>
        </div>
        <p className="mt-1 text-sm text-slate-700">
          Your cash falls to <b>{usd(pc.lowest)}</b> in the week of {niceDate(low.date)}, {usd(pc.shortfall)} below your {usd(company.buffer)} safety buffer
          {pc.goesNegative ? ' and below zero' : ''}. You are under the buffer for {pc.weeksBelowBuffer} {pc.weeksBelowBuffer === 1 ? 'week' : 'weeks'} in total
          {back ? `, and back above it for good around ${niceDate(back.date)}, when you can repay` : ', and do not recover within the plan'}.
        </p>
        <p className="mt-1 text-xs text-slate-500">{basis}</p>
      </div>
    )
  }
  return (
    <div className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4" aria-live="polite">
      <p className="text-xl font-bold text-slate-900">
        <span aria-hidden className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">✓</span>
        No loan needed.
      </p>
      <p className="mt-1 text-sm text-slate-700">
        Lowest balance is <b>{usd(pc.lowest)}</b> in the week of {niceDate(low.date)}, {usd(pc.lowest - company.buffer)} above your {usd(company.buffer)} safety buffer.
      </p>
      <p className="mt-1 text-xs text-slate-500">{basis}</p>
    </div>
  )
}

// ---------- Swim lanes ----------

const LABEL_COL = 'w-8 shrink-0'
const posPct = (day: number, horizon: number) => `${Math.min(100, Math.max(0, (day / horizon) * 100))}%`

/** Weeks where the combined balance is under the buffer, as day ranges, for shading behind the lanes. */
function belowRanges(pc: PortfolioCash, buffer: number): [number, number][] {
  const out: [number, number][] = []
  for (const w of pc.weeks) {
    if (w.balance >= buffer) continue
    const last = out[out.length - 1]
    if (last && last[1] === w.startDay) last[1] = w.startDay + 7
    else out.push([w.startDay, w.startDay + 7])
  }
  return out
}

function DipShading({ pc, buffer, horizon }: { pc: PortfolioCash; buffer: number; horizon: number }) {
  return (
    <>
      {belowRanges(pc, buffer).map(([a, b]) =>
        a < horizon ? (
          <div
            key={a}
            aria-hidden
            className="absolute inset-y-0 bg-amber-200/40"
            style={{ left: posPct(a, horizon), width: `calc(${posPct(Math.min(b, horizon), horizon)} - ${posPct(a, horizon)})` }}
          />
        ) : null,
      )}
    </>
  )
}

function TimeAxis({ startDate, horizon, pc, buffer }: { startDate: string; horizon: number; pc: PortfolioCash; buffer: number }) {
  // A tick at the first of each month inside the horizon.
  const ticks: { day: number; label: string }[] = []
  const start = new Date(startDate + 'T00:00:00Z')
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  while (true) {
    const day = Math.round((d.getTime() - start.getTime()) / 86_400_000)
    if (day > horizon) break
    ticks.push({ day, label: d.toLocaleDateString('en-US', { month: 'short', year: d.getUTCMonth() === 0 ? 'numeric' : undefined, timeZone: 'UTC' }) })
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  const hasDip = pc.shortfall > 0
  return (
    <div className="flex border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
      <div className={LABEL_COL} />
      <div className="px-4 py-1.5 flex-1">
        <div className="relative h-4">
          <span className="absolute left-0">{shortDate(startDate)}</span>
          {ticks.map((t) => (
            <span key={t.day} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: posPct(t.day, horizon) }}>
              {t.label}
            </span>
          ))}
        </div>
        {hasDip && (
          <p className="mt-0.5 flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-4 rounded-sm bg-amber-200" /> Weeks your combined cash is under the {usd(buffer)} buffer
          </p>
        )}
      </div>
    </div>
  )
}

function Lane({
  a,
  index,
  color,
  startDate,
  horizon,
  pc,
  buffer,
}: {
  a: OrderAnalysis
  index: number
  color: string
  startDate: string
  horizon: number
  pc: PortfolioCash
  buffer: number
}) {
  const { editOrder, deleteOrder } = useApp()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const o = a.order
  const p = a.placed

  // Timeline geometry, all in portfolio days.
  const off = a.offsetDays
  const arrival = off + a.cash.arrivalDay
  const salesStart = off + a.cash.salesStartWeek * 7
  const sellOut = off + a.sellOutDay
  const maxPay = Math.max(...sameDay(a).map((g) => g.total), 1)

  return (
    <div className="flex border-t border-slate-200 first-of-type:border-t-0">
      {/* Vertical lane label, like the wireframe */}
      <div className={`${LABEL_COL} flex items-center justify-center border-l-4 border-r border-r-slate-200`} style={{ borderLeftColor: color, background: `${color}1f` }}>
        <span className="rotate-180 text-[11px] font-semibold uppercase tracking-wider text-slate-700 [writing-mode:vertical-rl]">Order {index + 1}</span>
      </div>

      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900">{o.name}</h3>
            <p className="text-xs text-slate-500">
              Ordered {niceDate(o.inputs.business.orderDate)} · {num(p.units)} units · arrives {shortDate(addDays(o.inputs.business.orderDate, a.cash.arrivalDay))}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              className="!px-2 !py-1 text-xs"
              onClick={() => {
                editOrder(o.id)
                navigate('/order/compare')
              }}
            >
              Edit
            </Button>
            {confirmDelete ? (
              <>
                <Button variant="danger" className="!px-2 !py-1 text-xs" onClick={() => deleteOrder(o.id)}>
                  Delete it
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm sm:grid-cols-4">
          <LaneFact label="Supplier" value={supplierLabel(p)} />
          <LaneFact label="Landed cost" value={usd(p.total)} />
          <LaneFact label="Per unit" value={usd(p.avgUnit, true)} />
          <LaneFact label="Tariffs paid" value={usd(p.baseDuty + p.extraDuty)} />
        </dl>

        {/* Timeline strip on the shared axis */}
        <div className="relative h-12 rounded-md bg-slate-50" role="img" aria-label={laneSummary(a, startDate)}>
          <DipShading pc={pc} buffer={buffer} horizon={horizon} />
          {/* order placed -> arrival */}
          <div className="absolute top-[18px] h-0.5 bg-slate-300" style={{ left: posPct(off, horizon), width: `calc(${posPct(arrival, horizon)} - ${posPct(off, horizon)})` }} />
          {/* selling period */}
          <div
            className="absolute top-[14px] h-2.5 rounded-r-full opacity-30"
            style={{ background: color, left: posPct(salesStart, horizon), width: `calc(${posPct(Math.min(sellOut, horizon), horizon)} - ${posPct(salesStart, horizon)})` }}
          />
          {salesStart < horizon && (
            <span className="absolute top-[28px] whitespace-nowrap text-[10px] text-slate-500" style={{ left: posPct(salesStart, horizon) }}>
              selling{sellOut > horizon ? ` until ${shortDate(addDays(startDate, sellOut))} →` : ''}
            </span>
          )}
          {/* arrival */}
          <Marker day={arrival} horizon={horizon} tip={`Arrives ${niceDate(addDays(startDate, arrival))}`}>
            <span className="block h-3 w-3 rotate-45 border-2 border-white bg-slate-600" />
          </Marker>
          {/* payments, sized by amount */}
          {sameDay(a).map(({ day, total, labels }) => {
            const size = 10 + 12 * Math.sqrt(total / maxPay)
            return (
              <Marker key={day} day={off + day} horizon={horizon} tip={`${niceDate(addDays(startDate, off + day))}: ${labels.join(', ')}`}>
                <span className="block rounded-full border-2 border-white" style={{ width: size, height: size, background: color }} />
              </Marker>
            )
          })}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Dots are payments (bigger = more cash out). Diamond is arrival. Hover for amounts.
        </p>
      </div>
    </div>
  )
}

function LaneFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="truncate font-medium tabular-nums text-slate-900">{value}</dd>
    </div>
  )
}

/** Payments on the same day share one dot. */
function sameDay(a: OrderAnalysis) {
  const groups = new Map<number, { day: number; total: number; labels: string[] }>()
  for (const e of a.cash.events) {
    const g = groups.get(e.day) ?? { day: e.day, total: 0, labels: [] }
    g.total += -e.amount
    g.labels.push(`${e.label.toLowerCase()} ${usd(-e.amount)}`)
    groups.set(e.day, g)
  }
  return [...groups.values()]
}

function laneSummary(a: OrderAnalysis, startDate: string) {
  const pays = a.cash.events.map((e) => `${e.label} ${usd(-e.amount)} on ${shortDate(addDays(startDate, a.offsetDays + e.day))}`).join('; ')
  return `${a.order.name} timeline: ${pays}; arrives ${shortDate(addDays(startDate, a.offsetDays + a.cash.arrivalDay))}.`
}

function Marker({ day, horizon, tip, children }: { day: number; horizon: number; tip: string; children: ReactNode }) {
  if (day > horizon) return null
  return (
    <div className="group absolute top-[19px] z-10 -translate-x-1/2 -translate-y-1/2 p-1.5" style={{ left: posPct(day, horizon) }}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 shadow-md group-hover:block">
        {tip}
      </span>
    </div>
  )
}

// ---------- Tariff panel ----------

function TariffPanel({
  countries,
  overrides,
  setOverrides,
  advice,
}: {
  countries: string[]
  overrides: Record<string, number>
  setOverrides: (fn: (m: Record<string, number>) => Record<string, number>) => void
  advice: { r: ReorderAdvice; color: string }[]
}) {
  const rateOf = (c: string) => overrides[c] ?? extraRateFor(rates, c)
  const setRate = (c: string, r: number) => setOverrides((m) => ({ ...m, [c]: Math.max(0, Math.round(r * 1000) / 1000) }))
  const moved = countries.some((c) => Math.abs(rateOf(c) - extraRateFor(rates, c)) > SAME)
  const changes = advice.filter(({ r }) => r.savings > 0.5)

  return (
    <Card title="Tariffs: plan your next orders">
      <p className="-mt-2 mb-3 text-xs text-slate-500">
        Placed orders stay as they are. Set the tariffs you expect and see who to order from if you buy the same items again.
      </p>
      <div className="space-y-3">
        {countries.map((c) => {
          const today = extraRateFor(rates, c)
          const r = rateOf(c)
          const max = today + RANGE_ABOVE_TODAY
          const changed = Math.abs(r - today) > SAME
          return (
            <div key={c}>
              <div className="flex items-baseline justify-between text-sm">
                <label htmlFor={`dash-tariff-${c}`} className="font-medium text-slate-800">
                  {c}
                </label>
                <span className="tabular-nums">
                  <b className={changed ? 'text-blue-800' : 'text-slate-900'}>{pct(r)}</b>
                  <span className="ml-1.5 text-xs text-slate-500">today {pct(today)}</span>
                </span>
              </div>
              <input
                id={`dash-tariff-${c}`}
                type="range"
                min={0}
                max={max * 100}
                step={0.5}
                value={r * 100}
                aria-valuetext={pct(r)}
                onChange={(e) => setRate(c, parseFloat(e.target.value) / 100)}
                className="w-full accent-blue-700"
              />
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant={moved ? 'secondary' : 'primary'} className="!px-2 !py-1 text-xs" onClick={() => setOverrides(() => ({}))}>
          Today's rates
        </Button>
        <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setOverrides(() => Object.fromEntries(countries.map((c) => [c, extraRateFor(rates, c) + 0.1])))}>
          All +10 points
        </Button>
        <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setOverrides(() => Object.fromEntries(countries.map((c) => [c, 0])))}>
          All removed
        </Button>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3" aria-live="polite">
        <p className="text-sm font-semibold text-slate-900">If you reorder {moved ? 'at these tariffs' : 'at today’s tariffs'}</p>
        <p className="mb-2 text-xs text-slate-500">
          {changes.length === 0
            ? 'Stay with the same supplier for every order.'
            : `Use a different supplier for ${changes.length} of ${advice.length} ${advice.length === 1 ? 'order' : 'orders'}.`}
        </p>
        <ul className="space-y-2">
          {advice.map(({ r, color }) => {
            const better = r.savings > 0.5
            return (
              <li key={r.order.id} className={`rounded-md border px-3 py-2 text-sm ${better ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="truncate">{r.order.name}</span>
                </p>
                {better ? (
                  <>
                    <p className="font-medium text-slate-900">
                      Order from {supplierLabel(r.best)} <span className="font-normal text-slate-500">instead of {r.same.supplierName}</span>
                    </p>
                    <p className="text-xs tabular-nums text-slate-700">
                      {usd(r.best.total)}, saves <b>{usd(r.savings)}</b>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-slate-900">✓ Stay with {supplierLabel(r.best)}</p>
                    <p className="text-xs tabular-nums text-slate-700">
                      {usd(r.best.total)}
                      {r.ranked[1] ? `, ${usd(r.ranked[1].total - r.best.total)} less than ${r.ranked[1].supplierName}` : ''}
                    </p>
                  </>
                )}
                {Math.round(r.vsToday) !== 0 && (
                  <p className={`text-xs ${r.vsToday > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {usd(Math.abs(r.vsToday))} {r.vsToday > 0 ? 'more' : 'less'} than this order cost
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}

// ---------- Cash flow panel ----------

function CashPanel({
  pc,
  company,
  setCompany,
  colorOf,
  nameOf,
}: {
  pc: PortfolioCash
  company: { cash: number; buffer: number; apr: number }
  setCompany: (p: Partial<{ cash: number; buffer: number; apr: number }>) => void
  colorOf: (id: string) => string
  nameOf: (id: string) => string
}) {
  const [showAll, setShowAll] = useState(false)
  // Default view: the risk period, through the last week under the buffer (or the low point) plus a few weeks.
  const lastBelow = [...pc.weeks].reverse().find((w) => w.balance < company.buffer)?.week
  const riskEnd = Math.max(lastBelow ?? pc.lowestWeek, pc.lowestWeek) + 5
  const end = showAll ? pc.weeks.length : Math.min(pc.weeks.length, Math.max(riskEnd, 8))
  const shown = pc.weeks.slice(0, end)
  const dips = belowRanges(pc, company.buffer).map(([a, b]) => [a / 7, b / 7 - 1] as const)

  // Biggest payments up to the low point: what is driving the dip.
  const drivers = pc.weeks
    .slice(0, pc.lowestWeek + 1)
    .flatMap((w) => w.events)
    .sort((x, y) => x.amount - y.amount)
    .slice(0, 4)

  return (
    <Card title="Cash flow">
      <p className="-mt-2 mb-2 text-xs text-slate-500">Placed orders, one bank balance.</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={shown} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            {dips
              .filter(([a]) => a < end)
              .map(([a, b]) => (
                <ReferenceArea key={a} x1={a} x2={Math.min(b, end - 1)} fill="#fde68a" fillOpacity={0.5} ifOverflow="hidden" />
              ))}
            <XAxis
              dataKey="week"
              tickFormatter={(w) => shortDate(pc.weeks[w]?.date ?? pc.startDate)}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              minTickGap={24}
            />
            <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<WeekTip nameOf={nameOf} colorOf={colorOf} />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
            <ReferenceLine y={company.buffer} stroke="#64748b" strokeDasharray="6 4" label={{ value: `Buffer ${usd(company.buffer)}`, position: 'insideBottomLeft', fontSize: 11, fill: '#475569' }} />
            {pc.goesNegative && <ReferenceLine y={0} stroke="#b91c1c" />}
            <Line type="linear" dataKey="balance" stroke="#1d4ed8" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            {pc.lowestWeek < end && <ReferenceDot x={pc.lowestWeek} y={pc.lowest} r={5} fill="#b45309" stroke="#fff" strokeWidth={2} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mb-3 flex justify-between gap-2 text-[11px] text-slate-500">
        <span>Combined balance, end of each week.{dips.length > 0 ? ' Shaded: under buffer.' : ''}</span>
        {pc.weeks.length > end || showAll ? (
          <button className="shrink-0 whitespace-nowrap font-medium text-blue-700 underline" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Zoom to the risk period' : 'Show the full plan'}
          </button>
        ) : null}
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Lowest balance" value={usd(pc.lowest)} sub={`week of ${shortDate(pc.weeks[pc.lowestWeek].date)}`} warn={pc.shortfall > 0} />
        <Stat
          label={pc.shortfall > 0 ? 'Need to borrow' : 'Headroom'}
          value={usd(pc.shortfall > 0 ? pc.shortfall : pc.lowest - company.buffer)}
          sub={pc.shortfall > 0 ? `for ${pc.weeksBelowBuffer} wk, ~${usd(pc.interest)} interest` : 'above buffer'}
          warn={pc.shortfall > 0}
        />
      </dl>

      {drivers.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Biggest payments before the low point</p>
          <ul className="space-y-1 text-xs">
            {drivers.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(e.orderId) }} />
                  <span className="truncate text-slate-700">
                    {nameOf(e.orderId)}: {e.label.toLowerCase()}, {shortDate(addDays(pc.startDate, e.day))}
                  </span>
                </span>
                <span className="tabular-nums text-slate-900">{usd(-e.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Details summary="Company cash settings">
        <p className="mb-2 text-xs text-slate-500">All orders draw on this one balance, starting {niceDate(pc.startDate)} (your earliest order).</p>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Cash" prefix="$" value={company.cash} onChange={(v) => setCompany({ cash: v })} />
          <NumberField label="Buffer" prefix="$" value={company.buffer} onChange={(v) => setCompany({ buffer: v })} />
          <NumberField label="APR" suffix="%" scale={100} value={company.apr} onChange={(v) => setCompany({ apr: v })} />
        </div>
      </Details>
      <WeekTable pc={pc} buffer={company.buffer} nameOf={nameOf} />
    </Card>
  )
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub: string; warn: boolean }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-lg font-bold tabular-nums ${warn ? 'text-amber-800' : 'text-slate-900'}`}>{value}</dd>
      <dd className="text-[11px] text-slate-500">{sub}</dd>
    </div>
  )
}

function WeekTip({ active, payload, nameOf, colorOf }: { active?: boolean; payload?: { payload: PortfolioWeek }[]; nameOf: (id: string) => string; colorOf: (id: string) => string }) {
  if (!active || !payload?.length) return null
  const w = payload[0].payload
  return (
    <div className="max-w-64 rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-md">
      <p className="font-semibold text-slate-900">Week of {shortDate(w.date)}</p>
      <p className="tabular-nums text-slate-700">Balance: {usd(w.balance)}</p>
      {w.inflow > 0 && <p className="tabular-nums text-slate-600">Sales in: {usd(w.inflow)}</p>}
      {w.events.map((e, i) => (
        <p key={i} className="flex items-center gap-1 tabular-nums text-slate-600">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(e.orderId) }} />
          {nameOf(e.orderId)}, {e.label.toLowerCase()}: {usd(e.amount)}
        </p>
      ))}
    </div>
  )
}

function WeekTable({ pc, buffer, nameOf }: { pc: PortfolioCash; buffer: number; nameOf: (id: string) => string }) {
  return (
    <Details summary="Week-by-week table">
      <div className="max-h-72 overflow-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-xs tabular-nums">
          <caption className="sr-only">Combined cash by week</caption>
          <thead className="sticky top-0 bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-2 py-1">Week of</th>
              <th className="px-2 py-1 text-right">In</th>
              <th className="px-2 py-1 text-right">Out</th>
              <th className="px-2 py-1 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {pc.weeks.map((w) => (
              <tr key={w.week} className={`border-t border-slate-100 ${w.balance < buffer ? 'bg-amber-50' : ''}`} title={w.events.map((e) => `${nameOf(e.orderId)}: ${e.label}`).join('\n')}>
                <td className="px-2 py-1">{shortDate(w.date)}</td>
                <td className="px-2 py-1 text-right">{w.inflow ? usd(w.inflow) : ''}</td>
                <td className="px-2 py-1 text-right">{w.outflow ? usd(w.outflow) : ''}</td>
                <td className={`px-2 py-1 text-right ${w.week === pc.lowestWeek ? 'font-semibold' : ''}`}>{usd(w.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Details>
  )
}

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addDays } from '../../engine'
import type { PortfolioCash, PortfolioWeek } from '../../engine/portfolio'
import { niceDate, pct, shortDate, usd } from '../../format'
import { APR_PRESETS, useApp } from '../../state'
import { Card, Info, NumberField, Segmented, StatusIcon, usePrefersReducedMotion } from '../../components/ui'
import { belowRanges, Dot, Stat, todayIso, type Portfolio } from './shared'

// Chart colors mirror the tokens in index.css (Recharts needs plain values).
const INK = '#14284b'
const MUTED = '#686257'
const ACCENT = '#f28c0a'
const GRID = '#ece6d8'
const AXIS = '#d9d0bd'

export default function FinancesTab({ p }: { p: Portfolio }) {
  const { company, orders } = useApp()
  const pc = p.pc
  const has = orders.length > 0 && p.analyses.length > 0

  return (
    <div>
      {has && <Verdict pc={pc} />}

      {/* Cash settings sit beside the chart they drive, so changing one shows its effect right away. */}
      <div className="mb-12 grid items-start gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <CompanyCard startDate={has ? pc.startDate : null} />
        {has ? (
          <CashChart p={p} />
        ) : (
          <Card>
            <p className="text-sm text-muted">Save an order to see your combined cash flow here.</p>
          </Card>
        )}
      </div>

      {has && (
        <>
          <dl className="mb-14 grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4 lg:gap-x-10">
            <Stat label={<>Lowest balance<Info term="lowestBalance" /></>} value={usd(pc.lowest)} sub={`week of ${niceDate(pc.weeks[pc.lowestWeek].date)}`} tone={pc.shortfall > 0 ? 'warn' : 'plain'} />
            <Stat
              label={pc.shortfall > 0 ? <>Need to borrow<Info term="belowBuffer" /></> : <>Headroom<Info term="headroom" /></>}
              value={usd(pc.shortfall > 0 ? pc.shortfall : pc.lowest - company.buffer)}
              sub={pc.shortfall > 0 ? `to stay at your ${usd(company.buffer)} buffer` : `above your ${usd(company.buffer)} buffer`}
              tone={pc.shortfall > 0 ? 'warn' : 'good'}
            />
            <Stat label={<>Weeks under buffer<Info term="weeksBelowBuffer" /></>} value={String(pc.weeksBelowBuffer)} sub={pc.weeksBelowBuffer > 0 ? 'in total across the plan' : 'none'} />
            <Stat label={<>Interest to bridge<Info term="interest" /></>} value={usd(pc.interest)} sub={`at ${pct(company.apr, 0)} APR`} />
          </dl>
          <div className="mb-12 grid items-start gap-8 md:grid-cols-2">
            <ComingUp p={p} />
            <Drivers p={p} />
          </div>
          <WeekTable p={p} />
        </>
      )}
    </div>
  )
}

/** The headline: do you need to borrow, how much, and by when. */
function Verdict({ pc }: { pc: PortfolioCash }) {
  const { company } = useApp()
  const wk = (w: number | null) => (w === null ? null : pc.weeks[w])
  const first = wk(pc.firstBelowWeek)
  const back = wk(pc.backAboveWeek)
  const low = pc.weeks[pc.lowestWeek]
  const basis = `Based on what is still to pay and still to sell on your saved orders, at today's tariffs, starting from your cash on hand on ${niceDate(pc.startDate)}.`

  if (pc.shortfall > 0) {
    const line = Math.ceil(pc.shortfall / 1000) * 1000
    return (
      <div className="mb-12 rounded-card border border-accent-line bg-accent-soft px-5 py-6 sm:px-8" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="flex items-center gap-3 font-serif text-[1.5rem] leading-8 font-semibold tracking-tight text-ink">
            <StatusIcon tone="warn" className="h-7 w-7" />
            Borrow about {usd(line)}
            {first ? ` by ${niceDate(first.date)}` : ''}.
          </p>
          <p className="text-sm text-copy">
            Est. interest <span className="font-medium tabular-nums text-ink">{usd(pc.interest)}</span> at {pct(company.apr, 0)} APR
          </p>
        </div>
        <p className="mt-3 max-w-[78ch] text-sm leading-6 text-copy">
          Your cash falls to <b>{usd(pc.lowest)}</b> in the week of {niceDate(low.date)}, {usd(pc.shortfall)} below your {usd(company.buffer)} safety buffer
          {pc.goesNegative ? ' and below zero' : ''}. You are under the buffer for {pc.weeksBelowBuffer} {pc.weeksBelowBuffer === 1 ? 'week' : 'weeks'} in total
          {back ? `, and back above it for good around ${niceDate(back.date)}, when you can repay` : ', and do not recover within the plan'}.
        </p>
        <p className="mt-3 max-w-[78ch] text-xs leading-5 text-muted">{basis}</p>
      </div>
    )
  }
  return (
    <div className="mb-12 rounded-card border border-good-line bg-good-soft px-5 py-6 sm:px-8" aria-live="polite">
      <p className="flex items-center gap-3 font-serif text-[1.5rem] leading-8 font-semibold tracking-tight text-ink">
        <StatusIcon tone="good" className="h-7 w-7" />
        No loan needed.
      </p>
      <p className="mt-3 max-w-[78ch] text-sm leading-6 text-copy">
        Lowest balance is <b>{usd(pc.lowest)}</b> in the week of {niceDate(low.date)}, {usd(pc.lowest - company.buffer)} above your {usd(company.buffer)} safety buffer.
      </p>
      <p className="mt-3 max-w-[78ch] text-xs leading-5 text-muted">{basis}</p>
    </div>
  )
}

/** Cash on hand, safety buffer and loan APR: one set for the whole company, used by every order. */
function CompanyCard({ startDate }: { startDate: string | null }) {
  const { company, setCompany } = useApp()
  return (
    <Card title="Company overview">
      <div className="space-y-5">
        <NumberField label="Cash on hand" info="cash" prefix="$" value={company.cash} onChange={(v) => setCompany({ cash: v })} />
        <NumberField label="Desired safety buffer" info="buffer" prefix="$" value={company.buffer} onChange={(v) => setCompany({ buffer: v })} />
        <div>
          <NumberField label="Loan APR" info="apr" suffix="%" scale={100} value={company.apr} onChange={(v) => setCompany({ apr: v })} />
          <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="APR presets">
            {APR_PRESETS.map((r) => {
              const active = Math.abs(company.apr - r) < 1e-9
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCompany({ apr: r })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors ${
                    active ? 'border-ink bg-ink text-white' : 'border-line-strong text-muted hover:bg-ink-soft hover:text-ink'
                  }`}
                >
                  {Math.round(r * 100)}%
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <p className="mt-6 border-t border-line pt-5 text-xs leading-5 text-muted">
        Cash on hand is what's in the bank on {startDate ? niceDate(startDate) : 'today'}; every order's remaining payments and sales run through it. The safety buffer is the lowest balance you're
        comfortable with; we flag any week you fall below it. New orders use these numbers too.
      </p>
    </Card>
  )
}

function CashChart({ p }: { p: Portfolio }) {
  const { company } = useApp()
  const pc = p.pc
  const [period, setPeriod] = useState<'risk' | 'all'>('all')
  const reducedMotion = usePrefersReducedMotion()
  // Zoomed view: the risk period, through the last week under the buffer (or the low point) plus a few weeks.
  const lastBelow = [...pc.weeks].reverse().find((w) => w.balance < company.buffer)?.week
  const riskEnd = Math.max(lastBelow ?? pc.lowestWeek, pc.lowestWeek) + 5
  const canZoom = pc.weeks.length > Math.max(riskEnd, 8)
  const end = period === 'all' || !canZoom ? pc.weeks.length : Math.min(pc.weeks.length, Math.max(riskEnd, 8))
  const shown = pc.weeks.slice(0, end)
  const dips = belowRanges(pc, company.buffer).map(([a, b]) => [a / 7, b / 7 - 1] as const)
  const todayWeek = Math.floor((Date.parse(todayIso()) - Date.parse(pc.startDate)) / (7 * 86_400_000))

  return (
    <Card
      title="Cash flow"
      actions={
        canZoom ? (
          <Segmented
            label="Weeks shown"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'risk', label: 'Risk period' },
              { value: 'all', label: `All ${pc.weeks.length} weeks` },
            ]}
          />
        ) : null
      }
    >
      <p className="-mt-3 mb-5 text-[0.8125rem] text-muted">Combined bank balance at the end of each week, all saved orders.{dips.length > 0 ? ' Shaded: under your buffer.' : ''}</p>
      <div className="h-[22rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={shown} margin={{ top: 16, right: 16, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            {dips
              .filter(([a]) => a < end)
              .map(([a, b]) => (
                <ReferenceArea key={a} x1={a} x2={Math.min(b, end - 1)} fill={ACCENT} fillOpacity={0.12} ifOverflow="hidden" />
              ))}
            <XAxis
              dataKey="week"
              tickFormatter={(w) => shortDate(pc.weeks[w]?.date ?? pc.startDate)}
              tick={{ fontSize: 12, fill: MUTED }}
              tickLine={false}
              axisLine={{ stroke: AXIS }}
              minTickGap={28}
            />
            <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: MUTED }} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<WeekTip nameOf={p.nameOf} colorOf={p.colorOf} />} cursor={{ stroke: '#a8a090', strokeWidth: 1 }} />
            <ReferenceLine
              y={company.buffer}
              stroke={MUTED}
              strokeDasharray="6 4"
              label={{ value: `Buffer ${usd(company.buffer)}`, position: 'insideBottomLeft', fontSize: 12, fill: '#38405a' }}
            />
            {todayWeek > 0 && todayWeek < end && (
              <ReferenceLine x={todayWeek} stroke={AXIS} label={{ value: 'Today', position: 'top', fontSize: 11, fill: MUTED }} />
            )}
            {pc.goesNegative && <ReferenceLine y={0} stroke="#a33b2b" />}
            <Line
              type="linear"
              dataKey="balance"
              stroke={INK}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={!reducedMotion}
              animationDuration={250}
              animationEasing="ease-out"
            />
            {pc.lowestWeek < end && <ReferenceDot x={pc.lowestWeek} y={pc.lowest} r={5} fill={ACCENT} stroke="#fffdf8" strokeWidth={2} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function WeekTip({ active, payload, nameOf, colorOf }: { active?: boolean; payload?: { payload: PortfolioWeek }[]; nameOf: (id: string) => string; colorOf: (id: string) => string }) {
  if (!active || !payload?.length) return null
  const w = payload[0].payload
  return (
    <div className="max-w-72 rounded-xl border border-line bg-surface px-3.5 py-3 text-xs leading-5 shadow-pop">
      <p className="font-semibold text-ink">Week of {shortDate(w.date)}</p>
      <p className="tabular-nums text-copy">Balance: {usd(w.balance)}</p>
      {w.inflow > 0 && <p className="tabular-nums text-muted">Sales in: {usd(w.inflow)}</p>}
      {w.events.map((e, i) => (
        <p key={i} className="flex items-center gap-1 tabular-nums text-muted">
          <Dot color={colorOf(e.orderId)} size={8} />
          {nameOf(e.orderId)}, {e.label.toLowerCase()}: {usd(e.amount)}
        </p>
      ))}
    </div>
  )
}

function PaymentList({ items, p }: { items: { orderId: string; label: string; amount: number; day: number }[]; p: Portfolio }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {items.map((e, i) => (
        <li key={i} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <span className="flex min-w-0 items-center gap-2">
            <Dot color={p.colorOf(e.orderId)} />
            <span className="min-w-0">
              <span className="block truncate text-ink">
                {p.nameOf(e.orderId)}: {e.label.toLowerCase()}
              </span>
              <span className="block text-xs text-muted">{niceDate(addDays(p.pc.startDate, e.day))}</span>
            </span>
          </span>
          <span className="shrink-0 text-right font-medium tabular-nums text-ink">{usd(-e.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

function ComingUp({ p }: { p: Portfolio }) {
  const today = todayIso()
  const next = p.pc.weeks
    .flatMap((w) => w.events)
    .filter((e) => addDays(p.pc.startDate, e.day) >= today)
    .sort((a, b) => a.day - b.day)
  const total = next.reduce((t, e) => t - e.amount, 0)
  return (
    <Card title="Coming up" actions={next.length > 0 ? <span className="text-xs text-muted">{usd(total)} still to pay</span> : null}>
      {next.length === 0 ? <p className="text-sm text-muted">Nothing left to pay on your saved orders.</p> : <PaymentList items={next.slice(0, 6)} p={p} />}
      {next.length > 6 && <p className="mt-4 text-xs text-muted">and {next.length - 6} more in the week-by-week table.</p>}
    </Card>
  )
}

function Drivers({ p }: { p: Portfolio }) {
  const pc = p.pc
  // Biggest payments up to the low point: what is driving the dip.
  const drivers = pc.weeks
    .slice(0, pc.lowestWeek + 1)
    .flatMap((w) => w.events)
    .sort((x, y) => x.amount - y.amount)
    .slice(0, 5)
  return (
    <Card title="Biggest payments before the low point">
      {drivers.length === 0 ? <p className="text-sm text-muted">No payments before the low point.</p> : <PaymentList items={drivers} p={p} />}
    </Card>
  )
}

function WeekTable({ p }: { p: Portfolio }) {
  const { company } = useApp()
  const pc = p.pc
  const today = todayIso()
  return (
    <Card title="Week by week">
      <p className="-mt-3 mb-5 text-[0.8125rem] text-muted">Weeks under your safety buffer are shaded. Starts from your cash on hand; payments already made aren't counted.</p>
      <div className="max-h-[28rem] overflow-auto rounded-xl border border-line">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Combined cash by week</caption>
          <thead className="sticky top-0 bg-ink-soft text-left text-[0.8125rem] text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Week of</th>
              <th scope="col" className="px-4 py-3 text-right">Sales in</th>
              <th scope="col" className="px-4 py-3 text-right">Paid out</th>
              <th scope="col" className="px-4 py-3">Payments</th>
              <th scope="col" className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {pc.weeks.map((w) => {
              const isNow = today >= w.date && today < addDays(w.date, 7)
              return (
                <tr key={w.week} className={`border-t border-line ${w.balance < company.buffer ? 'bg-accent-soft' : ''}`}>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {shortDate(w.date)}
                    {isNow && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-white">Now</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">{w.inflow ? usd(w.inflow) : ''}</td>
                  <td className="px-4 py-2.5 text-right">{w.outflow ? usd(w.outflow) : ''}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {w.events.map((e, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          <Dot color={p.colorOf(e.orderId)} size={8} />
                          {e.label}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right ${w.week === pc.lowestWeek ? 'font-semibold text-accent-ink' : 'text-ink'}`}>{usd(w.balance)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

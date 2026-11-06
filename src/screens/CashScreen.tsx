import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addDays, type CashWeek } from '../engine'
import { niceDate, shortDate, usd } from '../format'
import { useApp } from '../state'
import { thisOrderSentences } from '../summaries'
import { Callout, Card, Info, NeedsData, NextLink, PageHeader } from '../components/ui'
import type { GlossaryKey } from '../glossary'

const EVENT_TERMS: Record<string, GlossaryKey> = {
  'Deposit to supplier': 'depositPayment',
  'Balance to supplier': 'balancePayment',
  'Freight and insurance': 'freightInsurance',
  'Duty and customs fees': 'dutyPayment',
}

const LINE = '#1d4ed8' // blue-700
const BUFFER = '#64748b' // slate-500
const DIP = '#b45309' // amber-700

function WeekTooltip({ active, payload }: { active?: boolean; payload?: { payload: CashWeek }[] }) {
  if (!active || !payload?.length) return null
  const w = payload[0].payload
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-md">
      <p className="font-semibold text-slate-900">
        Week {w.week} · {shortDate(w.date)}
      </p>
      <p className="tabular-nums text-slate-700">Balance at week end: {usd(w.balance)}</p>
      {w.inflow > 0 && <p className="tabular-nums text-slate-600">Sales in: {usd(w.inflow)}</p>}
      {w.events.map((e) => (
        <p key={e.label} className="tabular-nums text-slate-600">
          {e.label}: {usd(e.amount)}
        </p>
      ))}
    </div>
  )
}

export default function CashScreen() {
  const { inputs, chosen, cash } = useApp()
  const [showAll, setShowAll] = useState(false)

  // Zoom to the order period: until cash is back above the starting balance, plus two weeks.
  let shownWeeks = cash?.weeks ?? []
  if (cash && !showAll) {
    const lastPayWeek = Math.floor(Math.max(...cash.events.map((e) => e.day)) / 7)
    const recovered = cash.weeks.findIndex((w) => w.week > lastPayWeek && w.balance >= inputs.business.cash)
    const end = recovered === -1 ? cash.weeks.length : Math.min(cash.weeks.length, recovered + 3)
    shownWeeks = cash.weeks.slice(0, Math.max(end, lastPayWeek + 2))
  }
  const zoomed = shownWeeks.length < (cash?.weeks.length ?? 0)

  return (
    <div>
      <PageHeader step={4} title="Cash check" subtitle="Week by week: you pay the supplier, freight and customs before the stock sells. Does your cash stay above your buffer?" />
      <NeedsData>
        {chosen && cash && (
          <>
            <div className="mb-5">
              <Callout tone={cash.shortfall > 0 ? 'warn' : 'good'}>
                {thisOrderSentences(inputs, chosen, cash).map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </Callout>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Lowest balance" info="lowestBalance" value={usd(cash.lowest)} sub={`Week ${cash.lowestWeek}`} />
              <Stat
                label={cash.shortfall > 0 ? 'Below buffer by' : 'Headroom'}
                info={cash.shortfall > 0 ? 'belowBuffer' : 'headroom'}
                value={usd(cash.shortfall > 0 ? cash.shortfall : cash.headroom)}
                sub={cash.shortfall > 0 ? `for ${cash.weeksBelowBuffer} weeks` : 'above buffer'}
              />
              <Stat label="Goods arrive" info="goodsArrive" value={`Day ${cash.arrivalDay}`} sub={niceDate(addDays(inputs.business.orderDate, cash.arrivalDay))} />
              <Stat
                label={cash.shortfall > 0 ? 'Interest to bridge' : 'Extra units affordable'}
                info={cash.shortfall > 0 ? 'interest' : 'extraUnits'}
                value={cash.shortfall > 0 ? usd(cash.interest) : cash.extraUnits.toLocaleString()}
                sub={cash.shortfall > 0 ? `at ${(inputs.business.apr * 100).toFixed(0)}% APR` : 'without borrowing'}
              />
            </div>

            <Card title={`Cash balance by week: ${chosen.supplierName} (${chosen.country})`} className="mb-5">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={shownWeeks} margin={{ top: 24, right: 24, bottom: 8, left: 8 }}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    {cash.shortfall > 0 && (
                      <ReferenceArea
                        x1={cash.weeks.find((w) => w.balance < inputs.business.buffer)?.week}
                        x2={[...cash.weeks].reverse().find((w) => w.balance < inputs.business.buffer)?.week}
                        fill="#fde68a"
                        fillOpacity={0.35}
                        ifOverflow="extendDomain"
                      />
                    )}
                    <XAxis
                      dataKey="week"
                      tickFormatter={(w) => `W${w}`}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip content={<WeekTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
                    <ReferenceLine
                      y={inputs.business.buffer}
                      stroke={BUFFER}
                      strokeDasharray="6 4"
                      label={{ value: `Safety buffer ${usd(inputs.business.buffer)}`, position: 'insideTopRight', fontSize: 12, fill: '#475569' }}
                    />
                    <ReferenceLine
                      x={cash.salesStartWeek}
                      stroke="#cbd5e1"
                      label={{ value: 'Sales start', position: 'top', fontSize: 11, fill: '#64748b' }}
                    />
                    <Line type="linear" dataKey="balance" stroke={LINE} strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                    <ReferenceDot
                      x={cash.lowestWeek}
                      y={cash.lowest}
                      r={6}
                      fill={DIP}
                      stroke="#fff"
                      strokeWidth={2}
                      label={{ value: `Lowest ${usd(cash.lowest)}`, position: 'right', dy: -14, fontSize: 12, fill: '#92400e', fontWeight: 600 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {cash.shortfall > 0 ? 'Shaded weeks are below your safety buffer. ' : ''}
                  Sales start the first full week after arrival<Info term="salesStart" />. 
                  Balances are at the end of each week. Hover a week for details.
                </span>
                {(zoomed || showAll) && (
                  <button className="font-medium text-blue-700 underline" onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Zoom to the order period' : `Show all ${cash.weeks.length} weeks until sold out`}
                  </button>
                )}
              </div>
            </Card>

            <Card title="Payments for this order">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 text-left">When</th>
                    <th className="py-2 text-left">What</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cash.events.map((e) => (
                    <tr key={e.label} className="border-b border-slate-100">
                      <td className="py-2">
                        Day {e.day} <span className="text-slate-500">({niceDate(addDays(inputs.business.orderDate, e.day))}, week {Math.floor(e.day / 7)})</span>
                      </td>
                      <td className="py-2">
                        {e.label}
                        {EVENT_TERMS[e.label] && <Info term={EVENT_TERMS[e.label]} />}
                      </td>
                      <td className="py-2 text-right">{usd(-e.amount, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
        <NextLink to="/tariffs">Next: what if tariffs change?</NextLink>
      </NeedsData>
    </div>
  )
}

function Stat({ label, value, sub, info }: { label: string; value: string; sub?: string; info?: GlossaryKey }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="flex items-center text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {info && <Info term={info} />}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

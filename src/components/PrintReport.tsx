import { createPortal } from 'react-dom'
import type { CashResult, Inputs } from '../engine'
import { niceDate, shortDate, usd } from '../format'
import { rates, useApp } from '../state'
import { templateExplanation } from '../ai/fallback'
import type { Explanation } from '../ai/explain'
import { DISCLAIMER } from '../summaries'
import { ASSUMPTIONS, htsStatus, useRateRows } from '../rateRows'
import { LogoMark } from './Logo'
import { DEMO_TODAY } from '../demo/data'

export interface ShownRecommendation {
  explanation: Partial<Explanation>
  ai: boolean
}

const ROWS: { key: Exclude<keyof Explanation, 'headline' | 'caveat'>; label: string }[] = [
  { key: 'supplier_choice', label: 'Supplier' },
  { key: 'cash_outlook', label: 'Cash' },
  { key: 'tariff_risk', label: 'Tariff risk' },
  { key: 'next_steps', label: 'Next steps' },
]

/** 1, 2 or 5 times a power of ten that gives about `target` steps across `range`. */
function niceStep(range: number, target = 4) {
  const raw = range / target
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
}

/**
 * Static SVG of the Cash check chart (weekly balance, safety buffer, weeks under it, lowest point).
 * Fixed size on purpose: a responsive chart inside a hidden print container has nothing to measure.
 * Covers the order period like the on-screen default: until cash is back above the starting balance, plus two weeks.
 */
function PrintCashChart({ inputs, cash }: { inputs: Inputs; cash: CashResult }) {
  const lastPayWeek = Math.floor(Math.max(...cash.events.map((e) => e.day)) / 7)
  const recovered = cash.weeks.findIndex((w) => w.week > lastPayWeek && w.balance >= inputs.business.cash)
  const end = recovered === -1 ? cash.weeks.length : Math.min(cash.weeks.length, recovered + 3)
  const weeks = cash.weeks.slice(0, Math.max(end, lastPayWeek + 2))
  const buffer = inputs.business.buffer

  const W = 700
  const H = 230
  const m = { l: 46, r: 12, t: 16, b: 26 }
  const values = weeks.map((w) => w.balance)
  const lo = Math.min(0, ...values)
  const hi = Math.max(buffer, ...values)
  const step = niceStep(hi - lo)
  const yMin = Math.floor(lo / step) * step
  const yMax = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(v)

  const n = weeks.length
  const colW = (W - m.l - m.r) / n
  const x = (i: number) => m.l + colW * (i + 0.5)
  const y = (v: number) => m.t + (H - m.t - m.b) * (1 - (v - yMin) / (yMax - yMin))
  const kfmt = (v: number) => (v === 0 ? '$0' : `$${Math.round(v / 1000)}k`)
  const line = weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(w.balance).toFixed(1)}`).join(' ')
  const xEvery = Math.max(1, Math.ceil(n / 7))
  const low = weeks.findIndex((w) => w.week === cash.lowestWeek)
  const salesIdx = weeks.findIndex((w) => w.week === cash.salesStartWeek)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cash balance by week" className="mt-2 block text-[9px]" fontFamily="Inter, sans-serif">
      {weeks.map(
        (w, i) => w.balance < buffer && <rect key={w.week} x={x(i) - colW / 2} y={m.t} width={colW} height={H - m.t - m.b} fill="#f28c0a" fillOpacity={0.12} />,
      )}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#e8e1d3" />
          <text x={m.l - 6} y={y(t) + 3} textAnchor="end" fill="#686257">
            {kfmt(t)}
          </text>
        </g>
      ))}
      {weeks.map(
        (w, i) =>
          i % xEvery === 0 && (
            <text key={w.week} x={x(i)} y={H - 8} textAnchor="middle" fill="#686257">
              {shortDate(w.date)}
            </text>
          ),
      )}
      {salesIdx > 0 && (
        <g>
          <line x1={x(salesIdx)} x2={x(salesIdx)} y1={m.t} y2={H - m.b} stroke="#cbc1ac" />
          <text x={x(salesIdx) + 4} y={m.t + 9} fill="#686257">
            Sales start
          </text>
        </g>
      )}
      <line x1={m.l} x2={W - m.r} y1={y(buffer)} y2={y(buffer)} stroke="#686257" strokeDasharray="5 4" />
      <text x={W - m.r - 2} y={y(buffer) - 5} textAnchor="end" fill="#38405a">
        Safety buffer {usd(buffer)}
      </text>
      <path d={line} fill="none" stroke="#14284b" strokeWidth={1.8} strokeLinejoin="round" />
      {low >= 0 && (
        <g>
          <circle cx={x(low)} cy={y(cash.lowest)} r={4} fill="#f28c0a" stroke="#fffdf8" strokeWidth={1.5} />
          <text x={x(low) + 8} y={y(cash.lowest) + 14} fill="#94500a" fontWeight={600}>
            Lowest {usd(cash.lowest)}
          </text>
        </g>
      )}
    </svg>
  )
}

/**
 * The printed report: US letter, recommendation first, then the supplier comparison, the cash flow chart, then the fine print.
 * Lives in a portal beside #root and is hidden on screen; the print styles in index.css hide everything else.
 */
export function PrintReport({ recommendation }: { recommendation: ShownRecommendation | null }) {
  const { inputs, ranked, chosen, cash, be } = useApp()
  const rateRows = useRateRows()
  if (!chosen || !cash) return null

  const rec: ShownRecommendation = recommendation ?? { explanation: templateExplanation(inputs, ranked, chosen, cash, be, rates.lastReviewed), ai: false }
  const e = rec.explanation
  const today = DEMO_TODAY
  const cheapestId = ranked[0]?.supplierId

  return createPortal(
    <div id="print-report" className="text-[9.5pt] leading-[1.45] text-ink">
      <header className="flex items-center justify-between border-b border-line-strong pb-3">
        <div className="flex items-center gap-2.5">
          <LogoMark size={30} />
          <span className="font-serif text-[17pt] leading-none font-semibold tracking-tight">Landfall</span>
        </div>
        <p className="text-[8.5pt] text-muted">Order summary · {niceDate(today)}</p>
      </header>

      <section className="mt-6 break-inside-avoid">
        <h1 className="font-serif text-[20pt] leading-[1.2] font-semibold tracking-tight">Recommendation</h1>
        {e.headline && <p className="mt-2 font-serif text-[12.5pt] leading-snug font-semibold">{e.headline}</p>}
        <dl className="mt-3 grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-2">
          {ROWS.map((r) =>
            e[r.key] ? (
              <div key={r.key} className="contents">
                <dt className="font-medium text-muted">{r.label}</dt>
                <dd>{e[r.key]}</dd>
              </div>
            ) : null,
          )}
        </dl>
        {rec.ai && <p className="mt-2 text-[8pt] text-quiet">Written by AI from the numbers in this report; every dollar amount and percentage was checked against the calculation.</p>}
      </section>

      <section className="mt-7 break-inside-avoid">
        <h2 className="font-serif text-[14pt] font-semibold tracking-tight">Supplier comparison</h2>
        <p className="mt-0.5 text-[8.5pt] text-muted">
          {chosen.units.toLocaleString()} units. Selected: {chosen.supplierName} ({chosen.country}), {usd(chosen.total, true)} landed.
        </p>
        <table className="mt-3 w-full text-[8.5pt] tabular-nums">
          <thead>
            <tr className="border-b border-line-strong text-right text-[8pt] text-muted">
              <th className="py-1.5 pr-2 text-left">Supplier</th>
              <th className="py-1.5 pr-2">Product cost</th>
              <th className="py-1.5 pr-2">Tariffs</th>
              <th className="py-1.5 pr-2">Freight + ins.</th>
              <th className="py-1.5 pr-2">Customs fees</th>
              <th className="py-1.5 pr-2">To arrive</th>
              <th className="py-1.5 pr-2">Landed total</th>
              <th className="py-1.5">Per unit</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => {
              const sup = inputs.suppliers.find((s) => s.id === r.supplierId)
              const isChosen = r.supplierId === chosen.supplierId
              return (
                <tr key={r.supplierId} className={`border-b border-line text-right ${isChosen ? 'bg-good-soft' : ''}`}>
                  <td className="py-2 pr-2 pl-1.5 text-left">
                    <span className="font-semibold">{r.supplierName}</span> <span className="text-muted">({r.country})</span>
                    <span className="block text-[7.5pt] text-muted">
                      {[r.supplierId === cheapestId ? 'Cheapest' : `+${usd(r.gapToCheapest, true)} vs cheapest`, isChosen ? 'Selected' : ''].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td className="py-2 pr-2">{usd(r.customsValue)}</td>
                  <td className="py-2 pr-2">{usd(r.baseDuty + r.extraDuty)}</td>
                  <td className="py-2 pr-2">{usd(r.freight + r.insurance)}</td>
                  <td className="py-2 pr-2">{usd(r.mpf + r.hmf + r.broker)}</td>
                  <td className="py-2 pr-2">{sup ? `${sup.leadTimeDays + sup.transitDays} days` : ''}</td>
                  <td className="py-2 pr-2 font-semibold">{usd(r.total, true)}</td>
                  <td className="py-2 pr-1.5">{usd(r.avgUnit, true)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-7 break-inside-avoid">
        <h2 className="font-serif text-[14pt] font-semibold tracking-tight">Cash flow</h2>
        <p className="mt-0.5 text-[8.5pt] text-muted">
          Cash balance by week with {chosen.supplierName} ({chosen.country}), starting from {usd(inputs.business.cash)} cash on hand.
          {cash.shortfall > 0 ? ' Shaded weeks are below your safety buffer.' : ''} Sales start the first full week after arrival.
        </p>
        <PrintCashChart inputs={inputs} cash={cash} />
      </section>

      <section className="mt-8 break-inside-avoid border-t border-line pt-3 text-[7.5pt] leading-[1.4] text-quiet">
        <p className="font-semibold text-muted">Rates, assumptions and disclaimer</p>
        <table className="mt-1.5 w-full">
          <tbody>
            {rateRows.map((r) => (
              <tr key={r.key} className="align-baseline">
                <td className="py-0.5 pr-3">{r.name}</td>
                <td className="py-0.5 pr-3 text-right tabular-nums">{r.value}</td>
                <td className="py-0.5 pr-3">{r.source}</td>
                <td className="py-0.5 whitespace-nowrap">{niceDate(r.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-2 list-disc space-y-0.5 pl-4">
          {ASSUMPTIONS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="mt-2">
          HTS schedule: {htsStatus.title}, checked daily, last checked {niceDate(htsStatus.checkedAt)}. Rates not taken from the schedule (extra tariffs, fees, the sample codes) were last reviewed {niceDate(rates.lastReviewed)}.
        </p>
        <p className="mt-1">{DISCLAIMER}</p>
      </section>
    </div>,
    document.body,
  )
}

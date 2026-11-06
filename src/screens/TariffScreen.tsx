import { useMemo, useState } from 'react'
import { compareSuppliers } from '../engine'
import { pct, points, usd } from '../format'
import { rates, useApp } from '../state'
import { nextOrderSentences } from '../summaries'
import { Button, Callout, Card, NeedsData, NextLink, PageHeader } from '../components/ui'

const MIN = -0.1
const MAX = 0.3

export default function TariffScreen() {
  const { inputs, ranked, be } = useApp()
  const [targetId, setTargetId] = useState<string | null>(null)
  const [delta, setDelta] = useState(0)

  const target = ranked.find((r) => r.supplierId === targetId) ?? ranked[0]
  const scenario = useMemo(
    () => (target ? compareSuppliers(inputs, rates, { [target.supplierId]: delta }) : []),
    [inputs, target, delta],
  )

  // Change in this supplier's extra tariff at which the ranking flips (vs the best of the others).
  const threshold = useMemo(() => {
    if (!target || ranked.length < 2 || target.customsValue === 0) return null
    const bestOther = Math.min(...ranked.filter((r) => r.supplierId !== target.supplierId).map((r) => r.total))
    return (bestOther - target.total) / target.customsValue
  }, [ranked, target])

  const maxGap = Math.max(...scenario.map((r) => r.gapToCheapest), 1)
  const minFloor = target ? Math.max(MIN, -target.extraRate) : MIN
  const winner = scenario[0]
  const thresholdPos = threshold !== null ? ((threshold - minFloor) / (MAX - minFloor)) * 100 : null

  return (
    <div>
      <PageHeader step={5} title="What if tariffs change?" subtitle="Tariffs move. See how far they can rise before a different supplier wins your next order." />
      <NeedsData>
        <div className="mb-5">
          <Callout tone="info">
            {nextOrderSentences(be).map((s) => (
              <p key={s}>{s}</p>
            ))}
          </Callout>
        </div>

        {target && (
          <Card title="Tariff slider" className="mb-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-700">Change the extra tariff on</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={target.supplierId}
                onChange={(e) => {
                  setTargetId(e.target.value)
                  setDelta(0)
                }}
              >
                {ranked.map((r) => (
                  <option key={r.supplierId} value={r.supplierId}>
                    {r.supplierName} ({r.country})
                  </option>
                ))}
              </select>
              <Button variant="ghost" onClick={() => setDelta(0)}>Reset to today</Button>
            </div>

            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-sm text-slate-600">
                Today {pct(target.extraRate)} → <b className="text-slate-900">{pct(target.extraRate + delta)}</b>
              </p>
              <p className="text-2xl font-bold tabular-nums text-blue-800">
                {delta >= 0 ? '+' : ''}
                {(delta * 100).toFixed(1)} points
              </p>
            </div>

            <div className="relative pb-6">
              <input
                type="range"
                aria-label="Extra tariff change in percentage points"
                min={minFloor * 100}
                max={MAX * 100}
                step={0.1}
                value={delta * 100}
                onChange={(e) => setDelta(parseFloat(e.target.value) / 100)}
                className="w-full accent-blue-700"
              />
              {thresholdPos !== null && thresholdPos >= 0 && thresholdPos <= 100 && (
                <div className="pointer-events-none absolute top-0 h-6" style={{ left: `${thresholdPos}%` }}>
                  <div className="h-6 w-0.5 -translate-x-1/2 bg-amber-600" />
                  <span className="absolute top-6 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-amber-800">
                    Break-even {threshold! >= 0 ? '+' : ''}
                    {(threshold! * 100).toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {threshold !== null && (
              <p className="mb-5 text-sm text-slate-600">
                {threshold >= 0
                  ? `${target.supplierName} stays cheapest unless its extra tariff rises by more than ${points(threshold)}.`
                  : `${target.supplierName} would need its extra tariff to fall by more than ${points(-threshold)} to become cheapest.`}
              </p>
            )}

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Landed total, and extra cost compared with the cheapest</p>
            <div className="space-y-3">
              {scenario.map((r) => {
                const isWinner = r.supplierId === winner.supplierId
                return (
                  <div key={r.supplierId}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-800">
                        {r.rank}. {r.supplierName} ({r.country}) <span className="font-normal text-slate-500">extra tariff {pct(r.extraRate)}</span>
                        {isWinner && <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">Cheapest</span>}
                      </span>
                      <span className="tabular-nums text-slate-900">
                        <b>{usd(r.total, true)}</b>
                        <span className="ml-2 inline-block w-24 text-right text-slate-500">{isWinner ? 'cheapest' : `+${usd(r.gapToCheapest)}`}</span>
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-3 rounded-full transition-all ${isWinner ? 'bg-emerald-600' : 'bg-slate-400'}`}
                        style={{ width: isWinner ? '6px' : `${Math.max(1, (r.gapToCheapest / maxGap) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <NextLink to="/summary">Next: summary</NextLink>
      </NeedsData>
    </div>
  )
}

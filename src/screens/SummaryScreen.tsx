import { useState } from 'react'
import { niceDate, usd } from '../format'
import { rates, useApp } from '../state'
import { nextOrderSentences, supplierSentence, thisOrderSentences, DISCLAIMER } from '../summaries'
import { Button, Callout, Card, Info, NeedsData, PageHeader } from '../components/ui'
import type { GlossaryKey } from '../glossary'
import { AiExplanation } from '../components/AiExplanation'
import { PrintReport, type ShownRecommendation } from '../components/PrintReport'
import { ASSUMPTIONS, htsStatus, useRateRows, type RateRow } from '../rateRows'

export default function SummaryScreen() {
  const { inputs, ranked, chosen, cash, be } = useApp()
  const rateRows = useRateRows()
  // What the Recommendation card currently shows (AI or standard summary), so the printed report matches it.
  const [recommendation, setRecommendation] = useState<ShownRecommendation | null>(null)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <PageHeader step={5} title="Owner summary" subtitle="Your two decisions, and where every number came from." />
        </div>
        {chosen && cash && (
          <Button variant="secondary" className="no-print inline-flex items-center gap-2" onClick={() => window.print()}>
            <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 6V2.5h7V6M4.5 11.5h-2V6h11v5.5h-2M4.5 9.5h7v4h-7z" />
            </svg>
            Print report
          </Button>
        )}
      </div>
      <PrintReport recommendation={recommendation} />
      <NeedsData>
        {chosen && cash && (
          <>
            <AiExplanation onShown={setRecommendation} />
            <div className="mb-8 grid gap-8 md:grid-cols-2">
              <Card title="This order">
                <p className="mb-4 text-sm leading-6 text-copy">{supplierSentence(ranked)}</p>
                {chosen.rank !== 1 && (
                  <p className="mb-4 text-sm leading-6 text-copy">
                    You picked {chosen.supplierName} ({chosen.country}) at {usd(chosen.total, true)}, {usd(chosen.gapToCheapest, true)} more than the cheapest.
                  </p>
                )}
                <Callout tone={cash.shortfall > 0 ? 'warn' : 'good'}>
                  {thisOrderSentences(inputs, chosen, cash).map((s) => (
                    <p key={s}>{s}</p>
                  ))}
                </Callout>
              </Card>
              <Card title="Next order">
                <Callout tone="info">
                  {nextOrderSentences(be).map((s) => (
                    <p key={s}>{s}</p>
                  ))}
                </Callout>
              </Card>
            </div>

            <Card title="Order at a glance" className="mb-8">
              <dl className="grid grid-cols-2 gap-x-8 gap-y-6 text-sm md:grid-cols-4">
                <Item label="Supplier" info="supplierName" value={`${chosen.supplierName} (${chosen.country})`} />
                <Item label="Units" info="units" value={chosen.units.toLocaleString()} />
                <Item label="Landed total" info="landedTotal" value={usd(chosen.total, true)} />
                <Item label="Per unit (average)" info="avgUnit" value={usd(chosen.avgUnit, true)} />
                <Item label="Product cost" info="productCost" value={usd(chosen.customsValue, true)} />
                <Item label="Tariffs" info="totalTariff" value={usd(chosen.baseDuty + chosen.extraDuty, true)} />
                <Item label="Freight + insurance" info="freightInsurance" value={usd(chosen.freight + chosen.insurance, true)} />
                <Item label="Customs fees + broker" info="customsFees" value={usd(chosen.mpf + chosen.hmf + chosen.broker, true)} />
              </dl>
            </Card>

            <Card title="Rates">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line-strong text-left text-[0.8125rem] text-muted">
                      <th className="py-3 pr-5">Rate</th>
                      <th className="py-3 pr-5 text-right">Value</th>
                      <th className="py-3 pr-5">Source</th>
                      <th className="py-3">As of</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateRows.map((r) => (
                      <Row key={r.key} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-7 border-t border-line pt-6 text-xs leading-5 text-quiet">
                <p className="mb-2 font-medium text-muted">Assumptions</p>
                <ul className="list-disc space-y-1 pl-5 marker:text-faint">
                  {ASSUMPTIONS.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <p className="mt-4">
                  HTS schedule: {htsStatus.title}, checked daily, last checked {niceDate(htsStatus.checkedAt)}. Rates not taken from the schedule (extra tariffs, fees, the sample codes) were last reviewed {niceDate(rates.lastReviewed)}.
                </p>
                <p className="mt-2">{DISCLAIMER}</p>
              </div>
            </Card>
          </>
        )}
      </NeedsData>
    </div>
  )
}

function Item({ label, value, info }: { label: string; value: string; info?: GlossaryKey }) {
  return (
    <div>
      <dt className="flex items-center text-xs text-muted">
        {label}
        {info && <Info term={info} />}
      </dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

function Row({ r }: { r: RateRow }) {
  return (
    <tr className="border-b border-line align-baseline">
      <td className="py-3.5 pr-5">{r.name}</td>
      <td className="py-3.5 pr-5 text-right tabular-nums">{r.value}</td>
      <td className="py-3.5 pr-5 text-muted">
        {r.url ? (
          <a href={r.url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            {r.source}
          </a>
        ) : (
          r.source
        )}
      </td>
      <td className="whitespace-nowrap py-3.5 text-muted">{niceDate(r.date)}</td>
    </tr>
  )
}

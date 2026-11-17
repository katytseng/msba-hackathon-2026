import { niceDate, pct, usd } from '../format'
import { rates, useApp } from '../state'
import { DISCLAIMER, nextOrderSentences, supplierSentence, thisOrderSentences } from '../summaries'
import { Button, Callout, Card, Info, NeedsData, PageHeader } from '../components/ui'
import type { GlossaryKey } from '../glossary'
import { AiExplanation } from '../components/AiExplanation'
import { productBaseRate } from '../engine'
import htsMeta from '../../public/hts/meta.json'

const ASSUMPTIONS = [
  'Prices are FOB (you pay freight from the port of origin).',
  'One ocean shipment and one customs entry into LA/Long Beach.',
  'Tariffs are charged on product value only.',
  'Base tariffs use the HTS general (most-favored-nation) rate, as a percent of value. Codes charged per kg, per unit or a mix are not supported, and trade-agreement (special) rates are not applied.',
  'One flat extra tariff per country.',
  'No returns, platform fees or sales tax.',
  'Freight and fixed fees are spread across products by share of product value.',
]

export default function SummaryScreen() {
  const { inputs, ranked, chosen, cash, be } = useApp()
  // One row per HTS code: the rate picked from the full schedule, else the rates.json entry.
  const usedCodes = [...new Map(inputs.products.map((p) => [p.htsCode, p])).values()]
  const usedCountries = new Set(inputs.suppliers.map((s) => s.country))
  const f = rates.fees

  return (
    <div>
      <PageHeader step={5} title="Owner summary" subtitle="Your two decisions, and where every number came from." />
      <NeedsData>
        {chosen && cash && (
          <>
            <AiExplanation />
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

            <Card title="Rates used, with sources and dates" className="mb-8">
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
                    {usedCodes.map((p) => {
                      const r = rates.baseTariffs[p.htsCode]
                      if (typeof p.baseRate === 'number' || !r)
                        return (
                          <Row
                            key={p.htsCode}
                            name={`Base tariff, HTS ${p.htsCode} (${p.htsDescription ?? 'from the HTS'})`}
                            value={pct(productBaseRate(rates, p))}
                            source={`USITC Harmonized Tariff Schedule${p.htsRelease ? `, ${p.htsRelease}` : ''}`}
                            url="https://hts.usitc.gov/"
                            date={htsMeta.fetchedAt.slice(0, 10)}
                          />
                        )
                      return <Row key={p.htsCode} name={`Base tariff, HTS ${p.htsCode} (${r.description})`} value={pct(r.rate)} source={r.source} url={r.url} date={r.date} />
                    })}
                    {[...usedCountries].map((c) => {
                      const r = rates.extraTariffs[c]
                      return <Row key={c} name={`Extra tariff, ${c} (${r.note})`} value={pct(r.rate)} source={r.source} url={r.url} date={r.date} />
                    })}
                    <Row name={f.mpf.label} value={`${pct(f.mpf.rate, 4)}, min ${usd(f.mpf.min, true)}, max ${usd(f.mpf.max, true)}`} source={f.mpf.source} url={f.mpf.url} date={f.mpf.date} />
                    <Row name={f.hmf.label} value={pct(f.hmf.rate, 3)} source={f.hmf.source} url={f.hmf.url} date={f.hmf.date} />
                    <Row name={f.insurance.label} value={pct(f.insurance.rate)} source={f.insurance.source} date={f.insurance.date} />
                    <Row name={f.broker.label} value={usd(f.broker.amount)} source={f.broker.source} date={f.broker.date} />
                    <Row name={f.dutyPaymentDays.label} value={`${f.dutyPaymentDays.days} days`} source={f.dutyPaymentDays.source} date={f.dutyPaymentDays.date} />
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Assumptions" className="mb-8">
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-copy marker:text-faint">
                {ASSUMPTIONS.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line-strong bg-surface px-7 py-5">
              <p className="font-semibold text-ink">{DISCLAIMER}</p>
              <Button variant="secondary" className="no-print" onClick={() => window.print()}>
                Print
              </Button>
            </div>
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

function Row({ name, value, source, url, date }: { name: string; value: string; source: string; url?: string; date: string }) {
  return (
    <tr className="border-b border-line align-baseline">
      <td className="py-3.5 pr-5">{name}</td>
      <td className="py-3.5 pr-5 text-right tabular-nums">{value}</td>
      <td className="py-3.5 pr-5 text-muted">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            {source}
          </a>
        ) : (
          source
        )}
      </td>
      <td className="py-3.5 whitespace-nowrap text-muted">{niceDate(date)}</td>
    </tr>
  )
}

import { niceDate, pct, usd } from '../format'
import { rates, useApp } from '../state'
import { DISCLAIMER, nextOrderSentences, supplierSentence, thisOrderSentences } from '../summaries'
import { Button, Callout, Card, Info, NeedsData, PageHeader } from '../components/ui'
import type { GlossaryKey } from '../glossary'

const ASSUMPTIONS = [
  'Prices are FOB (you pay freight from the port of origin).',
  'One ocean shipment and one customs entry into LA/Long Beach.',
  'Tariffs are charged on product value only.',
  'One flat extra tariff per country.',
  'No returns, platform fees or sales tax.',
  'Freight and fixed fees are spread across products by share of product value.',
]

export default function SummaryScreen() {
  const { inputs, ranked, chosen, cash, be } = useApp()
  const usedCodes = new Set(inputs.products.map((p) => p.htsCode))
  const usedCountries = new Set(inputs.suppliers.map((s) => s.country))
  const f = rates.fees

  return (
    <div>
      <PageHeader step={6} title="Owner summary" subtitle="Your two decisions, and where every number came from." />
      <NeedsData>
        {chosen && cash && (
          <>
            <div className="mb-5 grid gap-5 md:grid-cols-2">
              <Card title="This order">
                <p className="mb-3 text-sm text-slate-700">{supplierSentence(ranked)}</p>
                {chosen.rank !== 1 && (
                  <p className="mb-3 text-sm text-slate-700">
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

            <Card title="Order at a glance" className="mb-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
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

            <Card title="Rates used, with sources and dates" className="mb-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Rate</th>
                      <th className="py-2 pr-3 text-right">Value</th>
                      <th className="py-2 pr-3">Source</th>
                      <th className="py-2">As of</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...usedCodes].map((code) => {
                      const r = rates.baseTariffs[code]
                      return <Row key={code} name={`Base tariff, HTS ${code} (${r.description})`} value={pct(r.rate)} source={r.source} url={r.url} date={r.date} />
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

            <Card title="Assumptions" className="mb-5">
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {ASSUMPTIONS.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-slate-300 bg-white p-4">
              <p className="font-semibold text-slate-900">{DISCLAIMER}</p>
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
      <dt className="flex items-center text-xs uppercase tracking-wide text-slate-500">
        {label}
        {info && <Info term={info} />}
      </dt>
      <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  )
}

function Row({ name, value, source, url, date }: { name: string; value: string; source: string; url?: string; date: string }) {
  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-2 pr-3">{name}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{value}</td>
      <td className="py-2 pr-3 text-slate-600">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
            {source}
          </a>
        ) : (
          source
        )}
      </td>
      <td className="py-2 whitespace-nowrap text-slate-600">{niceDate(date)}</td>
    </tr>
  )
}

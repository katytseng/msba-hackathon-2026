import { useState } from 'react'
import { pct, usd } from '../format'
import { useApp } from '../state'
import { supplierSentence } from '../summaries'
import { Callout, Card, Collapse, Info, NeedsData, PageHeader, Segmented } from '../components/ui'

export default function CompareScreen() {
  const { inputs, ranked, chosen, setSelectedId } = useApp()
  const [details, setDetails] = useState(false)
  const toggleDetails = (
    <Segmented
      label="Calculation details"
      value={details ? 'details' : 'totals'}
      onChange={(v) => setDetails(v === 'details')}
      options={[
        { value: 'totals', label: 'Totals' },
        { value: 'details', label: 'Details' },
      ]}
    />
  )

  return (
    <div>
      <PageHeader step={3} title="Compare landed cost" subtitle="Everything you pay to get the goods to your door: product, freight, insurance, tariffs and customs fees." />
      <NeedsData>
        <div className="mb-5">
          <Callout tone="info">
            <p>{supplierSentence(ranked)}</p>
          </Callout>
        </div>

        <Card title="Suppliers, cheapest first" className="mb-5" actions={toggleDetails}>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-right text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4 text-center">Select</th>
                  <th className="py-2 pr-3 text-left">Supplier</th>
                  <th className="py-2 pr-3">Product cost<Info term="productCost" /></th>
                  <th className="py-2 pr-3">Tariffs<Info term="totalTariff" /></th>
                  <th className="py-2 pr-3">Freight + insurance<Info term="freightInsurance" /></th>
                  <th className="py-2 pr-3">Customs fees<Info term="customsFees" /></th>
                  <th className="py-2 pr-3">Time to arrive<Info term="daysToArrive" /></th>
                  <th className="py-2 pr-3">Landed total<Info term="landedTotal" /></th>
                  <th className="py-2">Per unit<Info term="avgUnit" /></th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const isChosen = chosen?.supplierId === r.supplierId
                  const isCheapest = r.rank === 1
                  const sup = inputs.suppliers.find((s) => s.id === r.supplierId)
                  const tariff = r.baseDuty + r.extraDuty
                  return (
                    <tr key={r.supplierId} className={`border-b border-line/60 text-right ${isCheapest ? 'bg-emerald-50' : ''}`}>
                      <td className="py-3 pr-4 text-center">
                        <label className="inline-flex cursor-pointer">
                          <input
                            type="radio"
                            name="chosen-supplier"
                            className="peer sr-only"
                            checked={isChosen}
                            onChange={() => setSelectedId(r.supplierId)}
                            aria-label={`Select ${r.supplierName} (${r.country})`}
                          />
                          <span
                            aria-hidden
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-bold text-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 ${
                              isChosen ? 'border-emerald-600 bg-emerald-600' : 'border-line-strong bg-surface hover:border-emerald-500'
                            }`}
                          >
                            {isChosen && '✓'}
                          </span>
                        </label>
                      </td>
                      <td className="py-3 pr-3 text-left">
                        <div className="font-semibold text-ink">
                          {r.rank}. {r.supplierName} <span className="font-normal text-muted">({r.country})</span>
                        </div>
                        {isCheapest ? (
                          <span className="mt-1 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">Cheapest</span>
                        ) : (
                          <span className="text-xs text-muted">+{usd(r.gapToCheapest, true)} vs cheapest</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">{usd(r.customsValue)}</td>
                      <td className="py-3 pr-3">
                        {usd(tariff)}
                        <div className="text-xs text-muted">{r.customsValue > 0 ? `${pct(tariff / r.customsValue)} of value` : ''}</div>
                        <Collapse open={details}>
                          <div className="mt-1 space-y-0.5 border-t border-line pt-1 text-xs text-muted">
                            <div>Base {usd(r.baseDuty)}</div>
                            <div>
                              + Extra {usd(r.extraDuty)} <span className="text-muted">({pct(r.extraRate)})</span>
                            </div>
                          </div>
                        </Collapse>
                      </td>
                      <td className="py-3 pr-3">{usd(r.freight + r.insurance)}</td>
                      <td className="py-3 pr-3">{usd(r.mpf + r.hmf + r.broker)}</td>
                      <td className="py-3 pr-3">
                        {sup && (
                          <>
                            {sup.leadTimeDays + sup.transitDays} days
                            <Collapse open={details}>
                              <div className="mt-1 border-t border-line pt-1 text-xs text-muted">
                                {sup.leadTimeDays} lead + {sup.transitDays} transit
                              </div>
                            </Collapse>
                          </>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-ink">{usd(r.total, true)}</td>
                      <td className="py-3">{usd(r.avgUnit, true)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Customs fees = merchandise processing fee + harbor maintenance fee + broker. Tariffs are charged on product value only (FOB). Time to arrive = supplier lead time + transit.</p>
        </Card>

        {chosen && (
          <Card title={`Landed cost per unit: ${chosen.supplierName} (${chosen.country})`} actions={toggleDetails}>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-line text-right text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 text-left">Product</th>
                    <th className="py-2 pr-3">Qty<Info term="qty" /></th>
                    <th className="py-2 pr-3">Quote<Info term="unitPrice" /></th>
                    <th className="py-2 pr-3">Tariff rate<Info term="totalTariffRate" /></th>
                    <th className="py-2 pr-3">Landed per unit<Info term="landedUnit" /></th>
                    <th className="py-2 pr-3">Markup on quote<Info term="markup" /></th>
                    <th className="py-2">Line total<Info term="lineTotal" /></th>
                  </tr>
                </thead>
                <tbody>
                  {chosen.perProduct.map((p) => (
                    <tr key={p.productId} className="border-b border-line/60 text-right">
                      <td className="py-2 pr-3 text-left">{p.name}</td>
                      <td className="py-2 pr-3">{p.qty.toLocaleString()}</td>
                      <td className="py-2 pr-3">{usd(p.unitPrice, true)}</td>
                      <td className="py-2 pr-3">
                        {pct(p.baseRate + chosen.extraRate)}
                        <Collapse open={details}>
                          <div className="text-xs text-muted">
                            {pct(p.baseRate)} base + {pct(chosen.extraRate)} extra
                          </div>
                        </Collapse>
                      </td>
                      <td className="py-2 pr-3 font-semibold">{usd(p.landedUnit, true)}</td>
                      <td className="py-2 pr-3 text-muted">{p.unitPrice > 0 ? `+${pct(p.landedUnit / p.unitPrice - 1, 0)}` : ''}</td>
                      <td className="py-2">{usd(p.landedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">Freight, customs fees and broker are spread across products by their share of product value.</p>
          </Card>
        )}
      </NeedsData>
    </div>
  )
}

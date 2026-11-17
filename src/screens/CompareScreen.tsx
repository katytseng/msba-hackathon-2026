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
        <div className="mb-8">
          <Callout tone="info">
            <p>{supplierSentence(ranked)}</p>
          </Callout>
        </div>

        <Card title="Suppliers, cheapest first" className="mb-8" actions={toggleDetails}>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line-strong text-right text-[0.8125rem] text-muted [&>:first-child]:pl-3 [&>:last-child]:pr-3">
                  <th className="py-3 pr-4 text-center">Select</th>
                  <th className="py-3 pr-3 text-left">Supplier</th>
                  <th className="py-3 pr-3"><Info term="productCost" lead />Product cost</th>
                  <th className="py-3 pr-3"><Info term="totalTariff" lead />Tariffs</th>
                  <th className="py-3 pr-3"><Info term="freightInsurance" lead />Freight + insurance</th>
                  <th className="py-3 pr-3"><Info term="customsFees" lead />Customs fees</th>
                  <th className="py-3 pr-3"><Info term="daysToArrive" lead />Time to arrive</th>
                  <th className="py-3 pr-3"><Info term="landedTotal" lead />Landed total</th>
                  <th className="py-3"><Info term="avgUnit" lead />Per unit</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const isChosen = chosen?.supplierId === r.supplierId
                  const isCheapest = r.rank === 1
                  const sup = inputs.suppliers.find((s) => s.id === r.supplierId)
                  const tariff = r.baseDuty + r.extraDuty
                  return (
                    <tr key={r.supplierId} className={`border-b border-line text-right [&>:first-child]:pl-3 [&>:last-child]:pr-3 ${isCheapest ? 'bg-good-soft' : ''}`}>
                      <td className="py-4 pr-4 text-center">
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
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 ${
                              isChosen ? 'border-good bg-good' : 'border-line-strong bg-surface hover:border-good'
                            }`}
                          >
                            {isChosen && (
                              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m3.5 8.4 3 3 6-6.8" />
                              </svg>
                            )}
                          </span>
                        </label>
                      </td>
                      <td className="py-4 pr-3 text-left">
                        <div className="font-semibold text-ink">
                          {r.rank}. {r.supplierName} <span className="font-normal text-muted">({r.country})</span>
                        </div>
                        {isCheapest ? (
                          <span className="mt-1.5 inline-block rounded-full bg-good px-2.5 py-0.5 text-xs font-medium text-white">Cheapest</span>
                        ) : (
                          <span className="text-xs text-muted">+{usd(r.gapToCheapest, true)} vs cheapest</span>
                        )}
                      </td>
                      <td className="py-4 pr-3">{usd(r.customsValue)}</td>
                      <td className="py-4 pr-3">
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
                      <td className="py-4 pr-3">{usd(r.freight + r.insurance)}</td>
                      <td className="py-4 pr-3">{usd(r.mpf + r.hmf + r.broker)}</td>
                      <td className="py-4 pr-3">
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
                      <td className="py-4 pr-3 font-semibold text-ink">{usd(r.total, true)}</td>
                      <td className="py-4">{usd(r.avgUnit, true)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-6 max-w-[78ch] text-xs leading-5 text-muted">Customs fees = merchandise processing fee + harbor maintenance fee + broker. Tariffs are charged on product value only (FOB). Time to arrive = supplier lead time + transit.</p>
        </Card>

        {chosen && (
          <Card title={`Landed cost per unit: ${chosen.supplierName} (${chosen.country})`} actions={toggleDetails}>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-line-strong text-right text-[0.8125rem] text-muted [&>:first-child]:pl-3 [&>:last-child]:pr-3">
                    <th className="py-3 pr-3 text-left">Product</th>
                    <th className="py-3 pr-3"><Info term="qty" lead />Qty</th>
                    <th className="py-3 pr-3"><Info term="unitPrice" lead />Quote</th>
                    <th className="py-3 pr-3"><Info term="totalTariffRate" lead />Tariff rate</th>
                    <th className="py-3 pr-3"><Info term="landedUnit" lead />Landed per unit</th>
                    <th className="py-3 pr-3"><Info term="markup" lead />Markup on quote</th>
                    <th className="py-3"><Info term="lineTotal" lead />Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {chosen.perProduct.map((p) => (
                    <tr key={p.productId} className="border-b border-line text-right">
                      <td className="py-3.5 pr-3 text-left">{p.name}</td>
                      <td className="py-3.5 pr-3">{p.qty.toLocaleString()}</td>
                      <td className="py-3.5 pr-3">{usd(p.unitPrice, true)}</td>
                      <td className="py-3.5 pr-3">
                        {pct(p.baseRate + chosen.extraRate)}
                        <Collapse open={details}>
                          <div className="text-xs text-muted">
                            {pct(p.baseRate)} base + {pct(chosen.extraRate)} extra
                          </div>
                        </Collapse>
                      </td>
                      <td className="py-3.5 pr-3 font-semibold">{usd(p.landedUnit, true)}</td>
                      <td className="py-3.5 pr-3 text-muted">{p.unitPrice > 0 ? `+${pct(p.landedUnit / p.unitPrice - 1, 0)}` : ''}</td>
                      <td className="py-3.5">{usd(p.landedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 max-w-[78ch] text-xs leading-5 text-muted">Freight, customs fees and broker are spread across products by their share of product value.</p>
          </Card>
        )}
      </NeedsData>
    </div>
  )
}

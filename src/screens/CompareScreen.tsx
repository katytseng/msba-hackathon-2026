import { pct, usd } from '../format'
import { useApp } from '../state'
import { supplierSentence } from '../summaries'
import { Button, Callout, Card, NeedsData, NextLink, PageHeader } from '../components/ui'

export default function CompareScreen() {
  const { ranked, chosen, setSelectedId } = useApp()

  return (
    <div>
      <PageHeader step={3} title="Compare landed cost" subtitle="Everything you pay to get the goods to your door: product, freight, insurance, tariffs and customs fees." />
      <NeedsData>
        <div className="mb-5">
          <Callout tone="info">
            <p>{supplierSentence(ranked)}</p>
          </Callout>
        </div>

        <Card title="Suppliers, cheapest first" className="mb-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-right text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 text-left">Supplier</th>
                  <th className="py-2 pr-3">Product cost</th>
                  <th className="py-2 pr-3">Base tariff</th>
                  <th className="py-2 pr-3">Extra tariff</th>
                  <th className="py-2 pr-3">Freight + insurance</th>
                  <th className="py-2 pr-3">Customs fees</th>
                  <th className="py-2 pr-3">Landed total</th>
                  <th className="py-2 pr-3">Per unit</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const isChosen = chosen?.supplierId === r.supplierId
                  const isCheapest = r.rank === 1
                  return (
                    <tr key={r.supplierId} className={`border-b border-slate-100 text-right ${isCheapest ? 'bg-emerald-50' : ''}`}>
                      <td className="py-3 pr-3 text-left">
                        <div className="font-semibold text-slate-900">
                          {r.rank}. {r.supplierName} <span className="font-normal text-slate-500">({r.country})</span>
                        </div>
                        {isCheapest ? (
                          <span className="mt-1 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">Cheapest</span>
                        ) : (
                          <span className="text-xs text-slate-500">+{usd(r.gapToCheapest, true)} vs cheapest</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">{usd(r.customsValue)}</td>
                      <td className="py-3 pr-3">{usd(r.baseDuty)}</td>
                      <td className="py-3 pr-3">
                        {usd(r.extraDuty)}
                        <div className="text-xs text-slate-500">{pct(r.extraRate)}</div>
                      </td>
                      <td className="py-3 pr-3">{usd(r.freight + r.insurance)}</td>
                      <td className="py-3 pr-3">{usd(r.mpf + r.hmf + r.broker)}</td>
                      <td className="py-3 pr-3 text-base font-bold text-slate-900">{usd(r.total, true)}</td>
                      <td className="py-3 pr-3">{usd(r.avgUnit, true)}</td>
                      <td className="py-3 text-right">
                        {isChosen ? (
                          <span className="inline-block rounded-md bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-800">Selected</span>
                        ) : (
                          <Button variant="secondary" onClick={() => setSelectedId(r.supplierId)}>Select</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">Customs fees = merchandise processing fee + harbor maintenance fee + broker. Tariffs are charged on product value only (FOB).</p>
        </Card>

        {chosen && (
          <Card title={`Landed cost per unit: ${chosen.supplierName} (${chosen.country})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-right text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 text-left">Product</th>
                    <th className="py-2 pr-3">Qty</th>
                    <th className="py-2 pr-3">Quote</th>
                    <th className="py-2 pr-3">Base tariff</th>
                    <th className="py-2 pr-3">Landed per unit</th>
                    <th className="py-2 pr-3">Markup on quote</th>
                    <th className="py-2">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {chosen.perProduct.map((p) => (
                    <tr key={p.productId} className="border-b border-slate-100 text-right">
                      <td className="py-2 pr-3 text-left">{p.name}</td>
                      <td className="py-2 pr-3">{p.qty.toLocaleString()}</td>
                      <td className="py-2 pr-3">{usd(p.unitPrice, true)}</td>
                      <td className="py-2 pr-3">{pct(p.baseRate)}</td>
                      <td className="py-2 pr-3 font-semibold">{usd(p.landedUnit, true)}</td>
                      <td className="py-2 pr-3 text-slate-600">{p.unitPrice > 0 ? `+${pct(p.landedUnit / p.unitPrice - 1, 0)}` : ''}</td>
                      <td className="py-2">{usd(p.landedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">Freight, customs fees and broker are spread across products by their share of product value.</p>
          </Card>
        )}
        <NextLink to="/cash">Next: can your cash carry it?</NextLink>
      </NeedsData>
    </div>
  )
}

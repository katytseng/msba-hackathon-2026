import { useState } from 'react'
import type { Supplier } from '../engine'
import { pct, usd } from '../format'
import { rates, useApp } from '../state'
import { Button, Card, DetailsToggle, Info, NextLink, NumberField, PageHeader } from '../components/ui'

const countries = Object.keys(rates.extraTariffs)

export default function SuppliersScreen() {
  const { inputs, setInputs, ranked } = useApp()
  const [openTariff, setOpenTariff] = useState<Record<string, boolean>>({})
  const { suppliers, products } = inputs

  const setSupplier = (id: string, patch: Partial<Supplier>) =>
    setInputs((p) => ({ ...p, suppliers: p.suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const setPrice = (s: Supplier, productId: string, v: number) => setSupplier(s.id, { prices: { ...s.prices, [productId]: v } })
  const addSupplier = () =>
    setInputs((p) => {
      const letter = String.fromCharCode(65 + p.suppliers.length)
      return {
        ...p,
        suppliers: [
          ...p.suppliers,
          {
            id: `s${Date.now()}`,
            name: `Supplier ${letter}`,
            country: countries[0],
            prices: {},
            freight: 0,
            depositPct: 0.3,
            balanceDays: 0,
            leadTimeDays: 30,
            transitDays: 20,
          },
        ],
      }
    })
  const removeSupplier = (id: string) => setInputs((p) => ({ ...p, suppliers: p.suppliers.filter((s) => s.id !== id) }))

  return (
    <div>
      <PageHeader step={2} title="Supplier quotes" subtitle="Unit prices (FOB), freight and payment terms from each supplier." />

      {products.length === 0 && (
        <Card className="mb-5">
          <p className="text-slate-600">Add products on the Business step first, or click <b>Reset to sample</b>.</p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {suppliers.map((s) => {
          const extra = rates.extraTariffs[s.country]
          const r = ranked.find((x) => x.supplierId === s.id)
          const tariff = r ? r.baseDuty + r.extraDuty : 0
          const showDetails = !!openTariff[s.id]
          const detailsId = `tariff-details-${s.id}`
          return (
            <Card key={s.id}>
              <div className="mb-3 flex items-center gap-2">
                <input
                  className="w-full rounded-md border border-slate-300 px-2 py-1 font-semibold"
                  value={s.name}
                  onChange={(e) => setSupplier(s.id, { name: e.target.value })}
                />
                <Button variant="danger" onClick={() => removeSupplier(s.id)}>Remove</Button>
              </div>

              <label className="mb-1 flex items-center text-sm font-medium text-slate-700">
                Ships from
                <Info term="country" />
              </label>
              <select
                className="mb-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={s.country}
                onChange={(e) => setSupplier(s.id, { country: e.target.value })}
              >
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <div className="mb-4 mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                {r && r.customsValue > 0 ? (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center font-medium text-slate-700">
                        Tariffs on this quote
                        <Info term="totalTariff" />
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">{usd(tariff)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">{pct(tariff / r.customsValue)} of product value</span>
                      <DetailsToggle open={showDetails} controls={detailsId} onToggle={() => setOpenTariff((o) => ({ ...o, [s.id]: !o[s.id] }))} />
                    </div>
                    {showDetails && (
                      <dl id={detailsId} className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs tabular-nums text-slate-600">
                        <div className="flex justify-between gap-2">
                          <dt className="flex items-center">
                            Base tariff (HTS)
                            <Info term="htsDuty" />
                          </dt>
                          <dd>
                            {usd(r.baseDuty)} <span className="text-slate-400">· avg {pct(r.baseDuty / r.customsValue)}</span>
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="flex items-center">
                            Extra tariff, {s.country}
                            <Info term="extraTariff" />
                          </dt>
                          <dd>
                            {usd(r.extraDuty)} <span className="text-slate-400">· {pct(r.extraRate)}</span>
                          </dd>
                        </div>
                        {extra && <p className="text-slate-500">{extra.note}</p>}
                      </dl>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-500">
                    {extra ? `Extra tariff from ${s.country}: ${pct(extra.rate)}. ` : ''}Enter unit prices to see total tariffs.
                  </p>
                )}
              </div>

              <p className="mb-2 flex items-center text-sm font-medium text-slate-700">
                Unit price per product (FOB)
                <Info term="unitPrice" />
              </p>
              <div className="mb-4 space-y-1.5">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-slate-600">{p.name}</span>
                    <NumberField compact label={`${p.name} price`} prefix="$" className="w-28" value={s.prices[p.id] ?? 0} onChange={(v) => setPrice(s, p.id, v)} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Freight quote" info="freight" prefix="$" value={s.freight} onChange={(v) => setSupplier(s.id, { freight: v })} />
                <NumberField label="Deposit" info="deposit" suffix="%" scale={100} value={s.depositPct} onChange={(v) => setSupplier(s.id, { depositPct: Math.min(1, Math.max(0, v)) })} />
                <NumberField label="Lead time" info="leadTime" suffix="days" value={s.leadTimeDays} onChange={(v) => setSupplier(s.id, { leadTimeDays: Math.max(0, Math.round(v)) })} />
                <NumberField label="Transit" info="transit" suffix="days" value={s.transitDays} onChange={(v) => setSupplier(s.id, { transitDays: Math.max(0, Math.round(v)) })} />
                <NumberField
                  label="Balance due, days after ship"
                  info="balanceDays"
                  suffix="days"
                  className="col-span-2"
                  value={s.balanceDays}
                  onChange={(v) => setSupplier(s.id, { balanceDays: Math.max(0, Math.round(v)) })}
                />
              </div>
            </Card>
          )
        })}

        <button
          onClick={addSupplier}
          className="flex min-h-40 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-700"
        >
          + Add supplier
        </button>
      </div>

      <NextLink to="/compare">Next: compare landed cost</NextLink>
    </div>
  )
}

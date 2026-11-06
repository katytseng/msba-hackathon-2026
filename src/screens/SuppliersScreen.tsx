import type { Supplier } from '../engine'
import { pct } from '../format'
import { rates, useApp } from '../state'
import { Button, Card, NextLink, NumberField, PageHeader } from '../components/ui'

const countries = Object.keys(rates.extraTariffs)

export default function SuppliersScreen() {
  const { inputs, setInputs } = useApp()
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
          <p className="text-slate-600">Add products on the Business step first, or click <b>Load sample</b>.</p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {suppliers.map((s) => {
          const extra = rates.extraTariffs[s.country]
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

              <label className="mb-1 block text-sm font-medium text-slate-700">Ships from</label>
              <select
                className="mb-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={s.country}
                onChange={(e) => setSupplier(s.id, { country: e.target.value })}
              >
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {extra && (
                <p className="mb-4 text-xs text-slate-500">
                  Extra tariff {pct(extra.rate)} ({extra.note})
                </p>
              )}

              <p className="mb-2 text-sm font-medium text-slate-700">Unit price per product</p>
              <div className="mb-4 space-y-1.5">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-slate-600">{p.name}</span>
                    <NumberField compact label={`${p.name} price`} prefix="$" className="w-28" value={s.prices[p.id] ?? 0} onChange={(v) => setPrice(s, p.id, v)} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Freight quote" prefix="$" value={s.freight} onChange={(v) => setSupplier(s.id, { freight: v })} />
                <NumberField label="Deposit" suffix="%" scale={100} value={s.depositPct} onChange={(v) => setSupplier(s.id, { depositPct: Math.min(1, Math.max(0, v)) })} />
                <NumberField label="Lead time" suffix="days" value={s.leadTimeDays} onChange={(v) => setSupplier(s.id, { leadTimeDays: Math.max(0, Math.round(v)) })} />
                <NumberField label="Transit" suffix="days" value={s.transitDays} onChange={(v) => setSupplier(s.id, { transitDays: Math.max(0, Math.round(v)) })} />
                <NumberField
                  label="Balance due, days after ship"
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

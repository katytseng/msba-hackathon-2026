import { productBaseRate, type Business, type Product } from '../engine'
import { pct } from '../format'
import { APR_PRESETS, rates, useApp } from '../state'
import { Button, Card, Info, NumberField, PageHeader } from '../components/ui'
import HtsPicker from '../components/HtsPicker'

const htsCodes = Object.entries(rates.baseTariffs)

export default function BusinessScreen() {
  const { inputs, setInputs } = useApp()
  const { business, products } = inputs

  const setBiz = (patch: Partial<Business>) => setInputs((p) => ({ ...p, business: { ...p.business, ...patch } }))
  const setProduct = (id: string, patch: Partial<Product>) =>
    setInputs((p) => ({ ...p, products: p.products.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  const addProduct = () =>
    setInputs((p) => ({
      ...p,
      products: [
        ...p.products,
        { id: `p${Date.now()}`, name: 'New product', htsCode: htsCodes[0][0], qty: 100, sellPrice: 0, salesPerWeek: 10 },
      ],
    }))
  const removeProduct = (id: string) => setInputs((p) => ({ ...p, products: p.products.filter((x) => x.id !== id) }))

  return (
    <div>
      <PageHeader step={1} title="Your business" subtitle="Cash today, the cushion you want to keep, and what you sell." />

      <Card title="Cash" className="mb-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <NumberField label="Cash on hand" info="cash" prefix="$" value={business.cash} onChange={(v) => setBiz({ cash: v })} />
          <NumberField label="Safety buffer" info="buffer" prefix="$" value={business.buffer} onChange={(v) => setBiz({ buffer: v })} />
          <div>
            <NumberField label="Loan APR" info="apr" suffix="%" scale={100} value={business.apr} onChange={(v) => setBiz({ apr: v })} />
            <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="APR presets">
              {APR_PRESETS.map((r) => {
                const active = Math.abs(business.apr - r) < 1e-9
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setBiz({ apr: r })}
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${
                      active ? 'border-ink bg-ink text-white' : 'border-line-strong text-muted hover:bg-page'
                    }`}
                  >
                    {Math.round(r * 100)}%
                  </button>
                )
              })}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 flex items-center text-sm font-medium text-copy">Order date<Info term="orderDate" /></span>
            <input
              type="date"
              className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
              value={business.orderDate}
              onChange={(e) => e.target.value && setBiz({ orderDate: e.target.value })}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">The safety buffer is the lowest balance you are comfortable with. We flag any week your cash falls below it.</p>
      </Card>

      <Card title="Products in this order">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="whitespace-nowrap border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-2">Product<Info term="productName" /></th>
                <th className="py-2 pr-2">HTS code<Info term="htsCode" /></th>
                <th className="py-2 pr-2 text-right">Base tariff<Info term="baseTariff" /></th>
                <th className="w-24 py-2 pr-2 text-right">Quantity<Info term="qty" /></th>
                <th className="w-28 py-2 pr-2 text-right">Sell price<Info term="sellPrice" /></th>
                <th className="w-32 py-2 pr-2 text-right">Sales / week<Info term="salesPerWeek" /></th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line/60">
                  <td className="py-2 pr-2">
                    <input
                      className="w-full rounded-md border border-line-strong px-2 py-1 text-sm"
                      value={p.name}
                      onChange={(e) => setProduct(p.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <HtsPicker
                      code={p.htsCode}
                      description={p.htsDescription}
                      onPick={(pick) => setProduct(p.id, pick)}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-muted">{pct(productBaseRate(rates, p))}</td>
                  <td className="py-2 pr-2">
                    <NumberField compact label="Quantity" value={p.qty} onChange={(v) => setProduct(p.id, { qty: Math.max(0, Math.round(v)) })} />
                  </td>
                  <td className="py-2 pr-2">
                    <NumberField compact label="Sell price" prefix="$" value={p.sellPrice} onChange={(v) => setProduct(p.id, { sellPrice: v })} />
                  </td>
                  <td className="py-2 pr-2">
                    <NumberField compact label="Sales per week" value={p.salesPerWeek} onChange={(v) => setProduct(p.id, { salesPerWeek: Math.max(0, v) })} />
                  </td>
                  <td className="py-2 text-right">
                    <Button variant="danger" onClick={() => removeProduct(p.id)}>Remove</Button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted">
                    No products yet. Click <b>Reset to sample</b> at the top, or add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Button variant="secondary" onClick={addProduct}>+ Add product</Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Search or browse the full USITC Harmonized Tariff Schedule, refreshed daily. Estimates use the general (most-favored-nation)
          rate and only support percent and Free rates; codes charged per kg, per unit or a mix of both can’t be picked yet.
        </p>
      </Card>
    </div>
  )
}

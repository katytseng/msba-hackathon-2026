import { productBaseRate, type Business, type Product } from '../engine'
import { Link } from 'react-router-dom'
import { pct, usd } from '../format'
import { rates, useApp } from '../state'
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
      <PageHeader step={1} title="Order details" subtitle="When you place this order, and what's in it." />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="block w-56">
            <span className="mb-1 flex items-center text-sm font-medium text-copy">Order date<Info term="orderDate" /></span>
            <input
              type="date"
              className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
              value={business.orderDate}
              onChange={(e) => e.target.value && setBiz({ orderDate: e.target.value })}
            />
          </label>
          <p className="flex-1 text-xs text-muted">
            Cash on hand ({usd(business.cash)}), safety buffer ({usd(business.buffer)}) and loan APR ({pct(business.apr, 0)}) are set once for the whole
            company on the dashboard's{' '}
            <Link to="/finances" className="font-medium text-ink underline underline-offset-2">
              Finances
            </Link>{' '}
            tab.
          </p>
        </div>
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
                    No products yet. Click <b>Load sample</b> at the top, or add one.
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

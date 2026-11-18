import { productBaseRate, type Business, type Product } from '../engine'
import { Link } from 'react-router-dom'
import { pct, usd } from '../format'
import { rates, useApp } from '../state'
import { Button, Card, Info, NumberField, PageHeader, Plus } from '../components/ui'
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

      <Card className="mb-8">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <label className="block w-56">
            <span className="mb-1.5 flex items-center text-sm font-medium text-copy">Order date<Info term="orderDate" /></span>
            <input
              type="date"
              className="field w-full"
              value={business.orderDate}
              onChange={(e) => e.target.value && setBiz({ orderDate: e.target.value })}
            />
          </label>
          <p className="min-w-[16rem] flex-1 text-[0.8125rem] leading-5 text-muted">
            Cash on hand ({usd(business.cash)}), safety buffer ({usd(business.buffer)}) and loan APR ({pct(business.apr, 0)}) are set once for the whole
            company on the dashboard's{' '}
            <Link to="/finances" className="font-medium text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink">
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
              <tr className="whitespace-nowrap border-b border-line-strong text-left text-[0.8125rem] text-muted">
                <th className="py-3 pr-3">Product<Info term="productName" /></th>
                <th className="py-3 pr-3">HTS code<Info term="htsCode" /></th>
                <th className="py-3 pr-3 text-right"><Info term="baseTariff" lead />Base tariff</th>
                <th className="w-24 py-3 pr-3 text-right"><Info term="qty" lead />Quantity</th>
                <th className="w-28 py-3 pr-3 text-right"><Info term="sellPrice" lead />Sell price</th>
                <th className="w-32 py-3 pr-3 text-right"><Info term="salesPerWeek" lead />Sales / week</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="py-3 pr-3">
                    <input
                      className="field w-full !py-1.5"
                      value={p.name}
                      onChange={(e) => setProduct(p.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <HtsPicker
                      code={p.htsCode}
                      description={p.htsDescription}
                      onPick={(pick) => setProduct(p.id, pick)}
                    />
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-muted">{pct(productBaseRate(rates, p))}</td>
                  <td className="py-3 pr-3">
                    <NumberField compact label="Quantity" value={p.qty} onChange={(v) => setProduct(p.id, { qty: Math.max(0, Math.round(v)) })} />
                  </td>
                  <td className="py-3 pr-3">
                    <NumberField compact label="Sell price" prefix="$" value={p.sellPrice} onChange={(v) => setProduct(p.id, { sellPrice: v })} />
                  </td>
                  <td className="py-3 pr-3">
                    <NumberField compact label="Sales per week" value={p.salesPerWeek} onChange={(v) => setProduct(p.id, { salesPerWeek: Math.max(0, v) })} />
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="danger" onClick={() => removeProduct(p.id)}>Remove</Button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No products yet. Click <b>Load sample</b> at the top, or add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6">
          <Button variant="secondary" onClick={addProduct}><Plus />Add product</Button>
        </div>
        <p className="mt-6 max-w-[78ch] text-xs leading-5 text-muted">
          Search or browse the full USITC Harmonized Tariff Schedule, refreshed daily. Estimates use the general (most-favored-nation)
          rate and only support percent and Free rates; codes charged per kg, per unit or a mix of both can’t be picked yet.
        </p>
      </Card>
    </div>
  )
}

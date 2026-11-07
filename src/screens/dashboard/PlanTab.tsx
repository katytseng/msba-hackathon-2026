import { useMemo, useState, type ReactNode } from 'react'
import {
  addDays,
  cashTimeline,
  compareSuppliers,
  costBreakdown,
  countryFlipRate,
  extraRateFor,
  orderMargin,
  type CashResult,
  type CostLineKey,
  type Inputs,
  type OrderMargin,
  type RankedResult,
  type Rates,
} from '../../engine'
import { reorderAdvice, withExtraRates, type Company, type ReorderAdvice, type SavedOrder } from '../../engine/portfolio'
import { niceDate, num, pct, shortDate, usd } from '../../format'
import { rates, useApp } from '../../state'
import { Button, Card, Details } from '../../components/ui'
import { Dot, Stat, supplierLabel, type Portfolio } from './shared'

const RANGE_ABOVE_TODAY = 0.3
const SAME = 0.0005 // rates closer than this count as equal (slider steps are 0.005)

const signedPoints = (x: number) => `${x >= 0 ? '+' : '-'}${Math.abs(x * 100).toFixed(1)} points`

const COST_LABELS: Record<CostLineKey, string> = {
  product: 'Product cost',
  baseDuty: 'Base tariff duty',
  extraDuty: 'Extra tariff duty',
  mpf: 'Customs processing fee',
  hmf: 'Harbor fee',
  insurance: 'Insurance',
  freight: 'Freight',
  broker: 'Broker fee',
}

export type Overrides = Record<string, number>

export default function PlanTab({ p, overrides, setOverrides }: { p: Portfolio; overrides: Overrides; setOverrides: (fn: (m: Overrides) => Overrides) => void }) {
  const { orders } = useApp()
  const scenarioRates = useMemo(() => withExtraRates(rates, overrides), [overrides])
  const countries = useMemo(
    () => [...new Set(orders.flatMap((o) => o.inputs.suppliers.map((s) => s.country)))].filter((c) => rates.extraTariffs[c]),
    [orders],
  )
  const advice = useMemo(
    () => p.analyses.map(({ a, color }) => ({ r: reorderAdvice(a.order, rates, scenarioRates), color, placedToday: a.placed })),
    [p.analyses, scenarioRates],
  )

  if (p.analyses.length === 0) {
    return (
      <Card>
        <p className="mb-1 font-semibold text-ink">Nothing to plan yet.</p>
        <p className="text-sm text-muted">Save at least one order on the Orders tab. Then set the tariffs you expect here and see who to buy from next time, order by order and item by item.</p>
      </Card>
    )
  }

  const rateOf = (c: string) => overrides[c] ?? extraRateFor(rates, c)
  const moved = countries.some((c) => Math.abs(rateOf(c) - extraRateFor(rates, c)) > SAME)
  const switches = advice.filter(({ r }) => r.savings > 0.5)
  const totalToday = advice.reduce((t, x) => t + x.placedToday.total, 0)
  const totalNext = advice.reduce((t, x) => t + x.r.best.total, 0)
  const totalSaved = switches.reduce((t, x) => t + x.r.savings, 0)
  const tariffsToday = advice.reduce((t, x) => t + x.placedToday.baseDuty + x.placedToday.extraDuty, 0)
  const tariffsNext = advice.reduce((t, x) => t + x.r.best.baseDuty + x.r.best.extraDuty, 0)
  const at = moved ? 'at these tariffs' : "at today's tariffs"

  return (
    <div>
      <TariffControls countries={countries} rateOf={rateOf} moved={moved} setOverrides={setOverrides} />

      <p className="mb-4 text-xl font-semibold leading-snug text-ink" aria-live="polite">
        {switches.length === 0
          ? `Reorder everything ${at}: stay with the same supplier for every order.`
          : `Reorder everything ${at}: switch supplier for ${switches.length} of ${advice.length} ${advice.length === 1 ? 'order' : 'orders'} and save ${usd(totalSaved)}.`}
      </p>

      <dl className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Reorder everything" value={usd(totalNext)} sub={<VsLine diff={totalNext - totalToday} label="vs these orders today" />} />
        <Stat label="Tariffs on the reorder" value={usd(tariffsNext)} sub={<VsLine diff={tariffsNext - tariffsToday} label="vs today" />} />
        <Stat label="Saved by switching" value={usd(totalSaved)} sub={switches.length ? `${switches.length} supplier ${switches.length === 1 ? 'change' : 'changes'}` : 'no changes needed'} tone={totalSaved > 0.5 ? 'good' : 'plain'} />
      </dl>

      <Recommendations advice={advice} scenarioRates={scenarioRates} />
      <ByItem advice={advice} />
      <OrderDeepDive p={p} scenarioRates={scenarioRates} rateOf={rateOf} />
    </div>
  )
}

function VsLine({ diff, label }: { diff: number; label: string }) {
  if (Math.round(Math.abs(diff)) === 0) return <>same as today</>
  return (
    <span className={diff > 0 ? 'text-red-700' : 'text-emerald-700'}>
      {usd(Math.abs(diff))} {diff > 0 ? 'more' : 'less'} <span className="text-muted">{label}</span>
    </span>
  )
}

// ---------- Tariff sliders ----------

function TariffControls({
  countries,
  rateOf,
  moved,
  setOverrides,
}: {
  countries: string[]
  rateOf: (c: string) => number
  moved: boolean
  setOverrides: (fn: (m: Overrides) => Overrides) => void
}) {
  const setRate = (c: string, r: number) => setOverrides((m) => ({ ...m, [c]: Math.max(0, Math.round(r * 1000) / 1000) }))
  return (
    <Card title="Tariffs you expect" className="mb-5">
      <p className="-mt-2 mb-4 text-xs text-muted">
        Placed orders stay as they are. Move a country's extra tariff to see who to order from if you buy the same items again.
      </p>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => {
          const today = extraRateFor(rates, c)
          const r = rateOf(c)
          const changed = Math.abs(r - today) > SAME
          return (
            <div key={c}>
              <div className="flex items-baseline justify-between text-sm">
                <label htmlFor={`plan-tariff-${c}`} className="font-medium text-ink">
                  {c}
                </label>
                <span className="tabular-nums">
                  <b className="text-ink">{pct(r)}</b>
                  <span className={`ml-1.5 text-xs ${changed ? 'text-accent-ink' : 'text-muted'}`}>{changed ? signedPoints(r - today) : `today ${pct(today)}`}</span>
                </span>
              </div>
              <input
                id={`plan-tariff-${c}`}
                type="range"
                min={0}
                max={(today + RANGE_ABOVE_TODAY) * 100}
                step={0.5}
                value={r * 100}
                aria-valuetext={pct(r)}
                onChange={(e) => setRate(c, parseFloat(e.target.value) / 100)}
                className="w-full accent-ink"
              />
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant={moved ? 'secondary' : 'primary'} className="!px-2.5 !py-1 text-xs" onClick={() => setOverrides(() => ({}))}>
          Today's rates
        </Button>
        <Button variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => setOverrides(() => Object.fromEntries(countries.map((c) => [c, extraRateFor(rates, c) + 0.1])))}>
          All +10 points
        </Button>
        <Button variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => setOverrides(() => Object.fromEntries(countries.map((c) => [c, 0])))}>
          All removed
        </Button>
      </div>
      <TariffSources />
    </Card>
  )
}

// ---------- Per-order recommendations ----------

type Advice = { r: ReorderAdvice; color: string; placedToday: RankedResult }

function Recommendations({ advice, scenarioRates }: { advice: Advice[]; scenarioRates: Rates }) {
  return (
    <Card title="Who to order from next time" className="mb-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="py-2 pr-3">Order</th>
              <th scope="col" className="py-2 pr-3">Last time</th>
              <th scope="col" className="py-2 pr-3">Next time</th>
              <th scope="col" className="py-2 pr-3 text-right">Reorder cost</th>
              <th scope="col" className="py-2 pr-3 text-right">Vs last time</th>
              <th scope="col" className="py-2">Switch point</th>
            </tr>
          </thead>
          <tbody>
            {advice.map(({ r, color, placedToday }) => {
              const better = r.savings > 0.5
              const country = placedToday.country
              const flip = countryFlipRate(r.order.inputs, scenarioRates, country)
              return (
                <tr key={r.order.id} className={`border-b border-line/60 align-top ${better ? 'bg-accent-soft' : ''}`}>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <Dot color={color} />
                      {r.order.name}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-copy">{supplierLabel(placedToday)}</td>
                  <td className="py-2.5 pr-3">
                    {better ? (
                      <>
                        <span className="font-semibold text-ink">Switch to {supplierLabel(r.best)}</span>
                        <span className="block text-xs text-emerald-700">saves {usd(r.savings)} vs staying</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-ink">✓ Stay with {r.best.supplierName}</span>
                        {r.ranked[1] && <span className="block text-xs text-muted">{usd(r.ranked[1].total - r.best.total)} less than {r.ranked[1].supplierName}</span>}
                      </>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-medium tabular-nums text-ink">{usd(r.best.total)}</td>
                  <td className="py-2.5 pr-3 text-right text-xs tabular-nums">
                    <VsLine diff={r.vsToday} label="" />
                  </td>
                  <td className="py-2.5 text-xs text-copy">
                    {flip === null
                      ? 'No supplier outside ' + country + ' to compare'
                      : `Cheapest changes if ${country}'s tariff ${flip >= extraRateFor(scenarioRates, country) ? 'passes' : 'drops under'} ${pct(Math.max(0, flip))}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------- By item ----------

interface ItemRow {
  key: string
  name: string
  htsCode: string
  orders: number
  units: number
  colors: string[]
  landedNow: number
  tariffNow: number
  landedNext: number
}

function ByItem({ advice }: { advice: Advice[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, ItemRow>()
    for (const { r, color, placedToday } of advice) {
      for (const prod of r.order.inputs.products) {
        const now = placedToday.perProduct.find((x) => x.productId === prod.id)
        const next = r.best.perProduct.find((x) => x.productId === prod.id)
        if (!now || now.qty <= 0) continue
        const key = `${prod.htsCode}|${prod.name.trim().toLowerCase()}`
        const row = map.get(key) ?? { key, name: prod.name.trim(), htsCode: prod.htsCode, orders: 0, units: 0, colors: [], landedNow: 0, tariffNow: 0, landedNext: 0 }
        row.orders += 1
        row.units += now.qty
        row.colors.push(color)
        row.landedNow += now.landedTotal
        row.tariffNow += now.unitPrice * now.qty * (now.baseRate + placedToday.extraRate)
        row.landedNext += next ? next.landedTotal : now.landedTotal
        map.set(key, row)
      }
    }
    return [...map.values()].sort((a, b) => b.orders - a.orders || b.units - a.units)
  }, [advice])

  if (rows.length === 0) return null
  const top = rows[0]
  return (
    <Card title="By item" className="mb-5">
      <p className="-mt-2 mb-3 text-xs text-muted">
        Every product across your saved orders, most often bought first. <b className="text-ink">{top.name}</b> is your most ordered item: {num(top.units)} units over{' '}
        {top.orders} {top.orders === 1 ? 'order' : 'orders'}. "Next time" is the landed cost per unit with the best supplier at the tariffs above.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="py-2 pr-3">Item</th>
              <th scope="col" className="py-2 pr-3 text-right">Orders</th>
              <th scope="col" className="py-2 pr-3 text-right">Units bought</th>
              <th scope="col" className="py-2 pr-3 text-right">Landed / unit</th>
              <th scope="col" className="py-2 pr-3 text-right">Tariffs / unit</th>
              <th scope="col" className="py-2 pr-3 text-right">Next time / unit</th>
              <th scope="col" className="py-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const now = row.landedNow / row.units
              const next = row.landedNext / row.units
              const diff = next - now
              return (
                <tr key={row.key} className="border-b border-line/60">
                  <td className="py-2 pr-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{row.name}</span>
                      {i === 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">Most ordered</span>}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="font-mono">{row.htsCode}</span>
                      <span className="flex gap-0.5">
                        {row.colors.map((c, j) => (
                          <Dot key={j} color={c} size={7} />
                        ))}
                      </span>
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">{row.orders}</td>
                  <td className="py-2 pr-3 text-right">{num(row.units)}</td>
                  <td className="py-2 pr-3 text-right text-ink">{usd(now, true)}</td>
                  <td className="py-2 pr-3 text-right text-muted">{usd(row.tariffNow / row.units, true)}</td>
                  <td className="py-2 pr-3 text-right font-medium text-ink">{usd(next, true)}</td>
                  <td className={`py-2 text-right text-xs ${Math.abs(diff) < 0.005 ? 'text-muted' : diff > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {Math.abs(diff) < 0.005 ? 'same' : `${diff > 0 ? '+' : '-'}${usd(Math.abs(diff), true)} (${pct(Math.abs(diff) / now, 1)})`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------- One order, in depth ----------

interface Scenario {
  inputs: Inputs
  ranked: RankedResult[]
  cheapest: RankedResult
  margin: OrderMargin
  cash: CashResult
}

/** The order's products and quotes, re-costed under `r`, drawing on the company's cash. */
function scenarioFor(order: SavedOrder, company: Company, r: Rates): Scenario | null {
  const inputs: Inputs = { ...order.inputs, business: { ...order.inputs.business, cash: company.cash, buffer: company.buffer, apr: company.apr } }
  const ranked = compareSuppliers(inputs, r)
  const cheapest = ranked[0]
  if (!cheapest) return null
  const supplier = inputs.suppliers.find((s) => s.id === cheapest.supplierId)!
  return { inputs, ranked, cheapest, margin: orderMargin(inputs, cheapest), cash: cashTimeline(inputs, supplier, r, cheapest) }
}

function OrderDeepDive({ p, scenarioRates, rateOf }: { p: Portfolio; scenarioRates: Rates; rateOf: (c: string) => number }) {
  const { company } = useApp()
  const [picked, setPicked] = useState<string | null>(null)
  const entry = p.analyses.find(({ a }) => a.order.id === picked) ?? p.analyses[0]
  const order = entry.a.order
  const s = useMemo(() => scenarioFor(order, company, scenarioRates), [order, company, scenarioRates])
  const today = useMemo(() => scenarioFor(order, company, rates), [order, company])
  if (!s || !today) return null

  // Keep supplier cards in a fixed order so they don't jump around as the sliders move.
  const cards = order.inputs.suppliers.map((sup) => s.ranked.find((r) => r.supplierId === sup.id)!).filter(Boolean)
  const flips = [...new Set(cards.map((c) => c.country))]
    .map((c) => ({ c, flip: countryFlipRate(s.inputs, scenarioRates, c) }))
    .filter((x): x is { c: string; flip: number } => x.flip !== null && x.flip >= 0)

  return (
    <section aria-label="One order in depth">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">One order in depth</h2>
        <label className="flex items-center gap-2 text-sm text-copy">
          Order
          <select
            className="rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm text-ink"
            value={order.id}
            onChange={(e) => setPicked(e.target.value)}
          >
            {p.analyses.map(({ a }) => (
              <option key={a.order.id} value={a.order.id}>
                {a.order.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {flips.length > 0 && (
        <p className="mb-3 text-sm text-copy">
          <span className="font-medium text-ink">The cheapest supplier for this order changes if </span>
          {flips.map(({ c, flip }, i) => (
            <span key={c}>
              {i > 0 && (i === flips.length - 1 ? ' or ' : ', ')}
              {c}'s extra tariff {rateOf(c) > flip ? 'drops under' : 'rises above'} <b>{pct(flip)}</b>
            </span>
          ))}
          .
        </p>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((r) => (
          <SupplierCard key={r.supplierId} r={r} delta={rateOf(r.country) - extraRateFor(rates, r.country)} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CashCard s={s} today={today} />
        <ProfitCard s={s} today={today} />
      </div>
    </section>
  )
}

/** Small green or red line comparing a value with today's. Nothing when it rounds to $0. */
function vsToday(now: number, today: number, moreIsGood: boolean, words: [more: string, less: string] = ['more', 'less']) {
  const diff = now - today
  if (Math.round(Math.abs(diff)) === 0) return null
  const good = diff > 0 === moreIsGood
  return (
    <p className={`text-xs font-medium ${good ? 'text-emerald-700' : 'text-red-700'}`}>
      {usd(Math.abs(diff))} {diff > 0 ? words[0] : words[1]} than at today's tariffs
    </p>
  )
}

function Tag({ tone, children }: { tone: 'green' | 'blue'; children: ReactNode }) {
  const style = tone === 'green' ? 'bg-emerald-600 text-white' : 'bg-ink-soft text-ink'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{children}</span>
}

function Row({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${strong ? 'font-semibold text-ink' : ''}`}>
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}

function SupplierCard({ r, delta }: { r: RankedResult; delta: number }) {
  const cheapest = r.rank === 1
  const breakdown = costBreakdown(r)
  return (
    <section
      aria-label={supplierLabel(r)}
      className={`rounded-lg border bg-surface p-4 shadow-sm ${cheapest ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-line'}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-ink">{r.supplierName}</h3>
        <span className="text-sm text-muted">{r.country}</span>
      </div>
      <div className="mb-3 flex min-h-6 flex-wrap gap-2">
        {cheapest && <Tag tone="green">Cheapest</Tag>}
        {Math.abs(delta) > SAME && <Tag tone="blue">Tariff {signedPoints(delta)}</Tag>}
      </div>
      <dl className="text-sm">
        <Row label="Extra tariff">{pct(r.extraRate)}</Row>
        <Row label="Total cost" strong>
          {usd(r.total)}
        </Row>
        <Row label="Per unit">{usd(r.avgUnit, true)}</Row>
        <Row label="Vs cheapest">
          {cheapest ? <span className="text-emerald-700">Cheapest</span> : <span className="text-red-700">{usd(r.gapToCheapest)} more</span>}
        </Row>
      </dl>
      <Details summary="See the cost breakdown">
        <dl>
          {breakdown.lines.map((l) => (
            <Row key={l.key} label={COST_LABELS[l.key]}>
              {usd(l.amount, true)}
            </Row>
          ))}
          <div className="mt-1 border-t border-line-strong pt-1">
            <Row label="Total cost" strong>
              {usd(breakdown.total, true)}
            </Row>
          </div>
        </dl>
      </Details>
    </section>
  )
}

function CashCard({ s, today }: { s: Scenario; today: Scenario }) {
  const c = s.cash
  const buffer = s.inputs.business.buffer
  const lowWeek = c.weeks[c.lowestWeek]
  return (
    <Card title={`Cash, ordering this again from ${s.cheapest.supplierName}`}>
      <div className="space-y-2 text-sm text-copy">
        <p className="text-xs text-muted">As if this were your only order, starting from your {usd(s.inputs.business.cash)} cash on hand.</p>
        {c.shortfall > 0 ? (
          <>
            <p className="text-2xl font-bold tabular-nums text-red-700">{usd(c.shortfall)} below</p>
            <p>
              your {usd(buffer)} safety buffer, for {c.weeksBelowBuffer} {c.weeksBelowBuffer === 1 ? 'week' : 'weeks'}.
            </p>
            {vsToday(c.shortfall, today.cash.shortfall, false, ['further below', 'less below'])}
            <p>
              Borrowing to cover it costs about <b>{usd(c.interest)}</b> in interest.
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums text-emerald-700">{usd(c.headroom)} spare</p>
            <p>You stay above your {usd(buffer)} safety buffer the whole time.</p>
          </>
        )}
        <p>
          Lowest balance: <b>{usd(c.lowest)}</b> in week {c.lowestWeek}
          {lowWeek ? ` (${shortDate(lowWeek.date)})` : ''}.
        </p>
      </div>
      <Details summary="See the week-by-week cash">
        <CashDetails c={c} orderDate={s.inputs.business.orderDate} />
      </Details>
    </Card>
  )
}

function CashDetails({ c, orderDate }: { c: CashResult; orderDate: string }) {
  return (
    <>
      <p className="mb-1 font-medium text-ink">Key payments</p>
      <ul className="mb-3 space-y-1">
        {c.events.map((e) => (
          <li key={e.label} className="flex justify-between gap-3">
            <span>
              {e.label}, {niceDate(addDays(orderDate, e.day))}
            </span>
            <span className="tabular-nums">{usd(-e.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="max-h-72 overflow-auto rounded border border-line bg-surface">
        <table className="w-full text-xs tabular-nums">
          <caption className="sr-only">Cash balance at the end of each week</caption>
          <thead className="sticky top-0 bg-ink-soft text-left text-muted">
            <tr>
              <th scope="col" className="px-2 py-1">Week</th>
              <th scope="col" className="px-2 py-1">Starts</th>
              <th scope="col" className="px-2 py-1 text-right">In</th>
              <th scope="col" className="px-2 py-1 text-right">Out</th>
              <th scope="col" className="px-2 py-1 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {c.weeks.map((w) => {
              const lowest = w.week === c.lowestWeek
              return (
                <tr key={w.week} className={lowest ? 'bg-accent-soft font-semibold' : 'border-t border-line/60'}>
                  <td className="px-2 py-1">{w.week}</td>
                  <td className="px-2 py-1">{shortDate(w.date)}</td>
                  <td className="px-2 py-1 text-right">{w.inflow ? usd(w.inflow) : ''}</td>
                  <td className="px-2 py-1 text-right">{w.outflow ? usd(w.outflow) : ''}</td>
                  <td className="px-2 py-1 text-right">
                    {usd(w.balance)}
                    {lowest && <span className="ml-1 text-accent-ink">Lowest</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ProfitCard({ s, today }: { s: Scenario; today: Scenario }) {
  const m = s.margin
  return (
    <Card title={`Profit, ordering this again from ${s.cheapest.supplierName}`}>
      <div className="space-y-2 text-sm text-copy">
        <p className="text-2xl font-bold tabular-nums text-ink">
          {usd(m.margin)} <span className="text-base font-semibold text-muted">({pct(m.marginPct)} of sales)</span>
        </p>
        {vsToday(m.margin, today.margin.margin, true)}
        <p>Gross profit once every unit sells, in about {m.weeksToSellOut} weeks.</p>
        {m.unsoldUnits > 0 && <p>{num(m.unsoldUnits)} units have no weekly sales set, so they are not counted.</p>}
      </div>
      <Details summary="How we calculated this">
        <div className="overflow-x-auto">
          <table className="mb-3 w-full text-xs tabular-nums">
            <caption className="sr-only">Sales by product</caption>
            <thead className="text-left text-muted">
              <tr>
                <th scope="col" className="py-1 pr-2">Product</th>
                <th scope="col" className="py-1 pr-2 text-right">Units</th>
                <th scope="col" className="py-1 pr-2 text-right">Sell price</th>
                <th scope="col" className="py-1 pr-2 text-right">Sold per week</th>
                <th scope="col" className="py-1 text-right">Sales</th>
              </tr>
            </thead>
            <tbody>
              {m.perProduct.map((p) => (
                <tr key={p.productId} className="border-t border-line">
                  <td className="py-1 pr-2">{p.name}</td>
                  <td className="py-1 pr-2 text-right">{num(p.qty)}</td>
                  <td className="py-1 pr-2 text-right">{usd(p.sellPrice, true)}</td>
                  <td className="py-1 pr-2 text-right">{num(p.salesPerWeek)}</td>
                  <td className="py-1 text-right">{usd(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl>
          <Row label="Total sales">{usd(m.revenue)}</Row>
          <Row label={`Total cost, ${supplierLabel(s.cheapest)}`}>-{usd(m.landed)}</Row>
          <div className="mt-1 border-t border-line-strong pt-1">
            <Row label="Gross profit" strong>
              {usd(m.margin)}
            </Row>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">Before returns, platform fees, and sales tax.</p>
      </Details>
    </Card>
  )
}

function TariffSources() {
  return (
    <Details summary="Where do these tariffs come from?">
      <p className="mb-1 font-medium text-ink">Extra tariffs, by country</p>
      <ul className="mb-3 space-y-1">
        {Object.entries(rates.extraTariffs).map(([country, t]) => (
          <li key={country}>
            <b>
              {country}: {pct(t.rate)}
            </b>
            . {t.note}. Source: <SourceLink source={t.source} url={t.url} />, {niceDate(t.date)}
            {t.status ? ` (${t.status})` : ''}.
          </li>
        ))}
      </ul>
      <p className="mb-1 font-medium text-ink">Base tariffs, by product</p>
      <p className="mb-3">Each product's base tariff is the HTS general rate for the code picked in its order. See an order's Summary step for codes and sources.</p>
      <p className="text-xs text-muted">Last reviewed {niceDate(rates.lastReviewed)}. Estimates, not customs or legal advice.</p>
    </Details>
  )
}

function SourceLink({ source, url }: { source: string; url?: string }) {
  if (!url) return <>{source}</>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-ink underline">
      {source}
    </a>
  )
}

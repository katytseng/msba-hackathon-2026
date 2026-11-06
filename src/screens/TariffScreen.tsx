import { useMemo, useState, type ReactNode } from 'react'
import {
  addDays,
  costBreakdown,
  countryFlipRate,
  extraRateFor,
  tariffScenario,
  type CashResult,
  type CostLineKey,
  type RankedResult,
  type TariffScenario,
} from '../engine'
import { niceDate, num, pct, shortDate, usd } from '../format'
import { rates, useApp } from '../state'
import { Button, Card, Details, NeedsData, NextLink, PageHeader } from '../components/ui'

const RANGE_ABOVE_TODAY = 0.3
const SAME = 0.0005 // rates closer than this count as equal (slider steps are 0.005)

const name = (r: RankedResult) => `${r.supplierName} (${r.country})`
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

/** Small green or red line comparing a value with today's. Nothing when it rounds to $0. */
function vsToday(now: number, today: number, moreIsGood: boolean, words: [more: string, less: string] = ['more', 'less']) {
  const diff = now - today
  if (Math.round(Math.abs(diff)) === 0) return null
  const good = diff > 0 === moreIsGood
  return (
    <p className={`text-xs font-medium ${good ? 'text-emerald-700' : 'text-red-700'}`}>
      {usd(Math.abs(diff))} {diff > 0 ? words[0] : words[1]} than today
    </p>
  )
}

function headline(s: TariffScenario): string {
  if (Math.abs(s.delta) < SAME) return `At today's tariffs, ${name(s.cheapest)} is cheapest.`
  const change = s.extraRate < SAME ? `If ${s.country}'s extra tariff is removed` : `If ${s.country}'s extra tariff goes to ${pct(s.extraRate)}`
  if (s.switched)
    return `${change}, switch to ${name(s.cheapest)}. You'd save ${usd(s.savingsVsStaying)} compared with staying with ${name(s.staying)}.`
  return `${change}, ${name(s.cheapest)} is still cheapest.`
}

export default function TariffScreen() {
  const { inputs, ranked } = useApp()
  const countries = useMemo(() => [...new Set(ranked.map((r) => r.country))], [ranked])
  const [pickedCountry, setPickedCountry] = useState<string | null>(null)
  const country = pickedCountry && countries.includes(pickedCountry) ? pickedCountry : ranked[0]?.country
  const todayRate = country ? extraRateFor(rates, country) : 0
  const [rateByCountry, setRateByCountry] = useState<Record<string, number>>({})
  const rate = country ? (rateByCountry[country] ?? todayRate) : 0
  const setRate = (r: number) => {
    if (country) setRateByCountry((m) => ({ ...m, [country]: Math.max(0, r) }))
  }

  const max = todayRate + RANGE_ABOVE_TODAY
  const scenario = useMemo(() => (country ? tariffScenario(inputs, rates, country, rate) : null), [inputs, country, rate])
  const today = useMemo(() => (country ? tariffScenario(inputs, rates, country, todayRate) : null), [inputs, country, todayRate])
  const flip = useMemo(() => (country ? countryFlipRate(inputs, rates, country) : null), [inputs, country])

  const presets = [
    { label: 'Today', value: todayRate },
    { label: '+10 points', value: todayRate + 0.1 },
    { label: 'Tariff removed', value: 0 },
  ]
  const flipPos = flip !== null && flip >= 0 && flip <= max ? (flip / max) * 100 : null
  // Keep supplier cards in a fixed order so they don't jump around as the slider moves.
  const supplierCards = scenario
    ? inputs.suppliers.map((s) => scenario.ranked.find((r) => r.supplierId === s.id)!).filter(Boolean)
    : []

  return (
    <div>
      <PageHeader step={5} title="What if tariffs change?" />
      <NeedsData>
        {country && scenario && today && (
          <>
            <p className="mb-2 text-xl font-semibold leading-snug text-slate-900" aria-live="polite">
              {headline(scenario)}
            </p>
            <div className="mb-5">
              <TariffSources />
            </div>

            <Card className="mb-6">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-700" htmlFor="tariff-country">
                  Country
                </label>
                <select
                  id="tariff-country"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  value={country}
                  onChange={(e) => setPickedCountry(e.target.value)}
                >
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-2xl font-bold tabular-nums text-blue-800">
                  {country} extra tariff: {pct(rate)}
                  <span className="ml-2 text-sm font-normal text-slate-500">Today: {pct(todayRate)}</span>
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Tariff scenarios">
                  {presets.map((p) => (
                    <Button
                      key={p.label}
                      variant={Math.abs(rate - p.value) < SAME ? 'primary' : 'secondary'}
                      onClick={() => setRate(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="relative pb-6">
                <input
                  type="range"
                  aria-label={`${country} extra tariff rate`}
                  aria-valuetext={pct(rate)}
                  min={0}
                  max={max * 100}
                  step={0.5}
                  value={rate * 100}
                  onChange={(e) => setRate(parseFloat(e.target.value) / 100)}
                  className="w-full accent-blue-700"
                />
                {flipPos !== null && (
                  <div className="pointer-events-none absolute top-0 h-6" style={{ left: `${flipPos}%` }}>
                    <div className="h-6 w-0.5 -translate-x-1/2 bg-amber-600" />
                    <span className="absolute top-6 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-amber-800">
                      Cheapest changes at {pct(flip!)}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {supplierCards.map((r) => (
                <SupplierCard key={r.supplierId} r={r} moving={r.country === country} delta={scenario.delta} />
              ))}
            </div>

            <h2 className="mb-3 text-lg font-semibold text-slate-900">What it means for you</h2>
            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <CashCard s={scenario} today={today} buffer={inputs.business.buffer} orderDate={inputs.business.orderDate} />
              <ProfitCard s={scenario} today={today} />
            </div>
          </>
        )}

        <NextLink to="/summary">Next: summary</NextLink>
      </NeedsData>
    </div>
  )
}

function Tag({ tone, children }: { tone: 'green' | 'blue'; children: ReactNode }) {
  const style = tone === 'green' ? 'bg-emerald-600 text-white' : 'bg-blue-100 text-blue-900'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{children}</span>
}

function Row({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${strong ? 'font-semibold text-slate-900' : ''}`}>
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}

function SupplierCard({ r, moving, delta }: { r: RankedResult; moving: boolean; delta: number }) {
  const cheapest = r.rank === 1
  const breakdown = costBreakdown(r)
  return (
    <section
      aria-label={name(r)}
      className={`rounded-lg border bg-white p-4 shadow-sm ${cheapest ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-900">{r.supplierName}</h3>
        <span className="text-sm text-slate-500">{r.country}</span>
      </div>
      <div className="mb-3 flex min-h-6 flex-wrap gap-2">
        {cheapest && <Tag tone="green">Cheapest</Tag>}
        {moving && <Tag tone="blue">Slider: {Math.abs(delta) < SAME ? 'no change' : signedPoints(delta)}</Tag>}
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
          <div className="mt-1 border-t border-slate-300 pt-1">
            <Row label="Total cost" strong>
              {usd(breakdown.total, true)}
            </Row>
          </div>
        </dl>
      </Details>
    </section>
  )
}

function CashCard({ s, today, buffer, orderDate }: { s: TariffScenario; today: TariffScenario; buffer: number; orderDate: string }) {
  const c = s.cash
  const lowWeek = c.weeks[c.lowestWeek]
  return (
    <Card title={`Cash with ${name(s.cheapest)}`}>
      <div className="space-y-2 text-sm text-slate-700">
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
        <CashDetails c={c} orderDate={orderDate} />
      </Details>
    </Card>
  )
}

function CashDetails({ c, orderDate }: { c: CashResult; orderDate: string }) {
  return (
    <>
      <p className="mb-1 font-medium text-slate-900">Key payments</p>
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
      <div className="max-h-72 overflow-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-xs tabular-nums">
          <caption className="sr-only">Cash balance at the end of each week</caption>
          <thead className="sticky top-0 bg-slate-100 text-left text-slate-600">
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
                <tr key={w.week} className={lowest ? 'bg-amber-100 font-semibold' : 'border-t border-slate-100'}>
                  <td className="px-2 py-1">{w.week}</td>
                  <td className="px-2 py-1">{shortDate(w.date)}</td>
                  <td className="px-2 py-1 text-right">{w.inflow ? usd(w.inflow) : ''}</td>
                  <td className="px-2 py-1 text-right">{w.outflow ? usd(w.outflow) : ''}</td>
                  <td className="px-2 py-1 text-right">
                    {usd(w.balance)}
                    {lowest && <span className="ml-1 text-amber-800">Lowest</span>}
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

function ProfitCard({ s, today }: { s: TariffScenario; today: TariffScenario }) {
  const m = s.margin
  return (
    <Card title={`Profit with ${name(s.cheapest)}`}>
      <div className="space-y-2 text-sm text-slate-700">
        <p className="text-2xl font-bold tabular-nums text-slate-900">
          {usd(m.margin)} <span className="text-base font-semibold text-slate-600">({pct(m.marginPct)} of sales)</span>
        </p>
        {vsToday(m.margin, today.margin.margin, true)}
        <p>
          Gross profit once every unit sells, in about {m.weeksToSellOut} weeks.
        </p>
        {m.unsoldUnits > 0 && <p>{num(m.unsoldUnits)} units have no weekly sales set, so they are not counted.</p>}
      </div>
      <Details summary="How we calculated this">
        <div className="overflow-x-auto">
          <table className="mb-3 w-full text-xs tabular-nums">
            <caption className="sr-only">Sales by product</caption>
            <thead className="text-left text-slate-600">
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
                <tr key={p.productId} className="border-t border-slate-200">
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
          <Row label={`Total cost, ${name(s.cheapest)}`}>-{usd(m.landed)}</Row>
          <div className="mt-1 border-t border-slate-300 pt-1">
            <Row label="Gross profit" strong>
              {usd(m.margin)}
            </Row>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-500">Before returns, platform fees, and sales tax.</p>
      </Details>
    </Card>
  )
}

function TariffSources() {
  return (
    <Details summary="Where do these tariffs come from?">
      <p className="mb-1 font-medium text-slate-900">Extra tariffs, by country</p>
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
      <p className="mb-1 font-medium text-slate-900">Base tariffs, by product</p>
      <ul className="mb-3 space-y-1">
        {Object.entries(rates.baseTariffs).map(([code, t]) => (
          <li key={code}>
            <b>
              {t.description} ({code}): {pct(t.rate)}
            </b>
            . Source: <SourceLink source={t.source} url={t.url} />, {niceDate(t.date)}.
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">Last reviewed {niceDate(rates.lastReviewed)}. Estimates, not customs or legal advice.</p>
    </Details>
  )
}

function SourceLink({ source, url }: { source: string; url?: string }) {
  if (!url) return <>{source}</>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-blue-800 underline">
      {source}
    </a>
  )
}

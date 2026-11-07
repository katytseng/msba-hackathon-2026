import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { OrderAnalysis } from '../../engine/portfolio'
import { niceDate, num, pct, shortDate, usd } from '../../format'
import { useApp } from '../../state'
import { Button, Card } from '../../components/ui'
import { Stat, supplierLabel, todayIso, trackOrder, type OrderTrack, type Portfolio, type Stage } from './shared'

const STAGE: Record<Stage, { label: string; style: string }> = {
  production: { label: 'In production', style: 'bg-ink-soft text-ink' },
  transit: { label: 'At sea', style: 'bg-ink-soft text-ink' },
  selling: { label: 'Selling', style: 'bg-accent-soft text-accent-ink' },
  paidBack: { label: 'Paid back', style: 'bg-emerald-50 text-emerald-700' },
  soldOut: { label: 'Sold out', style: 'bg-page text-muted ring-1 ring-line' },
}

export default function OrdersTab({ p }: { p: Portfolio }) {
  const { orders, startNewOrder, addSampleOrders, company } = useApp()
  const navigate = useNavigate()
  const today = todayIso()

  const newOrder = () => {
    startNewOrder()
    navigate('/order/business')
  }

  if (orders.length === 0) {
    return (
      <Card>
        <p className="mb-1 font-semibold text-ink">No saved orders yet.</p>
        <p className="mb-4 text-sm text-muted">
          Click <b>New order</b>, work through the steps, pick a supplier, then click <b>Save order</b>. Each saved order is tracked here, and all of them
          are checked against one bank balance on the Finances tab.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={newOrder}>+ New order</Button>
          <Button variant="secondary" onClick={addSampleOrders}>
            Add 3 sample orders
          </Button>
        </div>
      </Card>
    )
  }

  const tracks = p.analyses.map(({ a, color }) => ({ a, color, t: trackOrder(a, today) }))
  const committed = tracks.reduce((s, { a }) => s + a.placed.total, 0)
  const tariffs = tracks.reduce((s, { a }) => s + a.placed.baseDuty + a.placed.extraDuty, 0)
  const moving = tracks.filter(({ t }) => t.stage === 'production' || t.stage === 'transit').length
  const pc = p.pc
  const firstBelow = pc.firstBelowWeek === null ? null : pc.weeks[pc.firstBelowWeek]

  return (
    <div>
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders" value={String(tracks.length)} sub={moving > 0 ? `${moving} not arrived yet` : 'all arrived'} />
        <Stat label="Total landed cost" value={usd(committed)} sub="at today's tariffs" />
        <Stat label="Total tariffs paid" value={usd(tariffs)} sub={committed > 0 ? `${pct(tariffs / committed, 0)} of landed cost` : undefined} />
        <Stat
          label="Cash"
          value={pc.shortfall > 0 ? `Borrow ${usd(Math.ceil(pc.shortfall / 1000) * 1000)}` : 'No loan needed'}
          tone={pc.shortfall > 0 ? 'warn' : 'good'}
          sub={
            <>
              {pc.shortfall > 0 && firstBelow ? `by ${shortDate(firstBelow.date)}, under your ${usd(company.buffer)} buffer. ` : `lowest ${usd(pc.lowest)}. `}
              <Link to="/finances" className="font-medium text-ink underline underline-offset-2">
                See finances
              </Link>
            </>
          }
        />
      </dl>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Your orders</h2>
        <Button onClick={newOrder}>+ New order</Button>
      </div>

      <div className="space-y-4">
        {tracks.map(({ a, color, t }, i) => (
          <OrderCard key={a.order.id} a={a} t={t} color={color} index={i} today={today} />
        ))}
        {p.failed.map(({ order, error }) => (
          <Card key={order.id}>
            <p className="text-sm text-red-700">
              {order.name}: can't calculate ({error}).
            </p>
          </Card>
        ))}
      </div>
      <button onClick={newOrder} className="mt-4 text-sm font-medium text-ink hover:underline">
        + Add another order
      </button>
    </div>
  )
}

function OrderCard({ a, t, color, index, today }: { a: OrderAnalysis; t: OrderTrack; color: string; index: number; today: string }) {
  const { editOrder, deleteOrder } = useApp()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const o = a.order
  const pl = a.placed
  const stage = STAGE[t.stage]

  return (
    <section aria-label={o.name} className="overflow-hidden rounded-xl border border-l-4 border-line bg-surface shadow-sm" style={{ borderLeftColor: color }}>
      <div className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Order {index + 1}</p>
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
              {o.name}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stage.style}`}>{stage.label}</span>
            </h3>
            <p className="text-xs text-muted">
              Ordered {niceDate(t.orderDate)} · {num(pl.units)} units
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              className="!px-2 !py-1 text-xs"
              onClick={() => {
                editOrder(o.id)
                navigate('/order/compare')
              }}
            >
              Edit
            </Button>
            {confirmDelete ? (
              <>
                <Button variant="danger" className="!px-2 !py-1 text-xs" onClick={() => deleteOrder(o.id)}>
                  Delete it
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-page px-4 py-3 text-sm md:grid-cols-4">
          <Fact label="Supplier" value={supplierLabel(pl)} />
          <Fact label={t.shipped ? 'Shipped' : 'Expected shipment'} value={niceDate(t.shipDate)} />
          <Fact label="Total tariffs paid" value={usd(pl.baseDuty + pl.extraDuty)} />
          <Fact label="Total landed cost" value={usd(pl.total)} />
        </dl>

        <Milestones t={t} today={today} color={color} />
        <Insight t={t} />
      </div>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="truncate font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

/** Ordered → ships → arrives → breaks even → sold out, filled in up to today. */
function Milestones({ t, today, color }: { t: OrderTrack; today: string; color: string }) {
  const steps = [
    { label: 'Ordered', date: t.orderDate },
    { label: t.shipped ? 'Shipped' : 'Ships', date: t.shipDate },
    { label: today >= t.arrivalDate ? 'Arrived' : 'Arrives', date: t.arrivalDate },
    { label: t.breakEvenDate && today >= t.breakEvenDate ? 'Broke even' : 'Breaks even', date: t.breakEvenDate },
    { label: today > t.sellOutDate ? 'Sold out' : 'Sells out', date: t.sellOutDate },
  ]
  return (
    <ol className="mb-3 grid grid-cols-5" aria-label="Order milestones">
      {steps.map((s, i) => {
        const done = !!s.date && today >= s.date
        const nextDone = i < steps.length - 1 && !!steps[i + 1].date && today >= steps[i + 1].date!
        return (
          <li key={s.label} className="relative flex flex-col items-center text-center">
            {i < steps.length - 1 && (
              <span aria-hidden className="absolute top-[7px] left-1/2 h-0.5 w-full" style={{ background: nextDone ? color : '#cfd6e0' }} />
            )}
            <span
              aria-hidden
              className="relative z-10 h-4 w-4 rounded-full border-2"
              style={done ? { background: color, borderColor: color } : { background: '#ffffff', borderColor: '#cfd6e0' }}
            />
            <span className={`mt-1 text-xs font-medium ${done ? 'text-ink' : 'text-muted'}`}>{s.label}</span>
            <span className="text-[11px] tabular-nums text-muted">{s.date ? shortDate(s.date) : 'not within plan'}</span>
            <span className="sr-only">{done ? '(done)' : '(upcoming)'}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** One useful line: before it ships, the next bill; after, when it pays for itself. */
function Insight({ t }: { t: OrderTrack }) {
  if (!t.shipped) {
    return (
      <p className="rounded-md border border-line px-3 py-2 text-sm text-copy">
        {t.nextPayment ? (
          <>
            Next payment: <b>{t.nextPayment.label.toLowerCase()}</b>, {usd(t.nextPayment.amount)} on {niceDate(t.nextPayment.date)}.
          </>
        ) : (
          'No payments left on this order.'
        )}{' '}
        Expected to break even {t.breakEvenDate ? <>the week of <b>{niceDate(t.breakEvenDate)}</b></> : <b>never, at these sell prices</b>}.
      </p>
    )
  }
  const share = t.landed > 0 ? Math.min(1, t.salesToDate / t.landed) : 0
  return (
    <div className="rounded-md border border-line px-3 py-2 text-sm text-copy">
      <p>
        {t.stage === 'transit' && <>Arrives {niceDate(t.arrivalDate)}. </>}
        {t.breakEvenDate ? (
          <>
            {t.stage === 'paidBack' || t.stage === 'soldOut' ? 'Broke even' : 'Expected to break even'} the week of <b>{niceDate(t.breakEvenDate)}</b>.
          </>
        ) : (
          <b>Does not break even at these sell prices. </b>
        )}{' '}
        Gross profit once it sells out: <b className={t.profitAtSellOut < 0 ? 'text-red-700' : ''}>{usd(t.profitAtSellOut)}</b>.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-soft" role="img" aria-label={`Sales so far cover ${pct(share, 0)} of the landed cost`}>
          <div className="h-full rounded-full bg-ink" style={{ width: `${share * 100}%` }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {t.salesToDate >= t.landed
            ? `Sales so far ${usd(t.salesToDate)}: the ${usd(t.landed)} landed cost is covered`
            : `Sales so far ${usd(t.salesToDate)} of the ${usd(t.landed)} landed cost (${pct(share, 0)})`}
        </span>
      </div>
    </div>
  )
}

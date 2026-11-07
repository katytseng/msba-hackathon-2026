import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio } from './dashboard/shared'
import OrdersTab from './dashboard/OrdersTab'
import FinancesTab from './dashboard/FinancesTab'
import PlanTab, { type Overrides } from './dashboard/PlanTab'

export type DashTab = 'orders' | 'finances' | 'plan'

export const DASH_TABS: { key: DashTab; path: string; label: string; intro: string }[] = [
  { key: 'orders', path: '/dashboard', label: 'Orders', intro: 'Track every order: where it is, what it cost, and when it pays for itself.' },
  { key: 'finances', path: '/finances', label: 'Finances', intro: 'Your cash, safety buffer and loan rate, and how all your orders move one bank balance.' },
  { key: 'plan', path: '/plan', label: 'Plan & simulate', intro: 'Set the tariffs you expect and see who to buy from next time, order by order and item by item.' },
]

export default function DashboardScreen({ tab }: { tab: DashTab }) {
  const p = usePortfolio()
  // Lives here so the tariff sliders keep their place when you switch tabs or open an order.
  const [overrides, setOverrides] = useState<Overrides>({})
  const current = DASH_TABS.find((t) => t.key === tab) ?? DASH_TABS[0]

  return (
    <div>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink">Dashboard</p>
        <h1 className="text-2xl font-bold text-ink">Your orders and cash</h1>
        <p className="mt-1 text-muted">{current.intro}</p>
      </div>

      <nav aria-label="Dashboard" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {DASH_TABS.map((t) => {
          const active = t.key === tab
          return (
            <Link
              key={t.key}
              to={t.path}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      {tab === 'orders' && <OrdersTab p={p} />}
      {tab === 'finances' && <FinancesTab p={p} />}
      {tab === 'plan' && <PlanTab p={p} overrides={overrides} setOverrides={setOverrides} />}
    </div>
  )
}

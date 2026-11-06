import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider } from './state'
import DashboardScreen from './screens/DashboardScreen'
import OrderModal, { ORDER_STEPS } from './components/OrderModal'
import { LogoMark } from './components/Logo'

const STEP_KEYS = ORDER_STEPS.map((s) => s.key as string)

function Shell() {
  const { pathname } = useLocation()
  // Old step links (/#/business) open that step in the order pop-up.
  const oldStep = pathname.slice(1)
  if (STEP_KEYS.includes(oldStep)) return <Navigate to={`/order/${oldStep}`} replace />
  if (pathname !== '/dashboard' && !pathname.startsWith('/order/')) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <LogoMark size={40} className="shrink-0" />
          <div>
            <p className="text-xl leading-tight font-extrabold tracking-tight text-ink">Landfall</p>
            <p className="text-xs text-muted">What your orders really cost after tariffs, and whether your cash can carry them.</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <DashboardScreen />
      </main>
      <footer className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-8 text-xs text-muted">
        <LogoMark size={20} className="shrink-0" />
        <p>
          <span className="font-semibold text-ink">Landfall</span>. Estimates, not customs or legal advice. Rates from rates.json, see an order's Summary step for sources and dates.
        </p>
      </footer>
      <Routes>
        <Route path="/order/:step" element={<OrderModal />} />
        <Route path="*" element={null} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  )
}

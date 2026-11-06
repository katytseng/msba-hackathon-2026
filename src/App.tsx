import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider } from './state'
import DashboardScreen from './screens/DashboardScreen'
import OrderModal, { ORDER_STEPS } from './components/OrderModal'

const STEP_KEYS = ORDER_STEPS.map((s) => s.key as string)

function Shell() {
  const { pathname } = useLocation()
  // Old step links (/#/business) open that step in the order pop-up.
  const oldStep = pathname.slice(1)
  if (STEP_KEYS.includes(oldStep)) return <Navigate to={`/order/${oldStep}`} replace />
  if (pathname !== '/dashboard' && !pathname.startsWith('/order/')) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <p className="text-lg font-bold text-slate-900">Landed Cost and Cash Check</p>
          <p className="text-xs text-slate-500">What your orders really cost after tariffs, and whether your cash can carry them.</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <DashboardScreen />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-500">
        Estimates, not customs or legal advice. Rates from rates.json, see an order's Summary step for sources and dates.
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

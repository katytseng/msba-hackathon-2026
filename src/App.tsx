import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './state'
import { Button } from './components/ui'
import BusinessScreen from './screens/BusinessScreen'
import SuppliersScreen from './screens/SuppliersScreen'
import CompareScreen from './screens/CompareScreen'
import CashScreen from './screens/CashScreen'
import TariffScreen from './screens/TariffScreen'
import SummaryScreen from './screens/SummaryScreen'

const steps = [
  { to: '/business', label: 'Business' },
  { to: '/suppliers', label: 'Supplier quotes' },
  { to: '/compare', label: 'Compare' },
  { to: '/cash', label: 'Cash check' },
  { to: '/tariffs', label: 'Tariff what-if' },
  { to: '/summary', label: 'Summary' },
]

function Shell() {
  const { loadSample, reset } = useApp()
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-lg font-bold text-slate-900">Landed Cost and Cash Check</p>
            <p className="text-xs text-slate-500">What your order really costs after tariffs, and whether your cash can carry it.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadSample}>Load sample</Button>
            <Button variant="secondary" onClick={reset}>Reset</Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {steps.map((s, i) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                  isActive ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`
              }
            >
              <span className="mr-1.5 text-slate-400">{i + 1}</span>
              {s.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/business" replace />} />
          <Route path="/business" element={<BusinessScreen />} />
          <Route path="/suppliers" element={<SuppliersScreen />} />
          <Route path="/compare" element={<CompareScreen />} />
          <Route path="/cash" element={<CashScreen />} />
          <Route path="/tariffs" element={<TariffScreen />} />
          <Route path="/summary" element={<SummaryScreen />} />
          <Route path="*" element={<Navigate to="/business" replace />} />
        </Routes>
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-500">
        Estimates, not customs or legal advice. Rates from rates.json, see the Summary for sources and dates.
      </footer>
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

import { useEffect, useRef, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, resetDemo } from './state'
import DashboardScreen, { DASH_TABS, type DashTab } from './screens/DashboardScreen'
import OrderModal, { ORDER_STEPS } from './components/OrderModal'
import { LogoMark } from './components/Logo'
import { Bubble } from './components/ui'

const STEP_KEYS = ORDER_STEPS.map((s) => s.key as string)

/** Restores the exact seed state (Sam's three orders, his bank balance, an empty draft). Two clicks, so it can't fire by accident. */
function ResetDemoButton() {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      onClick={() => (armed ? resetDemo() : setArmed(true))}
      title="Restore the demo's starting state: Sam's three orders and his bank balance. Clears anything you saved or typed."
      className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${armed ? 'bg-bad-soft text-bad' : 'text-quiet hover:bg-ink-soft hover:text-ink'}`}
    >
      {armed ? 'Click again to reset' : 'Reset demo'}
    </button>
  )
}

function Shell() {
  const { pathname } = useLocation()
  // The tab behind the order pop-up is whichever dashboard tab you were last on.
  const lastTab = useRef<DashTab>('orders')
  const onTab = DASH_TABS.find((t) => t.path === pathname)
  if (onTab) lastTab.current = onTab.key

  // The tariff what-if moved out of the pop-up into the dashboard's Plan tab.
  if (pathname === '/tariffs' || pathname === '/order/tariffs') return <Navigate to="/plan" replace />
  // Old step links (/#/business) open that step in the order pop-up.
  const oldStep = pathname.slice(1)
  if (STEP_KEYS.includes(oldStep)) return <Navigate to={`/order/${oldStep}`} replace />
  if (!onTab && !pathname.startsWith('/order/')) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5 sm:px-10">
          <LogoMark size={44} className="shrink-0" />
          <p className="font-serif text-[1.625rem] leading-none font-semibold tracking-tight text-ink">Landfall</p>
          <ResetDemoButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-10 sm:pt-12">
        <DashboardScreen tab={lastTab.current} />
      </main>
      <footer className="mx-auto max-w-6xl px-5 pb-12 sm:px-10">
        <div className="border-t border-line pt-6">
          <div className="flex items-center gap-3 text-[0.8125rem] text-copy">
            <LogoMark size={20} className="shrink-0" />
            <p>
              Designed and built by{' '}
              <Bubble
                label="Who made Landfall"
                placement="above"
                width={248}
                className={(pinned) =>
                  `font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink ${pinned ? 'decoration-ink' : ''}`
                }
                trigger="Landed Together"
              >
                <p className="mb-1.5 text-sm font-semibold text-ink">Landed Together</p>
                <p className="leading-relaxed">Katy Tseng, Duncan Wu, Alessio Yu, Fan Zhang</p>
              </Bubble>
              .
            </p>
          </div>
          <p className="mt-2 pl-8 text-xs leading-5 text-quiet">
            Estimates, not customs or legal advice. Rates from rates.json, see an order's Summary step for sources and dates.
          </p>
        </div>
      </footer>
      <Routes>
        <Route path="/order/:step" element={<OrderModal returnTo={DASH_TABS.find((t) => t.key === lastTab.current)!.path} />} />
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

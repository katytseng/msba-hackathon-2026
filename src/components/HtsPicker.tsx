import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ancestors, labelFor, searchHts, type HtsData, type HtsEntry } from '../hts/data'
import { loadHts, recentCodes, rememberCode, useHts } from '../hts/load'
import { CHAPTERS, SECTIONS, pad2 } from '../hts/sections'
import { pct } from '../format'
import { rates } from '../state'

export interface HtsPick {
  htsCode: string
  baseRate: number
  htsDescription: string
  htsRelease: string
}

interface Props {
  code: string
  description?: string
  onPick: (pick: HtsPick) => void
}

type View = { tab: 'search' } | { tab: 'browse'; section?: string; chapter?: string; node?: number }

const PANEL_W = 600

/**
 * HTS code picker: type a code (any prefix, dots optional) or words, or browse
 * Section → Chapter → Heading → line. Only lines with a percent or Free rate can be picked;
 * per-kg, per-unit and compound rates are shown but disabled, because the estimate can't use them.
 */
export default function HtsPicker({ code, description, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>({ tab: 'search' })
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState({ top: 0, left: 0, maxH: 480 })
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const { data, error } = useHts(open)
  const deferred = useDeferredValue(query)

  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_W - 8)
    const below = window.innerHeight - r.bottom - 12
    const top = below > 320 ? r.bottom + 4 : Math.max(8, r.top - 4 - Math.min(480, r.top - 12))
    setPos({ top, left, maxH: Math.min(480, below > 320 ? below : r.top - 12) })
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open])

  // Start downloading the schedule shortly after the screen shows, so the first open is instant.
  useEffect(() => {
    const t = window.setTimeout(() => loadHts().catch(() => {}), 800)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    const onScroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) place()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open, view.tab])

  const results = useMemo(() => (data && deferred.trim() ? searchHts(data, deferred) : []), [data, deferred])
  const suggestions = useMemo(() => {
    if (!data) return []
    const codes = [...recentCodes(), ...Object.keys(rates.baseTariffs)]
    const seen = new Set<string>()
    return codes
      .map((c) => data.byCode.get(c))
      .filter((e): e is HtsEntry => !!e?.rated && !seen.has(e.code) && !!seen.add(e.code))
      .slice(0, 8)
  }, [data, open])
  const list = query.trim() ? results : suggestions

  useEffect(() => setActive(0), [deferred, view.tab])

  const pick = (e: HtsEntry) => {
    if (!data || e.rate === null) return
    rememberCode(e.code)
    onPick({ htsCode: e.code, baseRate: e.rate, htsDescription: labelFor(data, e), htsRelease: data.release })
    setOpen(false)
    setQuery('')
    btn.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation() // close only the picker, not the order dialog behind it
      setOpen(false)
      btn.current?.focus()
    } else if (view.tab === 'search' && e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, list.length - 1))
    } else if (view.tab === 'search' && e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (view.tab === 'search' && e.key === 'Enter' && list[active]) {
      e.preventDefault()
      pick(list[active])
    }
  }

  useEffect(() => {
    panel.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={`${code} · ${description ?? rates.baseTariffs[code]?.description ?? ""}`}
        className="flex w-72 items-center gap-2 rounded-md border border-line-strong bg-surface px-2 py-1 text-left text-sm hover:border-muted"
      >
        <span className="font-mono text-xs text-ink">{code || 'Pick a code'}</span>
        <span className="min-w-0 flex-1 truncate text-muted">{description ?? rates.baseTariffs[code]?.description ?? ''}</span>
        <span aria-hidden className="text-muted">▾</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Find an HTS code"
            onKeyDown={onKey}
            style={{ top: pos.top, left: pos.left, width: PANEL_W, maxHeight: pos.maxH }}
            className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-sm shadow-xl"
          >
            <div className="border-b border-line p-2">
              <div className="mb-2 flex gap-1" role="tablist">
                {(['search', 'browse'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={view.tab === t}
                    onClick={() => setView({ tab: t })}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${view.tab === t ? 'bg-ink text-white' : 'text-muted hover:bg-ink-soft'}`}
                  >
                    {t === 'search' ? 'Search' : 'Browse all sections'}
                  </button>
                ))}
              </div>
              {view.tab === 'search' && (
                <input
                  ref={input}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Code (6109.10) or words (cotton t-shirt, sneakers, laptop)"
                  aria-label="Search HTS codes"
                  className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
                />
              )}
            </div>
            <div key={JSON.stringify(view)} className="min-h-0 flex-1 overflow-y-auto">
              {error && <p className="p-3 text-red-700">Couldn’t load the tariff schedule ({error}). Close and try again.</p>}
              {!data && !error && <p className="p-3 text-muted">Loading the tariff schedule…</p>}
              {data && view.tab === 'search' && (
                <>
                  {!query.trim() && <p className="px-3 pt-2 text-xs font-medium uppercase tracking-wide text-muted">Recent and common codes</p>}
                  {query.trim() && list.length === 0 && (
                    <p className="p-3 text-muted">
                      No match. Try fewer or simpler words (the schedule says “trousers”, not “jeans”), or use Browse.
                    </p>
                  )}
                  <ul role="listbox" aria-label="Matching HTS codes">
                    {list.map((e, k) => (
                      <ResultRow key={e.i} data={data} e={e} idx={k} active={k === active} onHover={() => setActive(k)} onPick={() => pick(e)} />
                    ))}
                  </ul>
                </>
              )}
              {data && view.tab === 'browse' && <Browse data={data} view={view} setView={setView} pick={pick} />}
            </div>
            <Footer data={data} />
          </div>,
          document.body,
        )}
    </>
  )
}

function RateBadge({ e }: { e: HtsEntry }) {
  if (e.rate !== null)
    return <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium tabular-nums text-emerald-800">{e.rate === 0 ? 'Free' : pct(e.rate)}</span>
  return (
    <span
      title={`Rate is “${e.general}”. Only percent and Free rates can be estimated, so this line can’t be picked.`}
      className="max-w-40 shrink-0 truncate rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink"
    >
      {e.general} · not supported
    </span>
  )
}

function ResultRow({ data, e, idx, active, onHover, onPick }: { data: HtsData; e: HtsEntry; idx: number; active: boolean; onHover: () => void; onPick: () => void }) {
  const crumbs = ancestors(data, e).filter((a) => a.desc)
  const disabled = e.rate === null
  return (
    <li
      role="option"
      aria-selected={active}
      aria-disabled={disabled}
      data-idx={idx}
      onMouseEnter={onHover}
      onClick={onPick}
      className={`flex cursor-pointer items-start gap-3 px-3 py-2 ${active ? 'bg-ink-soft' : ''} ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
    >
      <span className="w-28 shrink-0 pt-0.5 font-mono text-xs text-ink">{e.code}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-ink">{e.desc.replace(/:$/, '')}</span>
        {crumbs.length > 0 && <span className="block truncate text-xs text-muted">{crumbs.map((c) => c.desc.replace(/:$/, '')).join(' › ')}</span>}
      </span>
      <RateBadge e={e} />
    </li>
  )
}

function Browse({ data, view, setView, pick }: { data: HtsData; view: Extract<View, { tab: 'browse' }>; setView: (v: View) => void; pick: (e: HtsEntry) => void }) {
  const section = SECTIONS.find((s) => s.id === view.section)
  const node = view.node !== undefined ? data.entries[view.node] : undefined

  const crumbs: { label: string; to: View }[] = [{ label: 'Sections', to: { tab: 'browse' } }]
  if (section) crumbs.push({ label: `Section ${section.id}`, to: { tab: 'browse', section: section.id } })
  if (view.chapter) crumbs.push({ label: `Ch. ${view.chapter}`, to: { tab: 'browse', section: view.section, chapter: view.chapter } })
  if (node) for (const a of [...ancestors(data, node), node]) crumbs.push({ label: a.code || a.desc.slice(0, 18) + '…', to: { ...view, node: a.i } })

  let rows: ReactNode
  if (!section) {
    rows = SECTIONS.map((s) => (
      <NavRow key={s.id} onClick={() => setView({ tab: 'browse', section: s.id })} left={`${s.id}`} text={s.title} right={`Ch. ${pad2(s.chapters[0])}–${pad2(s.chapters[1])}`} />
    ))
  } else if (!view.chapter) {
    const chs = []
    for (let c = section.chapters[0]; c <= section.chapters[1]; c++) if (CHAPTERS[c]) chs.push(c)
    rows = chs.map((c) => <NavRow key={c} onClick={() => setView({ ...view, chapter: pad2(c) })} left={pad2(c)} text={CHAPTERS[c]} />)
  } else {
    const kids = node ? node.children : (data.headingsByChapter.get(view.chapter) ?? [])
    rows = kids.map((i) => {
      const e = data.entries[i]
      if (e.children.length > 0)
        return <NavRow key={i} onClick={() => setView({ ...view, node: i })} left={e.code} text={e.desc.replace(/:$/, '')} right={e.rated ? <RateBadge e={e} /> : undefined} />
      return (
        <li key={i}>
          <button
            type="button"
            disabled={e.rate === null}
            onClick={() => pick(e)}
            className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-transparent"
          >
            <span className="w-28 shrink-0 pt-0.5 font-mono text-xs text-ink">{e.code}</span>
            <span className="min-w-0 flex-1 text-ink">{e.desc.replace(/:$/, '')}</span>
            {e.rated && <RateBadge e={e} />}
          </button>
        </li>
      )
    })
  }

  return (
    <div>
      <nav aria-label="Browse path" className="flex flex-wrap items-center gap-1 border-b border-line/60 px-3 py-2 text-xs">
        {crumbs.map((c, k) => (
          <span key={k} className="flex items-center gap-1">
            {k > 0 && <span className="text-muted">›</span>}
            {k === crumbs.length - 1 ? (
              <span className="font-medium text-ink">{c.label}</span>
            ) : (
              <button type="button" className="text-ink hover:underline" onClick={() => setView(c.to)}>
                {c.label}
              </button>
            )}
          </span>
        ))}
      </nav>
      {view.chapter && <p className="px-3 pt-2 text-xs text-muted">{CHAPTERS[Number(view.chapter)]}</p>}
      {node?.rated && (
        <div className="flex items-center gap-3 border-b border-line/60 bg-page px-3 py-2">
          <span className="min-w-0 flex-1 text-copy">
            Use <span className="font-mono text-xs">{node.code}</span> itself
          </span>
          <RateBadge e={node} />
          <button type="button" disabled={node.rate === null} onClick={() => pick(node)} className="rounded-md bg-ink px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
            Use this code
          </button>
        </div>
      )}
      <ul>{rows}</ul>
    </div>
  )
}

function NavRow({ onClick, left, text, right }: { onClick: () => void; left: string; text: string; right?: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-ink-soft">
        <span className="w-28 shrink-0 pt-0.5 font-mono text-xs text-muted">{left}</span>
        <span className="min-w-0 flex-1 text-ink">{text}</span>
        {right && <span className="shrink-0 text-xs text-muted">{right}</span>}
        <span aria-hidden className="text-muted">›</span>
      </button>
    </li>
  )
}

function Footer({ data }: { data: HtsData | null }) {
  return (
    <p className="border-t border-line bg-page px-3 py-1.5 text-xs text-muted">
      {data ? `USITC HTS ${data.title}, checked ${new Date(data.fetchedAt).toLocaleDateString()}. ` : ''}
      Only percent and Free rates can be estimated. Per-kg, per-unit and mixed rates are shown but can’t be picked.
    </p>
  )
}

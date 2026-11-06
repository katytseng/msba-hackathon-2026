import { useEffect, useState } from 'react'
import { buildHts, type HtsData, type HtsFile } from './data'

let cache: Promise<HtsData> | null = null

/** Load public/hts/hts.json once (about 360 KB gzipped) and index it. */
export function loadHts(): Promise<HtsData> {
  cache ??= fetch(`${import.meta.env.BASE_URL}hts/hts.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTS data: ${r.status}`)
      return r.json() as Promise<HtsFile>
    })
    .then(buildHts)
    .catch((err) => {
      cache = null // let the next open retry
      throw err
    })
  return cache
}

export function useHts(enabled: boolean) {
  const [state, setState] = useState<{ data: HtsData | null; error: string | null }>({ data: null, error: null })
  useEffect(() => {
    if (!enabled || state.data) return
    let live = true
    loadHts().then(
      (data) => live && setState({ data, error: null }),
      (e: Error) => live && setState({ data: null, error: e.message }),
    )
    return () => {
      live = false
    }
  }, [enabled, state.data])
  return state
}

const RECENT_KEY = 'landed-cost:hts-recent:v1'
export function recentCodes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}
export function rememberCode(code: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([code, ...recentCodes().filter((c) => c !== code)].slice(0, 6)))
  } catch {
    // storage blocked: recents just won't persist
  }
}

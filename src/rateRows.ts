import { niceDate, pct, usd } from './format'
import { rates, useApp } from './state'
import { productBaseRate } from './engine'
import htsMeta from '../public/hts/meta.json'
import htsChecked from '../public/hts/checked.json'

export const ASSUMPTIONS = [
  'Prices are FOB (you pay freight from the port of origin).',
  'One ocean shipment and one customs entry into LA/Long Beach.',
  'Tariffs are charged on product value only.',
  'Base tariffs use the HTS general (most-favored-nation) rate, as a percent of value. Codes charged per kg, per unit or a mix are not supported, and trade-agreement (special) rates are not applied.',
  'One flat extra tariff per country.',
  'No returns, platform fees or sales tax.',
  'Freight and fixed fees are spread across products by share of product value.',
]

/** The HTS schedule behind the code picker: which release it is, and the day the daily sync last confirmed it current. */
export const htsStatus = {
  title: htsMeta.title,
  effective: htsMeta.effective,
  // checked.json is written by every daily sync run; meta.json only changes on a new release, so it is the fallback.
  checkedAt: htsChecked.checkedAt ?? htsMeta.fetchedAt.slice(0, 10),
}

export interface RateRow {
  key: string
  name: string
  value: string
  source: string
  url?: string
  date: string
}

/** Every rate this order's numbers rest on, with source and date: one row per HTS code, per country, and per fee. */
export function useRateRows(): RateRow[] {
  const { inputs } = useApp()
  // One row per HTS code: the rate picked from the full schedule, else the rates.json entry.
  const usedCodes = [...new Map(inputs.products.map((p) => [p.htsCode, p])).values()]
  const usedCountries = [...new Set(inputs.suppliers.map((s) => s.country))]
  const f = rates.fees

  const rows: RateRow[] = []
  for (const p of usedCodes) {
    const r = rates.baseTariffs[p.htsCode]
    if (typeof p.baseRate === 'number' || !r)
      rows.push({
        key: `hts-${p.htsCode}`,
        name: `Base tariff, HTS ${p.htsCode} (${p.htsDescription ?? 'from the HTS'})`,
        value: pct(productBaseRate(rates, p)),
        source: `USITC Harmonized Tariff Schedule${p.htsRelease ? `, ${p.htsRelease}` : ''}`,
        url: 'https://hts.usitc.gov/',
        date: htsStatus.checkedAt,
      })
    else {
      // Typed into rates.json by hand. The daily sync checks it against the schedule: if it still matches, show the check date.
      const matches = (htsChecked as { baseRatesMatch?: Record<string, boolean> }).baseRatesMatch?.[p.htsCode] === true
      rows.push({ key: `hts-${p.htsCode}`, name: `Base tariff, HTS ${p.htsCode} (${r.description})`, value: pct(r.rate), source: r.source, url: r.url, date: matches ? htsStatus.checkedAt : r.date })
    }
  }
  for (const c of usedCountries) {
    const r = rates.extraTariffs[c]
    rows.push({ key: `extra-${c}`, name: `Extra tariff, ${c} (${r.note})`, value: pct(r.rate), source: r.source, url: r.url, date: r.date })
  }
  rows.push(
    { key: 'mpf', name: f.mpf.label, value: `${pct(f.mpf.rate, 4)}, min ${usd(f.mpf.min, true)}, max ${usd(f.mpf.max, true)}`, source: f.mpf.source, url: f.mpf.url, date: f.mpf.date },
    { key: 'hmf', name: f.hmf.label, value: pct(f.hmf.rate, 3), source: f.hmf.source, url: f.hmf.url, date: f.hmf.date },
    { key: 'ins', name: f.insurance.label, value: pct(f.insurance.rate), source: f.insurance.source, date: f.insurance.date },
    { key: 'broker', name: f.broker.label, value: usd(f.broker.amount), source: f.broker.source, date: f.broker.date },
    { key: 'duty-days', name: f.dutyPaymentDays.label, value: `${f.dutyPaymentDays.days} days`, source: f.dutyPaymentDays.source, date: f.dutyPaymentDays.date },
  )
  return rows
}

export const asOf = (iso: string) => niceDate(iso)

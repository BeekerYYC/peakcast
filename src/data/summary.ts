import { feelsLikeSeries } from './derive'
import type { ModelSeries, Series } from './types'

export interface DayModelStats {
  hi: number | null
  lo: number | null
  precip: number | null
  snow: number | null
  gust: number | null
  /** Coldest wind chill / warmest humidex of the day. */
  feelsLo: number | null
  feelsHi: number | null
  /** Hours of data in this day (partial days at window edges). */
  hours: number
}

export interface Consensus {
  value: number | null
  min: number | null
  max: number | null
}

export interface DaySummary {
  /** Local date key YYYY-MM-DD. */
  key: string
  /** Unix seconds of the first hour in the window for this day. */
  start: number
  label: string
  hi: Consensus
  lo: Consensus
  precip: Consensus
  snow: Consensus
  gust: Consensus
  feelsLo: Consensus
  feelsHi: Consensus
  perModel: Record<string, DayModelStats>
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function dayKeyFormatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    fmtCache.set(tz, f)
  }
  return f
}

export function localDayKey(unix: number, tz: string): string {
  return dayKeyFormatter(tz).format(new Date(unix * 1000))
}

function consensus(vals: (number | null)[], digits: number): Consensus {
  const v = vals.filter((x): x is number => x != null)
  if (!v.length) return { value: null, min: null, max: null }
  const f = 10 ** digits
  const r = (x: number) => Math.round(x * f) / f
  return {
    value: r(v.reduce((a, b) => a + b, 0) / v.length),
    min: r(Math.min(...v)),
    max: r(Math.max(...v)),
  }
}

function slice(s: Series | undefined, idx: number[]): number[] {
  if (!s) return []
  const out: number[] = []
  for (const i of idx) {
    const v = s[i]
    if (v != null) out.push(v)
  }
  return out
}

/**
 * Per-day at-a-glance numbers across the given models within [from, to] (unix s).
 * Each figure is the mean across models, with the model range alongside.
 */
export function dailySummary(
  models: ModelSeries[],
  tz: string,
  from: number,
  to: number,
): DaySummary[] {
  const days = new Map<string, DaySummary>()
  const weekday = new Intl.DateTimeFormat('en-CA', { timeZone: tz, weekday: 'short' })

  for (const m of models) {
    if (!m.covered) continue
    const feels = feelsLikeSeries(m.vars.temperature_2m, m.vars.wind_speed_10m, m.vars.relative_humidity_2m)
    const byDay = new Map<string, number[]>()
    m.time.forEach((t, i) => {
      if (t < from || t > to) return
      if (m.vars.temperature_2m?.[i] == null) return
      const k = localDayKey(t, tz)
      const arr = byDay.get(k) ?? []
      arr.push(i)
      byDay.set(k, arr)
    })
    for (const [k, idx] of byDay) {
      let d = days.get(k)
      if (!d) {
        const start = m.time[idx[0]]
        d = {
          key: k,
          start,
          label: weekday.format(new Date(start * 1000)),
          hi: empty(),
          lo: empty(),
          precip: empty(),
          snow: empty(),
          gust: empty(),
          feelsLo: empty(),
          feelsHi: empty(),
          perModel: {},
        }
        days.set(k, d)
      }
      d.start = Math.min(d.start, m.time[idx[0]])
      const t = slice(m.vars.temperature_2m, idx)
      const p = slice(m.vars.precipitation, idx)
      const s = slice(m.vars.snowfall, idx)
      const g = slice(m.vars.wind_gusts_10m, idx)
      const f = slice(feels, idx)
      d.perModel[m.modelId] = {
        hi: t.length ? Math.max(...t) : null,
        lo: t.length ? Math.min(...t) : null,
        precip: p.length ? p.reduce((a, b) => a + b, 0) : null,
        snow: s.length ? s.reduce((a, b) => a + b, 0) : null,
        gust: g.length ? Math.max(...g) : null,
        feelsLo: f.length ? Math.min(...f) : null,
        feelsHi: f.length ? Math.max(...f) : null,
        hours: idx.length,
      }
    }
  }

  const out = [...days.values()].sort((a, b) => a.start - b.start)
  for (const d of out) {
    const pm = Object.values(d.perModel)
    d.hi = consensus(pm.map((x) => x.hi), 0)
    d.lo = consensus(pm.map((x) => x.lo), 0)
    d.precip = consensus(pm.map((x) => x.precip), 1)
    d.snow = consensus(pm.map((x) => x.snow), 1)
    d.gust = consensus(pm.map((x) => x.gust), 0)
    d.feelsLo = consensus(pm.map((x) => x.feelsLo), 0)
    d.feelsHi = consensus(pm.map((x) => x.feelsHi), 0)
  }
  return out
}

function empty(): Consensus {
  return { value: null, min: null, max: null }
}

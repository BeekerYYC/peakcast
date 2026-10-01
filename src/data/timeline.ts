import { localHour } from '../lib/format'
import { nightIntervals } from '../lib/sun'
import type { ModelSeries, Series, SeriesKey } from './types'

export interface Timeline {
  /** Hourly unix seconds from `from` to `to` inclusive. */
  times: number[]
  tz: string
  from: number
  to: number
  /** Current hour (unix s). */
  now: number
  /** Local hour (0–23) of each entry in `times`. */
  hours: number[]
  /** Local midnights inside the window. */
  midnights: number[]
  nights: [number, number][]
}

export function buildTimeline(
  tz: string,
  lat: number,
  lon: number,
  hoursAhead: number,
  pastHours: number,
  nowMs = Date.now(),
): Timeline {
  const now = Math.floor(nowMs / 3_600_000) * 3600
  const from = now - pastHours * 3600
  const to = now + hoursAhead * 3600
  const times: number[] = []
  const hours: number[] = []
  const midnights: number[] = []
  for (let t = from; t <= to; t += 3600) {
    const h = localHour(t, tz)
    times.push(t)
    hours.push(h)
    if (h === 0) midnights.push(t)
  }
  return { times, tz, from, to, now, hours, midnights, nights: nightIntervals(from, to, lat, lon) }
}

/** Re-index a model series onto the timeline's hours (missing → null). */
export function align(m: ModelSeries, s: Series | undefined, times: number[]): Series {
  if (!s) return times.map(() => null)
  const t0 = m.time[0]
  const regular = m.time.length > 1 && m.time[m.time.length - 1] - t0 === (m.time.length - 1) * 3600
  if (regular) {
    return times.map((t) => {
      const i = (t - t0) / 3600
      return i >= 0 && i < s.length ? (s[i] ?? null) : null
    })
  }
  const idx = new Map(m.time.map((t, i) => [t, i]))
  return times.map((t) => {
    const i = idx.get(t)
    return i == null ? null : (s[i] ?? null)
  })
}

export function alignVar(m: ModelSeries, key: SeriesKey, times: number[]): Series {
  return align(m, m.vars[key], times)
}

/** Running total; nulls stay null but don't reset the sum. */
export function accumulate(s: Series): Series {
  let acc = 0
  return s.map((v) => {
    if (v == null) return null
    acc += v
    return Math.round(acc * 100) / 100
  })
}

/** Index of the hour nearest `t` in the timeline. */
export function indexOf(tl: Timeline, t: number): number {
  return Math.max(0, Math.min(tl.times.length - 1, Math.round((t - tl.from) / 3600)))
}

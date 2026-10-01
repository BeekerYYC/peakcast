import { align } from './timeline'
import type { ModelSeries, Series, SeriesKey } from './types'

/** Per-hour mean across models on the given time axis (null where none have data). */
export function consensus(models: ModelSeries[], key: SeriesKey, times: number[]): Series {
  const aligned = models.filter((m) => m.covered).map((m) => align(m, m.vars[key], times))
  return times.map((_, i) => {
    let sum = 0
    let n = 0
    for (const s of aligned) {
      const v = s[i]
      if (v != null) {
        sum += v
        n++
      }
    }
    return n ? Math.round((sum / n) * 100) / 100 : null
  })
}

/** Running total from the first hour, skipping nulls (they stay null). */
export function runningTotal(s: Series): Series {
  let acc = 0
  return s.map((v) => {
    if (v == null) return null
    acc += v
    return Math.round(acc * 100) / 100
  })
}

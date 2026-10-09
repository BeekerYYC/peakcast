import { feelsLikeSeries } from './derive'
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

/**
 * Mean "feels like" across models, only where it differs from the mean air
 * temperature by at least `minDiff` °C (null elsewhere, so the chart shows it
 * only when it matters). With `pad`, each run starts and ends on the
 * temperature curve so the dashed line visibly peels off it.
 */
export function feelsConsensus(models: ModelSeries[], times: number[], minDiff = 1, pad = true): Series {
  const covered = models.filter((m) => m.covered)
  const feels = covered.map((m) =>
    align(
      m,
      feelsLikeSeries(m.vars.temperature_2m, m.vars.wind_speed_10m, m.vars.relative_humidity_2m),
      times,
    ),
  )
  const temps = covered.map((m) => align(m, m.vars.temperature_2m, times))
  const mean = (list: Series[], i: number) => {
    let sum = 0
    let n = 0
    for (const s of list) {
      const v = s[i]
      if (v != null) {
        sum += v
        n++
      }
    }
    return n ? sum / n : null
  }
  const out: Series = times.map((_, i) => {
    const f = mean(feels, i)
    const t = mean(temps, i)
    if (f == null || t == null || Math.abs(f - t) < minDiff) return null
    return Math.round(f * 10) / 10
  })
  if (!pad) return out
  // Keep single isolated hours readable: extend each run by one hour on both
  // sides with the temperature itself so the dashed line peels off the curve.
  return out.map((v, i) => {
    if (v != null) return v
    const near = out[i - 1] != null || out[i + 1] != null
    const t = mean(temps, i)
    return near && t != null ? Math.round(t * 10) / 10 : null
  })
}

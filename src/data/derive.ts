import type { Band, Num, Series } from './types'

/** Snowfall (cm) to water equivalent (mm): Open-Meteo uses 0.7 cm per mm. */
export const SNOW_CM_PER_MM = 0.7

/** Liquid precipitation, derived from total minus snow water equivalent. */
export function deriveLiquid(precip: Series, snowfall: Series): Series {
  return precip.map((p, i) => {
    const s = snowfall[i]
    if (p == null) return null
    if (s == null) return p
    const v = p - s / SNOW_CM_PER_MM
    return v < 0.05 ? 0 : round(v, 2)
  })
}

export function sumSeries(a: Series, b: Series): Series {
  return a.map((x, i) => {
    const y = b[i]
    if (x == null && y == null) return null
    return (x ?? 0) + (y ?? 0)
  })
}

export interface ProfileLevel {
  /** Geopotential height (m). */
  z: Num
  /** Temperature (°C). */
  t: Num
}

/**
 * Height of the 0 °C isotherm from a vertical profile.
 *
 * Uses the highest 0 °C crossing (what matters in the mountains: where
 * precipitation aloft turns to rain), ignoring levels below ground. If the whole
 * column is below freezing, returns the surface elevation. If everything is
 * above freezing up to the top level, returns null (off the top of the profile).
 */
export function freezingLevel(
  surfaceZ: number,
  surfaceT: Num,
  levels: ProfileLevel[],
): Num {
  const pts: { z: number; t: number }[] = []
  if (surfaceT != null) pts.push({ z: surfaceZ, t: surfaceT })
  for (const l of levels) {
    if (l.z == null || l.t == null) continue
    if (l.z <= surfaceZ) continue
    pts.push({ z: l.z, t: l.t })
  }
  if (pts.length < 2) return null
  pts.sort((a, b) => a.z - b.z)

  // Walk from the top down; first transition from sub-freezing (above) to
  // above-freezing (below) is the highest freezing level.
  for (let i = pts.length - 1; i > 0; i--) {
    const up = pts[i]
    const dn = pts[i - 1]
    if (up.t <= 0 && dn.t > 0) {
      const f = dn.t / (dn.t - up.t)
      return Math.round(dn.z + f * (up.z - dn.z))
    }
  }
  if (pts[pts.length - 1].t > 0) return null
  // Entire column at or below freezing.
  return Math.round(surfaceZ)
}

export function freezingLevelSeries(
  surfaceZ: number,
  t2m: Series,
  levels: { t: Series; z: Series }[],
): Series {
  return t2m.map((t, i) =>
    freezingLevel(
      surfaceZ,
      t,
      levels.map((l) => ({ t: l.t[i], z: l.z[i] })),
    ),
  )
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export interface EnsembleStats {
  mean: Series
  band: Band
}

/** Per-hour mean and P10–P90 across members (nulls skipped). */
export function ensembleStats(members: Series[], digits = 1): EnsembleStats {
  const n = members[0]?.length ?? 0
  const mean: Series = new Array(n).fill(null)
  const lo: Series = new Array(n).fill(null)
  const hi: Series = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    const vals: number[] = []
    for (const m of members) {
      const v = m[i]
      if (v != null) vals.push(v)
    }
    if (vals.length === 0) continue
    vals.sort((a, b) => a - b)
    mean[i] = round(vals.reduce((a, b) => a + b, 0) / vals.length, digits)
    lo[i] = round(quantile(vals, 0.1), digits)
    hi[i] = round(quantile(vals, 0.9), digits)
  }
  return { mean, band: { lo, hi } }
}

/** Circular mean of wind directions (degrees). */
export function circularMean(members: Series[]): Series {
  const n = members[0]?.length ?? 0
  const out: Series = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    let sx = 0
    let sy = 0
    let c = 0
    for (const m of members) {
      const v = m[i]
      if (v == null) continue
      sx += Math.cos((v * Math.PI) / 180)
      sy += Math.sin((v * Math.PI) / 180)
      c++
    }
    if (c === 0) continue
    const deg = (Math.atan2(sy, sx) * 180) / Math.PI
    out[i] = Math.round((deg + 360) % 360)
  }
  return out
}

export function round(v: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

export function allNull(s: Series | undefined): boolean {
  return !s || s.every((v) => v == null)
}

/** Most frequent value per hour across members (for categorical codes). */
export function modeSeries(members: Series[]): Series {
  const n = members[0]?.length ?? 0
  const out: Series = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    const counts = new Map<number, number>()
    for (const m of members) {
      const v = m[i]
      if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    let best: number | null = null
    let bestC = 0
    for (const [v, c] of counts) if (c > bestC || (c === bestC && best != null && v > best)) [best, bestC] = [v, c]
    out[i] = best
  }
  return out
}

/**
 * "Feels like" temperature (°C) in Environment Canada's terms: wind chill when
 * it is cool and breezy (T ≤ 10 °C, wind ≥ 5 km/h), humidex when it is warm
 * and humid (T ≥ 20 °C), otherwise the air temperature.
 */
export function feelsLike(t: Num, windKmh: Num, rh: Num): Num {
  if (t == null) return null
  if (t <= 10 && windKmh != null && windKmh >= 5) {
    const v = windKmh ** 0.16
    const wc = 13.12 + 0.6215 * t - 11.37 * v + 0.3965 * t * v
    return round(Math.min(t, wc), 1)
  }
  if (t >= 20 && rh != null && rh > 0) {
    // Vapour pressure (hPa) from temperature and relative humidity.
    const e = 6.112 * 10 ** ((7.5 * t) / (237.7 + t)) * (rh / 100)
    const hx = t + 0.5555 * (e - 10)
    return round(Math.max(t, hx), 1)
  }
  return t
}

export function feelsLikeSeries(t: Series | undefined, wind: Series | undefined, rh: Series | undefined): Series {
  if (!t) return []
  return t.map((v, i) => feelsLike(v, wind?.[i] ?? null, rh?.[i] ?? null))
}

/**
 * Ensemble chance of precipitation: per hour, the share of members (0–100)
 * with at least `mm` of precipitation over the `hours` hours ending then,
 * and the share with at least `cm` of snowfall over the same window.
 */
export function wetChance(
  precip: Series[],
  snowfall: Series[],
  hours = 6,
  mm = 0.5,
  cm = 0.5,
): { wet: Series; snow: Series } {
  const n = precip[0]?.length ?? 0
  const wet: Series = new Array(n).fill(null)
  const snow: Series = new Array(n).fill(null)
  const trailing = (s: Series, i: number): number | null => {
    let sum = 0
    for (let j = i - hours + 1; j <= i; j++) {
      const v = s[j]
      if (j < 0 || v == null) return null
      sum += v
    }
    return sum
  }
  for (let i = hours - 1; i < n; i++) {
    let total = 0
    let w = 0
    let sn = 0
    precip.forEach((p, k) => {
      const sum = trailing(p, i)
      if (sum == null) return
      total++
      if (sum >= mm) w++
      const s = snowfall[k] ? trailing(snowfall[k], i) : null
      if (s != null && s >= cm) sn++
    })
    if (!total) continue
    wet[i] = Math.round((100 * w) / total)
    snow[i] = Math.round((100 * sn) / total)
  }
  return { wet, snow }
}

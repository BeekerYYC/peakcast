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

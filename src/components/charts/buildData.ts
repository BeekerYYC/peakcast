import { getModel } from '../../config/models'
import { feelsConsensus } from '../../data/consensus'
import { accumulate, align, type Timeline } from '../../data/timeline'
import type { ModelSeries, Series, SeriesKey } from '../../data/types'
import type { ChartCtx, ChartDef, LineSpec } from './chartDefs'

export interface SeriesMeta {
  /** '' for series that combine models (spread, mean, feels like). */
  modelId: string
  line: LineSpec
  kind: 'line' | 'bandHi' | 'bandLo' | 'spreadHi' | 'spreadLo' | 'mean' | 'feels'
}

export interface PeakLabel {
  t: number
  v: number
  text: string
  lo: boolean
}

/** One local 6-hour block of the ensemble chance-of-precip strip. */
export interface WetCell {
  from: number
  to: number
  /** % of members with ≥ 0.5 mm in the block. */
  wet: number
  /** % of members with ≥ 0.5 cm of snow in the block. */
  snow: number
}

export interface ChartData {
  /** uPlot aligned data: [x, ...series]. */
  data: Series[] & { 0: number[] }
  meta: SeriesMeta[]
  /** [hiSeriesIdx, loSeriesIdx, modelId ('' = model spread)] (uPlot indexes, 1-based). */
  bands: [number, number, string][]
  /** Spread mode is active on this chart (model lines are drawn faded). */
  spread: boolean
  /** Mean of the main line across models (spread mode). */
  mean: Series | null
  /** Consensus feels-like temperature where it differs from the air temperature. */
  feels: Series | null
  peaks: PeakLabel[]
  wet: { cells: WetCell[]; model: string } | null
  /** Per model, per line role: aligned values (for readouts). */
  values: Record<string, Partial<Record<LineSpec['role'], Series>>>
  /** Wind directions per model (for arrows). */
  dirs: Record<string, Series>
  /** Models that have no data at all for this chart. */
  missing: string[]
  empty: boolean
  min: number
  max: number
}

export function buildChartData(
  def: ChartDef,
  ctx: ChartCtx,
  tl: Timeline,
  models: ModelSeries[],
): ChartData {
  const lines = def.lines(ctx)
  const data: Series[] = []
  const meta: SeriesMeta[] = []
  const bands: [number, number, string][] = []
  const values: ChartData['values'] = {}
  const dirs: ChartData['dirs'] = {}
  const missing: string[] = []
  let min = Infinity
  let max = -Infinity
  let any = false
  const useBands = def.bands?.(ctx) ?? false

  for (const m of models) {
    if (!m.covered) continue
    const vals: ChartData['values'][string] = {}
    let has = false
    for (const line of lines) {
      let s = align(m, m.vars[line.key], tl.times)
      if (s.every((v) => v == null)) continue
      if (line.accumulate) s = accumulate(s)
      else if (def.aggregates && ctx.aggHours > 1) s = bucketSum(s, tl, ctx.aggHours)
      has = true
      vals[line.role] = s
      data.push(s)
      meta.push({ modelId: m.modelId, line, kind: 'line' })
      for (const v of s) {
        if (v == null) continue
        if (v < min) min = v
        if (v > max) max = v
        if (v !== 0) any = true
      }
      const band = useBands && line.role === 'main' ? m.bands?.[line.key] : undefined
      if (band) {
        const hi = align(m, band.hi, tl.times)
        const lo = align(m, band.lo, tl.times)
        data.push(hi, lo)
        meta.push({ modelId: m.modelId, line, kind: 'bandHi' }, { modelId: m.modelId, line, kind: 'bandLo' })
        bands.push([data.length - 1, data.length, m.modelId])
        for (const v of hi) if (v != null && v > max) max = v
        for (const v of lo) if (v != null && v < min) min = v
      }
    }
    if (has) values[m.modelId] = vals
    else if (!getModel(m.modelId).hidden) missing.push(m.modelId)
    if (def.windArrows) dirs[m.modelId] = align(m, m.vars.wind_direction_10m, tl.times)
  }

  // Spread: min–max band across models plus their mean, for the main line.
  let spread = false
  let mean: Series | null = null
  const mains = Object.values(values)
    .map((v) => v.main)
    .filter((x): x is Series => !!x)
  const mainLine = lines.find((l) => l.role === 'main')
  if (ctx.mode === 'spread' && def.spread?.(ctx) && mains.length >= 2 && mainLine) {
    spread = true
    const hi: Series = []
    const lo: Series = []
    mean = []
    for (let i = 0; i < tl.times.length; i++) {
      const vals = mains.map((s) => s[i]).filter((v): v is number => v != null)
      hi.push(vals.length >= 2 ? Math.max(...vals) : null)
      lo.push(vals.length >= 2 ? Math.min(...vals) : null)
      mean.push(vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null)
    }
    data.push(hi, lo, mean)
    meta.push(
      { modelId: '', line: mainLine, kind: 'spreadHi' },
      { modelId: '', line: mainLine, kind: 'spreadLo' },
      { modelId: '', line: mainLine, kind: 'mean' },
    )
    bands.push([data.length - 2, data.length - 1, ''])
  }

  let feels: Series | null = null
  if (def.feels && mainLine) {
    const f = feelsConsensus(models, tl.times)
    if (f.some((v) => v != null)) {
      feels = f
      data.push(f)
      meta.push({ modelId: '', line: mainLine, kind: 'feels' })
      for (const v of f) {
        if (v == null) continue
        if (v < min) min = v
        if (v > max) max = v
      }
    }
  }

  const peaks = def.peaks ? dailyPeaks(def.peaks, models, tl) : []
  for (const p of peaks) {
    if (p.v > max) max = p.v
    if (p.v < min) min = p.v
  }

  let wet: ChartData['wet'] = null
  if (def.wetStrip) {
    const ens = models.find((m) => m.covered && m.vars.wet_chance)
    if (ens) wet = { cells: wetCells(ens, tl), model: ens.modelId }
  }

  if (!Number.isFinite(min)) {
    min = 0
    max = 1
  }
  return {
    data: [tl.times, ...data] as ChartData['data'],
    meta,
    bands,
    spread,
    mean,
    feels,
    peaks,
    wet,
    values,
    dirs,
    missing,
    empty: !any,
    min,
    max,
  }
}

/**
 * Sum hourly amounts into local-time buckets of `n` hours (e.g. 00–06) and
 * repeat the bucket total across its hours so a stepped line draws a block.
 * Open-Meteo amounts are for the preceding hour, so the hour ending at 06:00
 * belongs to the 00–06 bucket.
 */
export function bucketSum(s: Series, tl: Timeline, n: number): Series {
  const key = (i: number) => {
    // Local hour index since the first local midnight before the window.
    const local = i + tl.hours[0] - 1
    return Math.floor(local / n)
  }
  const out: Series = new Array(s.length).fill(null)
  let i = 0
  while (i < s.length) {
    const k = key(i)
    let j = i
    let sum = 0
    let any = false
    while (j < s.length && key(j) === k) {
      const v = s[j]
      if (v != null) {
        sum += v
        any = true
      }
      j++
    }
    for (let x = i; x < j; x++) out[x] = any && s[x] != null ? Math.round(sum * 100) / 100 : null
    i = j
  }
  return out
}

/** Local day segments [i0, i1] (timeline indexes) with at least `minHours` hours. */
function daySegments(tl: Timeline, minHours = 6): [number, number][] {
  const cuts = tl.midnights.map((t) => Math.round((t - tl.from) / 3600))
  const edges = [0, ...cuts.filter((c) => c > 0 && c < tl.times.length - 1), tl.times.length - 1]
  const out: [number, number][] = []
  for (let k = 0; k < edges.length - 1; k++) {
    const a = edges[k]
    const b = edges[k + 1]
    if (b - a >= minHours) out.push([a, b])
  }
  return out
}

/**
 * Daily high (and low) labels. The value is the mean of each model's daily
 * extreme (what the day cards show); it sits at the hour where the models'
 * mean peaks.
 */
export function dailyPeaks(spec: NonNullable<ChartDef['peaks']>, models: ModelSeries[], tl: Timeline): PeakLabel[] {
  const pick = (key: SeriesKey) =>
    models
      .filter((m) => m.covered)
      .map((m) => align(m, m.vars[key], tl.times))
      .filter((s) => s.some((v) => v != null))
  let series = pick(spec.key)
  let fb = false
  if (!series.length && spec.fallback) {
    series = pick(spec.fallback)
    fb = true
  }
  if (!series.length) return []
  const out: PeakLabel[] = []
  const segs = daySegments(tl)
  for (const [k, [a, b]] of segs.entries()) {
    // The closing midnight belongs to the next day (except at the window's end).
    const end = k === segs.length - 1 ? b + 1 : b
    const ext = (lo: boolean) => {
      const per: number[] = []
      for (const s of series) {
        let best: number | null = null
        for (let i = a; i < end; i++) {
          const v = s[i]
          if (v != null && (best == null || (lo ? v < best : v > best))) best = v
        }
        if (best != null) per.push(best)
      }
      if (!per.length) return null
      let at = -1
      let atV = 0
      for (let i = a; i < end; i++) {
        const vals = series.map((s) => s[i]).filter((v): v is number => v != null)
        if (!vals.length) continue
        const m = vals.reduce((x, y) => x + y, 0) / vals.length
        if (at < 0 || (lo ? m < atV : m > atV)) {
          at = i
          atV = m
        }
      }
      const v = per.reduce((x, y) => x + y, 0) / per.length
      return { t: tl.times[at], v, text: spec.fmt(v, fb), lo }
    }
    const hi = ext(false)
    if (hi) out.push(hi)
    if (spec.lo) {
      const lo = ext(true)
      if (lo) out.push(lo)
    }
  }
  return out
}

/** Ensemble chance of precipitation per local 6 h block (00–06, 06–12, …). */
export function wetCells(m: ModelSeries, tl: Timeline): WetCell[] {
  const wet = align(m, m.vars.wet_chance, tl.times)
  const snow = align(m, m.vars.snow_chance, tl.times)
  const out: WetCell[] = []
  for (let i = 0; i < tl.times.length; i++) {
    // The value at a block's last hour covers the 6 h ending there.
    if (tl.hours[i] % 6 !== 0 || i === 0) continue
    const w = wet[i]
    if (w == null) continue
    out.push({ from: tl.times[i] - 6 * 3600, to: tl.times[i], wet: w, snow: snow[i] ?? 0 })
  }
  return out
}

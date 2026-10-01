import { getModel } from '../../config/models'
import { accumulate, align, type Timeline } from '../../data/timeline'
import type { ModelSeries, Series } from '../../data/types'
import type { ChartCtx, ChartDef, LineSpec } from './chartDefs'

export interface SeriesMeta {
  modelId: string
  line: LineSpec
  kind: 'line' | 'bandHi' | 'bandLo'
}

export interface ChartData {
  /** uPlot aligned data: [x, ...series]. */
  data: Series[] & { 0: number[] }
  meta: SeriesMeta[]
  /** [hiSeriesIdx, loSeriesIdx, modelId] (uPlot indexes, 1-based). */
  bands: [number, number, string][]
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

  if (!Number.isFinite(min)) {
    min = 0
    max = 1
  }
  return {
    data: [tl.times, ...data] as ChartData['data'],
    meta,
    bands,
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

import type { SeriesKey } from '../../data/types'
import type { ChartMode, PrecipMode } from '../../state/prefs'

export interface LineSpec {
  key: SeriesKey
  /** Short label used in readouts, e.g. "gust". */
  role: 'main' | 'secondary'
  dash?: number[]
  width?: number
  step?: boolean
  fill?: boolean
  accumulate?: boolean
}

export interface ChartCtx {
  precipMode: PrecipMode
  /** Elevation the forecast is valid for (m). */
  elevation: number
  /** Bucket size for hourly precip bars on long horizons (1 = none). */
  aggHours: number
  mode: ChartMode
}

/** Tinted value range, e.g. strong gusts. */
export interface Zone {
  from: number
  label: string
}

/** Daily extreme labels drawn on the chart (same numbers as the day cards). */
export interface PeakSpec {
  key: SeriesKey
  /** Used when no visible model has `key` (e.g. gusts → wind speed). */
  fallback?: SeriesKey
  lo: boolean
  fmt: (v: number, fromFallback: boolean) => string
}

export interface RefLine {
  value: number
  label?: string
  kind: 'zero' | 'ground'
}

export interface ChartDef {
  id: string
  title: string
  unit: string
  height: number
  digits: number
  lines: (c: ChartCtx) => LineSpec[]
  range: (min: number, max: number, c: ChartCtx) => [number, number]
  refLines?: (c: ChartCtx) => RefLine[]
  /** Collapse the chart (header only) when every visible value is 0/null. */
  collapseWhenEmpty?: string
  windArrows?: boolean
  /** Shown when none of the visible models provide this variable. */
  noDataHint?: string
  /** Precip-style series that are summed into `aggHours` buckets. */
  aggregates?: boolean
  /** Allow ensemble spread bands (only meaningful for hourly values). */
  bands?: (c: ChartCtx) => boolean
  /** Spread mode applies (range band + mean of the main line). */
  spread?: (c: ChartCtx) => boolean
  peaks?: PeakSpec
  /** Dashed "feels like" line (wind chill / humidex). */
  feels?: boolean
  zones?: Zone[]
  /** Ensemble chance-of-precip strip along the top. */
  wetStrip?: boolean
}

const pad = (min: number, max: number, p: number, minSpan: number): [number, number] => {
  const span = Math.max(max - min, minSpan)
  const mid = (max + min) / 2
  return [Math.floor(mid - span / 2 - p), Math.ceil(mid + span / 2 + p)]
}

const precipLines =
  (key: SeriesKey) =>
  (c: ChartCtx): LineSpec[] =>
    c.precipMode === 'total'
      ? [{ key, role: 'main', accumulate: true }]
      : [{ key, role: 'main', step: true, fill: true, width: 1.5 }]

export const CHARTS: ChartDef[] = [
  {
    id: 'temp',
    title: 'Temperature',
    unit: '°C',
    height: 150,
    digits: 1,
    lines: () => [{ key: 'temperature_2m', role: 'main' }],
    range: (min, max) => pad(min, max, 1, 6),
    refLines: () => [{ value: 0, kind: 'zero' }],
    bands: () => true,
    spread: () => true,
    peaks: { key: 'temperature_2m', lo: true, fmt: (v) => `${Math.round(v)}°` },
    feels: true,
  },
  {
    id: 'precip',
    title: 'Precipitation',
    unit: 'mm',
    height: 120,
    digits: 1,
    lines: precipLines('precipitation'),
    spread: (c) => c.precipMode === 'total',
    wetStrip: true,
    range: (_min, max, c) => [0, Math.max(c.precipMode === 'total' ? 5 : 2 * Math.sqrt(c.aggHours), Math.ceil(max * 1.15))],
    collapseWhenEmpty: 'No precipitation forecast',
    aggregates: true,
    bands: (c) => c.precipMode === 'hourly' && c.aggHours === 1,
  },
  {
    id: 'snow',
    title: 'Snowfall',
    unit: 'cm',
    height: 110,
    digits: 1,
    lines: precipLines('snowfall'),
    spread: (c) => c.precipMode === 'total',
    range: (_min, max, c) => [0, Math.max(c.precipMode === 'total' ? 5 : Math.sqrt(c.aggHours), Math.ceil(max * 1.15))],
    collapseWhenEmpty: 'No snow forecast',
    aggregates: true,
    bands: (c) => c.precipMode === 'hourly' && c.aggHours === 1,
  },
  {
    id: 'wind',
    title: 'Wind · gusts',
    unit: 'km/h',
    height: 150,
    digits: 0,
    lines: () => [
      { key: 'wind_speed_10m', role: 'main' },
      { key: 'wind_gusts_10m', role: 'secondary', dash: [3, 3], width: 1.25 },
    ],
    range: (_min, max) => [0, Math.max(20, Math.ceil((max * 1.1) / 10) * 10)],
    windArrows: true,
    bands: () => true,
    spread: () => true,
    peaks: {
      key: 'wind_gusts_10m',
      fallback: 'wind_speed_10m',
      lo: false,
      fmt: (v, fb) => (fb ? `${Math.round(v)}` : `g${Math.round(v)}`),
    },
    zones: [{ from: 50, label: 'gusty 50+' }],
  },
  {
    id: 'fzl',
    title: 'Freezing level',
    unit: 'm',
    height: 140,
    digits: 0,
    lines: () => [{ key: 'freezing_level_height', role: 'main' }],
    range: (min, max, c) => {
      const lo = Math.min(min, c.elevation - 200)
      const hi = Math.max(max, c.elevation + 800)
      return [Math.max(0, Math.floor(lo / 250) * 250), Math.ceil(hi / 250) * 250]
    },
    refLines: (c) => [{ value: c.elevation, label: `${Math.round(c.elevation)} m`, kind: 'ground' }],
    spread: () => true,
    noDataHint: 'Not provided by these models. Tap Compare to overlay HRRR, HRDPS, RDPS, GDPS, IFS or AIFS.',
  },
  {
    id: 'cloud',
    title: 'Cloud cover',
    unit: '%',
    height: 100,
    digits: 0,
    lines: () => [{ key: 'cloud_cover', role: 'main', width: 1.75 }],
    range: () => [0, 100],
    bands: () => true,
    spread: () => true,
  },
  {
    id: 'rh',
    title: 'Humidity',
    unit: '%',
    height: 100,
    digits: 0,
    lines: () => [{ key: 'relative_humidity_2m', role: 'main', width: 1.75 }],
    range: () => [0, 100],
    bands: () => true,
    spread: () => true,
  },
  {
    id: 'pressure',
    title: 'Pressure (MSL)',
    unit: 'hPa',
    height: 100,
    digits: 0,
    lines: () => [{ key: 'pressure_msl', role: 'main', width: 1.75 }],
    range: (min, max) => pad(min, max, 1, 10),
    bands: () => true,
    spread: () => true,
  },
]

/** Unit label, e.g. "mm/6h" when precip is bucketed. */
export function unitFor(def: ChartDef, c: ChartCtx): string {
  if (def.aggregates && c.precipMode === 'hourly' && c.aggHours > 1) return `${def.unit}/${c.aggHours}h`
  return def.unit
}

/** Every chart card, in default order ('precipcloud' is the combined card). */
export const CARDS: { id: string; title: string }[] = [
  { id: 'temp', title: 'Temperature' },
  { id: 'precipcloud', title: 'Precipitation & clouds' },
  ...CHARTS.filter((c) => c.id !== 'temp').map((c) => ({ id: c.id, title: c.title })),
]

/** Saved order merged with the full list (new cards appear at their default spot). */
export function orderedCards(saved: string[]): string[] {
  const all = CARDS.map((c) => c.id)
  const known = saved.filter((id) => all.includes(id))
  for (const [i, id] of all.entries()) {
    if (known.includes(id)) continue
    // Insert after its default predecessor when possible.
    const prev = all[i - 1]
    const at = prev ? known.indexOf(prev) + 1 : 0
    known.splice(at, 0, id)
  }
  return known
}

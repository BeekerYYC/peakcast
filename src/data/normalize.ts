import { HOURLY_VARS, getModel, type VarKey } from '../config/models'
import {
  allNull,
  circularMean,
  modeSeries,
  deriveLiquid,
  ensembleStats,
  freezingLevelSeries,
  sumSeries,
} from './derive'
import { ENSEMBLE_VARS } from './openmeteo'
import type { ModelSeries, Series, SeriesKey } from './types'

export interface RawResponse {
  latitude: number
  longitude: number
  elevation: number
  timezone: string
  utc_offset_seconds: number
  hourly: Record<string, (number | null)[]> & { time: number[] }
}

/**
 * Open-Meteo suffixes keys with `_<model>` when several models are requested,
 * but omits the suffix for a single model.
 */
function pick(raw: RawResponse, key: string, modelId: string, single: boolean): Series | undefined {
  return raw.hourly[`${key}_${modelId}`] ?? (single ? raw.hourly[key] : undefined)
}

/** Split a multi-model forecast response into one ModelSeries per visible model. */
export function normalizeForecast(raw: RawResponse, requestedIds: string[]): ModelSeries[] {
  const single = requestedIds.length === 1
  const time = raw.hourly.time
  const out: ModelSeries[] = []

  for (const id of requestedIds) {
    const m = getModel(id)
    if (m.hidden) continue
    const vars: Partial<Record<SeriesKey, Series>> = {}
    for (const v of HOURLY_VARS) {
      if (m.unsupported.includes(v)) continue
      const s = pick(raw, v, id, single)
      if (s) vars[v] = s
    }

    // Liquid precip: native rain + showers, else derived from snowfall.
    if (vars.precipitation) {
      if (vars.rain && !allNull(vars.rain)) {
        vars.liquid = vars.showers ? sumSeries(vars.rain, vars.showers) : vars.rain
      } else if (vars.snowfall) {
        vars.liquid = deriveLiquid(vars.precipitation, vars.snowfall)
      }
    }
    delete vars.rain
    delete vars.showers

    let fl: ModelSeries['freezingLevel'] = 'none'
    const src = m.freezingLevel
    if (src.kind === 'native' && !allNull(vars.freezing_level_height)) {
      fl = 'native'
    } else if (src.kind === 'derived' || src.kind === 'companion') {
      const from = src.kind === 'companion' ? src.from : id
      const fromSingle = single && from === id
      const levels = src.levels.map((l) => ({
        t: pick(raw, `temperature_${l}hPa`, from, fromSingle) ?? [],
        z: pick(raw, `geopotential_height_${l}hPa`, from, fromSingle) ?? [],
      }))
      // Use the companion's own 2 m temperature so the profile is self-consistent.
      const t2m =
        src.kind === 'companion'
          ? pick(raw, 'temperature_2m', from, false)
          : vars.temperature_2m
      if (t2m && levels.some((l) => l.t.length)) {
        const s = freezingLevelSeries(raw.elevation, t2m, levels)
        if (!allNull(s)) {
          vars.freezing_level_height = s
          fl = 'derived'
        }
      }
    }
    if (fl === 'none') delete vars.freezing_level_height

    out.push({
      modelId: id,
      time,
      vars,
      freezingLevel: fl,
      elevation: raw.elevation,
      timezone: raw.timezone,
      covered: !allNull(vars.temperature_2m),
    })
  }
  return out
}

const DIGITS: Partial<Record<string, number>> = {
  precipitation: 2,
  rain: 2,
  showers: 2,
  snowfall: 2,
}

/** Ensemble response → mean series + P10–P90 bands. */
export function normalizeEnsemble(raw: RawResponse, modelId: string): ModelSeries {
  const time = raw.hourly.time
  const vars: Partial<Record<SeriesKey, Series>> = {}
  const bands: NonNullable<ModelSeries['bands']> = {}
  let members = 0

  const membersOf = (v: string): Series[] => {
    const list: Series[] = []
    const ctrl = raw.hourly[v] ?? raw.hourly[`${v}_${modelId}`]
    if (ctrl) list.push(ctrl)
    for (let i = 1; i < 100; i++) {
      const k = `${v}_member${String(i).padStart(2, '0')}`
      const s = raw.hourly[k] ?? raw.hourly[`${k}_${modelId}`]
      if (!s) break
      list.push(s)
    }
    return list
  }

  // Liquid per member, then statistics, so the band reflects members not sums of bands.
  const rain = membersOf('rain')
  const showers = membersOf('showers')
  const liquid = rain.map((r, i) => (showers[i] ? sumSeries(r, showers[i]) : r))
  if (liquid.length) {
    const st = ensembleStats(liquid, 2)
    vars.liquid = st.mean
    bands.liquid = st.band
  }

  for (const v of ENSEMBLE_VARS) {
    if (v === 'rain' || v === 'showers') continue
    const list = membersOf(v)
    if (!list.length) continue
    members = Math.max(members, list.length)
    if (v === 'weather_code') {
      vars.weather_code = modeSeries(list)
      continue
    }
    if (v === 'wind_direction_10m') {
      vars[v as VarKey] = circularMean(list)
      continue
    }
    const st = ensembleStats(list, DIGITS[v] ?? 1)
    vars[v as VarKey] = st.mean
    bands[v as VarKey] = st.band
  }

  return {
    modelId,
    time,
    vars,
    bands,
    members,
    freezingLevel: 'none',
    elevation: raw.elevation,
    timezone: raw.timezone,
    covered: !allNull(vars.temperature_2m),
  }
}

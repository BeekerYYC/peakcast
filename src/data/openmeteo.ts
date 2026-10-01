import { HOURLY_VARS, getModel, type ModelDef } from '../config/models'
import type { SpotQuery } from './types'

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
export const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble'
export const META_URL = (domain: string) =>
  `https://api.open-meteo.com/data/${domain}/static/meta.json`

/** History included before "now", in hours. */
export const PAST_HOURS = 6

/** Variables requested from the ensemble API (GEPS lacks gusts/freezing level). */
export const ENSEMBLE_VARS = [
  'temperature_2m',
  'precipitation',
  'rain',
  'showers',
  'snowfall',
  'wind_speed_10m',
  'wind_direction_10m',
  'cloud_cover',
  'relative_humidity_2m',
  'pressure_msl',
  'weather_code',
]

/** The model plus any hidden companions it depends on. */
export function withCompanions(ids: string[]): string[] {
  const out = new Set<string>()
  for (const id of ids) {
    const m = getModel(id)
    out.add(id)
    if (m.freezingLevel.kind === 'companion') out.add(m.freezingLevel.from)
  }
  return [...out]
}

export function levelVars(models: ModelDef[]): string[] {
  const levels = new Set<number>()
  for (const m of models) {
    const fl = m.freezingLevel
    if (fl.kind === 'derived' || fl.kind === 'companion') fl.levels.forEach((l) => levels.add(l))
  }
  return [...levels]
    .sort((a, b) => b - a)
    .flatMap((l) => [`temperature_${l}hPa`, `geopotential_height_${l}hPa`])
}

function commonParams(spot: SpotQuery): URLSearchParams {
  const p = new URLSearchParams({
    latitude: spot.lat.toFixed(5),
    longitude: spot.lon.toFixed(5),
    timezone: 'auto',
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
    past_hours: String(PAST_HOURS),
  })
  if (spot.elevation != null && Number.isFinite(spot.elevation)) {
    p.set('elevation', String(Math.round(spot.elevation)))
  }
  return p
}

/** One forecast-API request for a set of models (companions added automatically). */
export function buildForecastUrl(spot: SpotQuery, modelIds: string[]): string {
  const ids = withCompanions(modelIds)
  const models = ids.map(getModel)
  const maxHours = Math.max(...models.map((m) => m.maxHours))
  const p = commonParams(spot)
  p.set('models', ids.join(','))
  p.set('hourly', [...HOURLY_VARS, ...levelVars(models)].join(','))
  p.set('forecast_hours', String(Math.min(16 * 24, maxHours + 12)))
  return `${FORECAST_URL}?${p}`
}

export function buildEnsembleUrl(spot: SpotQuery, modelId: string): string {
  const m = getModel(modelId)
  const p = commonParams(spot)
  p.set('models', modelId)
  p.set('hourly', ENSEMBLE_VARS.join(','))
  p.set('forecast_hours', String(m.maxHours))
  return `${ENSEMBLE_URL}?${p}`
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal })
      if (!res.ok) {
        let reason = res.statusText
        try {
          const body = (await res.json()) as { reason?: string }
          if (body.reason) reason = body.reason
        } catch {
          /* not JSON */
        }
        // 4xx are not worth retrying.
        if (res.status < 500) throw new ApiError(reason, res.status)
        lastErr = new ApiError(reason, res.status)
      } else {
        return (await res.json()) as T
      }
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) throw e
      if ((e as Error).name === 'AbortError') throw e
      lastErr = e
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
  }
  throw lastErr
}

export interface ModelMeta {
  last_run_initialisation_time: number
  last_run_availability_time: number
  data_end_time?: number
  update_interval_seconds?: number
}

const metaCache = new Map<string, { at: number; meta: ModelMeta }>()
const META_TTL_MS = 10 * 60 * 1000

/** Latest run info for a model (cached in memory for 10 minutes). */
export async function fetchMeta(modelId: string): Promise<ModelMeta | null> {
  const domain = getModel(modelId).metaDomain
  const hit = metaCache.get(domain)
  if (hit && Date.now() - hit.at < META_TTL_MS) return hit.meta
  try {
    const meta = await getJson<ModelMeta>(META_URL(domain))
    metaCache.set(domain, { at: Date.now(), meta })
    return meta
  } catch {
    return null
  }
}

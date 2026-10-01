import type { VarKey } from '../config/models'

export type Num = number | null
export type Series = Num[]

/** Normalized variables per model. `liquid` = rain + showers (or derived). */
export type SeriesKey = VarKey | 'liquid'

export interface Band {
  lo: Series
  hi: Series
}

export interface ModelSeries {
  modelId: string
  /** Unix seconds, hourly. */
  time: number[]
  vars: Partial<Record<SeriesKey, Series>>
  /** Ensemble spread (P10–P90) per variable, ensemble models only. */
  bands?: Partial<Record<SeriesKey, Band>>
  /** Number of ensemble members, ensemble models only. */
  members?: number
  freezingLevel: 'native' | 'derived' | 'none'
  /** Elevation (m) the forecast is valid for: grid DEM or user override. */
  elevation: number
  timezone: string
  /** False when the spot is outside the model domain (all values null). */
  covered: boolean
}

export interface CachedModel {
  series: ModelSeries
  /** ms epoch when this was fetched from the network. */
  fetchedAt: number
  /** Unix seconds of the model run used, from meta.json (best effort). */
  runInit: number | null
}

export interface SpotQuery {
  lat: number
  lon: number
  elevation?: number
}

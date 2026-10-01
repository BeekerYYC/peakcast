/**
 * Model registry: the single source of truth for every weather model.
 * Adding or removing a model must only require editing this file.
 *
 * IDs, variable gaps, meta domains and coverage were verified against the
 * live Open-Meteo API on 2026-10-01 (see CLAUDE.md "Data layer").
 */

export type HorizonId = '48h' | '3.5d' | '10d' | '16d'

/** Canonical hourly variables the app works with. */
export type VarKey =
  | 'temperature_2m'
  | 'precipitation'
  | 'rain'
  | 'showers'
  | 'snowfall'
  | 'wind_speed_10m'
  | 'wind_gusts_10m'
  | 'wind_direction_10m'
  | 'cloud_cover'
  | 'freezing_level_height'
  | 'relative_humidity_2m'
  | 'pressure_msl'
  | 'weather_code'

export const HOURLY_VARS: VarKey[] = [
  'temperature_2m',
  'precipitation',
  'rain',
  'showers',
  'snowfall',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'cloud_cover',
  'freezing_level_height',
  'relative_humidity_2m',
  'pressure_msl',
  'weather_code',
]

/** Pressure levels (hPa) used to derive the 0 °C height. */
export const GEM_LEVELS = [1000, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500]
export const ECMWF_LEVELS = [1000, 925, 850, 700, 600, 500]

export type FreezingLevelSource =
  | { kind: 'native' }
  | { kind: 'derived'; levels: number[] }
  /** Derive from another (hidden) model's pressure levels, same run cycle. */
  | { kind: 'companion'; from: string; levels: number[] }
  | { kind: 'none' }

export interface ModelDef {
  /** Open-Meteo `models=` value. */
  id: string
  api: 'forecast' | 'ensemble'
  label: string
  short: string
  /** Validated categorical slots (dataviz palette), stepped per theme. */
  color: { light: string; dark: string }
  horizon: HorizonId
  resolution: string
  /** Hours of forecast the model provides from its init time. */
  maxHours: number
  /** Domain for https://api.open-meteo.com/data/<metaDomain>/static/meta.json */
  metaDomain: string
  coverage: string
  /** Variables Open-Meteo returns as all-null for this model. */
  unsupported: VarKey[]
  freezingLevel: FreezingLevelSource
  /** Companion models are fetched but never shown. */
  hidden?: boolean
}

export const MODELS: ModelDef[] = [
  {
    id: 'cmc_gem_hrdps_west',
    api: 'forecast',
    label: 'HRDPS West 1 km',
    short: 'HRDPS-W',
    color: { light: '#2a78d6', dark: '#3987e5' }, // blue
    horizon: '48h',
    resolution: '1 km',
    maxHours: 48,
    metaDomain: 'cmc_gem_hrdps_west',
    coverage: 'Western Canada (experimental)',
    unsupported: ['rain', 'showers', 'freezing_level_height'],
    freezingLevel: { kind: 'none' },
  },
  {
    id: 'cmc_gem_hrdps',
    api: 'forecast',
    label: 'HRDPS Continental',
    short: 'HRDPS',
    color: { light: '#eb6834', dark: '#d95926' }, // orange
    horizon: '48h',
    resolution: '2.5 km',
    maxHours: 48,
    metaDomain: 'cmc_gem_hrdps',
    coverage: 'Canada and northern US',
    unsupported: ['freezing_level_height'],
    freezingLevel: { kind: 'derived', levels: GEM_LEVELS },
  },
  {
    id: 'ncep_hrrr_conus',
    api: 'forecast',
    label: 'NCEP HRRR',
    short: 'HRRR',
    color: { light: '#1baf7a', dark: '#199e70' }, // aqua
    horizon: '48h',
    resolution: '3 km',
    maxHours: 48,
    metaDomain: 'ncep_hrrr_conus',
    coverage: 'Continental US; reaches ~52°N in the Rockies (no Jasper/Edmonton)',
    unsupported: [],
    freezingLevel: { kind: 'native' },
  },
  {
    id: 'cmc_gem_rdps',
    api: 'forecast',
    label: 'GEM RDPS',
    short: 'RDPS',
    color: { light: '#eda100', dark: '#c98500' }, // yellow
    horizon: '3.5d',
    resolution: '10 km',
    maxHours: 84,
    metaDomain: 'cmc_gem_rdps_10km',
    coverage: 'North America',
    unsupported: ['freezing_level_height'],
    freezingLevel: { kind: 'derived', levels: GEM_LEVELS },
  },
  {
    id: 'cmc_gem_gdps',
    api: 'forecast',
    label: 'GEM GDPS',
    short: 'GDPS',
    color: { light: '#4a3aa7', dark: '#9085e9' }, // violet
    horizon: '10d',
    resolution: '15 km',
    maxHours: 240,
    metaDomain: 'cmc_gem_gdps_15km',
    coverage: 'Global',
    unsupported: ['freezing_level_height'],
    freezingLevel: { kind: 'derived', levels: GEM_LEVELS },
  },
  {
    id: 'ecmwf_ifs',
    api: 'forecast',
    label: 'ECMWF IFS 9 km',
    short: 'IFS',
    color: { light: '#e87ba4', dark: '#d55181' }, // magenta
    horizon: '10d',
    resolution: '9 km',
    maxHours: 240,
    metaDomain: 'ecmwf_ifs',
    coverage: 'Global',
    unsupported: ['freezing_level_height'],
    freezingLevel: { kind: 'companion', from: 'ecmwf_ifs025', levels: ECMWF_LEVELS },
  },
  {
    id: 'ecmwf_aifs025_single',
    api: 'forecast',
    label: 'ECMWF AIFS',
    short: 'AIFS',
    color: { light: '#008300', dark: '#008300' }, // green
    horizon: '10d',
    resolution: '0.25°',
    maxHours: 240,
    metaDomain: 'ecmwf_aifs025_single',
    coverage: 'Global (AI model)',
    unsupported: ['wind_gusts_10m', 'freezing_level_height'],
    freezingLevel: { kind: 'derived', levels: ECMWF_LEVELS },
  },
  {
    id: 'gem_global_ensemble',
    api: 'ensemble',
    label: 'GEPS ensemble',
    short: 'GEPS',
    color: { light: '#e34948', dark: '#e66767' }, // red
    horizon: '16d',
    resolution: '0.35° · 21 members',
    maxHours: 384,
    metaDomain: 'cmc_gem_geps',
    coverage: 'Global',
    unsupported: ['wind_gusts_10m', 'freezing_level_height'],
    freezingLevel: { kind: 'none' },
  },
  {
    id: 'ecmwf_ifs025',
    api: 'forecast',
    label: 'ECMWF IFS 0.25°',
    short: 'IFS25',
    color: { light: '#898781', dark: '#898781' },
    horizon: '10d',
    resolution: '0.25°',
    maxHours: 240,
    metaDomain: 'ecmwf_ifs025',
    coverage: 'Global',
    unsupported: ['freezing_level_height'],
    freezingLevel: { kind: 'derived', levels: ECMWF_LEVELS },
    hidden: true,
  },
]

export const MODELS_BY_ID: Record<string, ModelDef> = Object.fromEntries(
  MODELS.map((m) => [m.id, m]),
)

export const VISIBLE_MODELS = MODELS.filter((m) => !m.hidden)

export function getModel(id: string): ModelDef {
  const m = MODELS_BY_ID[id]
  if (!m) throw new Error(`Unknown model ${id}`)
  return m
}

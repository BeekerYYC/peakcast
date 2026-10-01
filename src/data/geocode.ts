import { getJson } from './openmeteo'

export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'

export interface Place {
  id: number
  name: string
  lat: number
  lon: number
  elevation?: number
  region: string
}

interface RawGeo {
  results?: {
    id: number
    name: string
    latitude: number
    longitude: number
    elevation?: number
    admin1?: string
    admin2?: string
    country?: string
    country_code?: string
  }[]
}

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const name = q.trim()
  if (name.length < 2) return []
  const p = new URLSearchParams({ name, count: '12', language: 'en', format: 'json' })
  const raw = await getJson<RawGeo>(`${GEOCODE_URL}?${p}`, signal)
  return (raw.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    elevation: r.elevation,
    region: [r.admin1, r.country_code === 'CA' || r.country_code === 'US' ? r.country_code : r.country]
      .filter(Boolean)
      .join(', '),
  }))
}

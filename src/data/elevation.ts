import { getJson } from './openmeteo'

/** Terrain elevation (m) from Open-Meteo's 90 m DEM. */
export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const r = await getJson<{ elevation: number[] }>(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}`,
    )
    const v = r.elevation?.[0]
    return Number.isFinite(v) ? Math.round(v) : null
  } catch {
    return null
  }
}

import type { Spot } from '../config/spots'
import { useSpots } from '../state/spots'
import { slugify } from './format'

export interface LinkTarget {
  slug: string | null
  /** Full spot description when the link carries coordinates (share links). */
  shared: Spot | null
}

/** Parse `?spot=<slug>[&name=&lat=&lon=&elev=]`. */
export function parseLink(search: string): LinkTarget {
  const p = new URLSearchParams(search)
  const slug = p.get('spot')
  const lat = Number(p.get('lat'))
  const lon = Number(p.get('lon'))
  const hasCoords =
    p.has('lat') && p.has('lon') && Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  if (!hasCoords) return { slug, shared: null }
  const name = (p.get('name') ?? '').trim().slice(0, 60) || `${lat.toFixed(3)}, ${lon.toFixed(3)}`
  const elevRaw = p.get('elev')
  const elev = elevRaw != null && elevRaw !== '' ? Number(elevRaw) : NaN
  return {
    slug,
    shared: {
      slug: slug ? slugify(slug) : slugify(name),
      name,
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
      elevation: Number.isFinite(elev) && elev > -500 && elev < 9000 ? Math.round(elev) : undefined,
      region: p.get('region')?.slice(0, 60) || undefined,
    },
  }
}

/** Short deep link for a saved spot (home-screen icons, Shortcuts). */
export function spotPath(s: Spot): string {
  return `/?spot=${encodeURIComponent(s.slug)}`
}

/** Self-contained link that works on someone else's device. */
export function shareUrl(s: Spot, origin = location.origin): string {
  const p = new URLSearchParams({
    spot: s.slug,
    name: s.name,
    lat: String(s.lat),
    lon: String(s.lon),
  })
  if (s.elevation != null) p.set('elev', String(Math.round(s.elevation)))
  if (s.region) p.set('region', s.region)
  return `${origin}/?${p}`
}

/** Keep the address bar in sync with the spot on screen. */
export function syncUrl(s: Spot, isTemp: boolean): void {
  const target = isTemp ? new URL(shareUrl(s)).search : spotPath(s).slice(1)
  if (location.search !== target) history.replaceState(null, '', `/${target}`)
}

/**
 * Apply the startup URL to the spot store. Called once in main.tsx before the
 * first render so URL syncing can never overwrite it.
 */
export function applyStartupLink(search = location.search): void {
  const { slug, shared } = parseLink(search)
  const st = useSpots.getState()
  if (!shared) {
    if (slug && st.spots.some((s) => s.slug === slug)) st.setCurrent(slug)
    return
  }
  const same = st.spots.find(
    (s) =>
      Math.abs(s.lat - shared.lat) < 1e-4 &&
      Math.abs(s.lon - shared.lon) < 1e-4 &&
      (s.elevation ?? null) === (shared.elevation ?? null),
  )
  if (same) st.setCurrent(same.slug)
  else st.setTemp(shared)
}

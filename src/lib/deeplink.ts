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

/**
 * Keep the address bar in sync with the spot on screen. The URL is the full
 * self-contained link, so "Add to Home Screen", bookmarks and Shortcuts work
 * even where the spot isn't saved (e.g. a fresh iOS home-screen container).
 */
export function syncUrl(s: Spot): void {
  const target = new URL(shareUrl(s)).search
  if (location.search !== target) history.replaceState(null, '', `/${target}`)
}

/**
 * Apply the startup URL to the spot store. Called once in main.tsx before the
 * first render so URL syncing can never overwrite it.
 */
export function applyStartupLink(search = location.search, standalone = false): void {
  const { slug, shared } = parseLink(search)
  const st = useSpots.getState()
  if (!shared) {
    if (slug && st.spots.some((s) => s.slug === slug)) st.setCurrent(slug)
    return
  }
  const near = (s: Spot) =>
    Math.abs(s.lat - shared.lat) < 1e-4 && Math.abs(s.lon - shared.lon) < 1e-4
  // Same slug at the same place (elevation may have been edited since), else
  // any saved spot at the same place and elevation.
  const same =
    st.spots.find((s) => s.slug === shared.slug && near(s)) ??
    st.spots.find((s) => near(s) && (s.elevation ?? null) === (shared.elevation ?? null))
  if (same) st.setCurrent(same.slug)
  // A home-screen icon for a spot: just save it, no "Save spot" banner.
  else if (standalone) st.add(shared)
  else st.setTemp(shared)
}

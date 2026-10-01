export interface Spot {
  /** URL-safe identifier used in `?spot=` deep links. */
  slug: string
  name: string
  lat: number
  lon: number
  /** Optional elevation override in metres (summit vs trailhead). */
  elevation?: number
  /** Short subtitle, e.g. "Alberta, Canada". */
  region?: string
}

export const SEED_SPOTS: Spot[] = [
  { slug: 'calgary', name: 'Calgary', lat: 51.0447, lon: -114.0719, region: 'Alberta' },
  {
    slug: 'kananaskis-village',
    name: 'Kananaskis Village',
    lat: 50.91598,
    lon: -115.14156,
    region: 'Kananaskis, Alberta',
  },
]

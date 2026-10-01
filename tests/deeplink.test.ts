import { describe, expect, it } from 'vitest'
import { parseLink, shareUrl } from '../src/lib/deeplink'
import { uniqueSlug } from '../src/state/spots'

describe('deep links', () => {
  it('parses a plain saved-spot link', () => {
    expect(parseLink('?spot=kananaskis-village')).toEqual({ slug: 'kananaskis-village', shared: null })
  })

  it('round-trips a share link with elevation', () => {
    const s = { slug: 'mt-allan', name: 'Mt Allan summit', lat: 50.97, lon: -115.205, elevation: 2819, region: 'Kananaskis' }
    const u = new URL(shareUrl(s, 'https://peakcast.example'))
    expect(parseLink(u.search).shared).toEqual(s)
  })

  it('rejects bad coordinates and clamps silly elevations', () => {
    expect(parseLink('?spot=x&lat=200&lon=10').shared).toBeNull()
    expect(parseLink('?lat=51&lon=-115&elev=99999').shared?.elevation).toBeUndefined()
    expect(parseLink('?lat=51&lon=-115').shared?.name).toBe('51.000, -115.000')
  })
})

describe('uniqueSlug', () => {
  it('suffixes collisions', () => {
    expect(uniqueSlug('Calgary', new Set(['calgary', 'calgary-2']))).toBe('calgary-3')
    expect(uniqueSlug('Lac Beauvert (Jasper)', new Set())).toBe('lac-beauvert-jasper')
  })
})

import { applyStartupLink } from '../src/lib/deeplink'
import { useSpots } from '../src/state/spots'
import { SEED_SPOTS } from '../src/config/spots'

describe('applyStartupLink', () => {
  const reset = () => useSpots.setState({ spots: [...SEED_SPOTS], current: 'calgary', temp: null })
  it('selects a saved spot from its full link', () => {
    reset()
    applyStartupLink('?spot=kananaskis-village&name=Kananaskis%20Village&lat=50.91598&lon=-115.14156')
    expect(useSpots.getState().current).toBe('kananaskis-village')
    expect(useSpots.getState().temp).toBeNull()
  })
  it('opens unknown spots as temporary in the browser, saves them when installed', () => {
    reset()
    const link = '?spot=mt-allan&name=Mt%20Allan&lat=50.97&lon=-115.205&elev=2819'
    applyStartupLink(link)
    expect(useSpots.getState().temp?.name).toBe('Mt Allan')
    reset()
    applyStartupLink(link, true)
    expect(useSpots.getState().spots.at(-1)?.elevation).toBe(2819)
    expect(useSpots.getState().current).toBe('mt-allan')
  })
})

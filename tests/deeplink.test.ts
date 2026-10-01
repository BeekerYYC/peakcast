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

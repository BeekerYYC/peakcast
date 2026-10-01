import { describe, expect, it } from 'vitest'
import {
  circularMean,
  deriveLiquid,
  ensembleStats,
  freezingLevel,
  modeSeries,
} from '../src/data/derive'
import { bucketSum } from '../src/components/charts/buildData'
import type { Timeline } from '../src/data/timeline'

describe('freezingLevel', () => {
  it('interpolates the 0 °C crossing above the surface', () => {
    // 10 °C at 1000 m, -10 °C at 3000 m → 0 °C at 2000 m.
    expect(freezingLevel(1000, 10, [{ z: 3000, t: -10 }])).toBe(2000)
  })

  it('ignores pressure levels below ground', () => {
    const fl = freezingLevel(1450, 4, [
      { z: 110, t: 15 }, // 1000 hPa, underground at Kananaskis
      { z: 1500, t: 3 },
      { z: 3000, t: -9 },
    ])
    expect(fl).toBe(1875)
  })

  it('returns the surface when the whole column is sub-freezing', () => {
    expect(freezingLevel(1100, -12, [{ z: 1500, t: -10 }, { z: 3000, t: -20 }])).toBe(1100)
  })

  it('uses the highest crossing under an inversion (cold pool, warm layer aloft)', () => {
    // Surface -8, warm +3 at 1800 m, back below freezing at 2800 m.
    const fl = freezingLevel(1050, -8, [
      { z: 1800, t: 3 },
      { z: 2800, t: -7 },
    ])
    expect(fl).toBe(2100)
  })

  it('returns null when above freezing through the top of the profile', () => {
    expect(freezingLevel(1000, 25, [{ z: 5600, t: 2 }])).toBeNull()
  })

  it('handles missing data', () => {
    expect(freezingLevel(1000, null, [{ z: null, t: null }])).toBeNull()
  })
})

describe('deriveLiquid', () => {
  it('subtracts snow water equivalent (0.7 cm per mm)', () => {
    expect(deriveLiquid([2, 1.4, null, 0.5], [0.7, 0.98, 0, 0])).toEqual([1, 0, null, 0.5])
  })
})

describe('ensembleStats', () => {
  it('computes mean and P10–P90 per hour', () => {
    const members = Array.from({ length: 11 }, (_, i) => [i, null])
    const st = ensembleStats(members)
    expect(st.mean).toEqual([5, null])
    expect(st.band.lo[0]).toBe(1)
    expect(st.band.hi[0]).toBe(9)
  })
})

describe('circularMean', () => {
  it('averages across north correctly', () => {
    expect(circularMean([[350], [10]])).toEqual([0])
  })
})

describe('modeSeries', () => {
  it('picks the most common code (ties → more severe)', () => {
    expect(modeSeries([[3, 61], [3, 71], [2, 61], [71, 71]])).toEqual([3, 71])
  })
})

describe('bucketSum', () => {
  it('sums into local 6 h buckets, hour-ending convention', () => {
    // Window starting at local 04:00: hours 04,05,06 | 07..12 | 13
    const hours = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    const tl = { hours } as unknown as Timeline
    const s = [1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2]
    expect(bucketSum(s, tl, 6)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 3, 2])
  })
})

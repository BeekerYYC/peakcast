import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeEnsemble, normalizeForecast, type RawResponse } from '../src/data/normalize'
import { dailySummary } from '../src/data/summary'

const fx = (f: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8')) as RawResponse

// Fixtures recorded from the live API on 2026-10-01 (scripts/record-fixtures.ts).

describe('normalizeForecast (48h, Kananaskis)', () => {
  const out = normalizeForecast(fx('kananaskis-48h.json'), [
    'cmc_gem_hrdps_west',
    'cmc_gem_hrdps',
    'ncep_hrrr_conus',
  ])
  const by = Object.fromEntries(out.map((s) => [s.modelId, s]))

  it('returns one series per model, all covered', () => {
    expect(out.map((s) => s.modelId)).toEqual([
      'cmc_gem_hrdps_west',
      'cmc_gem_hrdps',
      'ncep_hrrr_conus',
    ])
    expect(out.every((s) => s.covered)).toBe(true)
    expect(by.cmc_gem_hrdps.timezone).toBe('America/Edmonton')
  })

  it('uses native freezing level for HRRR and derives it for HRDPS', () => {
    expect(by.ncep_hrrr_conus.freezingLevel).toBe('native')
    expect(by.cmc_gem_hrdps.freezingLevel).toBe('derived')
    expect(by.cmc_gem_hrdps_west.freezingLevel).toBe('none')
    expect(by.cmc_gem_hrdps_west.vars.freezing_level_height).toBeUndefined()
  })

  it('derived freezing level is in the same ballpark as HRRR native', () => {
    const a = by.ncep_hrrr_conus.vars.freezing_level_height!
    const b = by.cmc_gem_hrdps.vars.freezing_level_height!
    const diffs: number[] = []
    a.forEach((v, i) => {
      if (v != null && b[i] != null) diffs.push(Math.abs(v - b[i]!))
    })
    expect(diffs.length).toBeGreaterThan(20)
    const median = diffs.sort((x, y) => x - y)[Math.floor(diffs.length / 2)]
    expect(median).toBeLessThan(150)
  })

  it('derives liquid precip for HRDPS West (no native rain)', () => {
    expect(by.cmc_gem_hrdps_west.vars.liquid).toBeDefined()
    expect(by.cmc_gem_hrdps_west.vars.rain).toBeUndefined()
  })
})

describe('normalizeForecast (single model, no key suffix)', () => {
  it('reads unsuffixed keys and honours the elevation override', () => {
    const [s] = normalizeForecast(fx('kananaskis-rdps-summit.json'), ['cmc_gem_rdps'])
    expect(s.covered).toBe(true)
    expect(s.elevation).toBe(2819)
    expect(s.freezingLevel).toBe('derived')
  })
})

describe('normalizeForecast (companion)', () => {
  it('fills ECMWF IFS 9 km freezing level from IFS 0.25° and hides the companion', () => {
    const out = normalizeForecast(fx('kananaskis-10d.json'), [
      'cmc_gem_gdps',
      'ecmwf_ifs',
      'ecmwf_aifs025_single',
      'ecmwf_ifs025',
    ])
    expect(out.map((s) => s.modelId)).not.toContain('ecmwf_ifs025')
    const ifs = out.find((s) => s.modelId === 'ecmwf_ifs')!
    expect(ifs.freezingLevel).toBe('derived')
    const aifs = out.find((s) => s.modelId === 'ecmwf_aifs025_single')!
    expect(aifs.vars.wind_gusts_10m).toBeUndefined()
  })
})

describe('coverage', () => {
  it('marks HRRR uncovered at Jasper', () => {
    const out = normalizeForecast(fx('jasper-48h.json'), ['cmc_gem_hrdps', 'ncep_hrrr_conus'])
    expect(out.find((s) => s.modelId === 'ncep_hrrr_conus')!.covered).toBe(false)
    expect(out.find((s) => s.modelId === 'cmc_gem_hrdps')!.covered).toBe(true)
  })
})

describe('normalizeEnsemble (GEPS)', () => {
  const s = normalizeEnsemble(fx('kananaskis-geps.json'), 'gem_global_ensemble')
  it('aggregates 21 members into mean + band', () => {
    expect(s.members).toBe(21)
    const t = s.vars.temperature_2m!
    const band = s.bands!.temperature_2m!
    const i = t.findIndex((v) => v != null)
    expect(band.lo[i]!).toBeLessThanOrEqual(t[i]!)
    expect(band.hi[i]!).toBeGreaterThanOrEqual(t[i]!)
    expect(s.vars.liquid).toBeDefined()
  })
})

describe('dailySummary', () => {
  it('produces per-day consensus with model ranges', () => {
    const raw = fx('kananaskis-48h.json')
    const out = normalizeForecast(raw, ['cmc_gem_hrdps_west', 'cmc_gem_hrdps', 'ncep_hrrr_conus'])
    const days = dailySummary(out, 'America/Edmonton', raw.hourly.time[0], raw.hourly.time.at(-1)!)
    expect(days.length).toBeGreaterThanOrEqual(2)
    for (const d of days) {
      if (d.hi.value == null) continue
      expect(d.hi.min!).toBeLessThanOrEqual(d.hi.max!)
      expect(d.hi.value).toBeGreaterThanOrEqual(d.lo.value!)
    }
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildEnsembleUrl, buildForecastUrl } from '../src/data/openmeteo'
import { MODELS, VISIBLE_MODELS } from '../src/config/models'
import { defaultModelsFor } from '../src/config/horizons'

describe('registry', () => {
  it('has unique ids and every horizon has models', () => {
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length)
    for (const h of ['48h', '3.5d', '10d', '16d'] as const) {
      expect(defaultModelsFor(h).length).toBeGreaterThan(0)
    }
  })
  it('companions exist and are hidden', () => {
    for (const m of VISIBLE_MODELS) {
      if (m.freezingLevel.kind === 'companion') {
        expect(MODELS.find((x) => x.id === (m.freezingLevel as { from: string }).from)?.hidden).toBe(true)
      }
    }
  })
})

describe('request builders', () => {
  it('adds companions and pressure levels; honours elevation', () => {
    const u = new URL(buildForecastUrl({ lat: 50.9, lon: -115.1, elevation: 2819.4 }, ['ecmwf_ifs']))
    expect(u.searchParams.get('models')).toBe('ecmwf_ifs,ecmwf_ifs025')
    expect(u.searchParams.get('hourly')).toContain('geopotential_height_700hPa')
    expect(u.searchParams.get('elevation')).toBe('2819')
    expect(u.searchParams.get('timeformat')).toBe('unixtime')
  })
  it('omits pressure levels when no model needs them', () => {
    const u = new URL(buildForecastUrl({ lat: 50.9, lon: -115.1 }, ['ncep_hrrr_conus']))
    expect(u.searchParams.get('hourly')).not.toContain('hPa')
    expect(u.searchParams.has('elevation')).toBe(false)
  })
  it('ensemble goes to the ensemble API', () => {
    expect(buildEnsembleUrl({ lat: 50.9, lon: -115.1 }, 'gem_global_ensemble')).toMatch(
      /^https:\/\/ensemble-api\.open-meteo\.com\/v1\/ensemble\?/,
    )
  })
})


describe('widget script', () => {
  it('header version matches VERSION (self-update relies on it)', () => {
    const code = readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8')
    const header = /^\/\/ PEAKCAST_WIDGET v(\d+)/.exec(code)?.[1]
    const constant = /const VERSION = (\d+)/.exec(code)?.[1]
    expect(header).toBeDefined()
    expect(header).toBe(constant)
    // The install page and updater fill in only the first placeholder: the APP line.
    expect(code.indexOf("'https://YOUR-APP.vercel.app'")).toBeLessThan(code.indexOf('const PLACEHOLDER'))
  })
})

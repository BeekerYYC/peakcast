import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { dayStats, describeDay, describeWeekend, type DayWx } from '../src/data/narrative'
import { normalizeForecast, type RawResponse } from '../src/data/normalize'
import type { ModelSeries } from '../src/data/types'

const base: DayWx = {
  key: '2026-10-09',
  start: 0,
  dow: 5,
  hi: 12,
  lo: 2,
  precip: 0,
  snow: 0,
  precipRange: [0, 0],
  snowRange: [0, 0],
  wet: 0,
  hiRange: [11, 13],
  gust: 20,
  cloud: 10,
  fzl: 2800,
  timing: [],
  thunder: false,
  models: ['HRDPS', 'HRRR'],
}

describe('describeDay', () => {
  it('sunny and dry', () => {
    expect(describeDay(base)).toBe('Sunny and dry. High 12°, low 2°.')
  })
  it('snow with timing and amount range, colder than yesterday', () => {
    const d = { ...base, wet: 2, cloud: 95, precip: 2, snow: 1.4, precipRange: [1, 3] as [number, number], timing: ['overnight', 'morning'] as DayWx['timing'], hi: 1, lo: -3 }
    expect(describeDay(d, { prev: { ...base, hi: 12 }, prevLabel: 'Friday' })).toBe(
      'Light snow overnight into the morning (1–2 cm). High 1°, low -3°, much colder than Friday.',
    )
  })
  it('rain with snow line above the spot, wind and model disagreement', () => {
    const d = { ...base, wet: 2, cloud: 80, precip: 6, snow: 0, precipRange: [1, 12] as [number, number], timing: ['afternoon'] as DayWx['timing'], fzl: 2400, gust: 55, hiRange: [6, 13] as [number, number] }
    expect(describeDay(d, { elevation: 1100 })).toBe(
      'Rain in the afternoon (1–12 mm). High 12°, low 2°. Snow above ~2,100 m. Windy, gusts to 55 km/h. Models disagree (highs 6° to 13°, precip 1–12 mm).',
    )
  })
})

describe('partial agreement', () => {
  it('says "possible" when only some models are wet', () => {
    const d = { ...base, cloud: 30, precip: 5.6, snow: 3.5, precipRange: [0, 16.7] as [number, number], snowRange: [0, 10.4] as [number, number], wet: 1, timing: ['overnight', 'morning'] as DayWx['timing'], models: ['GDPS', 'IFS', 'AIFS'] }
    expect(describeDay(d)).toMatch(/^Mostly sunny, snow possible overnight into the morning \(1 of 3 models, up to 10 cm\)\./)
  })
})

describe('majority agreement', () => {
  it('says "likely" when most models are wet', () => {
    const d = { ...base, cloud: 10, precip: 1.6, precipRange: [0, 3] as [number, number], wet: 3, timing: ['afternoon'] as DayWx['timing'], models: ['A', 'B', 'C', 'D'] }
    expect(describeDay(d)).toMatch(/^Mostly sunny, rain likely in the afternoon \(3 of 4 models, up to 3 mm\)\./)
  })
})

describe('describeWeekend', () => {
  const days = (todayDow: number): DayWx[] =>
    [0, 1, 2, 3, 4].map((i) => ({ ...base, key: String(i), dow: (todayDow + i) % 7 }))
  it('only Wednesday to Saturday', () => {
    expect(describeWeekend(days(1))).toBeNull()
    expect(describeWeekend(days(0))).toBeNull()
    expect(describeWeekend(days(4))?.title).toBe('This weekend')
  })
  it('picks the better day', () => {
    const d = days(5)
    d[1] = { ...d[1], precip: 5, snow: 4, cloud: 100, hi: 1 }
    expect(describeWeekend(d)?.text).toMatch(/Sunday looks like the better day/)
  })
  it('on Saturday talks about Sunday only', () => {
    expect(describeWeekend(days(6))?.title).toBe('Tomorrow (Sunday)')
  })
})

describe('dayStats on real data', () => {
  it('builds days from the recorded 48h + 10d fixtures, preferring short-range models', () => {
    const fx = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8')) as RawResponse
    const short = normalizeForecast(fx('kananaskis-48h.json'), ['cmc_gem_hrdps_west', 'cmc_gem_hrdps', 'ncep_hrrr_conus'])
    const long = normalizeForecast(fx('kananaskis-10d.json'), ['cmc_gem_gdps', 'ecmwf_ifs', 'ecmwf_aifs025_single', 'ecmwf_ifs025'])
    const models: ModelSeries[] = [...short, ...long]
    const from = short[0].time[0]
    const days = dayStats(models, 'America/Edmonton', from)
    expect(days.length).toBeGreaterThanOrEqual(5)
    expect(days[1].models).toContain('HRDPS')
    expect(days.at(-1)!.models).not.toContain('HRDPS')
    for (const d of days) {
      expect(d.hi).toBeGreaterThanOrEqual(d.lo)
      expect(describeDay(d).length).toBeGreaterThan(10)
    }
  })
})

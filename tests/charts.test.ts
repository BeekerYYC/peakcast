import { describe, expect, it } from 'vitest'
import { feelsLike, wetChance } from '../src/data/derive'
import { buildTimeline, dayWindow, sliceTimeline } from '../src/data/timeline'
import { buildChartData, dailyPeaks } from '../src/components/charts/buildData'
import { CHARTS, orderedCards, type ChartCtx } from '../src/components/charts/chartDefs'
import type { ModelSeries } from '../src/data/types'

const TZ = 'America/Edmonton'
// 2026-01-10 00:00 MST
const MIDNIGHT = Date.UTC(2026, 0, 10, 7) / 1000

function model(id: string, temps: number[], extra: Partial<ModelSeries['vars']> = {}): ModelSeries {
  return {
    modelId: id,
    time: temps.map((_, i) => MIDNIGHT + i * 3600),
    vars: { temperature_2m: temps, ...extra },
    freezingLevel: 'none',
    elevation: 1400,
    timezone: TZ,
    covered: true,
  }
}

describe('feelsLike', () => {
  it('uses Environment Canada wind chill when cold and windy', () => {
    // EC table: -20 °C at 30 km/h ≈ -33.
    expect(feelsLike(-20, 30, 70)).toBeCloseTo(-32.6, 0)
  })
  it('uses humidex when warm and humid', () => {
    // 30 °C at 70 % RH ≈ humidex 41.
    expect(feelsLike(30, 5, 70)).toBeCloseTo(41, 0)
  })
  it('falls back to the air temperature in between or when calm', () => {
    expect(feelsLike(15, 30, 50)).toBe(15)
    expect(feelsLike(-5, 2, 50)).toBe(-5)
    expect(feelsLike(null, 10, 50)).toBeNull()
  })
})

describe('wetChance', () => {
  it('counts members with ≥0.5 mm over the trailing 6 h, and snowy ones', () => {
    const dry = new Array(8).fill(0)
    const wet = [0, 0, 0.2, 0.2, 0.2, 0, 0, 0]
    const snowWet = [0.3, 0.3, 0, 0, 0, 0, 0, 0]
    const snow = [0.4, 0.4, 0, 0, 0, 0, 0, 0]
    const r = wetChance([dry, wet, snowWet, dry], [dry, dry, snow, dry])
    expect(r.wet.slice(0, 5)).toEqual([null, null, null, null, null])
    // Hour 5 covers hours 0–5: members 2 (0.6) and 3 (0.6) are wet.
    expect(r.wet[5]).toBe(50)
    expect(r.snow[5]).toBe(25)
    // Hour 7 covers 2–7: only member 2 still wet.
    expect(r.wet[7]).toBe(25)
    expect(r.snow[7]).toBe(0)
  })
})

describe('zoom timeline', () => {
  const tl = buildTimeline(TZ, 51, -115, 48, 0, MIDNIGHT * 1000 + 5 * 3_600_000)
  it('finds the local day around a time and slices to it', () => {
    const [from, to] = dayWindow(tl, MIDNIGHT + 30 * 3600)
    expect(from).toBe(MIDNIGHT + 24 * 3600)
    expect(to).toBe(MIDNIGHT + 48 * 3600)
    const z = sliceTimeline(tl, from, to)
    expect(z.times.length).toBe(25)
    expect(z.hours[0]).toBe(0)
    expect(z.midnights).toEqual([from, to])
    for (const [a, b] of z.nights) {
      expect(a).toBeGreaterThanOrEqual(from)
      expect(b).toBeLessThanOrEqual(to)
    }
  })
  it('clamps the first, partial day to the window start', () => {
    const [from] = dayWindow(tl, tl.now)
    expect(from).toBe(tl.from)
  })
})

describe('chart data', () => {
  const tl = buildTimeline(TZ, 51, -115, 47, 0, MIDNIGHT * 1000)
  const day = (base: number) => Array.from({ length: 48 }, (_, i) => base + 5 * Math.sin(((i % 24) - 9) * (Math.PI / 12)))
  const a = model('cmc_gem_hrdps', day(0))
  const b = model('ncep_hrrr_conus', day(2))
  const temp = CHARTS.find((c) => c.id === 'temp')!
  const ctx: ChartCtx = { precipMode: 'hourly', elevation: 1400, aggHours: 1, mode: 'lines' }

  it('labels daily highs/lows with the mean of each model’s extreme', () => {
    const peaks = dailyPeaks(temp.peaks!, [a, b], tl)
    const highs = peaks.filter((p) => !p.lo)
    expect(highs).toHaveLength(2)
    expect(highs[0].v).toBeCloseTo(6, 5) // (5 + 7) / 2
    expect(highs[0].text).toBe('6°')
    // Peak at 15:00 local.
    expect(highs[0].t).toBe(MIDNIGHT + 15 * 3600)
  })

  it('adds a min–max band and mean line in spread mode', () => {
    const cd = buildChartData(temp, { ...ctx, mode: 'spread' }, tl, [a, b])
    expect(cd.spread).toBe(true)
    expect(cd.bands.some(([, , id]) => id === '')).toBe(true)
    expect(cd.mean![15]).toBeCloseTo(6, 1)
    const lines = buildChartData(temp, ctx, tl, [a, b])
    expect(lines.spread).toBe(false)
    expect(lines.mean).toBeNull()
  })

  it('needs two models for spread', () => {
    expect(buildChartData(temp, { ...ctx, mode: 'spread' }, tl, [a]).spread).toBe(false)
  })

  it('draws feels-like only where it differs from the temperature', () => {
    const cold = model('cmc_gem_hrdps', new Array(48).fill(-10), {
      wind_speed_10m: [...new Array(24).fill(0), ...new Array(24).fill(30)],
    })
    const cd = buildChartData(temp, ctx, tl, [cold])
    expect(cd.feels![5]).toBeNull()
    expect(cd.feels![30]).toBeLessThan(-18)
  })
})

describe('orderedCards', () => {
  it('keeps the saved order and slots in new cards', () => {
    const all = orderedCards([])
    expect(all[0]).toBe('temp')
    expect(all[1]).toBe('precipcloud')
    // A card added in a later version ('snow' here) lands after its default neighbour.
    const old = ['wind', 'temp', 'precipcloud', 'precip', 'fzl', 'cloud', 'rh', 'pressure', 'gone']
    const saved = orderedCards(old)
    expect(saved).toEqual(['wind', 'temp', 'precipcloud', 'precip', 'snow', 'fzl', 'cloud', 'rh', 'pressure'])
    expect(saved.length).toBe(all.length)
  })
})

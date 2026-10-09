/**
 * Plain-language day and weekend descriptions, generated from the forecast
 * data with simple rules (no network, works offline). Each day uses the best
 * models that cover it: short-range (HRDPS, HRRR, RDPS…) when available, then
 * the long-range deterministic models, then the GEPS ensemble mean.
 */
import { getModel } from '../config/models'
import { localHour } from '../lib/format'
import { SNOW_CM_PER_MM } from './derive'
import { localDayKey } from './summary'
import type { ModelSeries, Series } from './types'

export interface DayWx {
  key: string
  /** First hour of the day in the data (unix s). */
  start: number
  /** 0 = Sunday … 6 = Saturday, in the spot's time zone. */
  dow: number
  hi: number
  lo: number
  /** Precip total (mm) and snowfall (cm), mean across models. */
  precip: number
  snow: number
  /** Per-model range of precip totals (mm) and highs (°C). */
  precipRange: [number, number]
  snowRange: [number, number]
  /** How many of the models used show ≥ 0.5 mm. */
  wet: number
  hiRange: [number, number]
  gust: number | null
  /** Mean daytime (08–18 h) cloud cover, %. */
  cloud: number | null
  /** Mean daytime freezing level, m. */
  fzl: number | null
  /** Parts of the day with meaningful precip. */
  timing: Part[]
  thunder: boolean
  models: string[]
}

export type Part = 'overnight' | 'morning' | 'afternoon' | 'evening'
const PARTS: Part[] = ['overnight', 'morning', 'afternoon', 'evening']
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const dowFmt = new Map<string, Intl.DateTimeFormat>()
function dayOfWeek(unix: number, tz: string): number {
  let f = dowFmt.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    dowFmt.set(tz, f)
  }
  return DOW[f.format(new Date(unix * 1000))] ?? 0
}

function tier(id: string): number {
  const m = getModel(id)
  if (m.api === 'ensemble') return 2
  return m.maxHours <= 96 ? 0 : 1
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN)
const nums = (s: (number | null | undefined)[]) => s.filter((v): v is number => v != null && Number.isFinite(v))

interface ModelDay {
  id: string
  idx: number[]
  hours: number[]
}

/**
 * Per-day statistics from `fromUnix` on (the current day is counted from then).
 * A model takes part in a day when it covers at least 80% of that day's hours.
 */
export function dayStats(models: ModelSeries[], tz: string, fromUnix: number, maxDays = 10): DayWx[] {
  const covered = models.filter((m) => m.covered)
  // Hours per day across all models (so coverage is judged against the full day).
  const byDay = new Map<string, Map<string, ModelDay>>()
  const dayHours = new Map<string, Set<number>>()
  const dayStart = new Map<string, number>()
  for (const m of covered) {
    m.time.forEach((t, i) => {
      if (t < fromUnix) return
      const k = localDayKey(t, tz)
      if (!byDay.has(k)) byDay.set(k, new Map())
      if (!dayHours.has(k)) dayHours.set(k, new Set())
      dayHours.get(k)!.add(t)
      dayStart.set(k, Math.min(dayStart.get(k) ?? Infinity, t))
      if (m.vars.temperature_2m?.[i] == null) return
      const md = byDay.get(k)!.get(m.modelId) ?? { id: m.modelId, idx: [], hours: [] }
      md.idx.push(i)
      md.hours.push(localHour(t, tz))
      byDay.get(k)!.set(m.modelId, md)
    })
  }

  const out: DayWx[] = []
  const keys = [...byDay.keys()].sort()
  for (const [ki, k] of keys.entries()) {
    // Partial days at the end of the data give misleading totals; keep only the
    // first (current) day when it's partial.
    if (ki > 0 && dayHours.get(k)!.size < 18) continue
    const need = Math.max(1, dayHours.get(k)!.size)
    const ok = [...byDay.get(k)!.values()].filter((md) => md.idx.length >= need * 0.8)
    if (!ok.length) continue
    const best = Math.min(...ok.map((md) => tier(md.id)))
    const use = ok.filter((md) => tier(md.id) === best)
    const series = (md: ModelDay, key: keyof ModelSeries['vars']): Series =>
      md.idx.map((i) => covered.find((m) => m.modelId === md.id)!.vars[key]?.[i] ?? null)

    const his: number[] = []
    const los: number[] = []
    const precips: number[] = []
    const snows: number[] = []
    const gusts: number[] = []
    const clouds: number[] = []
    const fzls: number[] = []
    const partTotals = [0, 0, 0, 0]
    let thunder = false
    for (const md of use) {
      const t = nums(series(md, 'temperature_2m'))
      his.push(Math.max(...t))
      los.push(Math.min(...t))
      const p = series(md, 'precipitation')
      precips.push(nums(p).reduce((a, b) => a + b, 0))
      snows.push(nums(series(md, 'snowfall')).reduce((a, b) => a + b, 0))
      const g = nums(series(md, 'wind_gusts_10m'))
      if (g.length) gusts.push(Math.max(...g))
      let day = md.hours.map((h, j) => (h >= 8 && h <= 18 ? j : -1)).filter((j) => j >= 0)
      // Evening/night-only remainder of today: use whatever hours are left.
      if (!day.length) day = md.hours.map((_, j) => j)
      const c = series(md, 'cloud_cover')
      const cd = nums(day.map((j) => c[j]))
      if (cd.length) clouds.push(mean(cd))
      const f = series(md, 'freezing_level_height')
      const fd = nums(day.map((j) => f[j]))
      if (fd.length) fzls.push(mean(fd))
      p.forEach((v, j) => {
        if (v != null) partTotals[Math.floor(md.hours[j] / 6)] += v / use.length
      })
      if (nums(series(md, 'weather_code')).some((c2) => c2 >= 95)) thunder = true
    }
    const precip = mean(precips)
    const timing = PARTS.filter((_, pi) => partTotals[pi] >= 0.3 && partTotals[pi] >= precip * 0.25)
    out.push({
      key: k,
      start: dayStart.get(k)!,
      dow: dayOfWeek(dayStart.get(k)!, tz),
      hi: Math.round(mean(his)),
      lo: Math.round(mean(los)),
      precip: round1(precip),
      snow: round1(mean(snows)),
      precipRange: [round1(Math.min(...precips)), round1(Math.max(...precips))],
      snowRange: [round1(Math.min(...snows)), round1(Math.max(...snows))],
      wet: precips.filter((p) => p >= 0.5).length,
      hiRange: [Math.round(Math.min(...his)), Math.round(Math.max(...his))],
      gust: gusts.length ? Math.round(Math.max(...gusts)) : null,
      cloud: clouds.length ? Math.round(mean(clouds)) : null,
      fzl: fzls.length ? Math.round(mean(fzls)) : null,
      timing,
      thunder,
      models: use.map((md) => getModel(md.id).short),
    })
    if (out.length >= maxDays) break
  }
  return out
}

const round1 = (v: number) => Math.round(v * 10) / 10

function sky(cloud: number | null): string {
  if (cloud == null) return ''
  if (cloud < 20) return 'Sunny'
  if (cloud < 45) return 'Mostly sunny'
  if (cloud < 70) return 'Mix of sun and cloud'
  if (cloud < 90) return 'Mostly cloudy'
  return 'Overcast'
}

function when(parts: Part[]): string {
  if (!parts.length) return ''
  if (parts.length >= 3) return 'on and off through the day'
  if (parts.length === 1) return parts[0] === 'overnight' ? 'overnight' : `in the ${parts[0]}`
  const [a, b] = parts
  if (PARTS.indexOf(b) - PARTS.indexOf(a) === 1) return `${a === 'overnight' ? 'overnight' : `from ${a}`} into the ${b}`
  return `${a === 'overnight' ? 'overnight' : `in the ${a}`} and again in the ${b}`
}

const fmtRange = (lo: number, hi: number, unit: string) =>
  hi - lo >= 1 && lo > 0 ? `${Math.round(lo)}–${Math.round(hi)} ${unit}` : `~${hi < 1 ? round1(hi) : Math.round(hi)} ${unit}`

type Kind = 'dry' | 'rain' | 'snow' | 'mixed'
function precipKind(d: DayWx): Kind {
  if (d.precip < 0.3 && d.snow < 0.3) return 'dry'
  const snowWater = d.snow / SNOW_CM_PER_MM
  const frac = d.precip > 0 ? snowWater / d.precip : 1
  if (frac >= 0.7) return 'snow'
  if (frac <= 0.3) return 'rain'
  return 'mixed'
}

/** The precip clause, e.g. "light snow overnight (~2 cm)". */
function precipPhrase(d: DayWx): string {
  const n = d.models.length
  const t = when(d.timing)
  // Only some models are wet: say so instead of averaging into a small amount.
  if (n > 1 && d.wet > 0 && d.wet < n) {
    const snowy = d.snowRange[1] >= 1
    if (!snowy && d.precipRange[1] < 1.5) return `a stray shower possible${t ? ` ${t}` : ''}`
    const what = snowy ? 'snow' : 'rain'
    const odds = d.wet * 2 >= n ? 'likely' : 'possible'
    const upTo = snowy ? `up to ${Math.round(d.snowRange[1])} cm` : `up to ${Math.round(d.precipRange[1])} mm`
    return `${what} ${odds}${t ? ` ${t}` : ''} (${d.wet} of ${n} models, ${upTo})`
  }
  const kind = precipKind(d)
  if (kind === 'dry') return ''
  if (kind === 'snow') {
    const s = d.snow
    const word = s < 2 ? 'light snow' : s < 10 ? 'snow' : 'heavy snow'
    const ratio = d.precip > 0 ? s / d.precip : 1
    const amount = fmtRange(d.precipRange[0] * ratio, d.precipRange[1] * ratio, 'cm')
    return `${word}${t ? ` ${t}` : ''} (${amount})`
  }
  const p = d.precip
  const word = kind === 'mixed' ? 'rain and snow' : p < 2 ? 'light rain' : p < 10 ? 'rain' : 'heavy rain'
  return `${word}${t ? ` ${t}` : ''} (${fmtRange(d.precipRange[0], d.precipRange[1], 'mm')})`
}

function snowLine(d: DayWx, elevation: number | null): string {
  const kind = precipKind(d)
  if (d.fzl == null || (kind !== 'rain' && kind !== 'mixed') || d.precipRange[1] < 1.5) return ''
  // Snow usually reaches ~300 m below the freezing level.
  const line = Math.max(0, Math.round((d.fzl - 300) / 100) * 100)
  if (elevation != null && line <= elevation) return ''
  return `Snow above ~${line.toLocaleString('en-CA')} m.`
}

function windPhrase(gust: number | null): string {
  if (gust == null) return ''
  if (gust >= 70) return `Strong winds, gusts to ${gust} km/h.`
  if (gust >= 45) return `Windy, gusts to ${gust} km/h.`
  if (gust >= 30) return `Breezy at times (gusts ${gust} km/h).`
  return ''
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const deg = (v: number) => `${v}°`

/** One or two short sentences describing a day. */
export function describeDay(
  d: DayWx,
  opts: { prev?: DayWx; elevation?: number | null; prevLabel?: string; partial?: boolean } = {},
): string {
  const parts: string[] = []
  const pr = precipPhrase(d)
  // "Sunny, rain likely…" reads oddly; soften the sky when there's precip.
  const sk = pr && d.cloud != null && d.cloud < 20 ? 'Mostly sunny' : sky(d.cloud)
  if (pr) parts.push(sk && d.cloud != null && d.cloud < 70 ? `${sk}, ${pr}.` : `${cap(pr)}.`)
  else parts.push(!sk ? 'Dry.' : sk.includes(' ') && !sk.startsWith('Mostly') ? `${sk}, dry.` : `${sk} and dry.`)
  if (d.thunder) parts.push('Thunderstorms possible.')

  let temp = opts.partial
    ? d.hi - d.lo < 2
      ? `Around ${deg(d.hi)}`
      : `Between ${deg(d.lo)} and ${deg(d.hi)}`
    : `High ${deg(d.hi)}, low ${deg(d.lo)}`
  if (opts.prev && !opts.partial) {
    const diff = d.hi - opts.prev.hi
    const than = opts.prevLabel ? ` than ${opts.prevLabel}` : ''
    if (diff <= -8) temp += `, much colder${than}`
    else if (diff <= -5) temp += `, colder${than}`
    else if (diff >= 8) temp += `, much warmer${than}`
    else if (diff >= 5) temp += `, warmer${than}`
  }
  parts.push(`${temp}.`)
  const sl = snowLine(d, opts.elevation ?? null)
  if (sl) parts.push(sl)
  const w = windPhrase(d.gust)
  if (w) parts.push(w)

  const conf: string[] = []
  if (d.models.length > 1 && d.hiRange[1] - d.hiRange[0] >= 5) conf.push(`highs ${d.hiRange[0]}° to ${d.hiRange[1]}°`)
  const [pl, ph] = d.precipRange
  const partial = d.wet > 0 && d.wet < d.models.length
  if (d.models.length > 1 && !partial && ph >= 3 && ph - pl >= Math.max(3, pl * 1.5)) conf.push(`precip ${pl}–${ph} mm`)
  if (conf.length) parts.push(`Models disagree (${conf.join(', ')}).`)
  return parts.join(' ')
}

/** Higher is a nicer day to be outside. */
export function dayScore(d: DayWx): number {
  return -d.precip * 3 - d.snow * 2 - Math.max(0, (d.gust ?? 0) - 30) * 0.4 - (d.cloud ?? 50) * 0.03 + d.hi * 0.3
}

/** Compact version for the weekend line, e.g. "light snow (~2 cm), high 1°". */
function brief(d: DayWx): string {
  const pr = precipPhrase(d)
  const sk = sky(d.cloud).toLowerCase()
  const wind = d.gust != null && d.gust >= 45 ? `, gusts ${d.gust}` : ''
  return `${pr || (sk ? `${sk}, dry` : 'dry')}, high ${deg(d.hi)}${wind}`
}

export interface Weekend {
  title: string
  text: string
}

/**
 * Weekend outlook from Wednesday through Saturday (on Saturday only Sunday is
 * left). Returns null on other days or when the weekend is beyond the data.
 */
export function describeWeekend(days: DayWx[]): Weekend | null {
  if (!days.length) return null
  const today = days[0].dow
  if (![3, 4, 5, 6].includes(today)) return null
  const sat = today === 6 ? null : days.find((d, i) => i > 0 && d.dow === 6)
  const sun = days.find((d, i) => i > 0 && d.dow === 0)
  if (today === 6) {
    if (!sun) return null
    return { title: 'Tomorrow (Sunday)', text: `${cap(brief(sun))}.` }
  }
  if (!sat && !sun) return null
  const bits: string[] = []
  if (sat) bits.push(`Saturday: ${brief(sat)}.`)
  if (sun) bits.push(`Sunday: ${brief(sun)}.`)
  if (sat && sun) {
    const a = dayScore(sat)
    const b = dayScore(sun)
    if (Math.abs(a - b) >= 2) bits.push(`${a > b ? 'Saturday' : 'Sunday'} looks like the better day to get out.`)
    else bits.push('Similar both days.')
  }
  const far = sat ? days.indexOf(sat) : days.indexOf(sun!)
  return { title: far >= 4 ? 'This weekend (low confidence)' : 'This weekend', text: bits.join(' ') }
}

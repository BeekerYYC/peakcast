import { useMemo } from 'react'
import type { Timeline } from '../data/timeline'
import { align } from '../data/timeline'
import type { ModelSeries } from '../data/types'
import { dailySummary, localDayKey } from '../data/summary'
import { dayOfMonth, num } from '../lib/format'
import { dailyCode, wmo } from '../lib/wmo'
import { useScrub } from '../state/scrub'
import { WxGlyph } from './Icons'

interface Props {
  models: ModelSeries[]
  tl: Timeline
}

export function DailySummary({ models, tl }: Props) {
  const scrubT = useScrub((s) => s.t)
  const setScrub = useScrub((s) => s.set)
  const days = useMemo(() => dailySummary(models, tl.tz, tl.now - 3600, tl.to), [models, tl])

  // Representative icon from the first covered model's daytime hours.
  const codes = useMemo(() => {
    const m = models.find((x) => x.covered && x.vars.weather_code)
    const out = new Map<string, number | null>()
    if (!m) return out
    const s = align(m, m.vars.weather_code, tl.times)
    const byDay = new Map<string, (number | null)[]>()
    tl.times.forEach((t, i) => {
      if (tl.hours[i] < 8 || tl.hours[i] > 18) return
      const k = localDayKey(t, tl.tz)
      byDay.set(k, [...(byDay.get(k) ?? []), s[i]])
    })
    for (const [k, v] of byDay) out.set(k, dailyCode(v))
    return out
  }, [models, tl])

  if (!days.length) return null
  const activeKey = scrubT != null ? localDayKey(scrubT, tl.tz) : null

  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
      {days.map((d) => {
        const code = codes.get(d.key)
        const w = wmo(code)
        const active = activeKey === d.key
        const spread = (c: { min: number | null; max: number | null }, digits = 0) =>
          c.min != null && c.max != null && c.max - c.min >= (digits ? 0.5 : 2)
            ? `${num(c.min, digits)}–${num(c.max, digits)}`
            : null
        const hiSpread = spread(d.hi)
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => {
              const noon = tl.times.find(
                (t, i) => localDayKey(t, tl.tz) === d.key && tl.hours[i] === 13,
              )
              setScrub(noon ?? d.start)
            }}
            className={`flex min-w-[84px] flex-1 shrink-0 snap-start flex-col items-center rounded-2xl px-2 pt-2 pb-2.5 text-center transition-colors ${
              active ? 'bg-accent/12 shadow-[0_0_0_1.5px_var(--accent)]' : 'bg-surface shadow-[0_0_0_1px_var(--hair)]'
            }`}
            aria-label={`${d.label}: high ${num(d.hi.value)}, low ${num(d.lo.value)}, ${w.label}`}
          >
            <span className="text-[12px] font-semibold text-ink">
              {d.label} <span className="font-normal text-muted">{dayOfMonth(d.start, tl.tz)}</span>
            </span>
            <span className="my-0.5" title={w.label}>
              <WxGlyph icon={w.icon} size={28} />
            </span>
            <span className="tnum text-[15px] leading-5 font-semibold text-ink">
              {num(d.hi.value)}°<span className="font-normal text-muted"> {num(d.lo.value)}°</span>
            </span>
            {hiSpread && <span className="tnum text-[10px] leading-3 text-muted">hi {hiSpread}</span>}
            <span className="tnum mt-1 text-[11px] leading-4 text-ink-2">
              {d.snow.value != null && d.snow.value >= 0.5
                ? `${num(d.snow.value, 1)} cm`
                : `${num(d.precip.value, 1)} mm`}
            </span>
            <span className="tnum text-[11px] leading-4 text-ink-2">
              {d.gust.value != null ? `g ${num(d.gust.value)}` : ' '}
            </span>
          </button>
        )
      })}
    </div>
  )
}

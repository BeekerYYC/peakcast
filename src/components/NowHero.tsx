import { useMemo } from 'react'
import { feelsConsensus } from '../data/consensus'
import { alignVar, indexOf, type Timeline } from '../data/timeline'
import type { ModelSeries, SeriesKey } from '../data/types'
import { num } from '../lib/format'
import { wmo } from '../lib/wmo'
import { WxGlyph } from './Icons'

interface Props {
  models: ModelSeries[]
  tl: Timeline
}

function mean(v: number[]): number | null {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Current conditions as a consensus of the visible models. */
export function NowHero({ models, tl }: Props) {
  const s = useMemo(() => {
    const i = indexOf(tl, tl.now)
    const at = (key: SeriesKey) =>
      models
        .map((m) => alignVar(m, key, tl.times)[i])
        .filter((v): v is number => v != null)
    const next24 = (key: SeriesKey) =>
      models
        .map((m) => {
          const s = alignVar(m, key, tl.times).slice(i + 1, i + 25)
          const vals = s.filter((v): v is number => v != null)
          return vals.length >= 12 ? vals.reduce((a, b) => a + b, 0) : null
        })
        .filter((v): v is number => v != null)
    const temps = at('temperature_2m')
    const code = models.map((m) => alignVar(m, 'weather_code', tl.times)[i]).find((v) => v != null)
    return {
      temp: mean(temps),
      tMin: temps.length > 1 ? Math.min(...temps) : null,
      tMax: temps.length > 1 ? Math.max(...temps) : null,
      code,
      feels: feelsConsensus(models, tl.times, 2, false)[i],
      wind: mean(at('wind_speed_10m')),
      gust: mean(at('wind_gusts_10m')),
      fzl: mean(at('freezing_level_height')),
      precip24: mean(next24('precipitation')),
      snow24: mean(next24('snowfall')),
    }
  }, [models, tl])

  const w = wmo(s.code)
  const night = tl.nights.some(([a, b]) => tl.now >= a && tl.now < b)
  return (
    <section className="flex items-stretch justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[0_0_0_1px_var(--hair)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <WxGlyph icon={w.icon} size={44} night={night} />
        <div className="min-w-0">
          <div className="tnum text-[40px] leading-[44px] font-semibold tracking-tight text-ink">
            {num(s.temp)}°
          </div>
          <div className="truncate text-[12px] text-ink-2">
            {night && w.icon === 'clear' ? 'Clear night' : w.label}
            {s.feels != null && <span className="tnum"> · feels {num(s.feels)}°</span>}
            {s.tMin != null && s.tMax != null && s.tMax - s.tMin >= 1 && (
              <span className="tnum text-muted"> · {num(s.tMin)}° to {num(s.tMax)}°</span>
            )}
          </div>
        </div>
      </div>
      <dl className="tnum grid shrink-0 grid-cols-[auto_auto] content-center gap-x-3 gap-y-0.5 text-[12px] leading-5">
        <dt className="text-muted">Wind</dt>
        <dd className="text-right font-medium text-ink">
          {num(s.wind)}
          {s.gust != null && <span className="text-ink-2"> g{num(s.gust)}</span>}
          <span className="font-normal text-muted"> km/h</span>
        </dd>
        <dt className="text-muted">0 °C level</dt>
        <dd className="text-right font-medium text-ink">
          {s.fzl != null ? `${Math.round(s.fzl / 10) * 10} m` : '–'}
        </dd>
        <dt className="text-muted">Next 24 h</dt>
        <dd className="text-right font-medium text-ink">
          {s.snow24 != null && s.snow24 >= 0.5
            ? `${num(s.snow24, 1)} cm`
            : `${num(s.precip24, 1)} mm`}
        </dd>
      </dl>
    </section>
  )
}

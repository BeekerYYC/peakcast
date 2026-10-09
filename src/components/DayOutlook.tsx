import { useMemo } from 'react'
import { dayStats, DAY_NAMES, describeDay, describeWeekend } from '../data/narrative'
import { localDayKey } from '../data/summary'
import type { Timeline } from '../data/timeline'
import type { ModelSeries } from '../data/types'
import { dayOfMonth, localHour } from '../lib/format'
import { useScrub } from '../state/scrub'

interface Props {
  /** Every covered model for the spot (not just this tab's), best per day is picked. */
  models: ModelSeries[]
  tl: Timeline
  elevation: number | null
}

/**
 * Plain-language outlook for today (or the day picked in the day cards), plus
 * a weekend summary from Wednesday to Saturday.
 */
export function DayOutlook({ models, tl, elevation }: Props) {
  const scrubT = useScrub((s) => s.t)
  const days = useMemo(() => dayStats(models, tl.tz, tl.now), [models, tl])
  const weekend = useMemo(() => describeWeekend(days), [days])
  if (!days.length) return null

  const nowHour = localHour(tl.now, tl.tz)
  const pickedKey = scrubT != null && scrubT !== tl.now ? localDayKey(scrubT, tl.tz) : null
  let i = pickedKey ? days.findIndex((d) => d.key === pickedKey) : 0
  if (i < 0) i = 0
  // Late evening: lead with tomorrow unless the user picked a day.
  if (!pickedKey && i === 0 && nowHour >= 21 && days.length > 1) i = 1
  const d = days[i]
  const partial = i === 0 && nowHour >= 12
  const title =
    i === 0
      ? partial
        ? nowHour >= 18
          ? 'Tonight'
          : 'Rest of today'
        : 'Today'
      : i === 1
        ? 'Tomorrow'
        : DAY_NAMES[d.dow]
  const prev = i > 0 ? days[i - 1] : undefined
  const text = describeDay(d, {
    prev: prev && !(i - 1 === 0 && nowHour >= 12) ? prev : undefined,
    prevLabel: i - 1 === 0 ? 'today' : prev ? DAY_NAMES[prev.dow] : undefined,
    elevation,
    partial,
  })

  return (
    <section className="rounded-2xl bg-surface px-4 py-3 shadow-[0_0_0_1px_var(--hair)]">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">
        {title}
        <span className="font-normal normal-case"> · {DAY_NAMES[d.dow].slice(0, 3)} {dayOfMonth(d.start, tl.tz)}</span>
      </h3>
      <p className="mt-1 text-[14px] leading-snug text-ink">{text}</p>
      {weekend && (
        <div className="mt-2.5 border-t border-hair pt-2.5">
          <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">{weekend.title}</h3>
          <p className="mt-1 text-[14px] leading-snug text-ink">{weekend.text}</p>
        </div>
      )}
      <p className="mt-2 text-[10.5px] text-muted">Based on {d.models.join(', ')}</p>
    </section>
  )
}

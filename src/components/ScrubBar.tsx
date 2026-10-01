import type { Timeline } from '../data/timeline'
import { scrubLabel } from '../lib/format'
import type { PrecipMode } from '../state/prefs'
import { useScrub } from '../state/scrub'

interface Props {
  tl: Timeline
  precipMode: PrecipMode
  onPrecipMode: (m: PrecipMode) => void
}

/** Sticky bar: the hour under the scrubber, a "Now" reset and the precip mode. */
export function ScrubBar({ tl, precipMode, onPrecipMode }: Props) {
  const t = useScrub((s) => s.t)
  const set = useScrub((s) => s.set)
  const isNow = t == null || t === tl.now
  return (
    <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 bg-bg/85 px-4 py-1.5 backdrop-blur-md">
      <div className="flex items-baseline gap-2">
        <span className="tnum text-[15px] font-semibold text-ink">
          {isNow ? 'Now' : scrubLabel(t, tl.tz)}
        </span>
        {!isNow && (
          <button
            type="button"
            onClick={() => set(null)}
            className="rounded-full px-2 py-0.5 text-[12px] font-medium text-accent active:opacity-60"
          >
            Back to now
          </button>
        )}
        {isNow && <span className="text-[12px] text-muted">drag a chart to scrub</span>}
      </div>
      <div className="flex rounded-lg bg-surface-2 p-0.5 text-[11px] font-semibold">
        {(['hourly', 'total'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onPrecipMode(m)}
            aria-pressed={precipMode === m}
            className={`rounded-md px-2 py-1 capitalize transition-colors ${
              precipMode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
            }`}
          >
            {m === 'hourly' ? 'Hourly' : 'Total'}
          </button>
        ))}
      </div>
    </div>
  )
}

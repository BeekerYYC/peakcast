import type { Timeline } from '../data/timeline'
import { scrubLabel } from '../lib/format'
import { usePrefs, type PrecipMode } from '../state/prefs'
import { useScrub } from '../state/scrub'
import { IconChevronDown, IconClose } from './Icons'

export interface ZoomControls {
  label: string
  prev?: () => void
  next?: () => void
  clear: () => void
}

interface Props {
  tl: Timeline
  precipMode: PrecipMode
  aggHours: number
  onPrecipMode: (m: PrecipMode) => void
  zoom?: ZoomControls | null
}

/** Sticky bar: the hour under the scrubber, a "Now" reset, chart mode and precip mode. */
export function ScrubBar({ tl, precipMode, aggHours, onPrecipMode, zoom }: Props) {
  const t = useScrub((s) => s.t)
  const set = useScrub((s) => s.set)
  const isNow = t == null || t === tl.now
  return (
    <div className="sticky top-0 z-10 -mx-4 bg-bg/85 px-4 py-1.5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="tnum shrink-0 text-[15px] font-semibold text-ink">
            {isNow ? 'Now' : scrubLabel(t, tl.tz)}
          </span>
          {!isNow && (
            <button
              type="button"
              onClick={() => set(null)}
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[12px] font-medium text-accent active:opacity-60"
            >
              ← Now
            </button>
          )}
          {isNow && <span className="hidden truncate text-[12px] text-muted min-[400px]:inline">drag a chart to scrub</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <SpreadToggle />
          <div className="flex rounded-lg bg-surface-2 p-0.5 text-[11px] font-semibold">
            {(['hourly', 'total'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onPrecipMode(m)}
                aria-pressed={precipMode === m}
                className={`rounded-md px-2 py-1 transition-colors ${
                  precipMode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
                }`}
              >
                {m === 'hourly' ? (aggHours > 1 ? `${aggHours}-hourly` : 'Hourly') : 'Total'}
              </button>
            ))}
          </div>
        </div>
      </div>
      {zoom && <ZoomBar zoom={zoom} />}
    </div>
  )
}

/** Lines (each model) vs Spread (range band + mean). */
export function SpreadToggle() {
  const mode = usePrefs((s) => s.chartMode)
  const setMode = usePrefs((s) => s.setChartMode)
  const on = mode === 'spread'
  return (
    <button
      type="button"
      onClick={() => setMode(on ? 'lines' : 'spread')}
      aria-pressed={on}
      title={on ? 'Showing model range and mean. Tap for individual lines.' : 'Show model range and mean'}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
        on ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2'
      }`}
    >
      <svg viewBox="0 0 16 12" className="h-3 w-4" aria-hidden="true">
        <path d="M0 5 C4 1 8 1 16 3 V9 C8 7 4 9 0 10 Z" fill="currentColor" opacity="0.35" />
        <path d="M0 7.5 C4 4.5 8 4 16 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      Spread
    </button>
  )
}

export function ZoomBar({
  zoom,
  className = 'mt-1.5',
  compact = false,
}: {
  zoom: ZoomControls
  className?: string
  /** Icon-only close button (landscape top bar). */
  compact?: boolean
}) {
  const btn = 'flex size-7 items-center justify-center rounded-full text-ink-2 active:bg-surface-2 disabled:opacity-30'
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl bg-accent/10 py-0.5 pr-1 pl-1 ${className}`}>
      <div className="flex items-center">
        <button type="button" className={btn} onClick={zoom.prev} disabled={!zoom.prev} aria-label="Previous day">
          <IconChevronDown size={16} className="rotate-90" />
        </button>
        <span className="tnum min-w-[52px] text-center text-[13px] font-semibold text-ink">{zoom.label}</span>
        <button type="button" className={btn} onClick={zoom.next} disabled={!zoom.next} aria-label="Next day">
          <IconChevronDown size={16} className="-rotate-90" />
        </button>
      </div>
      <button
        type="button"
        onClick={zoom.clear}
        aria-label="Show all days"
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-accent active:opacity-60"
      >
        {!compact && 'Show all'} <IconClose size={13} />
      </button>
    </div>
  )
}

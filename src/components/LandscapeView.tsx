import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Timeline } from '../data/timeline'
import type { ModelSeries } from '../data/types'
import { scrubLabel } from '../lib/format'
import type { Resolved } from '../lib/theme'
import { usePrefs } from '../state/prefs'
import { useScrub } from '../state/scrub'
import type { ChartData } from './charts/buildData'
import { ChartCard } from './charts/ChartCard'
import { CARDS, type ChartCtx, type ChartDef } from './charts/chartDefs'
import { PrecipCloudCard } from './charts/PrecipCloudCard'
import { HorizonTabs } from './HorizonTabs'
import { SpreadToggle, ZoomBar, type ZoomControls } from './ScrubBar'

const SHORT: Record<string, string> = {
  temp: 'Temp',
  precipcloud: 'Precip & cloud',
  precip: 'Precip',
  snow: 'Snow',
  wind: 'Wind',
  fzl: 'Freezing lvl',
  cloud: 'Cloud',
  rh: 'Humidity',
  pressure: 'Pressure',
}

interface Props {
  spotName: string
  tl: Timeline
  ctx: ChartCtx
  theme: Resolved
  models: ModelSeries[]
  charts: { def: ChartDef; cd: ChartData }[]
  cards: string[]
  height: number
  zoom: ZoomControls | null
  /** Zoom into the day under the scrubber (or today). */
  onZoom: () => void
}

/** Phone turned sideways: one chart filling the screen, picked with chips. */
export function LandscapeView({ spotName, tl, ctx, theme, models, charts, cards, height, zoom, onZoom }: Props) {
  const picked = usePrefs((s) => s.landscapeChart)
  const setPicked = usePrefs((s) => s.setLandscapeChart)
  const t = useScrub((s) => s.t)
  const id = cards.includes(picked) ? picked : cards[0]

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Viewport minus the top bar, card header and x axis.
  const plot = Math.max(110, height - 112)
  const chart = charts.find((c) => c.def.id === id)
  // Portal: ancestors use transforms (swipe animations), which would trap `fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pr-[max(env(safe-area-inset-right),8px)] pl-[max(env(safe-area-inset-left),8px)]">
      <div className="flex h-11 shrink-0 items-center gap-2">
        <div className="flex min-w-0 shrink-0 flex-col leading-tight">
          <span className="max-w-[140px] truncate text-[14px] font-bold text-ink">{spotName}</span>
          <span className="tnum text-[11px] text-muted">{t == null || t === tl.now ? 'Now' : scrubLabel(t, tl.tz)}</span>
        </div>
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {cards.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPicked(c)}
              aria-pressed={c === id}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                c === id ? 'bg-ink text-bg' : 'text-ink-2 shadow-[0_0_0_1px_var(--hair)]'
              }`}
            >
              {SHORT[c] ?? CARDS.find((x) => x.id === c)?.title}
            </button>
          ))}
        </div>
        {zoom ? (
          <ZoomBar zoom={zoom} className="shrink-0" compact />
        ) : (
          <button
            type="button"
            onClick={onZoom}
            className="shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-2"
          >
            Day
          </button>
        )}
        <SpreadToggle />
        <HorizonTabs pill="horizon-pill-landscape" compact />
      </div>
      <div className="min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),6px)]">
        {id === 'precipcloud' ? (
          <PrecipCloudCard
            models={models}
            tl={tl}
            theme={theme}
            aggHours={ctx.aggHours}
            heights={[Math.round((plot - 30) * 0.64), Math.round((plot - 30) * 0.36)]}
          />
        ) : (
          chart && <ChartCard def={chart.def} ctx={ctx} tl={tl} cd={chart.cd} theme={theme} showX height={plot} />
        )}
      </div>
    </div>,
    document.body,
  )
}

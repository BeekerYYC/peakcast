import { motion } from 'motion/react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { HORIZONS_BY_ID, PAST_HOURS } from '../config/horizons'
import type { Spot } from '../config/spots'
import { buildTimeline } from '../data/timeline'
import type { CachedModel, ModelSeries } from '../data/types'
import { useResolvedTheme } from '../lib/theme'
import { usePrefs, visibleModelsFor } from '../state/prefs'
import { buildChartData } from './charts/buildData'
import { ChartCard } from './charts/ChartCard'
import { PrecipCloudCard } from './charts/PrecipCloudCard'
import { CHARTS, type ChartCtx } from './charts/chartDefs'
import { DailySummary } from './DailySummary'
import { DayOutlook } from './DayOutlook'
import { ModelChips } from './ModelChips'
import { NowHero } from './NowHero'
import { ScrubBar } from './ScrubBar'

interface Props {
  spot: Spot
  data: Record<string, CachedModel>
  loading: boolean
  error: string | null
  onRetry: () => void
}

/** Re-render on the hour so "now" and the window advance. */
function useHourTick(): number {
  const [h, setH] = useState(() => Math.floor(Date.now() / 3_600_000))
  useEffect(() => {
    const id = setInterval(() => setH(Math.floor(Date.now() / 3_600_000)), 60_000)
    return () => clearInterval(id)
  }, [])
  return h
}

export function ForecastView({ spot, data, loading, error, onRetry }: Props) {
  const theme = useResolvedTheme()
  const horizonId = usePrefs((s) => s.horizon)
  const vis = usePrefs((s) => s.modelVis)
  const precipMode = usePrefs((s) => s.precipMode)
  const setPrecipMode = usePrefs((s) => s.setPrecipMode)
  const hour = useHourTick()
  const horizon = HORIZONS_BY_ID[horizonId]

  const ids = useMemo(() => visibleModelsFor(vis, horizonId), [vis, horizonId])
  const models = useMemo(
    () => ids.map((id) => data[id]?.series).filter((s): s is ModelSeries => !!s && s.covered),
    [ids, data],
  )
  // The written outlook uses every model for the spot, whatever the tab.
  const allModels = useMemo(
    () => Object.values(data).map((c) => c.series).filter((s) => s.covered),
    [data],
  )
  const tz = models[0]?.timezone ?? Object.values(data)[0]?.series.timezone ?? 'America/Edmonton'
  const elevation = models[0]?.elevation ?? spot.elevation ?? 0

  const tl = useMemo(
    () => buildTimeline(tz, spot.lat, spot.lon, horizon.hours, PAST_HOURS, hour * 3_600_000 + 1),
    [tz, spot.lat, spot.lon, horizon.hours, hour],
  )
  const aggHours = horizon.hours > 96 ? 6 : 1
  const ctx: ChartCtx = useMemo(
    () => ({ precipMode, elevation, aggHours }),
    [precipMode, elevation, aggHours],
  )
  const charts = useMemo(
    () => CHARTS.map((def) => ({ def, cd: buildChartData(def, ctx, tl, models) })),
    [ctx, tl, models],
  )

  const hasData = models.length > 0
  return (
    <div className="flex flex-col gap-3">
      <ModelChips horizon={horizonId} data={data} />
      {hasData ? (
        <motion.div
          key={horizonId}
          className="flex flex-col gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <NowHero models={models} tl={tl} />
          <DayOutlook models={allModels} tl={tl} elevation={elevation} />
          <DailySummary models={models} tl={tl} />
          <ScrubBar tl={tl} precipMode={precipMode} aggHours={aggHours} onPrecipMode={setPrecipMode} />
          <div className="flex flex-col gap-2.5">
            {charts.map(({ def, cd }) => (
              <Fragment key={def.id}>
                <ChartCard def={def} ctx={ctx} tl={tl} cd={cd} theme={theme} showX />
                {def.id === 'temp' && (
                  <PrecipCloudCard models={models} tl={tl} theme={theme} aggHours={aggHours} />
                )}
              </Fragment>
            ))}
          </div>
        </motion.div>
      ) : (
        <EmptyState
          loading={loading}
          anyData={Object.keys(data).length > 0}
          error={error}
          onRetry={onRetry}
        />
      )}
    </div>
  )
}

function EmptyState({
  loading,
  anyData,
  error,
  onRetry,
}: {
  loading: boolean
  anyData: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading)
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true">
        {[150, 120, 150, 140].map((h, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl bg-surface shadow-[0_0_0_1px_var(--hair)]"
            style={{ height: h + 30, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    )
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-4 py-8 text-center shadow-[0_0_0_1px_var(--hair)]">
      <p className="text-[14px] text-ink-2">
        {anyData
          ? 'Turn on a model above to see its forecast.'
          : error === 'Offline'
            ? 'You are offline and this spot has no saved forecast yet.'
            : error
              ? `Couldn't load the forecast (${error}).`
              : 'No forecast loaded yet.'}
      </p>
      {!anyData && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-accent-ink active:scale-95"
        >
          Try again
        </button>
      )}
    </div>
  )
}

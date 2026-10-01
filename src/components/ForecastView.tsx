import { useEffect, useMemo, useState } from 'react'
import { HORIZONS_BY_ID, PAST_HOURS } from '../config/horizons'
import type { Spot } from '../config/spots'
import { buildTimeline } from '../data/timeline'
import type { CachedModel, ModelSeries } from '../data/types'
import { useResolvedTheme } from '../lib/theme'
import { usePrefs, visibleModelsFor } from '../state/prefs'
import { buildChartData } from './charts/buildData'
import { ChartCard } from './charts/ChartCard'
import { CHARTS, type ChartCtx } from './charts/chartDefs'
import { DailySummary } from './DailySummary'
import { ModelChips } from './ModelChips'
import { ScrubBar } from './ScrubBar'

interface Props {
  spot: Spot
  data: Record<string, CachedModel>
  loading: boolean
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

export function ForecastView({ spot, data, loading }: Props) {
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
  const tz = models[0]?.timezone ?? Object.values(data)[0]?.series.timezone ?? 'America/Edmonton'
  const elevation = models[0]?.elevation ?? spot.elevation ?? 0

  const tl = useMemo(
    () => buildTimeline(tz, spot.lat, spot.lon, horizon.hours, PAST_HOURS, hour * 3_600_000 + 1),
    [tz, spot.lat, spot.lon, horizon.hours, hour],
  )
  const ctx: ChartCtx = useMemo(() => ({ precipMode, elevation }), [precipMode, elevation])
  const charts = useMemo(
    () => CHARTS.map((def) => ({ def, cd: buildChartData(def, ctx, tl, models) })),
    [ctx, tl, models],
  )

  const hasData = models.length > 0
  return (
    <div className="flex flex-col gap-3">
      <ModelChips horizon={horizonId} data={data} />
      {hasData ? (
        <>
          <DailySummary models={models} tl={tl} />
          <ScrubBar tl={tl} precipMode={precipMode} onPrecipMode={setPrecipMode} />
          <div className="flex flex-col gap-2.5">
            {charts.map(({ def, cd }) => (
              <ChartCard key={def.id} def={def} ctx={ctx} tl={tl} cd={cd} theme={theme} showX />
            ))}
          </div>
        </>
      ) : (
        <EmptyState loading={loading} anyData={Object.keys(data).length > 0} />
      )}
    </div>
  )
}

function EmptyState({ loading, anyData }: { loading: boolean; anyData: boolean }) {
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
    <p className="rounded-2xl bg-surface px-4 py-6 text-center text-[13px] text-ink-2 shadow-[0_0_0_1px_var(--hair)]">
      {anyData ? 'Turn on a model above to see its forecast.' : 'No forecast loaded yet.'}
    </p>
  )
}

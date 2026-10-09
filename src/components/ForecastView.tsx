import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { HORIZONS_BY_ID, PAST_HOURS } from '../config/horizons'
import type { Spot } from '../config/spots'
import { localDayKey } from '../data/summary'
import { buildTimeline, dayWindow, sliceTimeline, type Timeline } from '../data/timeline'
import type { CachedModel, ModelSeries } from '../data/types'
import { useLandscape } from '../hooks/useLandscape'
import { dayOfMonth, weekday } from '../lib/format'
import { useResolvedTheme } from '../lib/theme'
import { usePrefs, visibleModelsFor } from '../state/prefs'
import { useScrub } from '../state/scrub'
import { buildChartData } from './charts/buildData'
import { ChartCard } from './charts/ChartCard'
import { PrecipCloudCard } from './charts/PrecipCloudCard'
import { CHARTS, orderedCards, type ChartCtx } from './charts/chartDefs'
import { ChartsSheet } from './ChartsSheet'
import { LandscapeView } from './LandscapeView'
import { DailySummary } from './DailySummary'
import { DayOutlook } from './DayOutlook'
import { ModelChips } from './ModelChips'
import { NowHero } from './NowHero'
import { ScrubBar, type ZoomControls } from './ScrubBar'

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

interface Day {
  key: string
  from: number
  to: number
}

/** Local days in the window with at least 6 hours, for zooming. */
function daysOf(tl: Timeline): Day[] {
  const starts = [tl.from, ...tl.midnights.filter((t) => t > tl.from)]
  return starts
    .map((t) => {
      const [from, to] = dayWindow(tl, t)
      return { key: localDayKey(t, tl.tz), from, to }
    })
    .filter((d) => d.to - d.from >= 6 * 3600)
}

/** Noon (or the first hour) of a day, so the scrubber lands on it. */
function noonOf(tl: Timeline, d: Day): number {
  const i = tl.times.findIndex((t, k) => t >= d.from && t <= d.to && tl.hours[k] === 13)
  return i >= 0 ? tl.times[i] : d.from
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

  const chartMode = usePrefs((s) => s.chartMode)
  const chartOrder = usePrefs((s) => s.chartOrder)
  const chartHidden = usePrefs((s) => s.chartHidden)
  const { landscape, height: viewH } = useLandscape()
  const [sheet, setSheet] = useState(false)

  const tl = useMemo(
    () => buildTimeline(tz, spot.lat, spot.lon, horizon.hours, PAST_HOURS, hour * 3_600_000 + 1),
    [tz, spot.lat, spot.lon, horizon.hours, hour],
  )

  // Day zoom: remembered per horizon tab, dropped if the day leaves the window.
  const [zoom, setZoom] = useState<{ h: string; key: string } | null>(null)
  const days = useMemo(() => daysOf(tl), [tl])
  const zi = zoom && zoom.h === horizonId ? days.findIndex((d) => d.key === zoom.key) : -1
  const zoomDay = zi >= 0 ? days[zi] : null
  const ztl = useMemo(() => (zoomDay ? sliceTimeline(tl, zoomDay.from, zoomDay.to) : tl), [tl, zoomDay])
  const goDay = (d: Day | undefined) => {
    if (!d) return setZoom(null)
    setZoom({ h: horizonId, key: d.key })
    useScrub.getState().set(noonOf(tl, d))
  }
  const zoomControls: ZoomControls | null = zoomDay
    ? {
        label: `${weekday(zoomDay.from + 3600, tl.tz)} ${dayOfMonth(zoomDay.from + 3600, tl.tz)}`,
        prev: zi > 0 ? () => goDay(days[zi - 1]) : undefined,
        next: zi < days.length - 1 ? () => goDay(days[zi + 1]) : undefined,
        clear: () => setZoom(null),
      }
    : null

  const aggHours = horizon.hours > 96 && !zoomDay ? 6 : 1
  const ctx: ChartCtx = useMemo(
    () => ({ precipMode, elevation, aggHours, mode: chartMode }),
    [precipMode, elevation, aggHours, chartMode],
  )
  const charts = useMemo(
    () => CHARTS.map((def) => ({ def, cd: buildChartData(def, ctx, ztl, models) })),
    [ctx, ztl, models],
  )
  const cards = useMemo(() => orderedCards(chartOrder).filter((id) => !chartHidden[id]), [chartOrder, chartHidden])

  const hasData = models.length > 0
  if (landscape && hasData)
    return (
      <LandscapeView
        spotName={spot.name}
        tl={ztl}
        ctx={ctx}
        theme={theme}
        models={models}
        charts={charts}
        cards={cards}
        height={viewH}
        zoom={zoomControls}
        onZoom={() => {
          const t = useScrub.getState().t ?? tl.now
          goDay(days.find((d) => t >= d.from && t < d.to) ?? days[0])
        }}
      />
    )
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
          <DailySummary
            models={models}
            tl={tl}
            zoomKey={zoomDay?.key ?? null}
            onPick={(key) => (zoomDay?.key === key ? setZoom(null) : setZoom({ h: horizonId, key }))}
          />
          <ScrubBar
            tl={tl}
            precipMode={precipMode}
            aggHours={aggHours}
            onPrecipMode={setPrecipMode}
            zoom={zoomControls}
          />
          <div className="flex flex-col gap-2.5">
            {cards.map((id) => {
              if (id === 'precipcloud')
                return <PrecipCloudCard key={id} models={models} tl={ztl} theme={theme} aggHours={aggHours} />
              const c = charts.find((x) => x.def.id === id)
              return c && <ChartCard key={id} def={c.def} ctx={ctx} tl={ztl} cd={c.cd} theme={theme} showX />
            })}
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="mt-1 self-center rounded-full px-4 py-1.5 text-[13px] font-medium text-ink-2 shadow-[0_0_0_1px_var(--hair)] active:scale-[0.97]"
            >
              Customize charts
            </button>
          </div>
          <ChartsSheet open={sheet} onClose={() => setSheet(false)} />
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

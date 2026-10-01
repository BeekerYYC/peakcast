import { memo, useEffect, useMemo, useRef } from 'react'
import uPlot from 'uplot'
import { getModel } from '../../config/models'
import { consensus, runningTotal } from '../../data/consensus'
import { indexOf, type Timeline } from '../../data/timeline'
import type { ModelSeries, Series } from '../../data/types'
import { num } from '../../lib/format'
import { alpha, CHROME, type Resolved } from '../../lib/theme'
import { useScrub } from '../../state/scrub'
import { bucketSum } from './buildData'
import { bindScrub, cursorOpts, drawBackdrop, drawNow, xAxis, Y_AXIS, yAxis } from './uplotShared'

const RAIN = { light: '#2a78d6', dark: '#3987e5' }
const SNOW = { light: '#8f8d86', dark: '#d6d4cc' }

interface Data {
  /** Hourly (or bucketed) total precip, mm. */
  bars: Series
  rainTotal: Series
  snowTotal: Series
  cloud: Series
  rainSum: number | null
  snowSum: number | null
}

function build(models: ModelSeries[], tl: Timeline, aggHours: number): Data {
  // Accumulate from "now" so totals read as "from now until then".
  const i0 = indexOf(tl, tl.now)
  const fromNow = (s: Series) => s.map((v, i) => (i <= i0 ? (i === i0 ? 0 : null) : v))
  const precip = consensus(models, 'precipitation', tl.times)
  const liquid = consensus(models, 'liquid', tl.times)
  const snow = consensus(models, 'snowfall', tl.times)
  const rainTotal = runningTotal(fromNow(liquid))
  const snowTotal = runningTotal(fromNow(snow))
  const last = (s: Series) => [...s].reverse().find((v) => v != null) ?? null
  return {
    bars: aggHours > 1 ? bucketSum(precip, tl, aggHours) : precip,
    rainTotal,
    snowTotal,
    cloud: consensus(models, 'cloud_cover', tl.times),
    rainSum: last(rainTotal),
    snowSum: last(snowTotal),
  }
}

function Readout({ tl, d, aggHours }: { tl: Timeline; d: Data; aggHours: number }) {
  const t = useScrub((s) => s.t)
  const i = indexOf(tl, t ?? tl.now)
  const scrubbing = t != null && t !== tl.now
  return (
    <div className="tnum mt-0.5 flex flex-wrap gap-x-3 text-[12px] leading-5 whitespace-nowrap text-ink">
      {scrubbing ? (
        <>
          <span>
            <span className="text-muted">{aggHours > 1 ? `${aggHours} h` : '1 h'} </span>
            {num(d.bars[i], 1)} mm
          </span>
          <span>
            <span className="inline-block size-2 rounded-full align-middle" style={{ background: 'var(--rain)' }} />{' '}
            <span className="text-muted">rain </span>
            {num(d.rainTotal[i], 1)} mm
          </span>
          <span>
            <span className="inline-block size-2 rounded-full align-middle" style={{ background: 'var(--snow)' }} />{' '}
            <span className="text-muted">snow </span>
            {num(d.snowTotal[i], 1)} cm
          </span>
          <span>
            <span className="text-muted">cloud </span>
            {num(d.cloud[i])}%
          </span>
        </>
      ) : (
        <>
          <span>
            <span className="text-muted">Total </span>
            {num(d.rainSum, 1)} mm rain
          </span>
          <span>{num(d.snowSum, 1)} cm snow</span>
        </>
      )}
    </div>
  )
}

function Plot({
  tl,
  theme,
  height,
  showX,
  data,
  series,
  range,
  yFmt,
}: {
  tl: Timeline
  theme: Resolved
  height: number
  showX: boolean
  data: Series[]
  series: uPlot.Series[]
  range: [number, number]
  yFmt?: (v: number) => string
}) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const C = CHROME[theme]
    const u = new uPlot(
      {
        width: el.clientWidth,
        height: height + (showX ? 18 : 0),
        padding: [4, 6, showX ? 0 : 2, 0],
        legend: { show: false },
        select: { show: false, left: 0, top: 0, width: 0, height: 0 },
        cursor: cursorOpts(C),
        scales: { x: { time: false, range: [tl.from, tl.to] }, y: { range } },
        axes: [xAxis(tl, C, showX, el.clientWidth - Y_AXIS), yAxis(C, yFmt)],
        series: [{}, ...series],
        hooks: { drawClear: [(p) => drawBackdrop(p, tl, C)], draw: [(p) => drawNow(p, tl, C)] },
      },
      [tl.times, ...data] as uPlot.AlignedData,
      el,
    )
    const unbind = bindScrub(u, tl, el)
    return () => {
      unbind()
      u.destroy()
    }
  }, [tl, theme, height, showX, data, series, range, yFmt])
  return <div ref={host} className="w-full select-none" />
}

const pctFmt = (v: number) => `${v}`

/**
 * Precipitation and clouds in one card: hourly precip bars with running rain
 * (mm) and snow (cm) totals on top, cloud cover as an area underneath. Values
 * are the mean of the models shown on this tab.
 */
export const PrecipCloudCard = memo(function PrecipCloudCard({
  models,
  tl,
  theme,
  aggHours,
}: {
  models: ModelSeries[]
  tl: Timeline
  theme: Resolved
  aggHours: number
}) {
  const d = useMemo(() => build(models, tl, aggHours), [models, tl, aggHours])
  const C = CHROME[theme]
  const rain = RAIN[theme]
  const snow = SNOW[theme]

  const top = useMemo(() => {
    const max = Math.max(
      2,
      ...[d.rainTotal, d.snowTotal, d.bars].flatMap((s) => s.filter((v): v is number => v != null)),
    )
    const series: uPlot.Series[] = [
      {
        stroke: alpha(C.ink2, 0.7),
        fill: alpha(C.ink2, 0.45),
        width: 0,
        paths:
          aggHours > 1
            ? uPlot.paths.stepped!({ align: -1 })
            : uPlot.paths.bars!({ size: [0.7, 10], align: -1 }),
        points: { show: false },
      },
      { stroke: rain, width: 2, fill: alpha(rain, 0.08), points: { show: false } },
      { stroke: snow, width: 2, points: { show: false } },
    ]
    return {
      data: [d.bars, d.rainTotal, d.snowTotal],
      series,
      range: [0, Math.ceil(max * 1.15)] as [number, number],
    }
  }, [d, C, rain, snow, aggHours])

  const bottom = useMemo(() => {
    const series: uPlot.Series[] = [
      { stroke: C.ink2, width: 1.5, fill: alpha(C.muted, theme === 'dark' ? 0.35 : 0.28), points: { show: false } },
    ]
    return { data: [d.cloud], series, range: [0, 100] as [number, number] }
  }, [d, C, theme])

  const ids = models.filter((m) => m.covered).map((m) => getModel(m.modelId).short)
  if (!ids.length) return null
  return (
    <section
      className="rounded-2xl bg-surface shadow-[0_0_0_1px_var(--hair)]"
      style={{ ['--rain' as string]: rain, ['--snow' as string]: snow }}
    >
      <header className="px-3.5 pt-2.5 pb-0.5">
        <h3 className="text-[13px] leading-5 font-semibold text-ink">Precipitation &amp; clouds</h3>
        <p className="truncate text-[11px] leading-4 text-muted">
          mean of {ids.join(', ')} · rain mm, snow cm
        </p>
        <Readout tl={tl} d={d} aggHours={aggHours} />
      </header>
      <div className="pr-1">
        <Plot tl={tl} theme={theme} height={110} showX={false} data={top.data} series={top.series} range={top.range} />
      </div>
      <div className="flex items-center gap-1 px-3.5 pt-1 text-[11px] text-muted">Cloud cover %</div>
      <div className="pr-1 pb-1">
        <Plot
          tl={tl}
          theme={theme}
          height={64}
          showX
          data={bottom.data}
          series={bottom.series}
          range={bottom.range}
          yFmt={pctFmt}
        />
      </div>
    </section>
  )
})

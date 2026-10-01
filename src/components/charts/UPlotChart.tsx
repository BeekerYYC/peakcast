import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { getModel } from '../../config/models'
import type { Timeline } from '../../data/timeline'
import { dayOfMonth, shortHour, weekday } from '../../lib/format'
import { alpha, CHROME, type Resolved } from '../../lib/theme'
import { useScrub } from '../../state/scrub'
import type { ChartData } from './buildData'
import type { ChartCtx, ChartDef } from './chartDefs'

const FONT = '10px -apple-system, system-ui, "Segoe UI", sans-serif'
const FONT_BOLD = '600 10px -apple-system, system-ui, "Segoe UI", sans-serif'
const Y_AXIS = 34

interface Props {
  def: ChartDef
  ctx: ChartCtx
  tl: Timeline
  cd: ChartData
  theme: Resolved
  /** Show x-axis labels (hour/day) under this chart. */
  showX: boolean
}

/** Smallest tick step (h) that leaves ~32 px per label. */
function tickStep(hours: number, plotPx: number): number {
  const fit = Math.max(2, Math.floor(plotPx / 32))
  for (const st of [3, 6, 12, 24, 48, 72, 96]) if (hours / st <= fit) return st
  return 96
}

export function UPlotChart({ def, ctx, tl, cd, theme, showX }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const plot = useRef<uPlot | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const C = CHROME[theme]
    const step = tickStep((tl.to - tl.from) / 3600, el.clientWidth - Y_AXIS)
    const longRange = (tl.to - tl.from) / 3600 > 250
    const [yMin, yMax] = def.range(cd.min, cd.max, ctx)
    const refs = def.refLines?.(ctx) ?? []

    const series: uPlot.Series[] = [{}]
    for (const s of cd.meta) {
      const color = getModel(s.modelId).color[theme]
      if (s.kind !== 'line') {
        series.push({ stroke: 'transparent', width: 0, points: { show: false } })
        continue
      }
      series.push({
        stroke: color,
        width: s.line.width ?? 2,
        dash: s.line.dash,
        fill: s.line.fill ? alpha(color, 0.1) : undefined,
        paths: s.line.step ? uPlot.paths.stepped!({ align: -1 }) : undefined,
        points: { show: false },
        spanGaps: false,
      })
    }

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: def.height + (showX ? 18 : 0),
      pxAlign: true,
      padding: [def.windArrows ? 8 + Object.keys(cd.dirs).length * 11 : 6, 6, showX ? 0 : 4, 0],
      legend: { show: false },
      select: { show: false, left: 0, top: 0, width: 0, height: 0 },
      cursor: {
        x: true,
        y: false,
        drag: { x: false, y: false, setScale: false },
        dataIdx: (_u, _s, closest) => closest,
        points: {
          size: 8,
          width: 2,
          stroke: () => C.surface,
          fill: (u, si) => {
            const st = u.series[si].stroke
            return typeof st === 'function' ? (st(u, si) as string) : (st as string)
          },
        },
        bind: {
          mousedown: () => null,
          mouseup: () => null,
          click: () => null,
          dblclick: () => null,
          mousemove: () => null,
          mouseleave: () => null,
          mouseenter: () => null,
        },
      },
      scales: {
        x: { time: false, range: [tl.from, tl.to] },
        y: { range: [yMin, yMax] },
      },
      bands: cd.bands.map(([hi, lo, id]) => ({
        series: [hi, lo] as [number, number],
        fill: alpha(getModel(id).color[theme], 0.16),
      })),
      axes: [
        {
          show: showX,
          stroke: C.muted,
          font: FONT,
          size: 18,
          gap: 2,
          grid: { show: false },
          ticks: { show: false },
          splits: () => {
            if (step <= 24) return tl.times.filter((_, i) => tl.hours[i] % step === 0)
            return tl.midnights.filter((_, i) => i % (step / 24) === 0)
          },
          values: (_u, splits) =>
            splits.map((t) => {
              const h = tl.hours[Math.round((t - tl.from) / 3600)]
              if (h === 0) return step >= 24 ? `${weekday(t, tl.tz)} ${dayOfMonth(t, tl.tz)}` : weekday(t, tl.tz)
              return shortHour(h)
            }),
        },
        {
          stroke: C.muted,
          font: FONT,
          size: Y_AXIS,
          gap: 3,
          space: 22,
          ticks: { show: false },
          grid: { stroke: C.grid, width: 1 },
          values: (_u, splits) => splits.map((v) => (Math.abs(v) >= 10000 ? `${v / 1000}k` : String(v))),
        },
      ],
      series,
      hooks: {
        drawClear: [
          (u) => {
            const c = u.ctx
            const { top, height } = u.bbox
            const X = (t: number) => u.valToPos(t, 'x', true)
            c.save()
            // Night shading.
            if (!longRange) {
              c.fillStyle = C.night
              for (const [a, b] of tl.nights) c.fillRect(X(a), top, X(b) - X(a), height)
            }
            // Below-ground band on the freezing-level chart.
            for (const r of refs) {
              if (r.kind !== 'ground') continue
              const y = u.valToPos(r.value, 'y', true)
              c.fillStyle = alpha(C.muted, theme === 'dark' ? 0.14 : 0.1)
              c.fillRect(u.bbox.left, y, u.bbox.width, top + height - y)
            }
            // Day separators.
            c.strokeStyle = C.axis
            c.lineWidth = 1
            for (const t of tl.midnights) {
              const x = Math.round(X(t)) + 0.5
              c.beginPath()
              c.moveTo(x, top)
              c.lineTo(x, top + height)
              c.stroke()
            }
            c.restore()
          },
        ],
        draw: [
          (u) => {
            const c = u.ctx
            const { left, top, width, height } = u.bbox
            const pr = uPlot.pxRatio
            c.save()
            // Reference lines (0 °C, spot elevation).
            for (const r of refs) {
              const y = Math.round(u.valToPos(r.value, 'y', true)) + 0.5
              if (y < top || y > top + height) continue
              c.strokeStyle = r.kind === 'zero' ? alpha(C.zero, 0.55) : C.ink2
              c.lineWidth = pr
              c.setLineDash(r.kind === 'ground' ? [4 * pr, 3 * pr] : [])
              c.beginPath()
              c.moveTo(left, y)
              c.lineTo(left + width, y)
              c.stroke()
              if (r.label) {
                c.setLineDash([])
                c.font = FONT_BOLD.replace('10px', `${10 * pr}px`)
                c.fillStyle = C.ink2
                c.textAlign = 'right'
                c.fillText(r.label, left + width - 4 * pr, y - 4 * pr)
              }
            }
            // "Now" marker.
            const nx = Math.round(u.valToPos(tl.now, 'x', true)) + 0.5
            c.setLineDash([])
            c.strokeStyle = C.ink2
            c.globalAlpha = 0.6
            c.lineWidth = pr
            c.beginPath()
            c.moveTo(nx, top)
            c.lineTo(nx, top + height)
            c.stroke()
            c.globalAlpha = 1
            // Wind direction arrows: one row per model along the top.
            if (def.windArrows) {
              const ids = Object.keys(cd.dirs)
              const every = Math.max(1, Math.ceil(tl.times.length / (width / pr / 20)))
              ids.forEach((id, row) => {
                const dir = cd.dirs[id]
                c.fillStyle = getModel(id).color[theme]
                const y = top - (Object.keys(cd.dirs).length - row - 0.5) * 11 * pr + pr
                for (let i = 0; i < tl.times.length; i += every) {
                  const d = dir[i]
                  if (d == null) continue
                  const x = u.valToPos(tl.times[i], 'x', true)
                  drawArrow(c, x, y, d, 4 * pr)
                }
              })
            }
            c.restore()
          },
        ],
      },
    }

    const u = new uPlot(opts, cd.data as uPlot.AlignedData, el)
    plot.current = u
    u.over.style.touchAction = 'pan-y'

    const toT = (clientX: number) => {
      const r = u.over.getBoundingClientRect()
      const t = u.posToVal(clientX - r.left, 'x')
      return Math.max(tl.from, Math.min(tl.to, Math.round(t / 3600) * 3600))
    }
    const down = (e: PointerEvent) => {
      useScrub.getState().set(toT(e.clientX), true)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.buttons || useScrub.getState().active) {
        useScrub.getState().set(toT(e.clientX), e.pointerType !== 'mouse' || e.buttons > 0)
      }
    }
    const up = () => {
      const s = useScrub.getState()
      if (s.active) s.set(s.t, false)
    }
    u.over.addEventListener('pointerdown', down)
    u.over.addEventListener('pointermove', move)
    u.over.addEventListener('pointerup', up)
    u.over.addEventListener('pointercancel', up)

    const position = (t: number | null) => {
      if (t == null) u.setCursor({ left: -10, top: -10 }, false)
      else u.setCursor({ left: u.valToPos(t, 'x'), top: 4 }, false)
    }
    position(useScrub.getState().t)
    const unsub = useScrub.subscribe((s) => position(s.t))

    const ro = new ResizeObserver(() => {
      if (el.clientWidth && el.clientWidth !== u.width) {
        u.setSize({ width: el.clientWidth, height: u.height })
        position(useScrub.getState().t)
      }
    })
    ro.observe(el)

    return () => {
      unsub()
      ro.disconnect()
      u.destroy()
      plot.current = null
    }
  }, [def, ctx, tl, cd, theme, showX])

  return <div ref={host} className="w-full select-none" />
}

function drawArrow(c: CanvasRenderingContext2D, x: number, y: number, fromDeg: number, r: number) {
  // Meteorological direction is where wind comes FROM; arrow points downwind.
  const a = ((fromDeg + 180) * Math.PI) / 180
  c.save()
  c.translate(x, y)
  c.rotate(a)
  c.beginPath()
  c.moveTo(0, -r)
  c.lineTo(r * 0.7, r)
  c.lineTo(0, r * 0.45)
  c.lineTo(-r * 0.7, r)
  c.closePath()
  c.fill()
  c.restore()
}

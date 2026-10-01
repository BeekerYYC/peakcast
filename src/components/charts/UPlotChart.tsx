import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { getModel } from '../../config/models'
import type { Timeline } from '../../data/timeline'
import { alpha, CHROME, type Resolved } from '../../lib/theme'
import type { ChartData } from './buildData'
import type { ChartCtx, ChartDef } from './chartDefs'
import { bindScrub, cursorOpts, drawBackdrop, drawNow, FONT_BOLD, xAxis, Y_AXIS, yAxis } from './uplotShared'

interface Props {
  def: ChartDef
  ctx: ChartCtx
  tl: Timeline
  cd: ChartData
  theme: Resolved
  /** Show x-axis labels (hour/day) under this chart. */
  showX: boolean
}

export function UPlotChart({ def, ctx, tl, cd, theme, showX }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const plot = useRef<uPlot | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const C = CHROME[theme]
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
      cursor: cursorOpts(C),
      scales: {
        x: { time: false, range: [tl.from, tl.to] },
        y: { range: [yMin, yMax] },
      },
      bands: cd.bands.map(([hi, lo, id]) => ({
        series: [hi, lo] as [number, number],
        fill: alpha(getModel(id).color[theme], 0.16),
      })),
      axes: [xAxis(tl, C, showX, el.clientWidth - Y_AXIS), yAxis(C)],
      series,
      hooks: {
        drawClear: [
          (u) => {
            drawBackdrop(u, tl, C)
            // Below-ground band on the freezing-level chart.
            for (const r of refs) {
              if (r.kind !== 'ground') continue
              const y = u.valToPos(r.value, 'y', true)
              u.ctx.fillStyle = alpha(C.muted, theme === 'dark' ? 0.14 : 0.1)
              u.ctx.fillRect(u.bbox.left, y, u.bbox.width, u.bbox.top + u.bbox.height - y)
            }
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
            c.setLineDash([])
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
            drawNow(u, tl, C)
          },
        ],
      },
    }

    const u = new uPlot(opts, cd.data as uPlot.AlignedData, el)
    plot.current = u
    const unbind = bindScrub(u, tl, el)

    return () => {
      unbind()
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

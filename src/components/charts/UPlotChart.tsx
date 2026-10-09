import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { getModel } from '../../config/models'
import type { Timeline } from '../../data/timeline'
import { alpha, CHROME, RAIN, SNOW, type Chrome, type Resolved } from '../../lib/theme'
import type { ChartData } from './buildData'
import type { ChartCtx, ChartDef } from './chartDefs'
import { bindScrub, cursorOpts, drawBackdrop, drawNow, FONT, FONT_BOLD, xAxis, Y_AXIS, yAxis } from './uplotShared'

interface Props {
  def: ChartDef
  ctx: ChartCtx
  tl: Timeline
  cd: ChartData
  theme: Resolved
  /** Show x-axis labels (hour/day) under this chart. */
  showX: boolean
  /** Plot height override (landscape view). */
  height?: number
}

const STRIP = 12
/** Minimum px per day before daily high/low labels are drawn. */
const LABEL_DAY_PX = 26

const font = (f: string, pr: number) => f.replace('10px', `${10 * pr}px`)

export function UPlotChart({ def, ctx, tl, cd, theme, showX, height }: Props) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const C = CHROME[theme]
    let [yMin, yMax] = def.range(cd.min, cd.max, ctx)
    if (cd.peaks.some((p) => p.lo)) yMin = Math.floor(yMin - (yMax - yMin) * 0.08)
    const refs = def.refLines?.(ctx) ?? []
    const arrowRows = def.windArrows ? Object.keys(cd.dirs).length : 0
    const padTop = 6 + arrowRows * 11 + (arrowRows ? 2 : 0) + (cd.wet ? STRIP + 4 : 0) + (cd.peaks.length ? 10 : 0)

    const series: uPlot.Series[] = [{}]
    for (const s of cd.meta) {
      const stepped = s.line.step ? uPlot.paths.stepped!({ align: -1 }) : undefined
      if (s.kind === 'mean') {
        series.push({ stroke: C.ink, width: 2.25, paths: stepped, points: { show: false }, spanGaps: false })
        continue
      }
      if (s.kind === 'feels') {
        series.push({
          stroke: alpha(C.ink2, 0.9),
          width: 1.5,
          dash: [4, 3],
          points: { show: false },
          spanGaps: false,
        })
        continue
      }
      if (s.kind !== 'line') {
        series.push({ stroke: 'transparent', width: 0, points: { show: false } })
        continue
      }
      const color = getModel(s.modelId).color[theme]
      series.push({
        stroke: cd.spread ? alpha(color, 0.45) : color,
        width: cd.spread ? 1 : (s.line.width ?? 2),
        dash: s.line.dash,
        fill: s.line.fill && !cd.spread ? alpha(color, 0.1) : undefined,
        paths: stepped,
        points: { show: false },
        spanGaps: false,
      })
    }

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: (height ?? def.height) + (showX ? 18 : 0),
      pxAlign: true,
      padding: [padTop, 6, showX ? 0 : 4, 0],
      legend: { show: false },
      select: { show: false, left: 0, top: 0, width: 0, height: 0 },
      cursor: cursorOpts(C),
      scales: {
        x: { time: false, range: [tl.from, tl.to] },
        y: { range: [yMin, yMax] },
      },
      bands: cd.bands.map(([hi, lo, id]) => ({
        series: [hi, lo] as [number, number],
        fill: id
          ? alpha(getModel(id).color[theme], cd.spread ? 0.07 : 0.16)
          : alpha(C.ink2, theme === 'dark' ? 0.2 : 0.14),
      })),
      axes: [xAxis(tl, C, showX, el.clientWidth - Y_AXIS), yAxis(C)],
      series,
      hooks: {
        drawClear: [
          (u) => {
            drawBackdrop(u, tl, C)
            const { left, top, width, height: h } = u.bbox
            // Below-ground band on the freezing-level chart.
            for (const r of refs) {
              if (r.kind !== 'ground') continue
              const y = u.valToPos(r.value, 'y', true)
              u.ctx.fillStyle = alpha(C.muted, theme === 'dark' ? 0.14 : 0.1)
              u.ctx.fillRect(left, y, width, top + h - y)
            }
            for (const z of def.zones ?? []) {
              const y = u.valToPos(z.from, 'y', true)
              if (y <= top) continue
              u.ctx.fillStyle = alpha(C.warn, theme === 'dark' ? 0.09 : 0.07)
              u.ctx.fillRect(left, top, width, Math.min(y, top + h) - top)
            }
          },
        ],
        draw: [
          (u) => {
            const c = u.ctx
            const { left, top, width, height: h } = u.bbox
            const pr = uPlot.pxRatio
            c.save()
            // Reference lines (0 °C, spot elevation).
            for (const r of refs) {
              const y = Math.round(u.valToPos(r.value, 'y', true)) + 0.5
              if (y < top || y > top + h) continue
              c.strokeStyle = r.kind === 'zero' ? alpha(C.zero, 0.55) : C.ink2
              c.lineWidth = pr
              c.setLineDash(r.kind === 'ground' ? [4 * pr, 3 * pr] : [])
              c.beginPath()
              c.moveTo(left, y)
              c.lineTo(left + width, y)
              c.stroke()
              if (r.label) {
                c.setLineDash([])
                c.font = font(FONT_BOLD, pr)
                c.fillStyle = C.ink2
                c.textAlign = 'right'
                c.fillText(r.label, left + width - 4 * pr, y - 4 * pr)
              }
            }
            c.setLineDash([])
            for (const z of def.zones ?? []) {
              const y = Math.round(u.valToPos(z.from, 'y', true)) + 0.5
              if (y <= top + 8 * pr || y > top + h) continue
              c.strokeStyle = alpha(C.warn, 0.45)
              c.lineWidth = pr
              c.setLineDash([2 * pr, 3 * pr])
              c.beginPath()
              c.moveTo(left, y)
              c.lineTo(left + width, y)
              c.stroke()
              c.setLineDash([])
              c.font = font(FONT, pr)
              c.fillStyle = alpha(C.warn, 0.95)
              c.textAlign = 'right'
              c.textBaseline = 'bottom'
              c.fillText(z.label, left + width - 4 * pr, y - 2 * pr)
            }
            // Wind direction arrows: one row per model along the top.
            if (def.windArrows) {
              const ids = Object.keys(cd.dirs)
              const every = Math.max(1, Math.ceil(tl.times.length / (width / pr / 20)))
              ids.forEach((id, row) => {
                const dir = cd.dirs[id]
                c.fillStyle = getModel(id).color[theme]
                const y = (6 + (row + 0.5) * 11) * pr
                for (let i = 0; i < tl.times.length; i += every) {
                  const d = dir[i]
                  if (d == null) continue
                  const x = u.valToPos(tl.times[i], 'x', true)
                  drawArrow(c, x, y, d, 4 * pr)
                }
              })
            }
            if (cd.wet) drawWetStrip(u, cd.wet.cells, tl, C, theme)
            drawPeaks(u, cd, tl, C)
            c.restore()
            drawNow(u, tl, C)
          },
        ],
      },
    }

    const u = new uPlot(opts, cd.data as uPlot.AlignedData, el)
    const unbind = bindScrub(u, tl, el)

    return () => {
      unbind()
      u.destroy()
    }
  }, [def, ctx, tl, cd, theme, showX, height])

  return <div ref={host} className="w-full select-none" />
}

/** Ensemble chance of precipitation: one cell per 6 h, opacity = chance. */
function drawWetStrip(u: uPlot, cells: { from: number; to: number; wet: number; snow: number }[], tl: Timeline, C: Chrome, theme: Resolved) {
  const c = u.ctx
  const pr = uPlot.pxRatio
  const { left, width } = u.bbox
  const y = 5 * pr
  const hgt = STRIP * pr
  c.save()
  c.font = font(FONT, pr)
  c.textBaseline = 'middle'
  c.textAlign = 'right'
  c.fillStyle = C.muted
  c.fillText('wet', left - 3 * pr, y + hgt / 2)
  c.fillStyle = alpha(C.muted, 0.12)
  c.fillRect(left, y, width, hgt)
  for (const cell of cells) {
    const a = Math.max(tl.from, cell.from)
    const b = Math.min(tl.to, cell.to)
    if (b <= a) continue
    const x0 = u.valToPos(a, 'x', true)
    const x1 = u.valToPos(b, 'x', true)
    const snowy = cell.snow >= cell.wet / 2 && cell.snow > 0
    const col = snowy ? SNOW[theme] : RAIN[theme]
    if (cell.wet > 0) {
      c.fillStyle = alpha(col, 0.12 + 0.78 * (cell.wet / 100))
      c.fillRect(x0 + 0.5 * pr, y, x1 - x0 - pr, hgt)
    }
    if (x1 - x0 >= 22 * pr && cell.wet >= 10) {
      c.textAlign = 'center'
      c.fillStyle = cell.wet >= 55 ? (snowy && theme === 'dark' ? '#111' : '#fff') : C.ink2
      c.fillText(`${cell.wet}%`, (x0 + x1) / 2, y + hgt / 2 + 0.5 * pr)
    }
  }
  c.restore()
}

/** Daily high/low labels with a small dot at the peak hour. */
function drawPeaks(u: uPlot, cd: ChartData, tl: Timeline, C: Chrome) {
  if (!cd.peaks.length) return
  const pr = uPlot.pxRatio
  const dayPx = (u.valToPos(tl.from + 86400, 'x', true) - u.valToPos(tl.from, 'x', true)) / pr
  if (dayPx < LABEL_DAY_PX) return
  const c = u.ctx
  const { left, top, width, height } = u.bbox
  c.save()
  c.font = font(FONT_BOLD, pr)
  c.lineJoin = 'round'
  // Highs first; a label that would overlap one already drawn is skipped.
  const placed: [number, number, number, number][] = []
  const lh = 11 * pr
  for (const p of [...cd.peaks].sort((a, b) => Number(a.lo) - Number(b.lo))) {
    const x = u.valToPos(p.t, 'x', true)
    const y = u.valToPos(p.v, 'y', true)
    if (y < top - 2 * pr || y > top + height + 2 * pr) continue
    const w = c.measureText(p.text).width
    const tx = Math.max(left + w / 2 + pr, Math.min(left + width - w / 2 - pr, x))
    const ty = p.lo ? y + 4 * pr : y - 4 * pr
    const box: [number, number, number, number] = [tx - w / 2 - 2 * pr, p.lo ? ty : ty - lh, w + 4 * pr, lh]
    const hit = placed.some(
      ([bx, by, bw, bh]) => box[0] < bx + bw && bx < box[0] + box[2] && box[1] < by + bh && by < box[1] + box[3],
    )
    if (hit) continue
    placed.push(box)
    c.fillStyle = p.lo ? C.ink2 : C.ink
    c.beginPath()
    c.arc(x, y, 2 * pr, 0, Math.PI * 2)
    c.fill()
    c.textAlign = 'center'
    c.textBaseline = p.lo ? 'top' : 'bottom'
    c.strokeStyle = C.surface
    c.lineWidth = 3 * pr
    c.strokeText(p.text, tx, ty)
    c.fillText(p.text, tx, ty)
  }
  c.restore()
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

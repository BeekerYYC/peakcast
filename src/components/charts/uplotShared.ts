import uPlot from 'uplot'
import type { Timeline } from '../../data/timeline'
import { dayOfMonth, shortHour, weekday } from '../../lib/format'
import type { Chrome } from '../../lib/theme'
import { useScrub } from '../../state/scrub'

export const FONT = '10px -apple-system, system-ui, "Segoe UI", sans-serif'
export const FONT_BOLD = '600 10px -apple-system, system-ui, "Segoe UI", sans-serif'
export const Y_AXIS = 34

/** Smallest tick step (h) that leaves ~32 px per label. */
export function tickStep(hours: number, plotPx: number): number {
  const fit = Math.max(2, Math.floor(plotPx / 32))
  for (const st of [3, 6, 12, 24, 48, 72, 96]) if (hours / st <= fit) return st
  return 96
}

/** Shared x axis: hour ticks, weekday at local midnight. */
export function xAxis(tl: Timeline, C: Chrome, show: boolean, plotPx: number): uPlot.Axis {
  const step = tickStep((tl.to - tl.from) / 3600, plotPx)
  return {
    show,
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
  }
}

export function yAxis(C: Chrome, fmt?: (v: number) => string): uPlot.Axis {
  return {
    stroke: C.muted,
    font: FONT,
    size: Y_AXIS,
    gap: 3,
    space: 22,
    ticks: { show: false },
    grid: { stroke: C.grid, width: 1 },
    values: (_u, splits) =>
      splits.map((v) => (fmt ? fmt(v) : Math.abs(v) >= 10000 ? `${v / 1000}k` : String(v))),
  }
}

/** Cursor that we drive ourselves (native mouse handling disabled). */
export function cursorOpts(C: Chrome): uPlot.Cursor {
  return {
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
  }
}

/** Night shading (≤10 days) and day separators, drawn under the series. */
export function drawBackdrop(u: uPlot, tl: Timeline, C: Chrome): void {
  const c = u.ctx
  const { top, height } = u.bbox
  const X = (t: number) => u.valToPos(t, 'x', true)
  c.save()
  if ((tl.to - tl.from) / 3600 <= 250) {
    c.fillStyle = C.night
    for (const [a, b] of tl.nights) c.fillRect(X(a), top, X(b) - X(a), height)
  }
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
}

/** "Now" marker line. */
export function drawNow(u: uPlot, tl: Timeline, C: Chrome): void {
  const c = u.ctx
  const { top, height } = u.bbox
  const nx = Math.round(u.valToPos(tl.now, 'x', true)) + 0.5
  c.save()
  c.strokeStyle = C.ink2
  c.globalAlpha = 0.6
  c.lineWidth = uPlot.pxRatio
  c.beginPath()
  c.moveTo(nx, top)
  c.lineTo(nx, top + height)
  c.stroke()
  c.restore()
}

/**
 * Wire a plot to the shared scrubber: pointer input sets the scrub time, and
 * scrub changes move this plot's cursor. Also keeps the width in sync.
 * Returns a cleanup function.
 */
export function bindScrub(u: uPlot, tl: Timeline, el: HTMLElement): () => void {
  u.over.style.touchAction = 'pan-y'
  const toT = (clientX: number) => {
    const r = u.over.getBoundingClientRect()
    const t = u.posToVal(clientX - r.left, 'x')
    return Math.max(tl.from, Math.min(tl.to, Math.round(t / 3600) * 3600))
  }
  const down = (e: PointerEvent) => useScrub.getState().set(toT(e.clientX), true)
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
  }
}

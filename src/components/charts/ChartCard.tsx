import { memo, type ReactNode } from 'react'
import { getModel } from '../../config/models'
import { indexOf, type Timeline } from '../../data/timeline'
import { compass, num } from '../../lib/format'
import type { Resolved } from '../../lib/theme'
import { usePrefs } from '../../state/prefs'
import { useScrub } from '../../state/scrub'
import { IconChevronDown } from '../Icons'
import type { ChartData } from './buildData'
import { unitFor, type ChartCtx, type ChartDef } from './chartDefs'
import { UPlotChart } from './UPlotChart'

interface Props {
  def: ChartDef
  ctx: ChartCtx
  tl: Timeline
  cd: ChartData
  theme: Resolved
  showX: boolean
  /** Landscape view: fixed plot height, no collapsing. */
  height?: number
}

function Readout({ def, tl, cd }: { def: ChartDef; tl: Timeline; cd: ChartData }) {
  const t = useScrub((s) => s.t)
  const i = indexOf(tl, t ?? tl.now)
  const ids = Object.keys(cd.values)
  const feels = cd.feels?.[i]
  const mean = cd.mean?.[i]
  const wet = cd.wet?.cells.find((c) => c.from < tl.times[i] && tl.times[i] <= c.to)
  return (
    <div className="flex flex-wrap justify-end gap-x-2.5 gap-y-0.5">
      {cd.spread && mean != null && (
        <span className="tnum text-[12px] leading-5 font-semibold text-ink">avg {num(mean, def.digits)}</span>
      )}
      {ids.map((id) => {
        const v = cd.values[id]
        const main = v.main?.[i]
        const sec = v.secondary?.[i]
        const dir = cd.dirs[id]?.[i]
        return (
          <span key={id} className="tnum inline-flex items-center gap-1 text-[12px] leading-5 text-ink">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: `var(--m-${id})` }}
              aria-label={getModel(id).short}
            />
            {num(main, def.digits)}
            {sec != null && <span className="text-ink-2">g{num(sec, 0)}</span>}
            {dir != null && def.windArrows && (
              <svg
                viewBox="0 0 10 10"
                className="size-2.5 text-muted"
                style={{ transform: `rotate(${dir + 180}deg)` }}
                aria-label={`from ${compass(dir)}`}
              >
                <path d="M5 0.5 8.5 9 5 7 1.5 9Z" fill="currentColor" />
              </svg>
            )}
          </span>
        )
      })}
      {feels != null && (
        <span className="tnum text-[12px] leading-5 text-ink-2">
          <span className="text-muted">feels </span>
          {num(feels)}°
        </span>
      )}
      {wet && (
        <span className="tnum text-[12px] leading-5 text-ink-2">
          <span className="text-muted">wet </span>
          {wet.wet}%{wet.snow > 0 && <span className="text-muted"> ❄{wet.snow}%</span>}
        </span>
      )}
    </div>
  )
}

/** Card title that collapses/expands the card (state remembered per device). */
export function CardHeader({
  id,
  title,
  fixed,
  children,
}: {
  id: string
  title: ReactNode
  fixed?: boolean
  children?: ReactNode
}) {
  const collapsed = usePrefs((s) => !fixed && !!s.chartCollapsed[id])
  const toggle = usePrefs((s) => s.toggleChartCollapsed)
  return (
    <header className={`flex items-start justify-between gap-3 px-3.5 pt-2.5 ${collapsed ? 'pb-2.5' : 'pb-0.5'}`}>
      {fixed ? (
        <h3 className="shrink-0 text-[13px] leading-5 font-semibold text-ink">{title}</h3>
      ) : (
        <button
          type="button"
          onClick={() => toggle(id)}
          aria-expanded={!collapsed}
          className="-my-1 -ml-1 flex shrink-0 items-center gap-1 rounded-lg py-1 pr-1 pl-1 text-left active:opacity-60"
        >
          <IconChevronDown
            size={14}
            className={`shrink-0 text-muted transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
          <h3 className="text-[13px] leading-5 font-semibold text-ink">{title}</h3>
        </button>
      )}
      {children}
    </header>
  )
}

export const ChartCard = memo(function ChartCard({ def, ctx, tl, cd, theme, showX, height }: Props) {
  const collapsed = usePrefs((s) => height == null && !!s.chartCollapsed[def.id])
  const empty = def.collapseWhenEmpty && cd.empty
  const noData = Object.keys(cd.values).length === 0
  return (
    <section className="rounded-2xl bg-surface shadow-[0_0_0_1px_var(--hair)]">
      <CardHeader
        id={def.id}
        fixed={height != null}
        title={
          <>
            {def.title} <span className="font-normal text-muted">{unitFor(def, ctx)}</span>
          </>
        }
      >
        {!empty && !noData && <Readout def={def} tl={tl} cd={cd} />}
      </CardHeader>
      {collapsed ? null : empty ? (
        <p className="px-3.5 pb-3 text-[12px] text-muted">{def.collapseWhenEmpty}</p>
      ) : noData ? (
        <p className="px-3.5 pb-3 text-[12px] text-muted">{def.noDataHint ?? 'Not available from the selected models'}</p>
      ) : (
        <div className="pr-1 pb-1">
          <UPlotChart def={def} ctx={ctx} tl={tl} cd={cd} theme={theme} showX={showX} height={height} />
        </div>
      )}
      {!collapsed && !empty && !noData && cd.missing.length > 0 && (
        <p className="px-3.5 pb-2 text-[11px] text-muted">
          Not provided by {cd.missing.map((id) => getModel(id).short).join(', ')}
        </p>
      )}
    </section>
  )
})

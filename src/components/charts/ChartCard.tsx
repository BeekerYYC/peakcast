import { memo } from 'react'
import { getModel } from '../../config/models'
import { indexOf, type Timeline } from '../../data/timeline'
import { compass, num } from '../../lib/format'
import type { Resolved } from '../../lib/theme'
import { useScrub } from '../../state/scrub'
import type { ChartData } from './buildData'
import type { ChartCtx, ChartDef } from './chartDefs'
import { UPlotChart } from './UPlotChart'

interface Props {
  def: ChartDef
  ctx: ChartCtx
  tl: Timeline
  cd: ChartData
  theme: Resolved
  showX: boolean
}

function Readout({ def, tl, cd }: { def: ChartDef; tl: Timeline; cd: ChartData }) {
  const t = useScrub((s) => s.t)
  const i = indexOf(tl, t ?? tl.now)
  const ids = Object.keys(cd.values)
  return (
    <div className="flex flex-wrap justify-end gap-x-2.5 gap-y-0.5">
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
    </div>
  )
}

export const ChartCard = memo(function ChartCard({ def, ctx, tl, cd, theme, showX }: Props) {
  const collapsed = def.collapseWhenEmpty && cd.empty
  const noData = Object.keys(cd.values).length === 0
  return (
    <section className="rounded-2xl bg-surface shadow-[0_0_0_1px_var(--hair)]">
      <header className="flex items-start justify-between gap-3 px-3.5 pt-2.5 pb-0.5">
        <h3 className="shrink-0 text-[13px] leading-5 font-semibold text-ink">
          {def.title} <span className="font-normal text-muted">{def.unit}</span>
        </h3>
        {!collapsed && !noData && <Readout def={def} tl={tl} cd={cd} />}
      </header>
      {collapsed ? (
        <p className="px-3.5 pb-3 text-[12px] text-muted">{def.collapseWhenEmpty}</p>
      ) : noData ? (
        <p className="px-3.5 pb-3 text-[12px] text-muted">Not available from the selected models</p>
      ) : (
        <div className="pr-1 pb-1">
          <UPlotChart def={def} ctx={ctx} tl={tl} cd={cd} theme={theme} showX={showX} />
        </div>
      )}
      {!collapsed && !noData && cd.missing.length > 0 && (
        <p className="px-3.5 pb-2 text-[11px] text-muted">
          Not provided by {cd.missing.map((id) => getModel(id).short).join(', ')}
        </p>
      )}
    </section>
  )
})

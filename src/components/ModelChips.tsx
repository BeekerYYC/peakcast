import { useState } from 'react'
import { defaultModelsFor, extraModelsFor } from '../config/horizons'
import { getModel, type HorizonId } from '../config/models'
import type { CachedModel } from '../data/types'
import { ago, runLabel } from '../lib/format'
import { isModelOn, usePrefs } from '../state/prefs'
import { IconPlus } from './Icons'

interface Props {
  horizon: HorizonId
  data: Record<string, CachedModel>
}

function Chip({ id, horizon, entry }: { id: string; horizon: HorizonId; entry?: CachedModel }) {
  const on = usePrefs((s) => isModelOn(s.modelVis, horizon, id))
  const toggle = usePrefs((s) => s.toggleModel)
  const m = getModel(id)
  const uncovered = entry && !entry.series.covered
  const run = entry?.runInit
  return (
    <button
      type="button"
      onClick={() => toggle(horizon, id)}
      disabled={!!uncovered}
      aria-pressed={on}
      className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-3 pl-2.5 text-left transition-all active:scale-[0.97] ${
        on && !uncovered
          ? 'bg-surface shadow-[0_0_0_1px_var(--hair),0_1px_2px_rgba(0,0,0,0.06)]'
          : 'bg-transparent shadow-[0_0_0_1px_var(--hair)]'
      } ${uncovered ? 'opacity-45' : ''}`}
      title={`${m.label} · ${m.resolution}`}
    >
      <span
        className="size-2.5 rounded-full transition-all"
        style={
          on && !uncovered
            ? { background: `var(--m-${id})` }
            : { boxShadow: `inset 0 0 0 1.5px var(--m-${id})` }
        }
      />
      <span className="flex flex-col leading-none">
        <span className={`text-[12.5px] font-semibold ${on ? 'text-ink' : 'text-ink-2'}`}>
          {m.short}
        </span>
        <span className="tnum mt-0.5 text-[10px] text-muted">
          {uncovered
            ? 'no coverage'
            : run
              ? `${runLabel(run)} · ${ago(run * 1000).replace(' ago', '')}`
              : m.resolution}
        </span>
      </span>
    </button>
  )
}

export function ModelChips({ horizon, data }: Props) {
  const defaults = defaultModelsFor(horizon)
  const extras = extraModelsFor(horizon)
  const anyExtraOn = usePrefs((s) => extras.some((id) => isModelOn(s.modelVis, horizon, id)))
  const [more, setMore] = useState(false)
  const showExtras = more || anyExtraOn
  return (
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5">
      {defaults.map((id) => (
        <Chip key={id} id={id} horizon={horizon} entry={data[id]} />
      ))}
      {showExtras &&
        extras.map((id) => <Chip key={id} id={id} horizon={horizon} entry={data[id]} />)}
      {!showExtras && (
        <button
          type="button"
          onClick={() => setMore(true)}
          className="flex shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-medium text-ink-2 shadow-[0_0_0_1px_var(--hair)] active:scale-[0.97]"
        >
          <IconPlus size={14} /> Compare
        </button>
      )}
    </div>
  )
}

import { motion } from 'motion/react'
import { HORIZONS } from '../config/horizons'
import { usePrefs } from '../state/prefs'

/** `pill` names the animated highlight so two tab bars can coexist (landscape view). */
export function HorizonTabs({ pill = 'horizon-pill', compact = false }: { pill?: string; compact?: boolean }) {
  const horizon = usePrefs((s) => s.horizon)
  const setHorizon = usePrefs((s) => s.setHorizon)
  return (
    <div role="tablist" className="relative grid shrink-0 grid-cols-4 rounded-xl bg-surface-2 p-0.5">
      {HORIZONS.map((h) => {
        const active = h.id === horizon
        return (
          <button
            key={h.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => setHorizon(h.id)}
            className={`relative z-0 font-semibold ${compact ? 'h-7 px-2.5 text-[12px]' : 'h-8 text-[13px]'}`}
          >
            {active && (
              <motion.span
                layoutId={pill}
                className="absolute inset-0 -z-10 rounded-[10px] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_var(--hair)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className={active ? 'text-ink' : 'text-ink-2'}>{h.label}</span>
          </button>
        )
      })}
    </div>
  )
}

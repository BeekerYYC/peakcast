import { motion } from 'motion/react'
import { HORIZONS } from '../config/horizons'
import { usePrefs } from '../state/prefs'

export function HorizonTabs() {
  const horizon = usePrefs((s) => s.horizon)
  const setHorizon = usePrefs((s) => s.setHorizon)
  return (
    <div role="tablist" className="relative grid grid-cols-4 rounded-xl bg-surface-2 p-0.5">
      {HORIZONS.map((h) => {
        const active = h.id === horizon
        return (
          <button
            key={h.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => setHorizon(h.id)}
            className="relative z-0 h-8 text-[13px] font-semibold"
          >
            {active && (
              <motion.span
                layoutId="horizon-pill"
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

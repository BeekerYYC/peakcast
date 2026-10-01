import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultModelsFor, extraModelsFor } from '../config/horizons'
import type { HorizonId } from '../config/models'

export type ThemePref = 'system' | 'light' | 'dark'
export type PrecipMode = 'hourly' | 'total'

interface PrefsState {
  theme: ThemePref
  horizon: HorizonId
  /** Per-horizon visibility overrides; unset = registry default. */
  modelVis: Partial<Record<HorizonId, Record<string, boolean>>>
  precipMode: PrecipMode
  setTheme: (t: ThemePref) => void
  setHorizon: (h: HorizonId) => void
  toggleModel: (h: HorizonId, id: string) => void
  setPrecipMode: (m: PrecipMode) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'system',
      horizon: '48h',
      modelVis: {},
      precipMode: 'hourly',
      setTheme: (theme) => set({ theme }),
      setHorizon: (horizon) => set({ horizon }),
      toggleModel: (h, id) =>
        set((s) => {
          const cur = isModelOn(s.modelVis, h, id)
          return { modelVis: { ...s.modelVis, [h]: { ...s.modelVis[h], [id]: !cur } } }
        }),
      setPrecipMode: (precipMode) => set({ precipMode }),
    }),
    { name: 'peakcast:prefs', version: 1 },
  ),
)

export function isModelOn(
  vis: PrefsState['modelVis'],
  h: HorizonId,
  id: string,
): boolean {
  const o = vis[h]?.[id]
  if (o != null) return o
  return defaultModelsFor(h).includes(id)
}

/** Models shown on a tab, in registry order (defaults first, then extras). */
export function visibleModelsFor(vis: PrefsState['modelVis'], h: HorizonId): string[] {
  return [...defaultModelsFor(h), ...extraModelsFor(h)].filter((id) => isModelOn(vis, h, id))
}

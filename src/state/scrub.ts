import { create } from 'zustand'

interface ScrubState {
  /** Unix seconds of the hour under the scrubber, or null (= "now"). */
  t: number | null
  /** True while a finger/pointer is actively dragging. */
  active: boolean
  set: (t: number | null, active?: boolean) => void
}

export const useScrub = create<ScrubState>()((set) => ({
  t: null,
  active: false,
  set: (t, active = false) => set({ t, active }),
}))

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SEED_SPOTS, type Spot } from '../config/spots'
import { slugify } from '../lib/format'

interface SpotsState {
  spots: Spot[]
  /** Slug of the last viewed spot (restored on reopen). */
  current: string
  /** A spot opened from a share link that isn't saved yet. */
  temp: Spot | null
  setCurrent: (slug: string) => void
  setTemp: (s: Spot | null) => void
  add: (s: Omit<Spot, 'slug'> & { slug?: string }) => Spot
  update: (slug: string, patch: Partial<Omit<Spot, 'slug'>>) => void
  remove: (slug: string) => void
  move: (from: number, to: number) => void
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  const b = slugify(base)
  if (!taken.has(b)) return b
  for (let i = 2; ; i++) if (!taken.has(`${b}-${i}`)) return `${b}-${i}`
}

export const useSpots = create<SpotsState>()(
  persist(
    (set, get) => ({
      spots: SEED_SPOTS,
      current: SEED_SPOTS[0].slug,
      temp: null,
      setCurrent: (current) => set({ current }),
      setTemp: (temp) => set({ temp }),
      add: (s) => {
        const taken = new Set(get().spots.map((x) => x.slug))
        const spot: Spot = { ...s, slug: uniqueSlug(s.slug ?? s.name, taken) }
        set((st) => ({
          spots: [...st.spots, spot],
          current: spot.slug,
          temp: st.temp?.slug === s.slug ? null : st.temp,
        }))
        return spot
      },
      update: (slug, patch) =>
        set((st) => ({ spots: st.spots.map((x) => (x.slug === slug ? { ...x, ...patch } : x)) })),
      remove: (slug) =>
        set((st) => {
          const spots = st.spots.filter((x) => x.slug !== slug)
          const idx = st.spots.findIndex((x) => x.slug === slug)
          const current =
            st.current === slug ? (spots[Math.max(0, idx - 1)]?.slug ?? '') : st.current
          return { spots, current }
        }),
      move: (from, to) =>
        set((st) => {
          const spots = [...st.spots]
          const [x] = spots.splice(from, 1)
          spots.splice(to, 0, x)
          return { spots }
        }),
    }),
    {
      name: 'peakcast:spots',
      version: 1,
      partialize: (s) => ({ spots: s.spots, current: s.current }),
    },
  ),
)

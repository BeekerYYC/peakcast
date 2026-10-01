import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { VISIBLE_MODELS } from '../config/models'
import { spotKey } from '../data/cache'
import { FRESH_MS, fetchModels, readAllCached } from '../data/forecast'
import type { CachedModel, SpotQuery } from '../data/types'

const ALL_IDS = VISIBLE_MODELS.map((m) => m.id)

/** In-memory layer over IndexedDB so swiping between spots is instant. */
const mem = new Map<string, Record<string, CachedModel>>()
const inflight = new Map<string, Promise<Record<string, CachedModel>>>()

export interface ForecastState {
  data: Record<string, CachedModel>
  loading: boolean
  error: string | null
  /** Oldest fetchedAt across the loaded models (ms), for the freshness label. */
  fetchedAt: number | null
  refresh: () => void
}

function isStale(d: Record<string, CachedModel>): boolean {
  const vals = ALL_IDS.map((id) => d[id])
  if (vals.some((v) => !v)) return true
  return vals.some((v) => Date.now() - v!.fetchedAt > FRESH_MS)
}

async function fromDb(spot: SpotQuery): Promise<Record<string, CachedModel>> {
  const k = spotKey(spot)
  let cur = mem.get(k)
  if (!cur) {
    cur = await readAllCached(spot, ALL_IDS)
    mem.set(k, cur)
  }
  return cur
}

async function fromNetwork(spot: SpotQuery): Promise<Record<string, CachedModel>> {
  const k = spotKey(spot)
  const pending = inflight.get(k)
  if (pending) return pending
  const p = fetchModels(spot, ALL_IDS)
    .then((fresh) => {
      const merged = { ...mem.get(k), ...fresh }
      mem.set(k, merged)
      return merged
    })
    .finally(() => inflight.delete(k))
  inflight.set(k, p)
  return p
}

/** Warm the cache for a spot (e.g. the neighbours in the pager). */
export function prefetch(spot: SpotQuery): void {
  void fromDb(spot)
    .then((d) => (isStale(d) ? fromNetwork(spot) : d))
    .catch(() => {})
}

interface Inner {
  key: string
  data: Record<string, CachedModel>
  loading: boolean
  error: string | null
}

export function useForecast(spot: SpotQuery | null): ForecastState {
  const k = spot ? spotKey(spot) : ''
  const [inner, setInner] = useState<Inner>({ key: '', data: {}, loading: false, error: null })
  const [nonce, setNonce] = useState(0)
  const forceRef = useRef(false)
  const spotRef = useRef(spot)
  useLayoutEffect(() => {
    spotRef.current = spot
  })

  // State belongs to one spot; for a new spot fall back to the memory cache.
  const state: Inner =
    inner.key === k ? inner : { key: k, data: mem.get(k) ?? {}, loading: false, error: null }

  useEffect(() => {
    const s = spotRef.current
    if (!s) return
    let alive = true
    const force = forceRef.current
    forceRef.current = false
    const patch = (p: Partial<Inner>) => {
      if (alive) setInner((prev) => ({ ...(prev.key === k ? prev : { key: k, data: {}, loading: false, error: null }), ...p }))
    }

    void (async () => {
      const cached = await fromDb(s)
      patch({ data: cached, error: null })
      if (!force && !isStale(cached)) return
      patch({ loading: true })
      try {
        patch({ data: await fromNetwork(s), loading: false })
      } catch (e) {
        patch({
          loading: false,
          error: !navigator.onLine ? 'Offline' : ((e as Error).message ?? 'Network error'),
        })
      }
    })()
    return () => {
      alive = false
    }
  }, [k, nonce])

  // Refresh when the app comes back to the foreground with stale data.
  useEffect(() => {
    const on = () => {
      if (document.visibilityState === 'visible' && k && isStale(mem.get(k) ?? {})) {
        setNonce((n) => n + 1)
      }
    }
    document.addEventListener('visibilitychange', on)
    window.addEventListener('online', on)
    return () => {
      document.removeEventListener('visibilitychange', on)
      window.removeEventListener('online', on)
    }
  }, [k])

  const refresh = useCallback(() => {
    forceRef.current = true
    setNonce((n) => n + 1)
  }, [setNonce])

  const times = Object.values(state.data).map((d) => d.fetchedAt)
  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    fetchedAt: times.length ? Math.min(...times) : null,
    refresh,
  }
}

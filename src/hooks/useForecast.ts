import { useCallback, useEffect, useRef, useState } from 'react'
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

async function load(spot: SpotQuery, force: boolean): Promise<Record<string, CachedModel>> {
  const k = spotKey(spot)
  let cur = mem.get(k)
  if (!cur) {
    cur = await readAllCached(spot, ALL_IDS)
    mem.set(k, cur)
  }
  if (!force && !isStale(cur)) return cur
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
  void load(spot, false).catch(() => {})
}

export function useForecast(spot: SpotQuery | null): ForecastState {
  const [data, setData] = useState<Record<string, CachedModel>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const forceRef = useRef(false)
  const k = spot ? spotKey(spot) : ''

  useEffect(() => {
    if (!spot) return
    let alive = true
    const force = forceRef.current
    forceRef.current = false
    const cached = mem.get(k)
    setData(cached ?? {})
    setError(null)

    void (async () => {
      if (!cached) {
        const fromDb = await readAllCached(spot, ALL_IDS)
        if (!alive) return
        mem.set(k, fromDb)
        setData(fromDb)
        if (!force && !isStale(fromDb)) return
      } else if (!force && !isStale(cached)) {
        return
      }
      setLoading(true)
      try {
        const d = await load(spot, force)
        if (alive) setData(d)
      } catch (e) {
        if (alive) {
          setError(
            typeof navigator !== 'undefined' && !navigator.onLine
              ? 'Offline'
              : ((e as Error).message ?? 'Network error'),
          )
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [k, nonce])

  // Refresh when the app comes back to the foreground with stale data.
  useEffect(() => {
    const on = () => {
      if (document.visibilityState === 'visible' && spot && isStale(mem.get(k) ?? {})) {
        setNonce((n) => n + 1)
      }
    }
    document.addEventListener('visibilitychange', on)
    window.addEventListener('online', on)
    return () => {
      document.removeEventListener('visibilitychange', on)
      window.removeEventListener('online', on)
    }
  }, [k, spot])

  const refresh = useCallback(() => {
    forceRef.current = true
    setNonce((n) => n + 1)
  }, [])

  const times = Object.values(data).map((d) => d.fetchedAt)
  return {
    data,
    loading,
    error,
    fetchedAt: times.length ? Math.min(...times) : null,
    refresh,
  }
}

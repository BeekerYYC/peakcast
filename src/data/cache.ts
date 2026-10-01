import { createStore, del, entries, get, set, type UseStore } from 'idb-keyval'
import type { CachedModel, SpotQuery } from './types'

let store: UseStore | null = null
function db(): UseStore {
  store ??= createStore('peakcast', 'forecasts')
  return store
}

/** Cache identity of a location: coordinates + elevation override. */
export function spotKey(s: SpotQuery): string {
  const el = s.elevation != null ? Math.round(s.elevation) : 'dem'
  return `${s.lat.toFixed(4)},${s.lon.toFixed(4)},${el}`
}

const key = (s: SpotQuery, modelId: string) => `${spotKey(s)}|${modelId}`

export async function readCached(s: SpotQuery, modelId: string): Promise<CachedModel | undefined> {
  try {
    return await get<CachedModel>(key(s, modelId), db())
  } catch {
    return undefined
  }
}

export async function writeCached(s: SpotQuery, modelId: string, v: CachedModel): Promise<void> {
  try {
    await set(key(s, modelId), v, db())
  } catch {
    /* storage full or unavailable: the app still works online */
  }
}

/** Drop entries older than `maxAgeMs` (keeps storage bounded). */
export async function pruneCache(maxAgeMs: number): Promise<void> {
  try {
    const now = Date.now()
    for (const [k, v] of await entries<string, CachedModel>(db())) {
      if (!v || now - v.fetchedAt > maxAgeMs) await del(k, db())
    }
  } catch {
    /* ignore */
  }
}

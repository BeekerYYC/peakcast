import { getModel } from '../config/models'
import { readCached, writeCached } from './cache'
import { normalizeEnsemble, normalizeForecast, type RawResponse } from './normalize'
import { buildEnsembleUrl, buildForecastUrl, fetchMeta, getJson, withCompanions } from './openmeteo'
import type { CachedModel, SpotQuery } from './types'

/** Cached data younger than this is used without refetching. */
export const FRESH_MS = 15 * 60 * 1000

export async function readAllCached(
  spot: SpotQuery,
  modelIds: string[],
): Promise<Record<string, CachedModel>> {
  const out: Record<string, CachedModel> = {}
  await Promise.all(
    modelIds.map(async (id) => {
      const c = await readCached(spot, id)
      if (c) out[id] = c
    }),
  )
  return out
}

/**
 * Fetch the given models from the network (one forecast request for all
 * deterministic models, one per ensemble), stamp run times, write the cache.
 */
export async function fetchModels(
  spot: SpotQuery,
  modelIds: string[],
  signal?: AbortSignal,
): Promise<Record<string, CachedModel>> {
  const det = modelIds.filter((id) => getModel(id).api === 'forecast')
  const ens = modelIds.filter((id) => getModel(id).api === 'ensemble')
  const metaP = Promise.all(modelIds.map(async (id) => [id, await fetchMeta(id)] as const))

  // Short-range and long-range models go in separate requests so the short
  // ones don't drag along hundreds of hours of nulls.
  const groups = new Map<string, string[]>()
  for (const id of det) {
    const k = getModel(id).maxHours <= 96 ? 'short' : 'long'
    groups.set(k, [...(groups.get(k) ?? []), id])
  }
  const jobs: Promise<ReturnType<typeof normalizeForecast>>[] = []
  for (const ids of groups.values()) {
    jobs.push(
      getJson<RawResponse>(buildForecastUrl(spot, ids), signal).then((raw) =>
        normalizeForecast(raw, withCompanions(ids)),
      ),
    )
  }
  for (const id of ens) {
    jobs.push(
      getJson<RawResponse>(buildEnsembleUrl(spot, id), signal).then((raw) => [
        normalizeEnsemble(raw, id),
      ]),
    )
  }

  // One failing request (e.g. the ensemble API) must not discard the others.
  const settled = await Promise.allSettled(jobs)
  const results = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
  if (!results.length) {
    const first = settled.find((s) => s.status === 'rejected') as PromiseRejectedResult | undefined
    throw first?.reason ?? new Error('No forecast data')
  }
  const meta = Object.fromEntries(await metaP)
  const fetchedAt = Date.now()
  const out: Record<string, CachedModel> = {}
  for (const series of results) {
    const entry: CachedModel = {
      series,
      fetchedAt,
      runInit: meta[series.modelId]?.last_run_initialisation_time ?? null,
    }
    out[series.modelId] = entry
    void writeCached(spot, series.modelId, entry)
  }
  return out
}

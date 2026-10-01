import { VISIBLE_MODELS, type HorizonId } from './models'

export interface HorizonDef {
  id: HorizonId
  label: string
  hours: number
}

export const HORIZONS: HorizonDef[] = [
  { id: '48h', label: '48h', hours: 48 },
  { id: '3.5d', label: '3.5d', hours: 84 },
  { id: '10d', label: '10d', hours: 240 },
  { id: '16d', label: '16d', hours: 384 },
]

export const HORIZONS_BY_ID = Object.fromEntries(HORIZONS.map((h) => [h.id, h])) as Record<
  HorizonId,
  HorizonDef
>

/** Hours shown before "now" so the current conditions aren't at the left edge. */
export const PAST_HOURS = 3

/** Models shown by default on a horizon tab: the ones registered for it. */
export function defaultModelsFor(h: HorizonId): string[] {
  return VISIBLE_MODELS.filter((m) => m.horizon === h).map((m) => m.id)
}

/** Every other visible model can be toggled on for comparison (off by default). */
export function extraModelsFor(h: HorizonId): string[] {
  return VISIBLE_MODELS.filter((m) => m.horizon !== h).map((m) => m.id)
}

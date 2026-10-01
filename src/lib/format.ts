const cache = new Map<string, Intl.DateTimeFormat>()
function fmt(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = tz + JSON.stringify(opts)
  let f = cache.get(k)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, ...opts })
    cache.set(k, f)
  }
  return f
}

/** Local hour (0–23) of a unix time in a time zone. */
export function localHour(unix: number, tz: string): number {
  const h = Number(fmt(tz, { hour: 'numeric', hourCycle: 'h23' }).format(new Date(unix * 1000)))
  return h === 24 ? 0 : h
}

export function weekday(unix: number, tz: string): string {
  return fmt(tz, { weekday: 'short' }).format(new Date(unix * 1000))
}

export function dayOfMonth(unix: number, tz: string): string {
  return fmt(tz, { day: 'numeric' }).format(new Date(unix * 1000))
}

/** "6a", "12p", "6p" style hour labels. */
export function shortHour(h: number): string {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

/** "Thu 14:00" */
export function scrubLabel(unix: number, tz: string): string {
  const d = new Date(unix * 1000)
  const wd = fmt(tz, { weekday: 'short' }).format(d)
  const hm = fmt(tz, { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(d)
  return `${wd} ${hm}`
}

/** "3 min ago", "2 h ago", "yesterday". */
export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, (now - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

/** Model run label, e.g. "12Z". */
export function runLabel(unix: number): string {
  return `${String(new Date(unix * 1000).getUTCHours()).padStart(2, '0')}Z`
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '–'
  const s = v.toFixed(digits)
  return s === '-0' || s === '-0.0' ? s.slice(1) : s
}

/** URL-safe slug from a spot name. */
export function slugify(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'spot'
  )
}

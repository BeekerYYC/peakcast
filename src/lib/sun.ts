/**
 * Sunrise/sunset (NOAA simplified algorithm). Accurate to ~1–2 minutes,
 * plenty for shading night on charts.
 */

const rad = Math.PI / 180

/** Returns [sunrise, sunset] unix seconds for the UTC date containing `dayUnix`,
 *  or null during polar day/night. */
export function sunTimes(dayUnix: number, lat: number, lon: number): [number, number] | null {
  const date = new Date(dayUnix * 1000)
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const doy = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 864e5)
  const g = ((2 * Math.PI) / 365) * (doy - 1)
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g))
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g)
  const cosH =
    Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl)
  if (cosH > 1 || cosH < -1) return null
  const ha = Math.acos(cosH) / rad
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000
  const rise = midnight + (720 - 4 * (lon + ha) - eqtime) * 60
  const set = midnight + (720 - 4 * (lon - ha) - eqtime) * 60
  return [rise, set]
}

/** Night intervals [start, end] (unix s) overlapping [from, to]. */
export function nightIntervals(from: number, to: number, lat: number, lon: number): [number, number][] {
  const days: [number, number][] = []
  for (let d = from - 86400 * 2; d <= to + 86400; d += 86400) {
    const s = sunTimes(d, lat, lon)
    if (s) days.push(s)
  }
  days.sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  for (let i = 0; i < days.length - 1; i++) {
    const a = days[i][1]
    const b = days[i + 1][0]
    if (b > from && a < to && b > a) out.push([Math.max(a, from), Math.min(b, to)])
  }
  return out
}

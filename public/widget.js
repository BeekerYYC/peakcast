// PEAKCAST_WIDGET v1
// iOS home-screen widget for Peakcast, run by the free Scriptable app.
// Loaded by the small loader script (see README "iPhone widget"), or paste this
// whole file into Scriptable and set APP below.
//
// Widget parameter (long-press widget → Edit Widget → Parameter), any of:
//   - a Peakcast share link (Share → Copy in the app)
//   - Name;lat;lon[;elevation]   e.g.  Mt Allan;50.97;-115.205;2819
//   - here                       → your current location
//   - empty → Kananaskis Village
// Add "| hourly" for the hourly strip layout, e.g.  here | hourly
//
// Data: Open-Meteo (CC BY 4.0). Models: HRDPS Continental, HRRR, RDPS.

const APP = typeof BASE !== 'undefined' ? BASE : 'https://YOUR-APP.vercel.app'

const MODELS = [
  // Same ids and colours as src/config/models.ts.
  { id: 'cmc_gem_hrdps', short: 'HRDPS', color: '#eb6834', derive: true },
  { id: 'ncep_hrrr_conus', short: 'HRRR', color: '#1baf7a', derive: false },
  { id: 'cmc_gem_rdps', short: 'RDPS', color: '#eda100', derive: true },
]
const LEVELS = [1000, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500]
const VARS = [
  'temperature_2m',
  'precipitation',
  'snowfall',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'weather_code',
  'freezing_level_height',
]

const C = {
  bg: Color.dynamic(new Color('#fcfcfb'), new Color('#1a1a19')),
  ink: Color.dynamic(new Color('#0b0b0b'), new Color('#ffffff')),
  ink2: Color.dynamic(new Color('#52514e'), new Color('#c3c2b7')),
  muted: new Color('#898781'),
  accent: Color.dynamic(new Color('#2a78d6'), new Color('#3987e5')),
  warn: new Color('#fab219'),
}

// ---------- spot ----------

/** Split "spot spec | style" from the widget parameter. */
function parseParam(param) {
  const raw = (param || '').trim()
  const bar = raw.lastIndexOf('|')
  const tail = bar >= 0 ? raw.slice(bar + 1).trim().toLowerCase() : ''
  const style = tail === 'hourly' || raw.toLowerCase() === 'hourly' ? 'hourly' : 'summary'
  let spec = bar >= 0 && (tail === 'hourly' || tail === 'summary') ? raw.slice(0, bar).trim() : raw
  if (spec.toLowerCase() === 'hourly') spec = ''
  return { spec, style }
}

/** Current location, named after the neighbourhood; falls back to the last fix. */
async function hereSpot() {
  const fm = FileManager.local()
  const file = fm.joinPath(fm.cacheDirectory(), 'peakcast-here.json')
  try {
    Location.setAccuracyToHundredMeters()
    const loc = await Location.current()
    const lat = Math.round(loc.latitude * 1e4) / 1e4
    const lon = Math.round(loc.longitude * 1e4) / 1e4
    let name = 'Here'
    try {
      const g = (await Location.reverseGeocode(lat, lon))[0]
      if (g) name = g.subLocality || g.locality || g.name || name
    } catch {
      /* keep "Here" */
    }
    const spot = { name, lat, lon, elev: null, slug: 'here-' + slugify(name) }
    fm.writeString(file, JSON.stringify(spot))
    return spot
  } catch {
    if (fm.fileExists(file)) return JSON.parse(fm.readString(file))
    throw new Error('Location unavailable. Allow Scriptable location access in iOS Settings.')
  }
}

function parseSpot(param) {
  const fallback = { name: 'Kananaskis Village', lat: 50.91598, lon: -115.14156, elev: null }
  if (!param || !param.trim()) return fallback
  const p = param.trim()
  if (p.startsWith('http')) {
    const q = {}
    const qs = p.split('?')[1] || ''
    for (const kv of qs.split('&')) {
      const [k, v] = kv.split('=')
      if (k) q[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '))
    }
    const lat = Number(q.lat)
    const lon = Number(q.lon)
    if (!isFinite(lat) || !isFinite(lon)) return fallback
    return { name: q.name || 'Spot', lat, lon, elev: q.elev ? Number(q.elev) : null, slug: q.spot }
  }
  const parts = p.split(';').map((s) => s.trim())
  const lat = Number(parts[1])
  const lon = Number(parts[2])
  if (parts.length < 3 || !isFinite(lat) || !isFinite(lon)) return fallback
  const elev = parts[3] ? Number(parts[3]) : null
  return { name: parts[0] || 'Spot', lat, lon, elev: isFinite(elev) ? elev : null }
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'spot'
}

function spotLink(s) {
  const q = [
    ['spot', s.slug || slugify(s.name)],
    ['name', s.name],
    ['lat', s.lat],
    ['lon', s.lon],
  ]
  if (s.elev != null) q.push(['elev', Math.round(s.elev)])
  return APP + '/?' + q.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&')
}

// ---------- data ----------

function forecastUrl(s) {
  const levelVars = LEVELS.flatMap((l) => ['temperature_' + l + 'hPa', 'geopotential_height_' + l + 'hPa'])
  const p = [
    'latitude=' + s.lat.toFixed(5),
    'longitude=' + s.lon.toFixed(5),
    'models=' + MODELS.map((m) => m.id).join(','),
    'hourly=' + VARS.concat(levelVars).join(','),
    'timezone=auto',
    'timeformat=unixtime',
    'wind_speed_unit=kmh',
    'past_hours=1',
    'forecast_hours=72',
  ]
  if (s.elev != null) p.push('elevation=' + Math.round(s.elev))
  return 'https://api.open-meteo.com/v1/forecast?' + p.join('&')
}

/** Highest 0 °C crossing above ground (same method as the app). */
function freezingLevel(z0, t0, levels) {
  const pts = []
  if (t0 != null) pts.push({ z: z0, t: t0 })
  for (const l of levels) if (l.z != null && l.t != null && l.z > z0) pts.push(l)
  if (pts.length < 2) return null
  pts.sort((a, b) => a.z - b.z)
  for (let i = pts.length - 1; i > 0; i--) {
    const up = pts[i]
    const dn = pts[i - 1]
    if (up.t <= 0 && dn.t > 0) return Math.round(dn.z + (dn.t / (dn.t - up.t)) * (up.z - dn.z))
  }
  if (pts[pts.length - 1].t > 0) return null
  return Math.round(z0)
}

function normalize(raw) {
  const h = raw.hourly
  const out = []
  for (const m of MODELS) {
    const get = (v) => h[v + '_' + m.id]
    const t = get('temperature_2m')
    if (!t || t.every((x) => x == null)) continue // outside this model's coverage
    let fzl = get('freezing_level_height')
    if (m.derive || !fzl || fzl.every((x) => x == null)) {
      const lv = LEVELS.map((l) => ({ t: get('temperature_' + l + 'hPa') || [], z: get('geopotential_height_' + l + 'hPa') || [] }))
      fzl = t.map((tt, i) => freezingLevel(raw.elevation, tt, lv.map((l) => ({ t: l.t[i], z: l.z[i] }))))
    }
    out.push({
      ...m,
      temp: t,
      precip: get('precipitation') || [],
      snow: get('snowfall') || [],
      wind: get('wind_speed_10m') || [],
      gust: get('wind_gusts_10m') || [],
      dir: get('wind_direction_10m') || [],
      code: get('weather_code') || [],
      fzl,
    })
  }
  return { time: h.time, tz: raw.timezone, elevation: raw.elevation, models: out }
}

async function load(s) {
  const fm = FileManager.local()
  const file = fm.joinPath(fm.cacheDirectory(), 'peakcast-' + slugify(s.name) + '-' + s.lat.toFixed(3) + s.lon.toFixed(3) + '.json')
  try {
    const req = new Request(forecastUrl(s))
    req.timeoutInterval = 20
    const raw = await req.loadJSON()
    if (!raw.hourly) throw new Error(raw.reason || 'Bad response')
    fm.writeString(file, JSON.stringify({ at: Date.now(), raw }))
    return { data: normalize(raw), at: Date.now(), stale: false }
  } catch (e) {
    if (fm.fileExists(file)) {
      const c = JSON.parse(fm.readString(file))
      return { data: normalize(c.raw), at: c.at, stale: true }
    }
    throw e
  }
}

/** 5-day outlook for the large hourly widget: GDPS + ECMWF IFS (mean). */
const DAILY_MODELS = ['cmc_gem_gdps', 'ecmwf_ifs']

async function loadDaily(s) {
  const fm = FileManager.local()
  const file = fm.joinPath(fm.cacheDirectory(), 'peakcast-5d-' + s.lat.toFixed(3) + s.lon.toFixed(3) + '.json')
  const p = [
    'latitude=' + s.lat.toFixed(5),
    'longitude=' + s.lon.toFixed(5),
    'models=' + DAILY_MODELS.join(','),
    'hourly=temperature_2m,precipitation,snowfall,weather_code',
    'timezone=auto',
    'timeformat=unixtime',
    'forecast_days=6',
  ]
  if (s.elev != null) p.push('elevation=' + Math.round(s.elev))
  let raw
  try {
    const req = new Request('https://api.open-meteo.com/v1/forecast?' + p.join('&'))
    req.timeoutInterval = 20
    raw = await req.loadJSON()
    if (!raw.hourly) throw new Error(raw.reason || 'Bad response')
    fm.writeString(file, JSON.stringify(raw))
  } catch {
    if (!fm.fileExists(file)) return null
    raw = JSON.parse(fm.readString(file))
  }
  const h = raw.hourly
  const models = DAILY_MODELS.map((id) => ({
    temp: h['temperature_2m_' + id] || [],
    precip: h['precipitation_' + id] || [],
    snow: h['snowfall_' + id] || [],
    code: h['weather_code_' + id] || [],
  })).filter((m) => m.temp.some((v) => v != null))
  return models.length ? { time: h.time, models } : null
}

// ---------- summary ----------

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const nums = (a) => a.filter((v) => v != null && isFinite(v))

function summarize(d) {
  const now = Math.floor(Date.now() / 3.6e6) * 3600
  let i = d.time.findIndex((t) => t >= now)
  if (i < 0) i = 0
  const at = (k) => mean(nums(d.models.map((m) => m[k][i])))
  const sumNext = (k, n) =>
    mean(
      nums(
        d.models.map((m) => {
          const v = nums(m[k].slice(i + 1, i + 1 + n))
          return v.length >= n / 2 ? v.reduce((a, b) => a + b, 0) : null
        }),
      ),
    )
  const maxNext = (k, n) =>
    mean(nums(d.models.map((m) => { const v = nums(m[k].slice(i, i + n)); return v.length ? Math.max(...v) : null })))
  const temps = nums(d.models.map((m) => m.temp[i]))
  const code = d.models.map((m) => m.code[i]).find((v) => v != null)
  return {
    i,
    temp: mean(temps),
    tRange: temps.length > 1 ? [Math.min(...temps), Math.max(...temps)] : null,
    code,
    wind: at('wind'),
    gust24: maxNext('gust', 24),
    fzl: at('fzl'),
    precip24: sumNext('precip', 24),
    snow24: sumNext('snow', 24),
  }
}

function wx(code, night) {
  const m = {
    0: [night ? 'moon.stars.fill' : 'sun.max.fill', night ? 'Clear night' : 'Clear'],
    1: [night ? 'moon.fill' : 'sun.max.fill', 'Mostly clear'],
    2: [night ? 'cloud.moon.fill' : 'cloud.sun.fill', 'Partly cloudy'],
    3: ['cloud.fill', 'Overcast'],
    45: ['cloud.fog.fill', 'Fog'],
    48: ['cloud.fog.fill', 'Fog'],
    51: ['cloud.drizzle.fill', 'Drizzle'],
    53: ['cloud.drizzle.fill', 'Drizzle'],
    55: ['cloud.drizzle.fill', 'Drizzle'],
    56: ['cloud.sleet.fill', 'Freezing drizzle'],
    57: ['cloud.sleet.fill', 'Freezing drizzle'],
    61: ['cloud.rain.fill', 'Light rain'],
    63: ['cloud.rain.fill', 'Rain'],
    65: ['cloud.heavyrain.fill', 'Heavy rain'],
    66: ['cloud.sleet.fill', 'Freezing rain'],
    67: ['cloud.sleet.fill', 'Freezing rain'],
    71: ['cloud.snow.fill', 'Light snow'],
    73: ['cloud.snow.fill', 'Snow'],
    75: ['cloud.snow.fill', 'Heavy snow'],
    77: ['cloud.snow.fill', 'Snow grains'],
    80: ['cloud.rain.fill', 'Showers'],
    81: ['cloud.rain.fill', 'Showers'],
    82: ['cloud.heavyrain.fill', 'Heavy showers'],
    85: ['cloud.snow.fill', 'Snow showers'],
    86: ['cloud.snow.fill', 'Snow showers'],
    95: ['cloud.bolt.rain.fill', 'Thunderstorm'],
    96: ['cloud.bolt.rain.fill', 'Thunder, hail'],
    99: ['cloud.bolt.rain.fill', 'Thunder, hail'],
  }
  return m[code] || ['cloud.fill', '—']
}

function isNight() {
  // Device local time; good enough for picking a sun vs moon glyph.
  const fmt = new DateFormatter()
  fmt.dateFormat = 'H'
  const h = Number(fmt.string(new Date()))
  return h < 7 || h >= 20
}

const n0 = (v) => (v == null ? '–' : String(Math.round(v)))
const n1 = (v) => (v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1))
const fzlText = (v) => (v == null ? '–' : Math.round(v / 10) * 10 + ' m')
const precipText = (s) => (s.snow24 != null && s.snow24 >= 0.5 ? n1(s.snow24) + ' cm' : n1(s.precip24) + ' mm')

// ---------- drawing ----------

function sparkline(d, s, w, h) {
  const ctx = new DrawContext()
  ctx.size = new Size(w, h)
  ctx.opaque = false
  ctx.respectScreenScale = true
  const from = s.i
  const to = Math.min(d.time.length - 1, from + 36)
  const all = nums(d.models.flatMap((m) => m.temp.slice(from, to + 1)))
  if (all.length < 2) return ctx.getImage()
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (hi - lo < 4) { const mid = (hi + lo) / 2; lo = mid - 2; hi = mid + 2 }
  const X = (k) => ((k - from) / (to - from)) * (w - 4) + 2
  const Y = (v) => h - 3 - ((v - lo) / (hi - lo)) * (h - 6)
  // 0 °C line
  if (lo < 0 && hi > 0) {
    const zp = new Path()
    zp.move(new Point(0, Y(0)))
    zp.addLine(new Point(w, Y(0)))
    ctx.addPath(zp)
    ctx.setStrokeColor(new Color('#2a78d6', 0.5))
    ctx.setLineWidth(1)
    ctx.strokePath()
  }
  // Day separator at local midnight.
  const fmt = new DateFormatter()
  fmt.dateFormat = 'H'
  for (let k = from + 1; k <= to; k++) {
    if (fmt.string(new Date(d.time[k] * 1000)) === '0') {
      const p = new Path()
      p.move(new Point(X(k), 0))
      p.addLine(new Point(X(k), h))
      ctx.addPath(p)
      ctx.setStrokeColor(new Color('#898781', 0.4))
      ctx.setLineWidth(1)
      ctx.strokePath()
    }
  }
  for (const m of d.models) {
    const p = new Path()
    let pen = false
    for (let k = from; k <= to; k++) {
      const v = m.temp[k]
      if (v == null) { pen = false; continue }
      const pt = new Point(X(k), Y(v))
      if (pen) p.addLine(pt)
      else { p.move(pt); pen = true }
    }
    ctx.addPath(p)
    ctx.setStrokeColor(new Color(m.color))
    ctx.setLineWidth(2)
    ctx.strokePath()
  }
  return ctx.getImage()
}

const dark = () => (typeof Device !== 'undefined' && Device.isUsingDarkAppearance ? Device.isUsingDarkAppearance() : true)

/** Gust cell colours, roughly Windy-like: calm → none, then green, yellow, orange, red. */
function gustFill(g) {
  if (g == null || g < 20) return null
  if (g < 35) return new Color('#1baf7a', 0.85)
  if (g < 50) return new Color('#eda100', 0.9)
  if (g < 70) return new Color('#eb6834', 0.9)
  return new Color('#d03b3b', 0.95)
}

function arrow(ctx, cx, cy, fromDeg, r, color) {
  // Arrow points downwind (meteorological direction is where wind comes from).
  const a = ((fromDeg + 180) * Math.PI) / 180
  const pt = (x, y) => new Point(cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a))
  const p = new Path()
  p.move(pt(0, -r))
  p.addLine(pt(r * 0.75, r))
  p.addLine(pt(0, r * 0.45))
  p.addLine(pt(-r * 0.75, r))
  p.closeSubpath()
  ctx.addPath(p)
  ctx.setFillColor(color)
  ctx.fillPath()
}

/** Windy-style hourly strip: hour, icon, temp, wind, gust (coloured), direction. */
function hourlyTable(d, s, w, h, step, cols) {
  const isDark = dark()
  const ink = new Color(isDark ? '#ffffff' : '#0b0b0b')
  const ink2 = new Color(isDark ? '#c3c2b7' : '#52514e')
  const muted = new Color('#898781')
  const ctx = new DrawContext()
  ctx.size = new Size(w, h)
  ctx.opaque = false
  ctx.respectScreenScale = true
  const cw = w / cols
  const hourFmt = new DateFormatter()
  hourFmt.dateFormat = 'H'
  const dayFmt = new DateFormatter()
  dayFmt.dateFormat = 'EEE'
  const rows = { hour: 0, icon: 14, temp: 35, precip: 53, wind: 70, gust: 84, dir: 102 }
  const scale = h / 114
  const Y = (k) => rows[k] * scale

  const textAt = (str, x, y, size, color, bold) => {
    ctx.setFont(bold ? Font.semiboldSystemFont(size) : Font.systemFont(size))
    ctx.setTextColor(color)
    ctx.setTextAlignedCenter()
    ctx.drawTextInRect(str, new Rect(x, y, cw, size + 4))
  }

  for (let c = 0; c < cols; c++) {
    const k = s.i + c * step
    if (k >= d.time.length) break
    const x = c * cw
    const date = new Date(d.time[k] * 1000)
    const hr = Number(hourFmt.string(date))
    const label = c === 0 ? 'Now' : hr === 0 ? dayFmt.string(date).toUpperCase().slice(0, 2) : String(hr)
    textAt(label, x, Y('hour'), 10, hr === 0 && c > 0 ? ink : muted, hr === 0)

    const at = (key) => {
      const v = nums(d.models.map((m) => m[key][k]))
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
    }
    // Over a multi-hour step, show the strongest gust in that block.
    const gustBlock = () => {
      const v = []
      for (let j = k; j < k + step && j < d.time.length; j++) v.push(...nums(d.models.map((m) => m.gust[j])))
      return v.length ? Math.max(...v) : null
    }
    const code = d.models.map((m) => m.code[k]).find((v) => v != null)
    const night = hr < 7 || hr >= 20
    const sym = SFSymbol.named(wx(code, night)[0])
    sym.applyFont(Font.systemFont(16))
    const img = sym.image
    const isz = 18 * scale
    ctx.drawImageInRect(img, new Rect(x + (cw - isz) / 2, Y('icon'), isz, isz))

    textAt(n0(at('temp')) + '°', x, Y('temp'), 12, ink, true)

    // Precip over the column's block: snow (cm) if any, else rain/total (mm).
    const blockSum = (key) => {
      const per = d.models.map((m) => {
        const v = nums(m[key].slice(k, k + step))
        return v.length ? v.reduce((a, b) => a + b, 0) : null
      })
      const v = nums(per)
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
    }
    const sn = blockSum('snow')
    const pr = blockSum('precip')
    const isSnow = sn != null && sn >= 0.1
    const amt = isSnow ? sn : pr
    if (amt != null && amt >= 0.1) {
      const strength = Math.min(1, 0.35 + amt / (isSnow ? 2 : 3))
      ctx.setFillColor(new Color(isSnow ? '#7fb2ee' : '#2a78d6', strength))
      ctx.fillRect(new Rect(x + 0.5, Y('precip') - 1, cw - 1, 15 * scale))
      textAt(amt < 10 ? n1(amt) : n0(amt), x, Y('precip'), 9.5, new Color('#ffffff'), true)
    } else {
      textAt('·', x, Y('precip'), 10, muted, false)
    }
    textAt(n0(at('wind')), x, Y('wind'), 10, ink2, false)

    const g = gustBlock()
    const fill = gustFill(g)
    if (fill) {
      ctx.setFillColor(fill)
      ctx.fillRect(new Rect(x + 0.5, Y('gust') - 1, cw - 1, 16 * scale))
    }
    textAt(n0(g), x, Y('gust'), 10, fill ? new Color('#ffffff') : ink2, !!fill)

    const dirs = nums(d.models.map((m) => (m.dir ? m.dir[k] : null)))
    if (dirs.length) {
      let sx = 0
      let sy = 0
      for (const v of dirs) {
        sx += Math.cos((v * Math.PI) / 180)
        sy += Math.sin((v * Math.PI) / 180)
      }
      const deg = (Math.atan2(sy, sx) * 180) / Math.PI
      arrow(ctx, x + cw / 2, Y('dir') + 6 * scale, deg, 5 * scale, ink2)
    }
    // Midnight divider.
    if (hr === 0 && c > 0) {
      const p = new Path()
      p.move(new Point(x, 0))
      p.addLine(new Point(x, h))
      ctx.addPath(p)
      ctx.setStrokeColor(new Color('#898781', 0.35))
      ctx.setLineWidth(1)
      ctx.strokePath()
    }
  }
  return ctx.getImage()
}

function text(stack, str, size, color, weight) {
  const t = stack.addText(str)
  t.font = weight === 'bold' ? Font.boldSystemFont(size) : weight === 'semibold' ? Font.semiboldSystemFont(size) : Font.systemFont(size)
  t.textColor = color
  t.lineLimit = 1
  t.minimumScaleFactor = 0.7
  return t
}

function statRow(stack, label, value) {
  const r = stack.addStack()
  r.centerAlignContent()
  text(r, label, 11, C.muted)
  r.addSpacer()
  text(r, value, 12, C.ink, 'semibold')
}

/** Windy-Premium-style 5-day panel: day columns, icon, lo/hi, temperature curve, precip strip. */
function dailyPanel(dd, w, h) {
  const isDark = dark()
  const ink = new Color(isDark ? '#ffffff' : '#0b0b0b')
  const ink2 = new Color(isDark ? '#c3c2b7' : '#52514e')
  const ctx = new DrawContext()
  ctx.size = new Size(w, h)
  ctx.opaque = false
  ctx.respectScreenScale = true
  const keyFmt = new DateFormatter()
  keyFmt.dateFormat = 'yyyy-MM-dd'
  const dayFmt = new DateFormatter()
  dayFmt.dateFormat = 'EEE'
  const hourFmt = new DateFormatter()
  hourFmt.dateFormat = 'H'

  // Hour-by-hour consensus.
  const avg = (key, i) => mean(nums(dd.models.map((m) => m[key][i])))
  const days = []
  const byKey = new Map()
  dd.time.forEach((t, i) => {
    const date = new Date(t * 1000)
    const k = keyFmt.string(date)
    if (!byKey.has(k)) {
      const day = { k, label: dayFmt.string(date).toUpperCase(), idx: [] }
      byKey.set(k, day)
      days.push(day)
    }
    byKey.get(k).idx.push(i)
  })
  // Drop days that already ended, keep five, and call the current one TODAY.
  while (days.length && days[0].idx.every((i) => dd.time[i] * 1000 < Date.now() - 3600e3)) days.shift()
  const shown = days.slice(0, 5)
  const todayKey = keyFmt.string(new Date())
  for (const day of shown) if (day.k === todayKey) day.label = 'TODAY'
  if (!shown.length) return ctx.getImage()
  const cols = shown.length
  const cw = w / cols
  const first = shown[0].idx[0]
  const last = shown[cols - 1].idx[shown[cols - 1].idx.length - 1]
  const span = Math.max(1, last - first)
  const X = (i) => ((i - first) / span) * w

  // Temperature curve (filled) behind the columns.
  const temps = []
  for (let i = first; i <= last; i++) temps.push(avg('temp', i))
  const tv = nums(temps)
  const curveTop = h * 0.3
  const curveBot = h * 0.66
  if (tv.length > 1) {
    const lo = Math.min(...tv)
    const hi = Math.max(...tv)
    const Yt = (v) => curveBot - ((v - lo) / Math.max(1, hi - lo)) * (curveBot - curveTop)
    const area = new Path()
    area.move(new Point(0, curveBot + 6))
    let started = false
    temps.forEach((v, j) => {
      if (v == null) return
      const pt = new Point(X(first + j), Yt(v))
      area.addLine(pt)
      started = true
    })
    if (started) {
      area.addLine(new Point(w, curveBot + 6))
      area.closeSubpath()
      ctx.addPath(area)
      ctx.setFillColor(new Color(isDark ? '#7fb2a0' : '#1baf7a', isDark ? 0.22 : 0.16))
      ctx.fillPath()
    }
  }

  const textAt = (str, x, y, width, size, color, bold) => {
    ctx.setFont(bold ? Font.semiboldSystemFont(size) : Font.systemFont(size))
    ctx.setTextColor(color)
    ctx.setTextAlignedCenter()
    ctx.drawTextInRect(str, new Rect(x, y, width, size + 4))
  }

  shown.forEach((day, c) => {
    const x = c * cw
    if (c > 0) {
      const p = new Path()
      p.move(new Point(x, 0))
      p.addLine(new Point(x, h * 0.72))
      ctx.addPath(p)
      ctx.setStrokeColor(new Color('#898781', 0.35))
      ctx.setLineWidth(1)
      ctx.strokePath()
    }
    textAt(day.label, x, 0, cw, 10, ink2, true)
    const t = nums(day.idx.map((i) => avg('temp', i)))
    const daytime = day.idx.filter((i) => {
      const hr = Number(hourFmt.string(new Date(dd.time[i] * 1000)))
      return hr >= 8 && hr <= 18
    })
    const codes = nums((daytime.length ? daytime : day.idx).map((i) => dd.models[0].code[i])).sort((a, b) => a - b)
    const code = codes.length ? codes[Math.min(codes.length - 1, Math.floor(codes.length * 0.75))] : null
    const sym = SFSymbol.named(wx(code, false)[0])
    sym.applyFont(Font.systemFont(18))
    const isz = 20
    ctx.drawImageInRect(sym.image, new Rect(x + (cw - isz) / 2, 15, isz, isz))
    const lo = t.length ? Math.min(...t) : null
    const hi = t.length ? Math.max(...t) : null
    textAt(n0(lo) + '°/' + n0(hi) + '°', x, h * 0.58, cw, 13, ink, true)
  })

  // Precip strip: hourly intensity, rain blue / snow pale blue.
  const sy = h * 0.82
  const sh = h * 0.12
  const bg = new Path()
  bg.addRoundedRect(new Rect(0, sy, w, sh), sh / 2, sh / 2)
  ctx.addPath(bg)
  ctx.setFillColor(new Color(isDark ? '#ffffff' : '#0b0b0b', 0.1))
  ctx.fillPath()
  const hw = w / (span + 1)
  for (let i = first; i <= last; i++) {
    const pr = avg('precip', i)
    if (pr == null || pr < 0.05) continue
    const sn = avg('snow', i)
    const isSnow = sn != null && sn >= 0.05
    ctx.setFillColor(new Color(isSnow ? '#a9cdf5' : '#3987e5', Math.min(1, 0.35 + pr / 1.5)))
    ctx.fillRect(new Rect(X(i), sy, Math.max(1, hw), sh))
  }
  return ctx.getImage()
}

function buildHourly(spot, res, family) {
  const { data: d, at, stale } = res
  const s = summarize(d)
  const w = new ListWidget()
  w.backgroundColor = C.bg
  w.url = spotLink(spot)
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)
  w.setPadding(10, 12, 8, 12)
  const head = w.addStack()
  head.centerAlignContent()
  text(head, spot.name, 14, C.ink, 'bold')
  head.addSpacer()
  const f = new DateFormatter()
  f.useNoDateStyle()
  f.useShortTimeStyle()
  text(head, (stale ? 'offline · ' : '') + 'Peakcast · ' + f.string(new Date(at)), 9, stale ? C.warn : C.muted)
  const small = family === 'small'
  const large = family === 'large'
  if (large) {
    // Current conditions line: "7° ☾ · wind 3 g8 km/h · 0 °C 2370 m".
    const now = w.addStack()
    now.centerAlignContent()
    text(now, n0(s.temp) + '°', 13, C.ink, 'semibold')
    now.addSpacer(4)
    const sym = now.addImage(SFSymbol.named(wx(s.code, isNight())[0]).image)
    sym.imageSize = new Size(14, 14)
    sym.tintColor = C.ink2
    now.addSpacer(6)
    text(now, 'wind ' + n0(s.wind) + ' g' + n0(s.gust24) + ' km/h  ·  0 °C ' + fzlText(s.fzl), 11, C.ink2)
    w.addSpacer(6)
    if (res.daily) {
      const di = w.addImage(dailyPanel(res.daily, 316, 104))
      di.imageSize = new Size(316, 104)
      w.addSpacer(6)
    }
  } else {
    w.addSpacer(4)
  }
  const cols = small ? 5 : large ? 13 : 12
  const iw = small ? 130 : 316
  const ih = large ? 128 : 112
  const img = w.addImage(hourlyTable(d, s, iw, ih, 1, cols))
  img.imageSize = new Size(iw, ih)
  w.addSpacer()
  if (large) {
    const foot = w.addStack()
    text(foot, 'Hourly: ' + d.models.map((m) => m.short).join(', ') + ' · 5-day: GDPS, IFS', 8, C.muted)
    foot.addSpacer()
    text(foot, 'mm · cm · km/h', 8, C.muted)
  }
  return w
}

function build(spot, res, family) {
  const { data: d, at, stale } = res
  const s = summarize(d)
  const night = isNight()
  const [symbol, label] = wx(s.code, night)
  const w = new ListWidget()
  w.backgroundColor = C.bg
  w.url = spotLink(spot)
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)
  w.setPadding(12, 14, 10, 14)

  const head = w.addStack()
  head.centerAlignContent()
  text(head, spot.name, family === 'small' ? 13 : 14, C.ink, 'bold')
  head.addSpacer()
  if (family !== 'small') {
    const f = new DateFormatter()
    f.useNoDateStyle()
    f.useShortTimeStyle()
    text(head, (stale ? 'offline · ' : '') + f.string(new Date(at)), 10, stale ? C.warn : C.muted)
  }
  w.addSpacer(4)

  const main = w.addStack()
  main.centerAlignContent()
  const left = main.addStack()
  left.layoutVertically()
  const tr = left.addStack()
  tr.centerAlignContent()
  const img = tr.addImage(SFSymbol.named(symbol).image)
  img.imageSize = new Size(family === 'small' ? 22 : 26, family === 'small' ? 22 : 26)
  img.tintColor = symbol.includes('sun') ? new Color('#eda100') : C.ink2
  tr.addSpacer(6)
  text(tr, n0(s.temp) + '°', family === 'small' ? 30 : 34, C.ink, 'semibold')
  text(left, label + (s.tRange && s.tRange[1] - s.tRange[0] >= 1 ? ' · ' + n0(s.tRange[0]) + ' to ' + n0(s.tRange[1]) + '°' : ''), 11, C.ink2)

  if (family === 'small') {
    w.addSpacer()
    statRow(w, 'Gust 24h', n0(s.gust24) + ' km/h')
    statRow(w, '0 °C', fzlText(s.fzl))
    statRow(w, 'Next 24h', precipText(s))
    return w
  }

  main.addSpacer(16)
  const right = main.addStack()
  right.layoutVertically()
  right.size = new Size(140, 0)
  statRow(right, 'Wind / gust', n0(s.wind) + ' / ' + n0(s.gust24))
  statRow(right, '0 °C level', fzlText(s.fzl))
  statRow(right, 'Next 24 h', precipText(s))

  w.addSpacer()
  const chartW = family === 'large' ? 310 : 300
  const chart = w.addImage(sparkline(d, s, chartW, family === 'large' ? 90 : 44))
  chart.imageSize = new Size(chartW, family === 'large' ? 90 : 44)
  w.addSpacer(3)
  const legend = w.addStack()
  legend.centerAlignContent()
  for (const m of d.models) {
    const dot = legend.addText('● ')
    dot.font = Font.systemFont(9)
    dot.textColor = new Color(m.color)
    text(legend, m.short + '  ', 9, C.muted)
  }
  legend.addSpacer()
  text(legend, 'next 36 h · Open-Meteo', 9, C.muted)
  return w
}

function errorWidget(spot, e) {
  const w = new ListWidget()
  w.backgroundColor = C.bg
  w.url = spotLink(spot)
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)
  text(w, spot.name, 13, C.ink, 'bold')
  w.addSpacer(6)
  text(w, 'No forecast yet', 12, C.ink2)
  text(w, String(e && e.message ? e.message : e).slice(0, 80), 10, C.muted)
  return w
}

// ---------- run ----------

const param = typeof args !== 'undefined' ? args.widgetParameter : null
// Opened by tapping a widget set to "Run Script" (param may be null if empty).
const fromWidgetTap = !config.runsInWidget && param != null
// Run by hand inside Scriptable: preview the large "here | hourly" widget.
// This is also what makes iOS show the location permission prompt, which a
// widget alone can't trigger.
const manual = !config.runsInWidget && !fromWidgetTap
const { spec, style } = parseParam(manual ? 'here | hourly' : param)
const family = config.runsInWidget ? config.widgetFamily || 'small' : manual ? 'large' : 'medium'
let spot = parseSpot(spec)
let widget
try {
  if (spec.toLowerCase() === 'here') {
    try {
      spot = await hereSpot()
    } catch (e) {
      if (!manual) throw e
      console.log('Location not available (' + e.message + '); previewing Kananaskis Village instead')
    }
  }
  const res = await load(spot)
  if (style === 'hourly' && family === 'large') res.daily = await loadDaily(spot)
  widget = style === 'hourly' ? buildHourly(spot, res, family) : build(spot, res, family)
} catch (e) {
  widget = errorWidget(spot, e)
}
console.log('Peakcast widget: ' + spot.name + ' · ' + family + ' · ' + style + (fromWidgetTap ? ' · opened from widget tap' : ''))
if (config.runsInWidget) Script.setWidget(widget)
// Widget set to "Run Script": a tap lands here, so jump to Peakcast.
else if (fromWidgetTap) Safari.open(spotLink(spot))
else await widget.presentLarge()
Script.complete()

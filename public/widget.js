// PEAKCAST_WIDGET v1
// iOS home-screen widget for Peakcast, run by the free Scriptable app.
// Loaded by the small loader script (see README "iPhone widget"), or paste this
// whole file into Scriptable and set APP below.
//
// Widget parameter (long-press widget → Edit Widget → Parameter), any of:
//   - a Peakcast share link (Share → Copy in the app)
//   - Name;lat;lon[;elevation]   e.g.  Mt Allan;50.97;-115.205;2819
//   - empty → Kananaskis Village
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

const spot = parseSpot(typeof args !== 'undefined' ? args.widgetParameter : null)
const family = config.runsInWidget ? config.widgetFamily || 'small' : 'medium'
let widget
try {
  widget = build(spot, await load(spot), family)
} catch (e) {
  widget = errorWidget(spot, e)
}
if (config.runsInWidget) Script.setWidget(widget)
else await widget.presentMedium()
Script.complete()

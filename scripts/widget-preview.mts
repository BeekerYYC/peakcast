// @ts-nocheck: mock Scriptable classes run inside the browser page
// Preview public/widget.js in Chromium with a canvas-backed Scriptable mock.
// Usage: npm run widget:preview -- <small|medium|large> "<parameter>" out.png  (FAKE_PRECIP=1 injects rain/snow)
// Render widget.js's hourly table in Chromium with a canvas-backed Scriptable mock.
import { readFileSync } from 'node:fs'
import { chromium, devices } from 'playwright'
const code = readFileSync('/home/user/peakcast/public/widget.js', 'utf8')
const family = process.argv[2] ?? 'medium'
const param = process.argv[3] ?? 'here | hourly'
const out = process.argv[4]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({ ...devices['iPhone 15'], colorScheme: 'dark' })
page.on('console', (m) => console.log('[console]', m.text()))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.route('**/*', async (r) => {
  const u = r.request().url()
  if (u.startsWith('https://api.open-meteo.com')) {
    const res = await fetch(u)
    let body = Buffer.from(await res.arrayBuffer())
    if (process.env.FAKE_PRECIP) {
      const j = JSON.parse(body.toString())
      for (const k of Object.keys(j.hourly)) {
        if (k.startsWith('precipitation_')) j.hourly[k] = j.hourly[k].map((v: number | null, i: number) => (v == null ? v : i % 12 > 4 && i % 12 < 9 ? 0.8 + (i % 3) * 0.6 : 0))
        if (k.startsWith('snowfall_')) j.hourly[k] = j.hourly[k].map((v: number | null, i: number) => (v == null ? v : i > 12 && i % 12 > 5 && i % 12 < 8 ? 0.7 : 0))
      }
      body = Buffer.from(JSON.stringify(j))
    }
    return r.fulfill({ status: res.status, body, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } })
  }
  return r.fulfill({ status: 200, body: '<html><body style="background:#000;margin:0"></body></html>', headers: { 'content-type': 'text/html' } })
})
await page.addInitScript('window.__name = (f) => f')
await page.goto('https://mock.local/')
const result = await page.evaluate(async ({ code, family, param }) => {
  class Color { constructor(public h: string, public a = 1) {} static dynamic(_l: any, d: any) { return d } css() { const n = parseInt(this.h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${this.a})` } }
  class Size { constructor(public width: number, public height: number) {} }
  class Point { constructor(public x: number, public y: number) {} }
  class Rect { constructor(public x: number, public y: number, public width: number, public height: number) {} }
  class Path { ops: any[] = []; move(p: any) { this.ops.push(['m', p]) } addLine(p: any) { this.ops.push(['l', p]) } closeSubpath() { this.ops.push(['z']) } addRoundedRect(r: any) { this.ops.push(['m', { x: r.x, y: r.y }], ['l', { x: r.x + r.width, y: r.y }], ['l', { x: r.x + r.width, y: r.y + r.height }], ['l', { x: r.x, y: r.y + r.height }], ['z']) } }
  const Font = { systemFont: (n: number) => `${n}px -apple-system, system-ui`, boldSystemFont: (n: number) => `700 ${n}px system-ui`, semiboldSystemFont: (n: number) => `600 ${n}px system-ui` }
  class DrawContext {
    c = document.createElement('canvas'); x: any; _size: any; path: any; font = '10px system-ui'; tc = '#fff'; align = 'left'; opaque = true; respectScreenScale = true
    set size(s: any) { this._size = s; this.c.width = s.width * 3; this.c.height = s.height * 3; this.x = this.c.getContext('2d'); this.x.scale(3, 3) }
    get size() { return this._size }
    addPath(p: any) { this.path = p }
    _trace() { const x = this.x; x.beginPath(); for (const [o, p] of this.path.ops) { if (o === 'm') x.moveTo(p.x, p.y); else if (o === 'l') x.lineTo(p.x, p.y); else x.closePath() } }
    setStrokeColor(c: any) { this.x.strokeStyle = c.css() } setFillColor(c: any) { this.x.fillStyle = c.css() } setLineWidth(w: number) { this.x.lineWidth = w }
    strokePath() { this._trace(); this.x.stroke() } fillPath() { this._trace(); this.x.fill() }
    fillRect(r: any) { this.x.fillRect(r.x, r.y, r.width, r.height) }
    setFont(f: string) { this.font = f } setTextColor(c: any) { this.tc = c.css() } setTextAlignedCenter() { this.align = 'center' }
    drawTextInRect(t: string, r: any) { const x = this.x; x.font = this.font; x.fillStyle = this.tc; x.textAlign = this.align; x.textBaseline = 'top'; x.fillText(t, this.align === 'center' ? r.x + r.width / 2 : r.x, r.y) }
    drawImageInRect(img: any, r: any) { const x = this.x; x.fillStyle = img.name.includes('sun') ? '#eda100' : img.name.includes('moon') ? '#c9c7f0' : '#9aa'; x.beginPath(); x.arc(r.x + r.width / 2, r.y + r.height / 2, r.width / 2.6, 0, 7); x.fill() }
    getImage() { return { dataUrl: this.c.toDataURL(), w: this._size.width, h: this._size.height } }
  }
  const items: string[] = []
  class Stack { kids: any[] = []; addStack() { const s = new Stack(); this.kids.push(s); return s } addText(t: string) { const o: any = { t }; items.push('text: ' + t); this.kids.push(o); return o } addImage(img: any) { const o: any = { img }; this.kids.push(o); return o } addSpacer() {} centerAlignContent() {} layoutVertically() {} setPadding() {} }
  class ListWidget extends Stack { async presentMedium() {} async presentLarge() {} }
  class DateFormatter { dateFormat = ''; useNoDateStyle() {} useShortTimeStyle() {} string(d: Date) { if (this.dateFormat === 'H') return String(d.getHours()); if (this.dateFormat === 'EEE') return d.toLocaleDateString('en', { weekday: 'short' }); if (this.dateFormat === 'yyyy-MM-dd') return d.toLocaleDateString('en-CA'); return d.toTimeString().slice(0, 5) } }
  const SFSymbol = { named: (n: string) => ({ image: { name: n }, applyFont() {} }) }
  const store = new Map()
  const FileManager = { local: () => ({ cacheDirectory: () => '/c', documentsDirectory: () => '/d', joinPath: (a: string, b: string) => a + '/' + b, writeString: (p: string, s: string) => store.set(p, s), readString: (p: string) => store.get(p), fileExists: (p: string) => store.has(p) }) }
  class Request { timeoutInterval = 0; constructor(public u: string) {} async loadJSON() { return (await fetch(this.u)).json() } }
  const Location = { setAccuracyToHundredMeters() {}, current: async () => ({ latitude: 51.0712, longitude: -114.1189 }), reverseGeocode: async () => [{ subLocality: 'Banff Trail', locality: 'Calgary' }] }
  const Device = { isUsingDarkAppearance: () => true }
  const Script = { setWidget() {}, complete() {} }
  const Safari = { open() {} }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const fn = new AsyncFunction('BASE', 'args', 'config', 'Color', 'Size', 'Point', 'Rect', 'Path', 'DrawContext', 'Font', 'ListWidget', 'DateFormatter', 'SFSymbol', 'FileManager', 'Request', 'Location', 'Device', 'Script', 'Safari', code + '\nreturn widget')
  const w = await fn('https://peakcast.example', { widgetParameter: param }, { runsInWidget: true, widgetFamily: family }, Color, Size, Point, Rect, Path, DrawContext, Font, ListWidget, DateFormatter, SFSymbol, FileManager, Request, Location, Device, Script, Safari)
  // Lay out roughly like iOS: texts then images.
  const box = document.createElement('div')
  box.style.cssText = 'margin:20px;padding:10px 12px;background:#1a1a19;border-radius:22px;color:#fff;font:14px system-ui;width:' + (family === 'small' ? 158 : 338) + 'px'
  const walk = (s: any) => { for (const k of s.kids) { if (k.kids) walk(k); else if (k.t != null) { const d = document.createElement('div'); d.textContent = k.t; d.style.fontSize = '12px'; box.appendChild(d) } else if (k.img?.dataUrl) { const im = new Image(); im.src = k.img.dataUrl; im.style.width = k.img.w + 'px'; box.appendChild(im) } } }
  walk(w)
  document.body.appendChild(box)
  return { url: w.url, items }
}, { code, family, param })
console.log(JSON.stringify(result))
if (out) await page.screenshot({ path: out })
await browser.close()

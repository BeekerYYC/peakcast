/**
 * Screenshot the app at an iPhone viewport. API calls are proxied through
 * Node's fetch (live data). Usage: tsx scripts/shot.ts [url] [out] [--dark] [--viewport] [--landscape]
 */
import { existsSync, readdirSync } from 'node:fs'
import { chromium, devices } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5173/'
const out = process.argv[3] ?? 'shot.png'
const dark = process.argv.includes('--dark')
const full = !process.argv.includes('--viewport')
const landscape = process.argv.includes('--landscape')

function chromiumPath(): string | undefined {
  const base = '/opt/pw-browsers'
  if (!existsSync(base)) return undefined
  for (const d of readdirSync(base)) {
    for (const p of [`${base}/${d}/chrome-linux/chrome`, `${base}/${d}/chrome-linux64/chrome`]) {
      if (existsSync(p)) return p
    }
  }
  return existsSync(`${base}/chromium`) ? `${base}/chromium` : undefined
}

const browser = await chromium.launch({ executablePath: chromiumPath() })
const ctx = await browser.newContext({ ...devices[landscape ? 'iPhone 15 landscape' : 'iPhone 15'], colorScheme: dark ? 'dark' : 'light' })
const page = await ctx.newPage()
page.on('console', (m) => console.log('[console]', m.type(), m.text()))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.route(/open-meteo\.com|openfreemap|opentopomap/, async (route) => {
  try {
    const r = await fetch(route.request().url())
    const body = Buffer.from(await r.arrayBuffer())
    await route.fulfill({
      status: r.status,
      body,
      headers: { 'content-type': r.headers.get('content-type') ?? 'application/json', 'access-control-allow-origin': '*' },
    })
  } catch {
    await route.abort()
  }
})
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const actions = process.env.SHOT_ACTIONS
if (actions) await new Function('page', `return (async () => { ${actions} })()`)(page)
await page.screenshot({ path: out, fullPage: full })
await browser.close()
console.log('saved', out)

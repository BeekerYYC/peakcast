/** Render public/icon.svg to the PNG sizes the manifest and iOS need. */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const svg = readFileSync('public/icon.svg', 'utf8')
const out: [string, number, boolean][] = [
  ['public/apple-touch-icon.png', 180, false],
  ['public/pwa-192.png', 192, false],
  ['public/pwa-512.png', 512, false],
  ['public/maskable-512.png', 512, true],
  ['public/favicon-32.png', 32, false],
]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const [file, size, maskable] of out) {
  // Maskable: keep the art inside the 80% safe zone on the same background.
  const inner = maskable ? Math.round(size * 0.8) : size
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:#0d366b;display:grid;place-items:center;width:${size}px;height:${size}px">
     <div style="width:${inner}px;height:${inner}px;overflow:hidden;border-radius:${maskable ? inner * 0.12 : 0}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  )
  await page.screenshot({ path: file, omitBackground: false })
  console.log('wrote', file)
}
await browser.close()

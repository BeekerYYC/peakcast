import type { Spot } from '../config/spots'
import { shareUrl } from './deeplink'

/** Running as an installed home-screen app. */
export function isStandalone(): boolean {
  return (
    (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iOS Safari exposes `navigator.standalone` (true/false); other browsers don't. */
function isIOS(): boolean {
  return typeof (navigator as Navigator & { standalone?: boolean }).standalone === 'boolean'
}

/**
 * iOS: point the manifest at the spot on screen, so "Add to Home Screen" makes
 * an icon that opens that spot directly. The start URL carries the spot's
 * coordinates because each iOS home-screen app can have its own storage.
 * Other platforms keep the static manifest (install stays standard).
 */
export function applySpotManifest(spot: Spot | undefined): void {
  if (!spot || !isIOS() || isStandalone()) return
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) return
  const o = location.origin
  const manifest = {
    id: `/?spot=${encodeURIComponent(spot.slug)}`,
    name: `${spot.name} · Peakcast`,
    short_name: spot.name.length > 14 ? spot.name.slice(0, 13) + '…' : spot.name,
    start_url: shareUrl(spot, o),
    scope: `${o}/`,
    display: 'standalone',
    background_color: '#0d0d0d',
    theme_color: '#0d366b',
    icons: [
      { src: `${o}/pwa-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${o}/pwa-512.png`, sizes: '512x512', type: 'image/png' },
    ],
  }
  link.href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`
  const title = document.querySelector('meta[name="apple-mobile-web-app-title"]')
  title?.setAttribute('content', manifest.short_name)
}

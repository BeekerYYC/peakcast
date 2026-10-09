import { registerSW } from 'virtual:pwa-register'

/**
 * Register the service worker and keep the installed app current. iOS
 * home-screen apps rarely look for updates on their own, so check whenever the
 * app is opened or brought back to the foreground; with registerType
 * "autoUpdate" a newly installed version reloads the page automatically.
 */
export function setupServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void reg.update().catch(() => {})
      }
      check()
      document.addEventListener('visibilitychange', check)
      setInterval(check, 30 * 60 * 1000)
    },
  })
}

import { HORIZONS } from '../config/horizons'
import { VISIBLE_MODELS } from '../config/models'
import { usePrefs, type ThemePref } from '../state/prefs'
import { Sheet } from './Sheet'
import { useToast } from '../state/toast'

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  const toast = useToast((s) => s.show)

  const shareApp = async () => {
    const url = location.origin
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Peakcast', text: 'Mountain forecasts, models side by side', url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => {})
    toast('App link copied')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="flex flex-col gap-5 px-4 pb-6">
        <section>
          <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Appearance</h3>
          <div className="grid grid-cols-3 rounded-xl bg-surface-2 p-0.5 text-[13px] font-semibold">
            {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`h-8 rounded-[10px] capitalize ${theme === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Models</h3>
          <ul className="divide-y divide-hair rounded-xl bg-surface-2">
            {HORIZONS.map((h) =>
              VISIBLE_MODELS.filter((m) => m.horizon === h.id).map((m) => (
                <li key={m.id} className="flex items-start gap-2.5 px-3 py-2.5">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: `var(--m-${m.id})` }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-medium text-ink">{m.label}</span>
                      <span className="text-[11px] text-muted">{h.label} tab</span>
                    </span>
                    <span className="block text-[12px] leading-snug text-muted">
                      {m.resolution} · {m.coverage}
                      {m.freezingLevel.kind === 'none' ? ' · no freezing level' : ''}
                      {m.freezingLevel.kind === 'derived' || m.freezingLevel.kind === 'companion'
                        ? ' · freezing level derived'
                        : ''}
                      {m.unsupported.includes('wind_gusts_10m') ? ' · no gusts' : ''}
                    </span>
                  </span>
                </li>
              )),
            )}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Install & share</h3>
          <div className="rounded-xl bg-surface-2 px-3 py-3 text-[13px] leading-relaxed text-ink-2">
            <p>
              <b className="text-ink">Install:</b> in Safari tap Share → <i>Add to Home Screen</i>. To get
              a home-screen icon for a single spot, open that spot first, then add it.
            </p>
            <p className="mt-2">
              <b className="text-ink">Friends:</b> the share button on a spot sends a link that opens
              the forecast directly, and they can save it. Spots are stored on each device only.
            </p>
            <a
              href="/widget-install.html"
              className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-surface text-[14px] font-semibold text-ink shadow-[0_0_0_1px_var(--hair)]"
            >
              Set up home-screen widget
            </a>
            <button
              type="button"
              onClick={() => void shareApp()}
              className="mt-3 h-10 w-full rounded-xl bg-accent text-[14px] font-semibold text-accent-ink"
            >
              Share Peakcast
            </button>
          </div>
        </section>
      </div>
    </Sheet>
  )
}

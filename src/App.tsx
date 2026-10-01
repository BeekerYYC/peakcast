import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { Spot } from './config/spots'
import { Attribution } from './components/Attribution'
import { ForecastView } from './components/ForecastView'
import { HorizonTabs } from './components/HorizonTabs'
import { IconChevronDown, IconMap, IconRefresh, IconShare, IconSettings, IconWifiOff } from './components/Icons'
import { Sheet } from './components/Sheet'
import { SpotEditor } from './components/SpotEditor'
import { SpotPicker } from './components/SpotPicker'
import { Toaster } from './components/Toast'
import { useToast } from './state/toast'
import { prefetch, useForecast } from './hooks/useForecast'
import { useOnline } from './hooks/useOnline'
import { PULL_TRIGGER, usePullToRefresh } from './hooks/usePullToRefresh'
import { syncUrl } from './lib/deeplink'
import { ago } from './lib/format'
import { injectModelColors } from './lib/modelCss'
import { shareSpot } from './lib/share'
import { applySpotManifest } from './lib/pwa'
import { useResolvedTheme } from './lib/theme'
import { useScrub } from './state/scrub'
import { useSpots } from './state/spots'
import { SettingsSheet } from './components/SettingsSheet'

const MapPicker = lazy(() => import('./components/MapPicker'))

const SWIPE_PX = 60

export default function App() {
  useResolvedTheme()
  useEffect(injectModelColors, [])

  const spots = useSpots((s) => s.spots)
  const current = useSpots((s) => s.current)
  const temp = useSpots((s) => s.temp)
  const setCurrent = useSpots((s) => s.setCurrent)
  const setTemp = useSpots((s) => s.setTemp)
  const add = useSpots((s) => s.add)
  const toast = useToast((s) => s.show)

  const saved = spots.find((s) => s.slug === current) ?? spots[0]
  const spot: Spot | undefined = temp ?? saved
  const idx = temp ? -1 : spots.findIndex((s) => s.slug === saved?.slug)
  const [dir, setDir] = useState(0)

  const [picker, setPicker] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [settings, setSettings] = useState(false)

  const fc = useForecast(spot ?? null)
  const online = useOnline()
  const pull = usePullToRefresh(fc.refresh)
  const elevation = Object.values(fc.data)[0]?.series.elevation

  useEffect(() => {
    if (spot) syncUrl(spot)
    applySpotManifest(spot)
    document.title = spot ? `${spot.name} · Peakcast` : 'Peakcast'
  }, [spot, temp])

  // Warm neighbours so swiping is instant (and available offline).
  useEffect(() => {
    if (fc.loading || !spots.length || idx < 0) return
    const t = setTimeout(() => {
      for (const d of [1, -1]) {
        const n = spots[(idx + d + spots.length) % spots.length]
        if (n && n.slug !== saved?.slug) prefetch(n)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [idx, fc.loading, spots, saved?.slug])

  const go = useCallback(
    (delta: number) => {
      if (!spots.length) return
      const base = idx < 0 ? (delta > 0 ? -1 : 0) : idx
      const next = (base + delta + spots.length) % spots.length
      setDir(delta)
      setTemp(null)
      setCurrent(spots[next].slug)
      useScrub.getState().set(null)
    },
    [idx, spots, setCurrent, setTemp],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea')) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const onSwipe = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_PX && Math.abs(info.velocity.x) < 500) return
    go(info.offset.x < 0 ? 1 : -1)
  }

  const header = useMemo(
    () =>
      spot && (
        <span className="tnum truncate text-[13px] text-ink-2">
          {spot.region ? `${spot.region} · ` : ''}
          {elevation != null ? `${Math.round(elevation)} m` : ''}
          {spot.elevation != null ? ' (set)' : ''}
        </span>
      ),
    [spot, elevation],
  )

  if (!spot) return null
  const offline = !online || fc.error === 'Offline'

  return (
    <div className="pt-safe px-safe mx-auto min-h-full max-w-[640px] pb-[calc(env(safe-area-inset-bottom)+72px)]">
      {pull > 4 && (
        <div
          className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-20 flex justify-center"
          style={{ transform: `translateY(${pull - 28}px)` }}
        >
          <span
            className="flex size-8 items-center justify-center rounded-full bg-surface text-accent shadow-md"
            style={{ transform: `rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / PULL_TRIGGER) }}
          >
            <IconRefresh size={16} />
          </span>
        </div>
      )}
      <div className="flex flex-col gap-3 px-4">
        <motion.header
          className="flex touch-pan-y flex-col pt-2"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          dragSnapToOrigin
          onDragEnd={onSwipe}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPicker(true)}
              className="min-w-0 text-left"
              aria-label="Choose spot"
            >
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.h1
                  key={spot.slug + (temp ? ':t' : '')}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -40 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className={`flex items-center gap-1 font-bold tracking-tight text-ink ${
                    spot.name.length > 18 ? 'text-[22px] leading-7' : 'text-[28px] leading-9'
                  }`}
                >
                  <span className="truncate">{spot.name}</span>
                  <IconChevronDown size={18} className="mt-1 shrink-0 text-muted" />
                </motion.h1>
              </AnimatePresence>
            </button>
            <button
              type="button"
              onClick={() => void shareSpot(spot)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 shadow-[0_0_0_1px_var(--hair)] active:scale-95"
              aria-label="Share spot"
            >
              <IconShare size={17} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            {header}
            <button
              type="button"
              onClick={fc.refresh}
              className="flex shrink-0 items-center gap-1 py-1 text-[12px] text-muted active:opacity-60"
              aria-label="Refresh forecast"
            >
              {offline ? (
                <IconWifiOff size={13} className="text-warn" />
              ) : (
                <IconRefresh size={13} className={fc.loading ? 'animate-spin' : ''} />
              )}
              {fc.loading && !fc.fetchedAt ? 'Loading' : fc.fetchedAt ? ago(fc.fetchedAt) : fc.error ? 'Retry' : ''}
            </button>
          </div>
        </motion.header>

        {(offline || (fc.error && fc.fetchedAt)) && (
          <div className="flex items-center gap-2 rounded-xl bg-warn/12 px-3 py-2 text-[12.5px] text-ink">
            <IconWifiOff size={15} className="shrink-0 text-warn" />
            <span>
              {offline ? 'Offline. ' : 'Could not refresh. '}
              {fc.fetchedAt
                ? `Showing forecast fetched ${ago(fc.fetchedAt)} (${new Date(fc.fetchedAt).toLocaleString('en-CA', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}).`
                : 'No saved forecast for this spot yet.'}
            </span>
          </div>
        )}

        {temp && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-accent/10 px-3 py-2">
            <span className="text-[13px] text-ink">Shared spot, not in your list</span>
            <button
              type="button"
              onClick={() => {
                const s = add({ ...temp })
                setTemp(null)
                toast(`Saved ${s.name}`)
              }}
              className="rounded-full bg-accent px-3 py-1 text-[13px] font-semibold text-accent-ink active:scale-95"
            >
              Save spot
            </button>
          </div>
        )}

        <HorizonTabs />
        <motion.div
          key={spot.slug + (temp ? ':t' : '')}
          initial={{ opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        >
          <ForecastView
            spot={spot}
            data={fc.data}
            loading={fc.loading}
            error={fc.error}
            onRetry={fc.refresh}
          />
        </motion.div>
        <Attribution />
      </div>

      <BottomBar
        count={spots.length}
        index={idx}
        onMap={() => setMapOpen(true)}
        onList={() => setPicker(true)}
        onSettings={() => setSettings(true)}
        onSwipe={onSwipe}
      />

      <SpotPicker
        open={picker}
        onClose={() => setPicker(false)}
        onEdit={(slug) => {
          setPicker(false)
          setEditing(slug)
        }}
        onMap={() => {
          setPicker(false)
          setMapOpen(true)
        }}
      />
      <SpotEditor slug={editing} onClose={() => setEditing(null)} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      <Sheet open={mapOpen} onClose={() => setMapOpen(false)} tall>
        <div className="h-[calc(100dvh-max(env(safe-area-inset-top),12px)-22px)]">
          <Suspense fallback={<div className="p-6 text-center text-[13px] text-muted">Loading map…</div>}>
            <MapPicker
              center={{ lat: spot.lat, lon: spot.lon }}
              onClose={() => setMapOpen(false)}
              onPreview={(s) => {
                setMapOpen(false)
                setTemp({ ...s, slug: `pin-${s.lat.toFixed(3)}-${s.lon.toFixed(3)}` })
              }}
            />
          </Suspense>
        </div>
      </Sheet>
      <Toaster />
    </div>
  )
}

function BottomBar({
  count,
  index,
  onMap,
  onList,
  onSettings,
  onSwipe,
}: {
  count: number
  index: number
  onMap: () => void
  onList: () => void
  onSettings: () => void
  onSwipe: (e: unknown, info: PanInfo) => void
}) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-hair bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-[640px] items-center justify-between px-3">
        <button type="button" onClick={onMap} className="flex size-11 items-center justify-center text-ink-2 active:opacity-50" aria-label="Drop a pin on the map">
          <IconMap size={22} />
        </button>
        <motion.button
          type="button"
          onClick={onList}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          dragSnapToOrigin
          onDragEnd={onSwipe}
          className="flex h-11 min-w-[120px] touch-pan-y items-center justify-center gap-1.5 px-4"
          aria-label="Spots"
        >
          {index < 0 && <span className="size-[7px] rounded-full bg-accent" />}
          {Array.from({ length: Math.min(count, 12) }, (_, i) => (
            <motion.span
              key={i}
              layout
              className={`rounded-full ${i === index ? 'h-[7px] w-4 bg-ink' : 'size-[7px] bg-surface-3'}`}
            />
          ))}
        </motion.button>
        <button type="button" onClick={onSettings} className="flex size-11 items-center justify-center text-ink-2 active:opacity-50" aria-label="Settings">
          <IconSettings size={22} />
        </button>
      </div>
    </nav>
  )
}

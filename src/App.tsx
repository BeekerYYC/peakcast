import { useEffect } from 'react'
import { Attribution } from './components/Attribution'
import { ForecastView } from './components/ForecastView'
import { HorizonTabs } from './components/HorizonTabs'
import { IconRefresh } from './components/Icons'
import { useForecast } from './hooks/useForecast'
import { ago } from './lib/format'
import { injectModelColors } from './lib/modelCss'
import { useResolvedTheme } from './lib/theme'
import { useSpots } from './state/spots'

export default function App() {
  useResolvedTheme()
  useEffect(injectModelColors, [])
  const spots = useSpots((s) => s.spots)
  const current = useSpots((s) => s.current)
  const spot = spots.find((s) => s.slug === current) ?? spots[0]
  const fc = useForecast(spot ?? null)
  const elevation = Object.values(fc.data)[0]?.series.elevation

  if (!spot) return null
  return (
    <div className="pt-safe pb-safe px-safe mx-auto min-h-full max-w-[640px]">
      <div className="flex flex-col gap-3 px-4">
        <header className="flex items-end justify-between gap-3 pt-2">
          <div className="min-w-0">
            <h1 className="truncate text-[26px] leading-8 font-bold tracking-tight text-ink">{spot.name}</h1>
            <p className="tnum truncate text-[13px] text-ink-2">
              {spot.region ? `${spot.region} · ` : ''}
              {elevation != null ? `${Math.round(elevation)} m` : ''}
              {spot.elevation != null ? ' (set)' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={fc.refresh}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-ink-2 shadow-[0_0_0_1px_var(--hair)] active:scale-95"
            aria-label="Refresh forecast"
          >
            <IconRefresh size={14} className={fc.loading ? 'animate-spin' : ''} />
            {fc.error ? (
              <span className="text-warn">{fc.error}</span>
            ) : fc.fetchedAt ? (
              ago(fc.fetchedAt)
            ) : (
              'Loading'
            )}
          </button>
        </header>
        <HorizonTabs />
        <ForecastView spot={spot} data={fc.data} loading={fc.loading} />
        <Attribution />
      </div>
    </div>
  )
}

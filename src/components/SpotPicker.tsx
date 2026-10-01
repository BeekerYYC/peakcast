import { Reorder, useDragControls } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Spot } from '../config/spots'
import { searchPlaces, type Place } from '../data/geocode'
import { useSpots } from '../state/spots'
import { IconCheck, IconEdit, IconGrip, IconLocate, IconMap, IconSearch } from './Icons'
import { Sheet } from './Sheet'
import { useToast } from './Toast'

interface Props {
  open: boolean
  onClose: () => void
  onEdit: (slug: string) => void
  onMap: () => void
}

function Row({ spot, onEdit, onPick }: { spot: Spot; onEdit: () => void; onPick: () => void }) {
  const controls = useDragControls()
  const current = useSpots((s) => s.current === spot.slug && !s.temp)
  return (
    <Reorder.Item
      value={spot}
      dragListener={false}
      dragControls={controls}
      className="relative flex items-center gap-1 bg-surface"
      whileDrag={{ scale: 1.02, boxShadow: '0 8px 30px rgba(0,0,0,0.18)', zIndex: 10 }}
    >
      <span
        className="flex h-12 w-10 shrink-0 touch-none items-center justify-center text-muted"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Reorder"
      >
        <IconGrip size={18} />
      </span>
      <button type="button" onClick={onPick} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-ink">{spot.name}</span>
          <span className="tnum block truncate text-[12px] text-muted">
            {[spot.region, spot.elevation != null ? `${spot.elevation} m set` : null]
              .filter(Boolean)
              .join(' · ') || `${spot.lat.toFixed(3)}, ${spot.lon.toFixed(3)}`}
          </span>
        </span>
        {current && <IconCheck size={18} className="shrink-0 text-accent" />}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="flex size-11 shrink-0 items-center justify-center text-ink-2 active:opacity-50"
        aria-label={`Edit ${spot.name}`}
      >
        <IconEdit size={17} />
      </button>
    </Reorder.Item>
  )
}

export function SpotPicker({ open, onClose, onEdit, onMap }: Props) {
  const spots = useSpots((s) => s.spots)
  const setCurrent = useSpots((s) => s.setCurrent)
  const setTemp = useSpots((s) => s.setTemp)
  const add = useSpots((s) => s.add)
  const toast = useToast((s) => s.show)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) {
      setQ('')
      setResults([])
    }
  }, [open])

  useEffect(() => {
    abort.current?.abort()
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    const ac = new AbortController()
    abort.current = ac
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await searchPlaces(q, ac.signal))
      } catch {
        /* aborted or offline */
      } finally {
        if (!ac.signal.aborted) setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const pick = (slug: string) => {
    setTemp(null)
    setCurrent(slug)
    onClose()
  }

  const addPlace = (p: Place) => {
    add({ name: p.name, lat: p.lat, lon: p.lon, region: p.region })
    setTemp(null)
    toast(`Saved ${p.name}`)
    onClose()
  }

  const locate = () => {
    if (!navigator.geolocation) return toast('Location not available')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const lat = Math.round(pos.coords.latitude * 1e5) / 1e5
        const lon = Math.round(pos.coords.longitude * 1e5) / 1e5
        const s = add({ name: 'My location', lat, lon, region: `${lat.toFixed(3)}, ${lon.toFixed(3)}` })
        setTemp(null)
        onClose()
        onEdit(s.slug)
      },
      (err) => {
        setLocating(false)
        toast(err.code === 1 ? 'Location permission denied' : 'Could not get location')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Spots">
      <div className="px-4 pb-2">
        <label className="flex items-center gap-2 rounded-xl bg-surface-2 px-3">
          <IconSearch size={17} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a place to add"
            className="h-10 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
            enterKeyHint="search"
            autoCorrect="off"
          />
          {searching && <span className="size-3 animate-spin rounded-full border-2 border-muted border-t-transparent" />}
        </label>
      </div>

      {results.length > 0 ? (
        <ul className="px-2 pb-3">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => addPlace(p)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 text-left active:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-ink">{p.name}</span>
                  <span className="block truncate text-[12px] text-muted">{p.region}</span>
                </span>
                {p.elevation != null && (
                  <span className="tnum shrink-0 text-[12px] text-muted">{Math.round(p.elevation)} m</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 px-4 pb-3">
            <button
              type="button"
              onClick={locate}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-2 text-[14px] font-medium text-ink active:scale-[0.98]"
            >
              <IconLocate size={17} className={locating ? 'animate-pulse text-accent' : 'text-accent'} />
              {locating ? 'Locating…' : 'Current location'}
            </button>
            <button
              type="button"
              onClick={onMap}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-2 text-[14px] font-medium text-ink active:scale-[0.98]"
            >
              <IconMap size={17} className="text-accent" />
              Drop a pin
            </button>
          </div>
          <Reorder.Group
            axis="y"
            values={spots}
            onReorder={(next) => useSpots.setState({ spots: next })}
            className="divide-y divide-hair border-y border-hair"
          >
            {spots.map((s) => (
              <Row key={s.slug} spot={s} onPick={() => pick(s.slug)} onEdit={() => onEdit(s.slug)} />
            ))}
          </Reorder.Group>
          <p className="px-4 pt-3 pb-4 text-[12px] leading-relaxed text-muted">
            Swipe the spot name left or right to switch. Each spot has its own link (Share → Add
            to Home Screen) so you can open it in one tap.
          </p>
        </>
      )}
    </Sheet>
  )
}

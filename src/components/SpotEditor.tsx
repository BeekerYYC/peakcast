import { useEffect, useState } from 'react'
import { fetchElevation } from '../data/elevation'
import { shareSpot } from '../lib/share'
import { useSpots } from '../state/spots'
import { IconShare, IconTrash } from './Icons'
import { Sheet } from './Sheet'

interface Props {
  slug: string | null
  onClose: () => void
}

export function SpotEditor({ slug, onClose }: Props) {
  const spot = useSpots((s) => s.spots.find((x) => x.slug === slug))
  const update = useSpots((s) => s.update)
  const remove = useSpots((s) => s.remove)
  const count = useSpots((s) => s.spots.length)
  const [name, setName] = useState('')
  const [elev, setElev] = useState('')
  const [terrain, setTerrain] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!spot) return
    setName(spot.name)
    setElev(spot.elevation != null ? String(spot.elevation) : '')
    setConfirm(false)
    setTerrain(null)
    void fetchElevation(spot.lat, spot.lon).then(setTerrain)
    // Only when a different spot is opened.
  }, [slug]) // eslint-disable-line

  const save = () => {
    if (!spot) return onClose()
    const e = elev.trim() === '' ? undefined : Number(elev)
    update(spot.slug, {
      name: name.trim() || spot.name,
      elevation: e != null && Number.isFinite(e) && e > -500 && e < 9000 ? Math.round(e) : undefined,
    })
    onClose()
  }

  return (
    <Sheet
      open={!!spot}
      onClose={save}
      title="Edit spot"
      action={
        <button type="button" onClick={save} className="text-[16px] font-semibold text-accent">
          Done
        </button>
      }
    >
      {spot && (
        <div className="flex flex-col gap-4 px-4 pb-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-2">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl bg-surface-2 px-3 text-[16px] text-ink outline-none"
              maxLength={60}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-2">Elevation override (m)</span>
            <div className="flex gap-2">
              <input
                value={elev}
                onChange={(e) => setElev(e.target.value.replace(/[^\d-]/g, ''))}
                inputMode="numeric"
                placeholder={terrain != null ? `Auto · terrain ${terrain} m` : 'Auto (terrain)'}
                className="tnum h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3 text-[16px] text-ink outline-none placeholder:text-muted"
              />
              {elev !== '' && (
                <button
                  type="button"
                  onClick={() => setElev('')}
                  className="rounded-xl px-3 text-[14px] font-medium text-accent"
                >
                  Auto
                </button>
              )}
            </div>
            <span className="text-[12px] leading-snug text-muted">
              Set a summit or trailhead height. Temperatures are downscaled to it, and the
              freezing-level chart marks it.
            </span>
          </label>
          <div className="tnum text-[12px] text-muted">
            {spot.lat.toFixed(5)}, {spot.lon.toFixed(5)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void shareSpot({ ...spot, name: name.trim() || spot.name })}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-surface-2 text-[14px] font-medium text-ink"
            >
              <IconShare size={17} className="text-accent" /> Share
            </button>
            <button
              type="button"
              disabled={count <= 1}
              onClick={() => {
                if (!confirm) return setConfirm(true)
                remove(spot.slug)
                onClose()
              }}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-medium disabled:opacity-40 ${
                confirm ? 'bg-danger text-white' : 'bg-surface-2 text-danger'
              }`}
            >
              <IconTrash size={17} /> {confirm ? 'Tap to delete' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

import * as maplibregl from 'maplibre-gl'
import type { MapMouseEvent, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef, useState } from 'react'
import type { Spot } from '../config/spots'
import { fetchElevation } from '../data/elevation'
import { useSpots } from '../state/spots'
import { IconClose, IconMountain, IconPin } from './Icons'
import { useToast } from './Toast'

maplibregl.setWorkerUrl(workerUrl)

const STREETS = 'https://tiles.openfreemap.org/styles/liberty'
const TOPO: StyleSpecification = {
  version: 8,
  sources: {
    otm: {
      type: 'raster',
      tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
      tileSize: 256,
      maxzoom: 17,
      attribution:
        'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM · Style © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    },
  },
  layers: [{ id: 'otm', type: 'raster', source: 'otm' }],
}

interface Props {
  center: { lat: number; lon: number }
  onClose: () => void
  onPreview: (s: Spot) => void
}

interface Pin {
  lat: number
  lon: number
  elevation: number | null
}

export default function MapPicker({ center, onClose, onPreview }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  const spots = useSpots((s) => s.spots)
  const add = useSpots((s) => s.add)
  const toast = useToast((s) => s.show)
  const [topo, setTopo] = useState(true)
  const [pin, setPin] = useState<Pin | null>(null)
  const [name, setName] = useState('')

  const drop = (lat: number, lon: number) => {
    const m = map.current
    if (!m) return
    lat = Math.round(lat * 1e5) / 1e5
    lon = Math.round(lon * 1e5) / 1e5
    if (!marker.current) {
      const el = document.createElement('div')
      el.className = 'peak-pin'
      marker.current = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' })
      marker.current.on('dragend', () => {
        const p = marker.current!.getLngLat()
        drop(p.lat, p.lng)
      })
    }
    marker.current.setLngLat([lon, lat]).addTo(m)
    setPin({ lat, lon, elevation: null })
    setName((n) => n || '')
    void fetchElevation(lat, lon).then((elevation) =>
      setPin((p) => (p && p.lat === lat && p.lon === lon ? { ...p, elevation } : p)),
    )
  }

  useEffect(() => {
    if (!host.current) return
    const m = new maplibregl.Map({
      container: host.current,
      style: TOPO,
      center: [center.lon, center.lat],
      zoom: 10,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    m.touchZoomRotate.disableRotation()
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right')
    // Start collapsed; tap (i) to expand.
    m.once('load', () =>
      host.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'),
    )
    map.current = m
    for (const s of spots) {
      const el = document.createElement('div')
      el.className = 'peak-dot'
      el.title = s.name
      new maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(m)
    }

    // Long-press to drop a pin (touch), right-click on desktop.
    let timer: ReturnType<typeof setTimeout> | undefined
    let start: { x: number; y: number } | null = null
    const canvas = m.getCanvasContainer()
    const clear = () => {
      clearTimeout(timer)
      start = null
    }
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return clear()
      const t = e.touches[0]
      const r = canvas.getBoundingClientRect()
      start = { x: t.clientX - r.left, y: t.clientY - r.top }
      timer = setTimeout(() => {
        if (!start) return
        const ll = m.unproject([start.x, start.y])
        navigator.vibrate?.(15)
        drop(ll.lat, ll.lng)
        clear()
      }, 500)
    }
    const onMove = (e: TouchEvent) => {
      if (!start) return
      const t = e.touches[0]
      const r = canvas.getBoundingClientRect()
      if (Math.hypot(t.clientX - r.left - start.x, t.clientY - r.top - start.y) > 8) clear()
    }
    canvas.addEventListener('touchstart', onStart, { passive: true })
    canvas.addEventListener('touchmove', onMove, { passive: true })
    canvas.addEventListener('touchend', clear)
    canvas.addEventListener('touchcancel', clear)
    m.on('contextmenu', (e: MapMouseEvent) => drop(e.lngLat.lat, e.lngLat.lng))
    m.on('movestart', () => clearTimeout(timer))

    return () => {
      clear()
      marker.current = null
      m.remove()
      map.current = null
    }
    // Map is created once per open.
  }, []) // eslint-disable-line

  useEffect(() => {
    map.current?.setStyle(topo ? TOPO : STREETS)
  }, [topo])

  const spotFromPin = (): Spot | null =>
    pin
      ? {
          slug: '',
          name: name.trim() || `Pin ${pin.lat.toFixed(3)}, ${pin.lon.toFixed(3)}`,
          lat: pin.lat,
          lon: pin.lon,
          region: pin.elevation != null ? `${pin.elevation} m terrain` : undefined,
        }
      : null

  return (
    <div className="relative flex h-full flex-col">
      <div ref={host} className="min-h-0 flex-1 overflow-hidden rounded-t-[22px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-surface/90 text-ink shadow-md backdrop-blur"
          aria-label="Close map"
        >
          <IconClose size={18} />
        </button>
        <div className="pointer-events-auto flex rounded-full bg-surface/90 p-0.5 text-[12px] font-semibold shadow-md backdrop-blur">
          {[
            ['Topo', true],
            ['Streets', false],
          ].map(([label, v]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => setTopo(v as boolean)}
              className={`rounded-full px-3 py-1.5 ${topo === v ? 'bg-ink text-bg' : 'text-ink-2'}`}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-safe absolute inset-x-0 bottom-0 p-3">
        {pin ? (
          <div className="rounded-2xl bg-surface p-3 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
            <div className="flex items-center gap-2">
              <IconPin size={18} className="shrink-0 text-accent" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this spot"
                className="h-9 min-w-0 flex-1 bg-transparent text-[16px] font-medium text-ink outline-none placeholder:text-muted"
                maxLength={60}
              />
            </div>
            <div className="tnum mt-0.5 flex items-center gap-1.5 pl-[26px] text-[12px] text-muted">
              {pin.lat.toFixed(4)}, {pin.lon.toFixed(4)}
              <IconMountain size={13} />
              {pin.elevation != null ? `${pin.elevation} m` : '…'}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const s = spotFromPin()
                  if (s) onPreview(s)
                }}
                className="h-11 rounded-xl bg-surface-2 text-[14px] font-semibold text-ink"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = spotFromPin()
                  if (!s) return
                  add({ name: s.name, lat: s.lat, lon: s.lon, region: s.region })
                  useSpots.getState().setTemp(null)
                  toast(`Saved ${s.name}`)
                  onClose()
                }}
                className="h-11 rounded-xl bg-accent text-[14px] font-semibold text-accent-ink"
              >
                Save spot
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-fit rounded-full bg-surface/95 px-4 py-2 text-[13px] font-medium text-ink shadow-md backdrop-blur">
            Long-press the map to drop a pin
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { isStandalone } from '../lib/pwa'

const TRIGGER = 72

/**
 * Pull-down-to-refresh for the installed app (iOS gives standalone web apps
 * none). Returns the current pull distance for the indicator.
 */
export function usePullToRefresh(onRefresh: () => void): number {
  const [pull, setPull] = useState(0)
  useEffect(() => {
    if (!isStandalone()) return
    let startY: number | null = null
    let dist = 0
    const start = (e: TouchEvent) => {
      const sheetOpen = document.body.style.overflow === 'hidden'
      startY = window.scrollY <= 0 && !sheetOpen && e.touches.length === 1 ? e.touches[0].clientY : null
      dist = 0
    }
    const move = (e: TouchEvent) => {
      if (startY == null) return
      dist = Math.max(0, e.touches[0].clientY - startY)
      setPull(Math.min(110, dist * 0.55))
    }
    const end = () => {
      if (startY != null && dist * 0.55 >= TRIGGER) onRefresh()
      startY = null
      dist = 0
      setPull(0)
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', end)
    return () => {
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
    }
  }, [onRefresh])
  return pull
}

export const PULL_TRIGGER = TRIGGER

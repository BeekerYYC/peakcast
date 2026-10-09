import { useEffect, useState } from 'react'
import type { ModelDef } from '../config/models'
import { usePrefs } from '../state/prefs'

export type Resolved = 'light' | 'dark'

/** Chart chrome from the dataviz reference palette. */
export const CHROME = {
  light: {
    surface: '#fcfcfb',
    ink: '#0b0b0b',
    ink2: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    night: 'rgba(30, 40, 80, 0.045)',
    zero: '#2a78d6',
    warn: '#d97706',
  },
  dark: {
    surface: '#1a1a19',
    ink: '#ffffff',
    ink2: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    night: 'rgba(0, 0, 0, 0.28)',
    zero: '#3987e5',
    warn: '#f59e0b',
  },
} as const

export type Chrome = (typeof CHROME)[Resolved]

/** Rain and snow colours shared by the precip charts. */
export const RAIN = { light: '#2a78d6', dark: '#3987e5' } as const
export const SNOW = { light: '#8f8d86', dark: '#d6d4cc' } as const

function systemDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

/** Resolved theme (system preference unless overridden in prefs). */
export function useResolvedTheme(): Resolved {
  const pref = usePrefs((s) => s.theme)
  const [sys, setSys] = useState(systemDark)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSys(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const resolved: Resolved = pref === 'system' ? (sys ? 'dark' : 'light') : pref
  useEffect(() => {
    const el = document.documentElement
    if (pref === 'system') el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', pref)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#0d0d0d' : '#f9f9f7')
  }, [pref, resolved])
  return resolved
}

export function modelColor(m: ModelDef, t: Resolved): string {
  return m.color[t]
}

/** Hex colour with alpha. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

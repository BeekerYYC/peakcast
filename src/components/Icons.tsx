import type { SVGProps } from 'react'
import type { WxIcon } from '../lib/wmo'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)
export const IconShare = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
    <path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
  </Svg>
)
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
)
export const IconLocate = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </Svg>
)
export const IconMap = (p: P) => (
  <Svg {...p}>
    <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
    <path d="M9 4v14M15 6v14" />
  </Svg>
)
export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 3.5V8h4.5" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 20.5V16h-4.5" />
  </Svg>
)
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
    <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
  </Svg>
)
export const IconGrip = (p: P) => (
  <Svg {...p}>
    <path d="M5 9h14M5 15h14" />
  </Svg>
)
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
)
export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
)
export const IconMountain = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 19.5 9 8l4 7 2.5-4 6 8.5Z" />
    <path d="m7.2 11.2 1.8 1.3 1.6-1.4" />
  </Svg>
)
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
)
export const IconEdit = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
  </Svg>
)
export const IconWifiOff = (p: P) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14 10.3A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.4-2.8M11 6a15 15 0 0 1 11 3.5" />
    <circle cx="12" cy="20" r="0.6" fill="currentColor" />
  </Svg>
)

/** Weather glyphs: two-tone, ink stroke with soft fills. */
export function WxGlyph({ icon, size = 26 }: { icon: WxIcon; size?: number }) {
  const sun = (
    <g stroke="#eda100" fill="#eda100" fillOpacity={0.25}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3" fill="none" />
    </g>
  )
  const cloud = (dx = 0, dy = 0) => (
    <path
      transform={`translate(${dx} ${dy})`}
      d="M7.5 18.5h9a3.75 3.75 0 0 0 .4-7.48A5.25 5.25 0 0 0 6.9 12 3.25 3.25 0 0 0 7.5 18.5Z"
      className="fill-surface-3"
      stroke="currentColor"
    />
  )
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-ink-2" aria-hidden="true">
      {icon === 'clear' && sun}
      {icon === 'partly' && (
        <>
          <g transform="translate(-3 -3) scale(0.85)">{sun}</g>
          {cloud(1.5, 1)}
        </>
      )}
      {icon === 'cloudy' && cloud(0, -1)}
      {icon === 'fog' && (
        <>
          {cloud(0, -3)}
          <path d="M5 19.5h14M7 22h10" stroke="currentColor" />
        </>
      )}
      {(icon === 'rain' || icon === 'drizzle') && (
        <>
          {cloud(0, -4)}
          <path d={icon === 'rain' ? 'M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3' : 'M9 17.5v1M13 17.5v1M17 17.5v1'} stroke="#2a78d6" />
        </>
      )}
      {icon === 'snow' && (
        <>
          {cloud(0, -4)}
          <g fill="#7fb2ee" stroke="none">
            <circle cx="8.5" cy="18.5" r="1.1" />
            <circle cx="12.5" cy="20.5" r="1.1" />
            <circle cx="16.5" cy="18.5" r="1.1" />
          </g>
        </>
      )}
      {icon === 'mixed' && (
        <>
          {cloud(0, -4)}
          <path d="M8.5 17l-1 3M16.5 17l-1 3" stroke="#2a78d6" />
          <circle cx="12.5" cy="19.5" r="1.1" fill="#7fb2ee" stroke="none" />
        </>
      )}
      {icon === 'thunder' && (
        <>
          {cloud(0, -4)}
          <path d="m12.5 15.5-2 3.5h3l-2 3.5" stroke="#eda100" />
        </>
      )}
    </svg>
  )
}

import { useEffect, useState } from 'react'

/** A phone turned sideways (short landscape viewport), not a desktop window. */
const QUERY = '(orientation: landscape) and (max-height: 520px)'

function read() {
  const on = typeof matchMedia !== 'undefined' && matchMedia(QUERY).matches
  return { landscape: on, height: typeof innerHeight === 'number' ? innerHeight : 390 }
}

/** Whether the phone is in landscape, plus the viewport height to size charts. */
export function useLandscape(): { landscape: boolean; height: number } {
  const [s, setS] = useState(read)
  useEffect(() => {
    const mq = matchMedia(QUERY)
    const on = () => setS(read())
    mq.addEventListener('change', on)
    addEventListener('resize', on)
    return () => {
      mq.removeEventListener('change', on)
      removeEventListener('resize', on)
    }
  }, [])
  return s
}

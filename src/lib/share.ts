import type { Spot } from '../config/spots'
import { useToast } from '../components/Toast'
import { shareUrl } from './deeplink'

/** iOS share sheet when available, otherwise copy the link. */
export async function shareSpot(s: Spot): Promise<void> {
  const url = shareUrl(s)
  const text = `${s.name} forecast on Peakcast`
  if (navigator.share) {
    try {
      await navigator.share({ title: s.name, text, url })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    useToast.getState().show('Link copied')
  } catch {
    window.prompt('Copy this link', url)
  }
}

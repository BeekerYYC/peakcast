import { Reorder, useDragControls } from 'motion/react'
import { createPortal } from 'react-dom'
import { CARDS, orderedCards } from './charts/chartDefs'
import { usePrefs } from '../state/prefs'
import { IconGrip } from './Icons'
import { Sheet } from './Sheet'
import { SpreadToggle } from './ScrubBar'

const TITLE = Object.fromEntries(CARDS.map((c) => [c.id, c.title]))

function Row({ id }: { id: string }) {
  const controls = useDragControls()
  const hidden = usePrefs((s) => !!s.chartHidden[id])
  const toggle = usePrefs((s) => s.toggleChartHidden)
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className="relative flex items-center gap-1 bg-surface-2"
      whileDrag={{ scale: 1.02, boxShadow: '0 8px 30px rgba(0,0,0,0.18)', zIndex: 10 }}
    >
      <span
        className="flex h-12 w-10 shrink-0 touch-none items-center justify-center text-muted"
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Reorder ${TITLE[id]}`}
      >
        <IconGrip size={18} />
      </span>
      <span className={`min-w-0 flex-1 truncate text-[15px] ${hidden ? 'text-muted' : 'font-medium text-ink'}`}>
        {TITLE[id]}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!hidden}
        aria-label={`Show ${TITLE[id]}`}
        onClick={() => toggle(id)}
        className={`relative mr-3 h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${hidden ? 'bg-surface-3' : 'bg-accent'}`}
      >
        <span
          className={`absolute top-[3px] size-5 rounded-full bg-white shadow transition-[left] ${hidden ? 'left-[3px]' : 'left-[21px]'}`}
        />
      </button>
    </Reorder.Item>
  )
}

/** Reorder and show/hide chart cards. */
export function ChartsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saved = usePrefs((s) => s.chartOrder)
  const setOrder = usePrefs((s) => s.setChartOrder)
  const order = orderedCards(saved)
  // Portal: it is opened from inside the forecast view, whose swipe transform
  // would otherwise put it under the bottom bar.
  return createPortal(
    <Sheet
      open={open}
      onClose={onClose}
      title="Charts"
      action={
        <button type="button" onClick={onClose} className="text-[15px] font-semibold text-accent">
          Done
        </button>
      }
    >
      <div className="flex flex-col gap-4 px-4 pb-6">
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={setOrder}
          className="divide-y divide-hair overflow-hidden rounded-xl bg-surface-2"
        >
          {order.map((id) => (
            <Row key={id} id={id} />
          ))}
        </Reorder.Group>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
          <span className="text-[13px] leading-snug text-ink-2">
            <b className="text-ink">Spread</b> shades the range between the models and draws their mean, instead of one
            line per model.
          </span>
          <SpreadToggle />
        </div>
        <p className="text-[12px] leading-relaxed text-muted">
          Drag the handle to reorder. Tap a chart title to fold it. Tap a day card to zoom every chart to that day.
          Turn your phone sideways for a full-screen chart.
        </p>
        <button
          type="button"
          onClick={() => usePrefs.setState({ chartOrder: [], chartHidden: {}, chartCollapsed: {} })}
          className="self-center text-[13px] font-medium text-accent active:opacity-60"
        >
          Reset to default
        </button>
      </div>
    </Sheet>,
    document.body,
  )
}

import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Right side of the header (e.g. "Done"). */
  action?: ReactNode
  children: ReactNode
  /** Full-height sheet (map). */
  tall?: boolean
}

/** iOS-style bottom sheet: spring in, drag the grabber down to dismiss. */
export function Sheet({ open, onClose, title, action, children, tall }: Props) {
  const controls = useDragControls()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-[640px] flex-col rounded-t-[22px] bg-surface shadow-[0_-8px_40px_rgba(0,0,0,0.25)] ${
              tall ? 'top-[max(env(safe-area-inset-top),12px)]' : 'max-h-[88dvh]'
            }`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2"
              onPointerDown={(e) => controls.start(e)}
            >
              <span className="h-1.5 w-10 rounded-full bg-surface-3" />
              {(title || action) && (
                <div className="flex w-full items-center justify-between gap-3 px-4 pt-2 pb-2">
                  <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
                  {action}
                </div>
              )}
            </div>
            <div className="pb-safe min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

import { AnimatePresence, motion } from 'motion/react'
import { useToast } from '../state/toast'

export function Toaster() {
  const { msg, id } = useToast()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 flex justify-center px-4">
      <AnimatePresence>
        {msg && (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg shadow-lg"
            role="status"
          >
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

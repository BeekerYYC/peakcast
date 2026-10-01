import { create } from 'zustand'

interface ToastState {
  msg: string | null
  id: number
  show: (msg: string) => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useToast = create<ToastState>()((set) => ({
  msg: null,
  id: 0,
  show: (msg) => {
    clearTimeout(timer)
    set((s) => ({ msg, id: s.id + 1 }))
    timer = setTimeout(() => set({ msg: null }), 2600)
  },
}))

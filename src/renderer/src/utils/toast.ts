export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
  duration: number
}

type Listener = (toasts: ToastItem[]) => void

let _id = 0
let _toasts: ToastItem[] = []
const _listeners = new Set<Listener>()

function notify() {
  _listeners.forEach((l) => l([..._toasts]))
}

export const toast = {
  show(message: string, type: ToastType = 'info', duration = 3000) {
    const item: ToastItem = { id: _id++, message, type, duration }
    _toasts = [..._toasts, item]
    notify()
    setTimeout(() => {
      _toasts = _toasts.filter((t) => t.id !== item.id)
      notify()
    }, duration)
    return item.id
  },
  success: (msg: string, duration?: number) => toast.show(msg, 'success', duration),
  error: (msg: string, duration?: number) => toast.show(msg, 'error', duration ?? 4000),
  warning: (msg: string, duration?: number) => toast.show(msg, 'warning', duration),
  info: (msg: string, duration?: number) => toast.show(msg, 'info', duration),
  dismiss: (id: number) => {
    _toasts = _toasts.filter((t) => t.id !== id)
    notify()
  },
  subscribe: (listener: Listener) => {
    _listeners.add(listener)
    listener([..._toasts])
    return () => _listeners.delete(listener)
  }
}

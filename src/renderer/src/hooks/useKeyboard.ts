import { useEffect } from 'react'

type ModKey = 'ctrl' | 'shift' | 'alt' | 'meta'

interface Shortcut {
  key: string
  mods?: ModKey[]
  handler: (e: KeyboardEvent) => void
  description?: string
}

export function useKeyboard(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const mods = shortcut.mods ?? []
        const ctrlOk = mods.includes('ctrl') ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
        const shiftOk = mods.includes('shift') ? e.shiftKey : !e.shiftKey
        const altOk = mods.includes('alt') ? e.altKey : !e.altKey

        if (ctrlOk && shiftOk && altOk && e.key.toLowerCase() === shortcut.key.toLowerCase()) {
          e.preventDefault()
          shortcut.handler(e)
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}

export function useGlobalKey(key: string, mods: ModKey[], handler: () => void) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const ctrlOk = mods.includes('ctrl') ? (e.ctrlKey || e.metaKey) : true
      const shiftOk = mods.includes('shift') ? e.shiftKey : true
      if (ctrlOk && shiftOk && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        handler()
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [key, handler])
}

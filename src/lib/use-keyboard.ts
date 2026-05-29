import { useEffect } from 'react'

type KeyCombo = {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
}

export function useKeyboard(combo: KeyCombo, handler: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === combo.key.toLowerCase() &&
        !!e.ctrlKey === !!combo.ctrl &&
        !!e.metaKey === !!combo.meta &&
        !!e.shiftKey === !!combo.shift &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        handler()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [combo.key, combo.ctrl, combo.meta, combo.shift, handler])
}

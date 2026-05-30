import { useCallback, useEffect } from 'react'
import { useUiStore } from '../stores/ui-store'
import type { ThemeMode } from '../types'

export function useTheme() {
  const storeTheme = useUiStore((s) => s.theme)
  const setStoreTheme = useUiStore((s) => s.setTheme)

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setStoreTheme(newTheme)
  }, [setStoreTheme])

  useEffect(() => {
    applyTheme(storeTheme)
  }, [storeTheme])

  useEffect(() => {
    if (storeTheme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [storeTheme])

  const resolvedTheme = (() => {
    if (storeTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return storeTheme
  })()

  return { theme: storeTheme, setTheme, resolvedTheme }
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  root.classList.toggle('dark', isDark)
  root.classList.toggle('light', !isDark)
}

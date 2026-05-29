import { useCallback, useEffect, useState } from 'react'
import type { ThemeMode } from '../types'

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('inkview-theme') as ThemeMode) || 'system'
  })

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme)
    localStorage.setItem('inkview-theme', newTheme)
    applyTheme(newTheme)
  }, [])

  const resolvedTheme = (() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  })()

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyTheme(theme)
    }
    mq.addEventListener('change', handler)
    applyTheme(theme)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return { theme, setTheme, resolvedTheme }
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', isDark)
  root.classList.toggle('light', !isDark)
}

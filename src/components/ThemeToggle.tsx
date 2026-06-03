import { useTheme } from '../lib/use-theme'
import { SunIcon, MoonIcon } from './CustomIcons'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      className="rounded-lg p-2 sm:p-2.5 text-ink-soft hover:text-accent hover:bg-accent-bg transition-colors"
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '../lib/use-theme'
import type { ThemeMode } from '../types'

const options: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'system', icon: Monitor, label: 'System' },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-alt p-0.5">
      {options.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          title={label}
          className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
            theme === mode
              ? 'bg-accent text-white shadow-xs'
              : 'text-ink-soft hover:text-ink hover:bg-surface'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}

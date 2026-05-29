import { useCallback, useRef, useState } from 'react'
import { BookOpen, Columns2, Clock, Eye, FileEdit, List, Plus } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import type { EditorMode } from '../types'

interface NavBarProps {
  title: string
  showContent?: boolean
  editorMode: EditorMode
  onEditorModeChange: (mode: EditorMode) => void
  onTitleChange?: (title: string) => void
  tocOpen?: boolean
  onTocToggle?: () => void
  onNewDoc?: () => void
  onHistory?: () => void
  variant?: 'main' | 'fullscreen'
  onCloseFullscreen?: () => void
}

const editorModes: { mode: EditorMode; icon: typeof FileEdit; label: string }[] = [
  { mode: 'edit', icon: FileEdit, label: 'Edit' },
  { mode: 'split', icon: Columns2, label: 'Split' },
  { mode: 'preview', icon: Eye, label: 'Preview' },
]

export function NavBar({
  title,
  showContent,
  editorMode,
  onEditorModeChange,
  onTitleChange,
  tocOpen,
  onTocToggle,
  onNewDoc,
  onHistory,
  variant = 'main',
  onCloseFullscreen,
}: NavBarProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEditing = useCallback(() => {
    setDraft(title)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }, [title])

  const saveTitle = useCallback(() => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== title) {
      onTitleChange?.(trimmed)
    }
  }, [draft, title, onTitleChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.currentTarget instanceof HTMLElement && e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      setDraft(title)
      setEditing(false)
    }
  }, [title])
  return (
    <header className="flex items-center justify-between border-b border-border/80 bg-surface/70 backdrop-blur-lg px-5 py-3 select-none">
      {/* Left side */}
      {variant === 'main' ? (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="rounded-lg bg-accent-bg p-1.5 shrink-0">
            <BookOpen size={18} className="text-accent" />
          </div>
          <span className="font-sans text-sm font-bold text-ink tracking-tight shrink-0">InkView</span>
          {showContent && title && (
            <>
              <span className="text-ink-faint/50 mx-1 shrink-0">/</span>
              {editing ? (
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={handleKeyDown}
                  className="min-w-0 flex-1 font-sans text-sm font-medium bg-surface-alt rounded-md px-1.5 py-0.5 text-ink outline-hidden border border-accent/40"
                />
              ) : (
                <button
                  onClick={startEditing}
                  className="truncate font-sans text-sm font-medium text-ink-soft min-w-0 text-left hover:text-ink transition-colors"
                  title="Click to rename"
                >
                  {title}
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={onCloseFullscreen}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-alt hover:text-ink transition-colors"
            title="Close fullscreen editor"
          >
            <Eye size={16} />
          </button>
          <div className="rounded-lg bg-accent-bg p-1.5">
            <BookOpen size={16} className="text-accent" />
          </div>
          <span className="text-sm font-medium text-ink font-sans truncate max-w-64">
            Editing: {title}
          </span>
        </div>
      )}

      {/* Right side */}
      <div className="flex items-center gap-1">
        {showContent && (
          <div className="flex items-center rounded-xl bg-surface-alt/80 border border-border/60 p-0.5 mr-2">
            {editorModes.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => onEditorModeChange(mode)}
                title={label}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                  editorMode === mode
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-ink-faint hover:text-ink'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}

        {showContent && editorMode !== 'edit' && (
          <button
            onClick={onTocToggle}
            title="Table of contents"
            className={`rounded-lg p-2 transition-colors ${
              tocOpen ? 'text-accent bg-accent-bg' : 'text-ink-faint hover:text-ink hover:bg-surface-alt'
            }`}
          >
            <List size={16} />
          </button>
        )}

        <>
          <button
            onClick={onNewDoc}
            title="New document (Ctrl+N)"
            className="rounded-lg p-2 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
          >
            <Plus size={16} />
          </button>

          <button
            onClick={onHistory}
            title="Document history (Ctrl+H)"
            className="rounded-lg p-2 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
          >
            <Clock size={16} />
          </button>
        </>

        <div className="ml-1 pl-1 border-l border-border/60">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

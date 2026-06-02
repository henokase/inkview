import { useCallback, useRef, useState } from 'react'
import { BookOpen, Columns2, Clock, Eye, FileEdit, List, Plus, WifiOff } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { ShareButton } from './ShareButton'

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
  isMobile?: boolean
  content?: string
  hidden?: boolean
  isOnline?: boolean
  hasHeadings?: boolean
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
  isMobile = false,
  content = '',
  hidden = false,
  isOnline = true,
  hasHeadings = true,
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

  const filteredModes = isMobile
    ? editorModes.filter((m) => m.mode !== 'split')
    : editorModes

  return (
    <header  className={`flex items-center justify-between border-b border-border/80 bg-surface/70 backdrop-blur-lg px-4 py-2.5 sm:px-6 sm:py-3 select-none transition-transform duration-300 ${
      showContent && variant !== 'fullscreen' ? 'fixed top-0 left-0 right-0 z-20' : ''
    } ${showContent && hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      {/* Left side */}
      {!showContent ? (
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 mr-2 flex-1">
          <div className="rounded-lg bg-accent-bg p-2 shrink-0">
            <BookOpen size={18} className="text-accent sm:size-5" />
          </div>
          <span className="font-sans text-sm sm:text-base font-bold text-ink tracking-tight shrink-0 hidden lg:inline">InkView</span>
        </div>
      ) : isMobile && variant === 'main' ? (
        <div className="flex items-center min-w-0 mr-2 flex-1">
          <div className="flex items-center rounded-xl bg-surface-alt/80 border border-border/60 p-0.5">
            {filteredModes.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => onEditorModeChange(mode)}
                title={label}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
                  editorMode === mode
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-ink-faint hover:text-ink'
                }`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      ) : variant === 'main' ? (
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 mr-2 flex-1">
          <div className="rounded-lg bg-accent-bg p-2 shrink-0">
            <BookOpen size={18} className="text-accent sm:size-5" />
          </div>
          <span className="font-sans text-sm sm:text-base font-bold text-ink tracking-tight shrink-0 hidden lg:inline">InkView</span>
          {title && (
            <>
              <span className="text-ink-faint/50 mx-0.5 sm:mx-1 shrink-0 hidden sm:inline">/</span>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={handleKeyDown}
                    className="w-full font-sans text-sm sm:text-base font-medium bg-surface-alt rounded-md px-2 py-1 text-ink outline-hidden border border-accent/40"
                  />
                ) : (
                  <button
                    onClick={startEditing}
                    className="truncate w-full font-sans text-sm sm:text-base font-medium text-ink-soft text-left hover:text-ink transition-colors"
                    title="Click to rename"
                  >
                    {title}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : isMobile ? (
        <div className="flex items-center min-w-0 mr-2 flex-1">
          <div className="flex items-center rounded-xl bg-surface-alt/80 border border-border/60 p-0.5">
            {filteredModes.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => onEditorModeChange(mode)}
                title={label}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
                  editorMode === mode
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-ink-faint hover:text-ink'
                }`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 sm:gap-3 mr-2 min-w-0">
          <div className="rounded-lg bg-accent-bg p-2 shrink-0">
            <BookOpen size={18} className="text-accent sm:size-5" />
          </div>
          <span className="text-sm sm:text-base font-medium text-ink font-sans truncate min-w-0">
            Editing: {title}
          </span>
        </div>
      )}

      {/* Right side */}
      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
        {!isMobile && showContent && (
          <div className="flex items-center rounded-xl bg-surface-alt/80 border border-border/60 p-0.5 mr-0.5 sm:mr-2">
            {filteredModes.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => onEditorModeChange(mode)}
                title={label}
                className={`flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all duration-150 ${
                  editorMode === mode
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-ink-faint hover:text-ink'
                }`}
              >
                <Icon size={14} className="sm:size-4" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>
        )}

        {showContent && editorMode !== 'edit' && hasHeadings && (
          <button
            onClick={onTocToggle}
            title="Table of contents"
            className={`rounded-lg p-2 sm:p-2.5 transition-colors ${
              tocOpen ? 'text-accent bg-accent-bg' : 'text-ink-faint hover:text-ink hover:bg-surface-alt'
            }`}
          >
            <List size={18} />
          </button>
        )}

        {showContent && <ShareButton content={content} title={title} />}

        <>
          <button
            onClick={onNewDoc}
            title="New document (Ctrl+N)"
            className="rounded-lg p-2 sm:p-2.5 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
          >
            <Plus size={18} />
          </button>

          {showContent && (
          <button
            onClick={onHistory}
            title="Document history (Ctrl+H)"
            className="rounded-lg p-2 sm:p-2.5 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
          >
            <Clock size={18} />
          </button>
        )}
        </>

        {!isOnline && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-note/10 text-note text-[10px] font-medium mr-0.5 sm:mr-1">
            <WifiOff size={11} />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}
        <div className="ml-0.5 sm:ml-1.5 pl-1 sm:pl-1.5 border-l border-border/60">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

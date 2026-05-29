import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileEdit,
  Eye,
  Columns2,
  Plus,
  Clock,
  BookOpen,
  FileText,
  List,
  X,
} from 'lucide-react'
import { useDocumentStore } from './stores/document-store'
import { useUiStore } from './stores/ui-store'
import { useTheme } from './lib/use-theme'
import { useKeyboard } from './lib/use-keyboard'
import { extractTitle } from './lib/toc'
import { ThemeToggle } from './components/ThemeToggle'
import { MarkdownEditor } from './components/MarkdownEditor'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { TocSidebar } from './components/TocSidebar'
import { HistoryModal } from './components/HistoryModal'
import { NewDocModal } from './components/NewDocModal'
import type { EditorMode } from './types'

function App() {
  const documents = useDocumentStore((s) => s.documents)
  const activeDocId = useDocumentStore((s) => s.activeDocId)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const updateContent = useDocumentStore((s) => s.updateContent)
  const setActiveDoc = useDocumentStore((s) => s.setActiveDoc)

  const editorMode = useUiStore((s) => s.editorMode)
  const setEditorMode = useUiStore((s) => s.setEditorMode)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [newDocOpen, setNewDocOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(true)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      setSplitRatio(Math.min(Math.max(ratio, 0.2), 0.8))
    }
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleDividerMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useTheme()

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId),
    [documents, activeDocId]
  )

  const title = useMemo(
    () => (activeDoc ? activeDoc.title || extractTitle(activeDoc.content) || 'Untitled' : ''),
    [activeDoc]
  )

  const handleFileUpload = useCallback(
    (content: string, name: string) => {
      const id = createDocument(content, name || 'Untitled')
      setActiveDoc(id)
      setNewDocOpen(false)
    },
    [createDocument, setActiveDoc]
  )

  const handleContentChange = useCallback(
    (content: string) => {
      if (activeDocId) {
        updateContent(activeDocId, content)
      }
    },
    [activeDocId, updateContent]
  )

  const handleNewDoc = useCallback(() => {
    const id = createDocument('', 'Untitled')
    setActiveDoc(id)
    setEditorMode('edit')
    setNewDocOpen(false)
  }, [createDocument, setActiveDoc, setEditorMode])

  useKeyboard({ key: 'e', ctrl: true }, () => {
    if (activeDocId) {
      setEditorMode(editorMode === 'edit' ? 'preview' : 'edit')
    }
  })

  useKeyboard({ key: 'n', ctrl: true }, () => setNewDocOpen(true))
  useKeyboard({ key: 'h', ctrl: true }, () => setHistoryOpen(true))

  const editorModes: { mode: EditorMode; icon: typeof FileEdit; label: string }[] = [
    { mode: 'edit', icon: FileEdit, label: 'Edit' },
    { mode: 'split', icon: Columns2, label: 'Split' },
    { mode: 'preview', icon: Eye, label: 'Preview' },
  ]

  const hasActiveDoc = activeDocId !== null && activeDoc !== undefined
  const showEmpty = documents.length === 0 && !activeDoc
  const showContent = hasActiveDoc

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <main className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border/80 bg-surface/70 backdrop-blur-lg px-5 py-3 select-none">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-accent-bg p-1.5">
              <BookOpen size={18} className="text-accent" />
            </div>
            <span className="font-sans text-sm font-bold text-ink tracking-tight">InkView</span>
            {showContent && (
              <>
                <span className="text-ink-faint/50 mx-1">/</span>
                <span className="truncate font-sans text-sm font-medium text-ink-soft max-w-[160px] sm:max-w-md">
                  {title}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {showContent && (
              <div className="flex items-center rounded-xl bg-surface-alt/80 border border-border/60 p-0.5 mr-2">
                {editorModes.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setEditorMode(mode)}
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
                onClick={() => setTocOpen(!tocOpen)}
                title="Table of contents"
                className={`rounded-lg p-2 transition-colors ${
                  tocOpen ? 'text-accent bg-accent-bg' : 'text-ink-faint hover:text-ink hover:bg-surface-alt'
                }`}
              >
                <List size={16} />
              </button>
            )}

            <button
              onClick={() => setNewDocOpen(true)}
              title="New document (Ctrl+N)"
              className="rounded-lg p-2 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
            >
              <Plus size={16} />
            </button>

            <button
              onClick={() => setHistoryOpen(true)}
              title="Document history (Ctrl+H)"
              className="rounded-lg p-2 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
            >
              <Clock size={16} />
            </button>

            <div className="ml-1 pl-1 border-l border-border/60">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {showEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6">
              <div className="mb-6 rounded-2xl bg-surface-alt p-5">
                <FileText size={44} className="text-ink-faint" />
              </div>
              <p className="mb-6 text-sm text-ink-soft max-w-xs text-center leading-relaxed font-sans">
                No documents open. Create a new one or open a file.
              </p>
              <button
                onClick={() => setNewDocOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:opacity-90 transition-opacity font-sans"
              >
                <Plus size={18} />
                New Document
              </button>
            </div>
          ) : showContent ? (
            <>
              <div ref={containerRef} className="flex flex-1 min-w-0">
                {(editorMode === 'edit' || editorMode === 'split') && (
                  <div
                    className="flex flex-col min-h-0"
                    style={editorMode === 'split' ? { width: `${splitRatio * 100}%` } : { flex: '1' }}
                  >
                    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
                      <MarkdownEditor
                        value={activeDoc.content}
                        onChange={handleContentChange}
                      />
                    </div>
                  </div>
                )}

                {editorMode === 'split' && (
                  <div
                    onMouseDown={handleDividerMouseDown}
                    className="w-1 shrink-0 cursor-col-resize bg-border/40 hover:bg-accent/50 transition-colors relative"
                  >
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-ink-faint/30" />
                  </div>
                )}

                {(editorMode === 'preview' || editorMode === 'split') && (
                  <div
                    className="flex flex-col overflow-hidden"
                    style={editorMode === 'split' ? { width: `${(1 - splitRatio) * 100}%` } : { flex: '1' }}
                  >
                    <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10 xl:px-16">
                      <article className="mx-auto max-w-4xl xl:max-w-5xl">
                        <MarkdownRenderer content={activeDoc.content} />
                      </article>
                    </div>
                  </div>
                )}
              </div>

              {/* TOC sidebar */}
              {editorMode !== 'edit' && tocOpen && (
                <aside className="w-60 shrink-0 border-l border-border/60 bg-surface-alt/30 p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-faint">
                      Contents
                    </h3>
                    <button
                      onClick={() => setTocOpen(false)}
                      className="rounded-lg p-1 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <TocSidebar content={activeDoc.content} />
                </aside>
              )}
            </>
          ) : null}
        </div>
      </main>

      {/* Fullscreen editor mode */}
      {editorMode === 'edit' && showContent && activeDoc && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-surface"
          style={{ animation: 'fadeIn 200ms' }}
        >
          <header className="flex items-center justify-between border-b border-border/80 bg-surface/70 backdrop-blur-lg px-5 py-3 select-none">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-bg p-1.5">
                <BookOpen size={16} className="text-accent" />
              </div>
              <span className="text-sm font-medium text-ink font-sans">
                Editing: {title}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {editorModes.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setEditorMode(mode)}
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
              <div className="ml-2 pl-2 border-l border-border/60">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-auto px-6 py-6 lg:px-12">
            <div className="mx-auto max-w-4xl h-full">
              <MarkdownEditor
                value={activeDoc.content}
                onChange={handleContentChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <HistoryModal key={String(historyOpen)} open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <NewDocModal
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        onCreateBlank={handleNewDoc}
        onFileUpload={handleFileUpload}
      />
    </div>
  )
}

export default App

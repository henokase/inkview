import { useCallback, useMemo, useState } from 'react'
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
  const [tocOpen, setTocOpen] = useState(false)

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
      {/* Main area */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border bg-surface/80 backdrop-blur-md px-4 py-2.5">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-accent shrink-0" />
            <h1 className="font-sans text-base font-bold text-ink tracking-tight">
              InkView
            </h1>
            {showContent && (
              <>
                <span className="mx-1 text-ink-faint">/</span>
                <h2 className="truncate font-sans text-sm font-medium text-ink max-w-[180px] sm:max-w-md">
                  {title}
                </h2>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {showContent && (
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-alt p-0.5 mr-1">
                {editorModes.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setEditorMode(mode)}
                    title={label}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      editorMode === mode
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-ink-soft hover:text-ink'
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
                title="Toggle table of contents"
                className={`rounded-md p-1.5 transition-colors ${
                  tocOpen ? 'text-accent bg-accent-bg' : 'text-ink-soft hover:text-ink hover:bg-surface-alt'
                }`}
              >
                <List size={18} />
              </button>
            )}

            <button
              onClick={() => setNewDocOpen(true)}
              title="New document (Ctrl+N)"
              className="rounded-md p-1.5 text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
            >
              <Plus size={18} />
            </button>

            <button
              onClick={() => setHistoryOpen(true)}
              title="Document history (Ctrl+H)"
              className="rounded-md p-1.5 text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
            >
              <Clock size={18} />
            </button>

            <div className="ml-1">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {showEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
              <div className="mb-6 inline-flex rounded-2xl bg-surface-alt p-4">
                <FileText size={40} className="text-ink-faint" />
              </div>
              <p className="mb-6 text-sm text-ink-soft max-w-xs text-center leading-relaxed">
                No documents open. Create a new one or open a file to get started.
              </p>
              <button
                onClick={() => setNewDocOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:opacity-90 transition-opacity"
              >
                <Plus size={18} />
                New Document
              </button>
            </div>
          ) : showContent ? (
            <>
              {/* Editor / Preview area */}
              <div className="flex flex-1 min-w-0">
                  {(editorMode === 'edit' || editorMode === 'split') && (
                  <div
                    className={`flex flex-col min-h-0 border-r border-border ${
                      editorMode === 'split' ? 'w-1/2' : 'w-full'
                    }`}
                  >
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                      <MarkdownEditor
                        value={activeDoc.content}
                        onChange={handleContentChange}
                      />
                    </div>
                  </div>
                )}

                  {(editorMode === 'preview' || editorMode === 'split') && (
                  <div
                    className={`flex flex-col overflow-hidden ${
                      editorMode === 'split' ? 'w-1/2' : 'w-full'
                    }`}
                  >
                    <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10 xl:px-16"
                    >
                      <article className="mx-auto max-w-4xl xl:max-w-5xl">
                        <MarkdownRenderer content={activeDoc.content} />
                      </article>
                    </div>
                  </div>
                )}
              </div>

              {/* TOC sidebar */}
              {editorMode !== 'edit' && tocOpen && (
                <aside className="w-60 shrink-0 border-l border-border bg-surface-alt/50 p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-faint">
                      On this page
                    </h3>
                    <button
                      onClick={() => setTocOpen(false)}
                      className="rounded p-0.5 text-ink-faint hover:text-ink transition-colors"
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
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditorMode('preview')}
                className="rounded-md p-1.5 text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
                title="Close fullscreen editor"
              >
                <Eye size={18} />
              </button>
              <span className="text-sm font-medium text-ink">
                Editing: {title}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {editorModes.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setEditorMode(mode)}
                  title={label}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    editorMode === mode
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
              <div className="ml-2">
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

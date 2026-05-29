import { useCallback, useMemo } from 'react'
import {
  Menu,
  X,
  FileEdit,
  Eye,
  Columns2,
  Plus,
  FileUp,
  BookOpen,
} from 'lucide-react'
import { useDocumentStore } from './stores/document-store'
import { useUiStore } from './stores/ui-store'
import { useTheme } from './lib/use-theme'
import { useKeyboard } from './lib/use-keyboard'
import { extractTitle } from './lib/toc'
import { ThemeToggle } from './components/ThemeToggle'
import { DocumentList } from './components/DocumentList'
import { MarkdownEditor } from './components/MarkdownEditor'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { TocSidebar } from './components/TocSidebar'
import { FileDropZone } from './components/FileDropZone'
import type { EditorMode } from './types'

function App() {
  const documents = useDocumentStore((s) => s.documents)
  const activeDocId = useDocumentStore((s) => s.activeDocId)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const updateContent = useDocumentStore((s) => s.updateContent)
  const setActiveDoc = useDocumentStore((s) => s.setActiveDoc)

  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const editorMode = useUiStore((s) => s.editorMode)
  const setEditorMode = useUiStore((s) => s.setEditorMode)

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
      setSidebarOpen(true)
    },
    [createDocument, setActiveDoc, setSidebarOpen]
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
  }, [createDocument, setActiveDoc, setEditorMode])

  useKeyboard({ key: 'e', ctrl: true }, () => {
    if (activeDocId) {
      setEditorMode(editorMode === 'edit' ? 'preview' : 'edit')
    }
  })

  useKeyboard({ key: 'n', ctrl: true }, handleNewDoc)

  const editorModes: { mode: EditorMode; icon: typeof FileEdit; label: string }[] = [
    { mode: 'edit', icon: FileEdit, label: 'Edit' },
    { mode: 'split', icon: Columns2, label: 'Split' },
    { mode: 'preview', icon: Eye, label: 'Preview' },
  ]

  const showWelcome = documents.length === 0
  const showContent = activeDoc && !showWelcome

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface-glass backdrop-blur-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-accent" />
            <h1 className="font-sans text-lg font-bold text-ink tracking-tight">
              InkView
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewDoc}
              title="New document (Ctrl+N)"
              className="rounded-md p-1.5 text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={toggleSidebar}
              className="rounded-md p-1.5 text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors lg:hidden"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <DocumentList />
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-xs lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Main area */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border bg-surface/80 backdrop-blur-md px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="rounded-md p-1.5 text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
              title="Toggle sidebar"
            >
              <Menu size={18} />
            </button>
            {showContent && (
              <h2 className="truncate font-sans text-sm font-medium text-ink max-w-[200px] sm:max-w-md">
                {title}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-2">
            {showContent && (
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-alt p-0.5 mr-2">
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
            <ThemeToggle />
          </div>
        </header>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {showWelcome ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
              <div className="mb-8 text-center">
                <div className="mb-4 inline-flex rounded-2xl bg-accent-bg p-4">
                  <BookOpen size={40} className="text-accent" />
                </div>
                <h1 className="mb-2 font-sans text-3xl font-bold text-ink">
                  Welcome to InkView
                </h1>
                <p className="text-sm text-ink-soft max-w-sm mx-auto leading-relaxed">
                  A premium Markdown viewer. Upload a file or create a new document to get started.
                </p>
              </div>
              <div className="w-full max-w-md space-y-4">
                <FileDropZone onFile={handleFileUpload} />
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-ink-faint">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <button
                  onClick={handleNewDoc}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-4 text-sm font-medium text-ink-soft hover:border-accent/50 hover:text-ink hover:bg-surface-alt/50 transition-all"
                >
                  <FileUp size={20} />
                  Create blank document
                </button>
              </div>
            </div>
          ) : showContent ? (
            <>
              {/* Editor / Preview area */}
              <div className="flex flex-1 min-w-0">
                {(editorMode === 'edit' || editorMode === 'split') && (
                  <div
                    className={`flex flex-col border-r border-border ${
                      editorMode === 'split' ? 'w-1/2' : 'w-full'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
                      <span className="text-xs font-medium text-ink-faint uppercase tracking-wider">
                        Editor
                      </span>
                    </div>
                    <div className="flex-1 overflow-auto px-4 py-4">
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
                    <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
                      <span className="text-xs font-medium text-ink-faint uppercase tracking-wider">
                        Preview
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
                      <article className="mx-auto max-w-3xl">
                        <MarkdownRenderer content={activeDoc.content} />
                      </article>
                    </div>
                  </div>
                )}
              </div>

              {/* TOC sidebar */}
              {editorMode !== 'edit' && (
                <aside className="hidden w-56 shrink-0 border-l border-border bg-surface-alt/50 p-4 overflow-y-auto xl:block">
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
          className="fixed inset-0 z-50 flex flex-col bg-surface animate-in fade-in-0"
          style={{ animationDuration: '200ms' }}
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
            <ThemeToggle />
          </header>
          <div className="flex-1 overflow-auto px-6 py-6 lg:px-12">
            <div className="mx-auto max-w-3xl h-full">
              <MarkdownEditor
                value={activeDoc.content}
                onChange={handleContentChange}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

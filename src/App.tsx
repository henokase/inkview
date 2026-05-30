import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { useDocumentStore } from './stores/document-store'
import { useUiStore } from './stores/ui-store'
import { useTheme } from './lib/use-theme'
import { useKeyboard } from './lib/use-keyboard'
import { extractTitle } from './lib/toc'
import { NavBar } from './components/NavBar'
import { MarkdownEditor } from './components/MarkdownEditor'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { TocSidebar } from './components/TocSidebar'
import { HistoryModal } from './components/HistoryModal'
import { NewDocModal } from './components/NewDocModal'

function App() {
  const documents = useDocumentStore((s) => s.documents)
  const activeDocId = useDocumentStore((s) => s.activeDocId)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const updateContent = useDocumentStore((s) => s.updateContent)
  const updateTitle = useDocumentStore((s) => s.updateTitle)
  const setActiveDoc = useDocumentStore((s) => s.setActiveDoc)

  const editorMode = useUiStore((s) => s.editorMode)
  const setEditorMode = useUiStore((s) => s.setEditorMode)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [newDocOpen, setNewDocOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(true)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorPaneRef = useRef<HTMLDivElement>(null)
  const previewPaneRef = useRef<HTMLDivElement>(null)
  const splitRatioRef = useRef(0.5)
  const [debouncedContent, setDebouncedContent] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkSize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile && editorMode === 'split') {
        setEditorMode('preview')
      }
    }
    checkSize()
    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [editorMode, setEditorMode])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0.2), 0.8)
      splitRatioRef.current = ratio
      if (editorPaneRef.current) {
        editorPaneRef.current.style.width = `${ratio * 100}%`
      }
      if (previewPaneRef.current) {
        previewPaneRef.current.style.width = `${(1 - ratio) * 100}%`
      }
    }
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setSplitRatio(splitRatioRef.current)
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

  const content = activeDoc?.content ?? ''
  const displayContent = editorMode === 'split' ? debouncedContent : content

  useEffect(() => {
    if (editorMode !== 'split') {
      setDebouncedContent(content)
      return
    }
    const timer = setTimeout(() => setDebouncedContent(content), 300)
    return () => clearTimeout(timer)
  }, [content, editorMode])

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

  const handleTitleChange = useCallback(
    (title: string) => {
      if (activeDocId) {
        updateTitle(activeDocId, title)
      }
    },
    [activeDocId, updateTitle]
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

  const hasActiveDoc = activeDocId !== null && activeDoc !== undefined
  const showEmpty = documents.length === 0 && !activeDoc
  const showContent = hasActiveDoc

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <main className="flex flex-1 flex-col min-w-0">
        <NavBar
          title={title}
          showContent={showContent}
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
          onTitleChange={handleTitleChange}
          tocOpen={tocOpen}
          onTocToggle={() => setTocOpen(!tocOpen)}
          onNewDoc={() => setNewDocOpen(true)}
          onHistory={() => setHistoryOpen(true)}
          isMobile={isMobile}
        />

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
                    ref={editorPaneRef}
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
                    ref={previewPaneRef}
                    className="flex flex-col overflow-hidden"
                    style={editorMode === 'split' ? { width: `${(1 - splitRatio) * 100}%` } : { flex: '1' }}
                  >
                    <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10 xl:px-16">
                      <article className="mx-auto max-w-4xl xl:max-w-5xl wrap-break-word">
                        <MarkdownRenderer content={displayContent} />
                      </article>
                    </div>
                  </div>
                )}
              </div>

              {/* TOC sidebar */}
              {editorMode !== 'edit' && tocOpen && (
                <>
                  {/* Backdrop overlay for mobile TOC */}
                  <div
                    className="fixed inset-0 z-30 bg-black/20 backdrop-blur-xs lg:hidden"
                    onClick={() => setTocOpen(false)}
                  />
                  <aside className="fixed inset-y-0 right-0 z-40 w-64 lg:static lg:w-60 shrink-0 border-l border-border/60 bg-surface lg:bg-surface-alt/30 p-4 overflow-y-auto shadow-2xl lg:shadow-none animate-in slide-in-from-right duration-200">
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
                </>
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
          <NavBar
            title={title}
            showContent
            editorMode={editorMode}
            onEditorModeChange={setEditorMode}
            onTitleChange={handleTitleChange}
            tocOpen={tocOpen}
            onTocToggle={() => setTocOpen(!tocOpen)}
            onNewDoc={() => setNewDocOpen(true)}
            onHistory={() => setHistoryOpen(true)}
            variant="fullscreen"
            onCloseFullscreen={() => setEditorMode('preview')}
            isMobile={isMobile}
          />
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

import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react'
import { FileText, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { useDocumentStore } from './stores/document-store'
import { useUiStore } from './stores/ui-store'
import { useKeyboard } from './lib/use-keyboard'
import { extractTitle, extractTocHeadings } from './lib/toc'
import { useHideOnScroll } from './lib/use-hide-on-scroll'
import { NavBar } from './components/NavBar'
import { MarkdownEditor } from './components/MarkdownEditor'
import type { MarkdownEditorHandle } from './components/MarkdownEditor'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { TocSidebar } from './components/TocSidebar'
import { HistoryModal } from './components/HistoryModal'
import { NewDocModal } from './components/NewDocModal'
import { Toast } from './components/Toast'
import { parseShareUrl, fetchSharedContent, resolveImportEntries, resolveTitleUnique } from './lib/share'

function findPreviewHeading(container: HTMLElement): string | null {
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  if (headings.length === 0) return null

  const containerRect = container.getBoundingClientRect()
  const viewportHeight = containerRect.height
  let bestInViewport: { text: string; top: number } | null = null
  let bestAbove: { text: string; dist: number } | null = null
  let bestBelow: { text: string; dist: number } | null = null

  for (const h of headings) {
    const el = h as HTMLElement
    const relativeTop = el.getBoundingClientRect().top - containerRect.top
    const text = el.textContent?.trim()
    if (!text) continue

    if (relativeTop >= 0 && relativeTop <= viewportHeight) {
      if (!bestInViewport || relativeTop < bestInViewport.top) {
        bestInViewport = { text, top: relativeTop }
      }
    } else if (relativeTop < 0) {
      const dist = Math.abs(relativeTop)
      if (!bestAbove || dist < bestAbove.dist) {
        bestAbove = { text, dist }
      }
    } else {
      const dist = relativeTop - viewportHeight
      if (!bestBelow || dist < bestBelow.dist) {
        bestBelow = { text, dist }
      }
    }
  }

  if (bestInViewport) return bestInViewport.text

  const aboveDist = bestAbove?.dist ?? Infinity
  const belowDist = bestBelow?.dist ?? Infinity
  return aboveDist <= belowDist ? (bestAbove?.text ?? null) : (bestBelow?.text ?? null)
}

function App() {
  const documents = useDocumentStore((s) => s.documents)
  const activeDocId = useDocumentStore((s) => s.activeDocId)
  const hydrated = useDocumentStore((s) => s._hydrated)
  const migrationCount = useDocumentStore((s) => s._migrationCount)
  const createDocument = useDocumentStore((s) => s.createDocument)
  const createDocuments = useDocumentStore((s) => s.createDocuments)
  const createFolder = useDocumentStore((s) => s.createFolder)
  const updateContent = useDocumentStore((s) => s.updateContent)
  const updateTitle = useDocumentStore((s) => s.updateTitle)
  const setActiveDoc = useDocumentStore((s) => s.setActiveDoc)

  const editorMode = useUiStore((s) => s.editorMode)
  const setEditorMode = useUiStore((s) => s.setEditorMode)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null)
  const [newDocOpen, setNewDocOpen] = useState(false)
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [tocOpen, setTocOpen] = useState(() => window.innerWidth >= 768)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [toastVisible, setToastVisible] = useState(false)

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToastMsg(msg)
    setToastType(type)
    setToastVisible(true)
  }, [])
  const hideToast = useCallback(() => setToastVisible(false), [])
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorPaneRef = useRef<HTMLDivElement>(null)
  const previewPaneRef = useRef<HTMLDivElement>(null)
  const splitRatioRef = useRef(0.5)
  const editorHandleRef = useRef<MarkdownEditorHandle>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

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

  const shareProcessed = useRef(false)

  useEffect(() => {
    const share = parseShareUrl()
    if (!share || shareProcessed.current) return
    shareProcessed.current = true
    setShareLoading(true)

    const timeoutId = setTimeout(() => {
      setShareLoading(false)
      showToast('Request timed out. Please try again.', 'error')
    }, 10000)

    fetchSharedContent(share.id)
      .then((data) => {
        clearTimeout(timeoutId)

        if (data.documents && data.documents.length > 0) {
          const state = useDocumentStore.getState()
          const { entries: deduped, deleteIds } = resolveImportEntries(
            data.documents!.map((d) => ({ title: d.title, content: d.content })),
            state.documents
          )
          if (deleteIds.length > 0) state.removeDocuments(deleteIds)

          const ids = createDocuments(deduped)

          const folderName = data.folderName || 'Shared Documents'
          let folderId: string
          const existingFolder = state.folders.find((f) => f.name === folderName)
          if (existingFolder) {
            state.moveDocumentsToFolder(existingFolder.id, ids)
            folderId = existingFolder.id
          } else {
            const newFolder = createFolder(folderName, ids)
            folderId = newFolder
          }

          setActiveDoc(ids[0])
          setShareLoading(false)
          window.history.replaceState(null, '', '/')
          setPendingFolderId(folderId)
          setHistoryOpen(true)
          showToast(`Imported ${ids.length} shared documents`, 'success')
        } else if (typeof data.content === 'string') {
          const state = useDocumentStore.getState()
          const { entries: deduped, deleteIds } = resolveImportEntries(
            [{ title: data.title || extractTitle(data.content) || 'Shared Document', content: data.content }],
            state.documents
          )
          if (deleteIds.length > 0) state.removeDocuments(deleteIds)
          const title = deduped[0].title
          const id = createDocument(data.content, title)
          setActiveDoc(id)
          setShareLoading(false)
          window.history.replaceState(null, '', '/')
          showToast('Shared document imported successfully', 'success')
        } else {
          setShareLoading(false)
          console.error('Share response:', JSON.stringify(data, null, 2))
          const keys = Object.keys(data || {}).join(', ')
          const t = data && 'content' in data ? typeof data.content : 'NO_KEY'
          showToast(`Bad response (keys: ${keys}, content: ${t})`, 'error')
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId)
        setShareLoading(false)
        const msg = err instanceof Error ? err.message : 'Failed to load shared content'
        showToast(msg, 'error')
      })
  }, [createDocument, createDocuments, createFolder, setActiveDoc, showToast])

  useEffect(() => {
    if (migrationCount > 0) {
      showToast(`Migrated ${migrationCount} document${migrationCount !== 1 ? 's' : ''} for offline access`, 'success')
    }
  }, [migrationCount, showToast])

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

  const handleSync = useCallback(() => {
    const previewEl = previewScrollRef.current
    if (!previewEl) return
    const heading = findPreviewHeading(previewEl)
    if (!heading) return
    editorHandleRef.current?.scrollToHeading(heading)
  }, [])

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId),
    [documents, activeDocId]
  )

  const hasActiveDoc = activeDocId !== null && activeDoc !== undefined
  const navbarHidden = useHideOnScroll(
    previewScrollRef,
    hasActiveDoc && editorMode !== 'edit'
  )

  const content = activeDoc?.content ?? ''
  const deferredContent = useDeferredValue(content)
  const displayContent = editorMode === 'split' ? deferredContent : content

  const title = useMemo(
    () => (activeDoc ? activeDoc.title || extractTitle(activeDoc.content) || 'Untitled' : ''),
    [activeDoc]
  )

  const hasHeadings = useMemo(
    () => content ? extractTocHeadings(content).length > 0 : false,
    [content]
  )

  const handleFileUpload = useCallback(
    (content: string, name: string) => {
      setCreatingDoc(true)
      setTimeout(() => {
        const state = useDocumentStore.getState()
        const { entries: deduped, deleteIds } = resolveImportEntries(
          [{ title: name || 'Untitled', content }],
          state.documents
        )
        if (deleteIds.length > 0) state.removeDocuments(deleteIds)
        const id = createDocument(content, deduped[0].title)
        setActiveDoc(id)
        setNewDocOpen(false)
        setCreatingDoc(false)
      }, 150)
    },
    [createDocument, setActiveDoc]
  )

  const handleFilesUpload = useCallback(
    (files: { content: string; name: string }[]) => {
      const state = useDocumentStore.getState()
      const { entries: deduped, deleteIds } = resolveImportEntries(
        files.map((f) => ({ title: f.name || 'Untitled', content: f.content })),
        state.documents
      )
      if (deleteIds.length > 0) state.removeDocuments(deleteIds)
      const ids = createDocuments(deduped)
      if (ids.length > 0) {
        setActiveDoc(ids[0])
      }
      setNewDocOpen(false)
      if (ids.length > 1) {
        const folderName = new Date().toLocaleDateString()
        const existingFolder = state.folders.find((f) => f.name === folderName)
        let folderId: string
        if (existingFolder) {
          state.moveDocumentsToFolder(existingFolder.id, ids)
          folderId = existingFolder.id
        } else {
          folderId = createFolder(folderName, ids)
        }
        setPendingFolderId(folderId)
      } else {
        setPendingFolderId(null)
      }
      setTimeout(() => setHistoryOpen(true), 200)
    },
    [createDocuments, createFolder, setActiveDoc]
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
        const state = useDocumentStore.getState()
        const conflict = state.documents.some((d) => d.id !== activeDocId && d.title === title)
        if (conflict) {
          const others = state.documents.filter((d) => d.id !== activeDocId)
          updateTitle(activeDocId, resolveTitleUnique(title, others))
        } else {
          updateTitle(activeDocId, title)
        }
      }
    },
    [activeDocId, updateTitle]
  )

  const handleNewDoc = useCallback(() => {
    setCreatingDoc(true)
    setTimeout(() => {
      const id = createDocument('', 'Untitled')
      setActiveDoc(id)
      setEditorMode('edit')
      setNewDocOpen(false)
      setCreatingDoc(false)
    }, 200)
  }, [createDocument, setActiveDoc, setEditorMode])

  useKeyboard({ key: 'e', ctrl: true }, () => {
    if (activeDocId) {
      setEditorMode(editorMode === 'edit' ? 'preview' : 'edit')
    }
  })

  useKeyboard({ key: 'n', ctrl: true }, () => setNewDocOpen(true))
  useKeyboard({ key: 'h', ctrl: true }, () => setHistoryOpen(true))

  const showEmpty = documents.length === 0 && !activeDoc
  const showContent = hasActiveDoc

  useEffect(() => {
    if (isMobile && editorMode === 'preview') {
      setTocOpen(false)
    }
  }, [isMobile, editorMode])

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-accent animate-spin" />
          <p className="text-sm text-ink-soft font-sans">Loading documents...</p>
        </div>
      </div>
    )
  }

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
            content={content}
            hidden={navbarHidden}
            isOnline={isOnline}
            hasHeadings={hasHeadings}
          />

        {/* Content area */}
        <div
          className={`flex flex-1 overflow-hidden ${navbarHidden ? 'mt-0' : 'sm:mt-5'}`}
          style={{
            paddingTop: hasActiveDoc && !navbarHidden ? '48px' : '0px',
            transition: 'padding-top 300ms',
          }}
        >
          {showEmpty ? (
            shareLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6">
                <Loader2 size={32} className="text-accent animate-spin mb-4" />
                <p className="text-sm text-ink-soft font-sans">Loading shared document...</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center px-4 pt-16 sm:pt-24">
                <div className="mb-4 rounded-2xl bg-surface-alt p-4 sm:p-5">
                  <FileText size={36} className="text-ink-faint sm:size-11" />
                </div>
                <p className="mb-4 text-sm text-ink-soft max-w-xs text-center leading-relaxed font-sans">
                  No documents. Create a new one or open a file.
                </p>
                <button
                  onClick={() => setNewDocOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-medium text-white shadow-xs hover:opacity-90 transition-opacity font-sans"
                >
                  <Plus size={16} className="sm:size-4.5" />
                  New Document
                </button>
              </div>
            )
          ) : showContent ? (
            <>
              <div ref={containerRef} className="flex flex-1 min-w-0">
                {(editorMode === 'edit' || editorMode === 'split') && (
                  <div
                    ref={editorPaneRef}
                    className="flex flex-col min-h-0"
                    style={editorMode === 'split' ? { width: `${splitRatio * 100}%` } : { flex: '1' }}
                  >
                    <div className={`flex flex-1 flex-col min-h-0 overflow-hidden py-8 ${
                      editorMode === 'split'
                        ? 'pl-6 lg:pl-10 xl:pl-16 pr-0'
                        : 'px-6 lg:px-10 xl:px-16'
                    }`}>
                      <MarkdownEditor
                        ref={editorHandleRef}
                        value={activeDoc.content}
                        onChange={handleContentChange}
                      />
                    </div>
                  </div>
                )}

                {editorMode === 'split' && (
                  <div
                    onMouseDown={handleDividerMouseDown}
                    className="w-1 shrink-0 cursor-col-resize bg-border/40 hover:bg-accent/50 transition-colors relative group"
                  >
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-ink-faint/30 pointer-events-none" />
                    <button
                      onClick={handleSync}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-surface shadow-xs border border-border/60 text-ink-faint hover:text-accent hover:border-accent/40 hover:bg-accent-bg/50 transition-all opacity-0 group-hover:opacity-100"
                      title="Snap editor to preview heading"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                )}

                {(editorMode === 'preview' || editorMode === 'split') && (
                  <div
                    ref={previewPaneRef}
                    className="flex flex-col overflow-hidden"
                    style={editorMode === 'split' ? { width: `${(1 - splitRatio) * 100}%` } : { flex: '1' }}
                  >
                    <div ref={previewScrollRef} className="flex-1 overflow-y-auto pl-6 pr-6 lg:px-10 xl:px-16 py-8" data-preview-scroll>
                      <article className="mx-auto max-w-4xl xl:max-w-5xl wrap-break-word">
                        <MarkdownRenderer content={displayContent} />
                      </article>
                    </div>
                  </div>
                )}
              </div>

              {/* TOC sidebar */}
              {editorMode !== 'edit' && tocOpen && hasHeadings && (
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
                    <TocSidebar
                      content={displayContent}
                      onHeadingClick={isMobile ? () => setTocOpen(false) : undefined}
                    />
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
          className="fixed inset-0 z-50 flex flex-col bg-surface-alt"
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
          <div className="flex-1 overflow-auto px-0 sm:px-6 lg:px-12">
            <div className="mx-auto h-full max-w-4xl bg-surface shadow-lg ring-1 ring-border/50 px-2 sm:px-4 py-3">
              <MarkdownEditor
                value={activeDoc.content}
                onChange={handleContentChange}
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onClose={hideToast} />

      {/* Modals */}
      <HistoryModal open={historyOpen} onClose={() => { setHistoryOpen(false); setPendingFolderId(null) }} showToast={showToast} initialFolderId={pendingFolderId} />
      <NewDocModal
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        onCreateBlank={handleNewDoc}
        onFileUpload={handleFileUpload}
        onFilesUpload={handleFilesUpload}
        loading={creatingDoc}
      />
    </div>
  )
}

export default App

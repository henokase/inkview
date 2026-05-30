import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Trash2, FileText, CheckSquare, Square, Clock, X, BookOpen, Filter } from 'lucide-react'
import { useDocumentStore } from '../stores/document-store'
import { ConfirmModal } from './ConfirmModal'
import { extractTitle } from '../lib/toc'

interface HistoryModalProps {
  open: boolean
  onClose: () => void
}

export function HistoryModal({ open, onClose }: HistoryModalProps) {
  const documents = useDocumentStore((s) => s.documents)
  const activeDocId = useDocumentStore((s) => s.activeDocId)
  const setActiveDoc = useDocumentStore((s) => s.setActiveDoc)
  const removeDocuments = useDocumentStore((s) => s.removeDocuments)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deleteTargetTitle = useMemo(() => {
    if (!deleteTarget) return ''
    const doc = documents.find((d) => d.id === deleteTarget)
    return doc?.title || extractTitle(doc?.content || '') || 'Untitled'
  }, [deleteTarget, documents])

  const sortBy = useMemo(() => {
    return [...documents].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [documents])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sortBy
    const q = searchQuery.toLowerCase()
    return sortBy.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
    )
  }, [sortBy, searchQuery])

  const toggleSelection = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedDocs.size === filtered.length) {
      setSelectedDocs(new Set())
    } else {
      setSelectedDocs(new Set(filtered.map((d) => d.id)))
    }
  }

  const handleDelete = () => {
    setDeleting(true)
    setTimeout(() => {
      const idsToDelete = Array.from(selectedDocs)
      removeDocuments(idsToDelete)
      setSelectedDocs(new Set())
      setSelectionMode(false)
      setShowDeleteModal(false)
      setDeleting(false)
    }, 200)
  }

  const handleSingleDelete = (id: string) => {
    setDeleteTarget(id)
  }

  const confirmSingleDelete = () => {
    if (!deleteTarget) return
    setDeleting(true)
    setTimeout(() => {
      removeDocuments([deleteTarget])
      setDeleteTarget(null)
      setDeleting(false)
    }, 200)
  }

  const handleDocClick = (id: string) => {
    if (selectionMode) {
      toggleSelection(id)
    } else {
      setActiveDoc(id)
      onClose()
    }
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    return d.toLocaleDateString()
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-accent-bg p-1.5">
              <BookOpen size={18} className="text-accent" />
            </div>
            <h2 className="font-sans text-base font-semibold text-ink">History</h2>
            <span className="rounded-md bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-ink-faint">
              {documents.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-alt hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-xl border border-border bg-surface-alt/50 py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint outline-hidden focus:border-accent/50 focus:bg-surface transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-2">
          <span className="text-xs font-medium text-ink-faint font-sans">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''}
          </span>
          {filtered.length > 0 && (
            <div className="flex items-center gap-2">
              {selectionMode ? (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors font-sans"
                  >
                    {selectedDocs.size === filtered.length ? (
                      <CheckSquare size={14} />
                    ) : (
                      <Square size={14} />
                    )}
                    Select all
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={selectedDocs.size === 0}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-sans"
                  >
                    <Trash2 size={14} />
                    Delete ({selectedDocs.size})
                  </button>
                  <button
                    onClick={() => { setSelectionMode(false); setSelectedDocs(new Set()) }}
                    className="rounded-lg px-2.5 py-1 text-xs text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors font-sans"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors font-sans"
                >
                  <Filter size={14} />
                  Select
                </button>
              )}
            </div>
          )}
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <div className="mb-4 rounded-xl bg-surface-alt p-3">
                <FileText size={32} className="text-ink-faint" />
              </div>
              <p className="text-sm font-medium text-ink font-sans">
                {searchQuery ? 'No matches found' : 'No documents yet'}
              </p>
              <p className="mt-1 text-xs text-ink-faint font-sans">
                {searchQuery ? 'Try a different search term' : 'Create or upload a document to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((doc) => {
                const title = doc.title || extractTitle(doc.content) || 'Untitled'
                const isActive = doc.id === activeDocId
                const isSelected = selectedDocs.has(doc.id)
                const preview = doc.content
                  .replace(/^#+\s+(.+)$/m, '')
                  .replace(/[[\]()#*`>-]/g, '')
                  .trim()
                  .slice(0, 120)

                return (
                  <div
                    key={doc.id}
                    className={`group flex items-center justify-between rounded-xl px-3.5 py-3 border transition-all duration-150 ${
                      isActive && !selectionMode
                        ? 'bg-accent-bg border-accent/20'
                        : isSelected
                          ? 'bg-accent-bg/30 border-accent/10'
                          : 'border-transparent hover:bg-surface-alt'
                    }`}
                  >
                    <button
                      onClick={() => handleDocClick(doc.id)}
                      className="flex flex-1 items-start gap-3 text-left min-w-0"
                    >
                      {selectionMode && (
                        <span className="mt-0.5 shrink-0">
                          {isSelected ? (
                            <CheckSquare size={18} className="text-accent" />
                          ) : (
                            <Square size={18} className="text-ink-faint" />
                          )}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink font-sans">
                          {title}
                        </p>
                        {preview && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-ink-faint font-serif">
                            {preview}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-faint font-sans">
                          <Clock size={10} />
                          <span>{formatDate(doc.updatedAt)}</span>
                        </div>
                      </div>
                    </button>
                    {!selectionMode && (
                      <button
                        onClick={() => handleSingleDelete(doc.id)}
                        className="shrink-0 rounded-lg p-1.5 text-ink-faint opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all ml-2"
                        title="Delete document"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={showDeleteModal}
        title="Delete documents"
        message={`Are you sure you want to delete ${selectedDocs.size} document${selectedDocs.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        loading={deleting}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete document"
        message={`Are you sure you want to delete "${deleteTargetTitle}"? This action cannot be undone.`}
        onConfirm={confirmSingleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>,
    document.body
  )
}

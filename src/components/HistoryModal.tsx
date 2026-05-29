import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Trash2, FileText, CheckSquare, Square, Clock, X, BookOpen } from 'lucide-react'
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

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return documents
    const q = searchQuery.toLowerCase()
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
    )
  }, [documents, searchQuery])

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
    const idsToDelete = Array.from(selectedDocs)
    removeDocuments(idsToDelete)
    setSelectedDocs(new Set())
    setSelectionMode(false)
    setShowDeleteModal(false)
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
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-accent" />
            <h2 className="font-sans text-base font-semibold text-ink">Document History</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or content..."
              className="w-full rounded-lg border border-border bg-surface-alt py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint outline-hidden focus:border-accent transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-2">
          <span className="text-xs font-medium text-ink-faint">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''}
          </span>
          {filtered.length > 0 && (
            <div className="flex items-center gap-2">
              {selectionMode ? (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink transition-colors"
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
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                    Delete ({selectedDocs.size})
                  </button>
                  <button
                    onClick={() => { setSelectionMode(false); setSelectedDocs(new Set()) }}
                    className="text-xs text-ink-faint hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              <FileText size={36} className="mb-3 text-ink-faint" />
              <p className="text-sm text-ink-soft">
                {searchQuery ? 'No documents found' : 'No history yet'}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                {searchQuery ? 'Try a different search' : 'Create or upload a document to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((doc) => {
                const title = doc.title || extractTitle(doc.content) || 'Untitled'
                const isActive = doc.id === activeDocId
                const isSelected = selectedDocs.has(doc.id)
                const preview = doc.content
                  .replace(/^#+\s+(.+)$/m, '')
                  .replace(/[[\]()#*`>-]/g, '')
                  .trim()
                  .slice(0, 100)

                return (
                  <button
                    key={doc.id}
                    onClick={() => handleDocClick(doc.id)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left transition-all ${
                      isActive && !selectionMode
                        ? 'bg-accent-bg border border-accent/20'
                        : isSelected
                          ? 'bg-accent-bg/50 border border-accent/10'
                          : 'border border-transparent hover:bg-surface-alt'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {selectionMode && (
                        <span className="mt-0.5 shrink-0">
                          {isSelected ? (
                            <CheckSquare size={16} className="text-accent" />
                          ) : (
                            <Square size={16} className="text-ink-faint" />
                          )}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {title}
                        </p>
                        {preview && (
                          <p className="mt-0.5 truncate text-xs text-ink-faint">
                            {preview}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-faint">
                          <Clock size={10} />
                          <span>{formatDate(doc.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
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
      />
    </div>,
    document.body
  )
}

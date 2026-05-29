import { useState, useMemo } from 'react'
import { Search, Trash2, FileText, CheckSquare, Square, Clock } from 'lucide-react'
import { useDocumentStore } from '../stores/document-store'
import { useUiStore } from '../stores/ui-store'
import { ConfirmModal } from './ConfirmModal'
import { extractTitle } from '../lib/toc'

export function DocumentList() {
  const documents = useDocumentStore((s) => s.documents)
  const activeDocId = useDocumentStore((s) => s.activeDocId)
  const setActiveDoc = useDocumentStore((s) => s.setActiveDoc)
  const removeDocuments = useDocumentStore((s) => s.removeDocuments)

  const searchQuery = useUiStore((s) => s.searchQuery)
  const setSearchQuery = useUiStore((s) => s.setSearchQuery)
  const selectionMode = useUiStore((s) => s.selectionMode)
  const selectedDocs = useUiStore((s) => s.selectedDocs)
  const toggleDocSelection = useUiStore((s) => s.toggleDocSelection)
  const selectAllDocs = useUiStore((s) => s.selectAllDocs)
  const clearSelection = useUiStore((s) => s.clearSelection)
  const setSelectionMode = useUiStore((s) => s.setSelectionMode)

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

  const handleDelete = () => {
    const idsToDelete = Array.from(selectedDocs)
    removeDocuments(idsToDelete)
    clearSelection()
    setShowDeleteModal(false)
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

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="relative mb-3">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full rounded-lg border border-border bg-surface-alt py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint outline-hidden focus:border-accent transition-colors"
          />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-faint">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''}
          </span>
          {filtered.length > 0 && (
            <div className="flex items-center gap-2">
              {selectionMode ? (
                <>
                  <button
                    onClick={() => {
                      if (selectedDocs.size === filtered.length) {
                        clearSelection()
                      } else {
                        selectAllDocs(filtered.map((d) => d.id))
                      }
                    }}
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
                    onClick={() => setSelectionMode(false)}
                    className="text-xs text-ink-faint hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="text-xs text-ink-faint hover:text-ink transition-colors"
                >
                  Select
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText size={32} className="mb-3 text-ink-faint" />
              <p className="text-sm text-ink-soft">
                {searchQuery ? 'No documents found' : 'No documents yet'}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                {searchQuery ? 'Try a different search' : 'Upload a file to get started'}
              </p>
            </div>
          ) : (
            filtered.map((doc) => {
              const title = doc.title || extractTitle(doc.content) || 'Untitled'
              const isActive = doc.id === activeDocId
              const isSelected = selectedDocs.has(doc.id)
              const preview = doc.content
                .replace(/^#+\s+(.+)$/m, '')
                .replace(/[[\]()#*`>-]/g, '')
                .trim()
                .slice(0, 80)

              return (
                <button
                  key={doc.id}
                  onClick={() => {
                    if (selectionMode) {
                      toggleDocSelection(doc.id)
                    } else {
                      setActiveDoc(doc.id)
                    }
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-all ${
                    isActive && !selectionMode
                      ? 'bg-accent-bg border border-accent/20'
                      : isSelected
                        ? 'bg-accent-bg/50 border border-accent/10'
                        : 'border border-transparent hover:bg-surface-alt'
                  }`}
                >
                  <div className="flex items-start gap-2">
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
            })
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
    </>
  )
}

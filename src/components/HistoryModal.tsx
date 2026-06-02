import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Trash2, FileText, CheckSquare, Square, Clock, X, BookOpen, Filter } from 'lucide-react'
import { useDocumentStore } from '../stores/document-store'
import { ConfirmModal } from './ConfirmModal'
import { extractTitle } from '../lib/toc'
import type { Document } from '../types'

interface HistoryModalProps {
  open: boolean
  onClose: () => void
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString()
}

function getPreview(content: string): string {
  return content
    .replace(/^#+\s+(.+)$/m, '')
    .replace(/[[\]()#*`>-]/g, '')
    .trim()
    .slice(0, 120)
}

function getItemTitle(doc: Document): string {
  return doc.title || extractTitle(doc.content) || 'Untitled'
}

interface DocListItemProps {
  id: string
  title: string
  content: string
  updatedAt: number
  isActive: boolean
  isSelected: boolean
  selectionMode: boolean
  onDocClick: (id: string) => void
  onDelete: (id: string) => void
}

const DocListItem = memo(function DocListItem({
  id,
  title,
  content,
  updatedAt,
  isActive,
  isSelected,
  selectionMode,
  onDocClick,
  onDelete,
}: DocListItemProps) {
  const displayTitle = getItemTitle({ id, title, content } as Document)

  return (
    <div
      className={`group flex items-center justify-between rounded-xl px-3.5 py-3 border transition-colors duration-150 ${
        isActive && !selectionMode
          ? 'bg-accent-bg border-accent/20'
          : isSelected
            ? 'bg-accent-bg/30 border-accent/10'
            : 'border-transparent hover:bg-surface-alt'
      }`}
    >
      <button
        onClick={() => onDocClick(id)}
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
            {displayTitle}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-ink-faint font-serif">
            {getPreview(content)}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-faint font-sans">
            <Clock size={10} />
            <span>{formatDate(updatedAt)}</span>
          </div>
        </div>
      </button>
      {!selectionMode && (
        <button
          onClick={() => onDelete(id)}
          className="shrink-0 rounded-lg p-1.5 text-ink-faint/50 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-2"
          title="Delete document"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
})

export function HistoryModal({ open, onClose }: HistoryModalProps) {
  const docsVersion = useDocumentStore((s) => s._docsVersion)
  const activeDocId = useDocumentStore((s) => s.activeDocId)
  const setActiveDoc = useDocumentStore((s) => s.setActiveDoc)
  const removeDocuments = useDocumentStore((s) => s.removeDocuments)

  const [documents, setDocuments] = useState<Document[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const { documents: docs } = useDocumentStore.getState()
    setDocuments(docs)
  }, [docsVersion])

  const sortBy = useMemo(() => {
    return [...documents].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
  }, [documents])

  const filtered = useMemo(() => {
    if (!deferredQuery.trim()) return sortBy
    const q = deferredQuery.toLowerCase()
    return sortBy.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
    )
  }, [sortBy, deferredQuery])

  const deleteTargetTitle = useMemo(() => {
    if (!deleteTarget) return ''
    const doc = documents.find((d) => d.id === deleteTarget)
    return doc ? getItemTitle(doc) : ''
  }, [deleteTarget, documents])

  const handleSelectAll = useCallback(() => {
    setSelectedDocs((prev) => {
      if (prev.size === filtered.length) {
        return new Set()
      }
      return new Set(filtered.map((d) => d.id))
    })
  }, [filtered])

  const handleDelete = useCallback(() => {
    setDeleting(true)
    setTimeout(() => {
      removeDocuments(Array.from(selectedDocs))
      setSelectedDocs(new Set())
      setSelectionMode(false)
      setShowDeleteModal(false)
      setDeleting(false)
    }, 200)
  }, [selectedDocs, removeDocuments])

  const confirmSingleDelete = useCallback(() => {
    if (!deleteTarget) return
    setDeleting(true)
    setTimeout(() => {
      removeDocuments([deleteTarget])
      setDeleteTarget(null)
      setDeleting(false)
    }, 200)
  }, [deleteTarget, removeDocuments])

  const handleDocClick = useCallback((id: string) => {
    setSelectedDocs((prev) => {
      if (selectionMode) {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }
      return prev
    })
    if (!selectionMode) {
      setActiveDoc(id)
      onClose()
    }
  }, [selectionMode, setActiveDoc, onClose])

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteTarget(id)
  }, [])

  const handleToolbarDelete = useCallback(() => {
    setShowDeleteModal(true)
  }, [])

  const cancelSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedDocs(new Set())
  }, [])

  const enableSelection = useCallback(() => {
    setSelectionMode(true)
  }, [])

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

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
        <div className="flex items-center justify-end px-5 py-2">
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
                    onClick={handleToolbarDelete}
                    disabled={selectedDocs.size === 0}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-sans"
                  >
                    <Trash2 size={14} />
                    Delete ({selectedDocs.size})
                  </button>
                  <button
                    onClick={cancelSelection}
                    className="rounded-lg px-2.5 py-1 text-xs text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors font-sans"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={enableSelection}
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
              {filtered.map((doc) => (
                <DocListItem
                  key={doc.id}
                  id={doc.id}
                  title={doc.title}
                  content={doc.content}
                  updatedAt={doc.updatedAt}
                  isActive={doc.id === activeDocId}
                  isSelected={selectedDocs.has(doc.id)}
                  selectionMode={selectionMode}
                  onDocClick={handleDocClick}
                  onDelete={handleDeleteClick}
                />
              ))}
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

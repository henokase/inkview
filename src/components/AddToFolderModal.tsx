import { memo, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, FileText, CheckSquare, Square, X, Folder as FolderIcon, FolderOpen } from 'lucide-react'
import { useDocumentStore } from '../stores/document-store'
import { extractTitle } from '../lib/toc'
import { ConfirmModal } from './ConfirmModal'
import type { Document } from '../types'

interface AddToFolderModalProps {
  open: boolean
  onClose: () => void
  folderId: string
  folderName: string
  existingDocIds: string[]
}

function getItemTitle(doc: Document): string {
  return doc.title || extractTitle(doc.content) || 'Untitled'
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

interface AddDocItemProps {
  id: string
  title: string
  content: string
  updatedAt: number
  isSelected: boolean
  folderBadge?: string
  onToggle: (id: string) => void
}

const AddDocItem = memo(function AddDocItem({
  id,
  title,
  content,
  updatedAt,
  isSelected,
  folderBadge,
  onToggle,
}: AddDocItemProps) {
  return (
    <div
      onClick={() => onToggle(id)}
      className={`flex items-center justify-between rounded-xl px-3.5 py-3 border transition-colors duration-150 cursor-pointer ${
        isSelected
          ? 'bg-accent-bg/30 border-accent/10'
          : 'border-transparent hover:bg-surface-alt'
      }`}
    >
      <span className="mt-0.5 shrink-0 cursor-pointer">
        {isSelected ? (
          <CheckSquare size={18} className="text-accent" />
        ) : (
          <Square size={18} className="text-ink-faint" />
        )}
      </span>
      <div className="flex flex-1 items-start gap-3 text-left min-w-0 ml-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink font-sans">
            {title}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-ink-faint font-serif">
            {getPreview(content)}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-faint font-sans">
            <span>{formatDate(updatedAt)}</span>
            {folderBadge && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-accent-bg/60 px-1.5 py-0.5 text-[10px] font-medium text-accent ml-1">
                <FolderIcon size={10} />
                {folderBadge}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export function AddToFolderModal({ open, onClose, folderId, folderName, existingDocIds }: AddToFolderModalProps) {
  const documents = useDocumentStore((s) => s.documents)
  const folders = useDocumentStore((s) => s.folders)
  const moveDocumentsToFolder = useDocumentStore((s) => s.moveDocumentsToFolder)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const docFolderMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const f of folders) {
      if (f.id === folderId) continue
      for (const docId of f.documentIds) {
        if (!map[docId]) {
          map[docId] = f.name
        }
      }
    }
    return map
  }, [folders, folderId])

  const availableDocs = useMemo(() => {
    const existingSet = new Set(existingDocIds)
    return documents.filter((d) => !existingSet.has(d.id))
  }, [documents, existingDocIds])

  const sorted = useMemo(() => {
    return [...availableDocs].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [availableDocs])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sorted
    const q = searchQuery.toLowerCase()
    return sorted.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
    )
  }, [sorted, searchQuery])

  const handleToggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleCancel = useCallback(() => {
    setSelected(new Set())
    setSearchQuery('')
    setShowConfirm(false)
    onClose()
  }, [onClose])

  const handleAdd = useCallback(() => {
    if (selected.size === 0) return

    const docsInOtherFolders = folders.some(
      (f) => f.id !== folderId && f.documentIds.some((did) => selected.has(did))
    )

    if (docsInOtherFolders) {
      setShowConfirm(true)
    } else {
      moveDocumentsToFolder(folderId, Array.from(selected))
      setSelected(new Set())
      onClose()
    }
  }, [selected, folders, folderId, moveDocumentsToFolder, onClose])

  const handleConfirmAdd = useCallback(() => {
    moveDocumentsToFolder(folderId, Array.from(selected))
    setSelected(new Set())
    setShowConfirm(false)
    onClose()
  }, [selected, folderId, moveDocumentsToFolder, onClose])

  return createPortal(
    <div className={`fixed inset-0 z-70 flex items-center justify-center transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />

      <div className="relative flex h-[70vh] w-[calc(100%-1rem)] sm:w-full sm:max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-accent-bg p-1.5">
              <FolderOpen size={16} className="text-accent" />
            </div>
            <h2 className="font-sans text-base font-semibold text-ink">Add to {folderName}</h2>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-alt hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
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
              autoFocus={open}
            />
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              <div className="mb-4 rounded-xl bg-surface-alt p-3">
                <FileText size={32} className="text-ink-faint" />
              </div>
              <p className="text-sm font-medium text-ink font-sans">
                {searchQuery ? 'No matches found' : 'All documents are already in this folder'}
              </p>
              <p className="mt-1 text-xs text-ink-faint font-sans">
                {searchQuery ? 'Try a different search term' : 'Create new documents to add them here'}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((doc) => (
                <AddDocItem
                  key={doc.id}
                  id={doc.id}
                  title={getItemTitle(doc)}
                  content={doc.content}
                  updatedAt={doc.updatedAt}
                  isSelected={selected.has(doc.id)}
                  folderBadge={docFolderMap[doc.id]}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-ink-faint font-sans">
            {selected.size > 0 ? `${selected.size} selected` : ''}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCancel}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-alt transition-colors font-sans"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-soft font-sans disabled:opacity-40"
            >
              Add ({selected.size})
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        title="Move documents"
        message="Some of the selected documents belong to other folders. Continuing will remove them from their current folders and add them to this one."
        confirmLabel="Add"
        destructive={false}
        onConfirm={handleConfirmAdd}
        onCancel={() => setShowConfirm(false)}
      />
    </div>,
    document.body
  )
}

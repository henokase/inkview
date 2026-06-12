import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, Trash2, FileText, CheckSquare, Square, Clock, X,
  Folder as FolderIcon, FolderOpen, Plus, Share2, Edit3, ChevronDown,
} from 'lucide-react'
import { useDocumentStore } from '../stores/document-store'
import { ConfirmModal } from './ConfirmModal'
import { extractTitle } from '../lib/toc'
import { createBatchShareLink } from '../lib/share'
import type { Document, Folder } from '../types'
import { DocListIcon } from './CustomIcons'
import { AddToFolderModal } from './AddToFolderModal'

interface HistoryModalProps {
  open: boolean
  onClose: () => void
  showToast?: (msg: string, type: 'success' | 'error') => void
  initialFolderId?: string | null
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
  folderBadge?: string
  onDocClick: (id: string) => void
  onDelete: (id: string) => void
  onToggleSelect: (id: string) => void
  onRemoveFromFolder?: (id: string) => void
}

const DocListItem = memo(function DocListItem({
  id,
  title,
  content,
  updatedAt,
  isActive,
  isSelected,
  folderBadge,
  onDocClick,
  onDelete,
  onToggleSelect,
  onRemoveFromFolder,
}: DocListItemProps) {
  const displayTitle = getItemTitle({ id, title, content } as Document)

  return (
    <div
      className={`group flex items-center justify-between rounded-xl px-3.5 py-3 border transition-colors duration-150 ${
        isActive
          ? 'bg-accent-bg border-accent/20'
          : isSelected
            ? 'bg-accent-bg/30 border-accent/10'
            : 'border-transparent hover:bg-surface-alt'
      }`}
    >
      <span
        onClick={(e) => { e.stopPropagation(); onToggleSelect(id) }}
        className="mt-0.5 shrink-0 cursor-pointer"
      >
        {isSelected ? (
          <CheckSquare size={18} className="text-accent" />
        ) : (
          <Square size={18} className="text-ink-faint" />
        )}
      </span>
      <button
        onClick={() => onDocClick(id)}
        className="flex flex-1 items-start gap-3 text-left min-w-0 ml-3"
      >
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
            {folderBadge && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-accent-bg/60 px-1.5 py-0.5 text-[10px] font-medium text-accent ml-1">
                <FolderIcon size={10} />
                {folderBadge}
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-0.5 shrink-0 ml-1">
        {onRemoveFromFolder && (
          <button
            onClick={() => onRemoveFromFolder(id)}
            className="rounded-lg p-1.5 text-ink-faint/50 hover:text-accent hover:bg-accent-bg/50 transition-colors"
            title="Remove from folder"
          >
            <X size={14} />
          </button>
        )}
        <button
          onClick={() => onDelete(id)}
          className="rounded-lg p-1.5 text-ink-faint/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete document"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
})

interface FolderItemProps {
  folder: Folder
  docCount: number
  isActive: boolean
  onSelect: () => void
  onShare: () => void
  onRename: () => void
  onDelete: () => void
}

const FolderItem = memo(function FolderItem({
  folder,
  docCount,
  isActive,
  onSelect,
  onShare,
  onRename,
  onDelete,
}: FolderItemProps) {
  const [showActions, setShowActions] = useState(false)
  const show = showActions

  return (
    <div
      className={`relative flex items-center gap-2 rounded-lg pl-3 py-2 text-sm cursor-pointer transition-colors ${
        isActive
          ? 'bg-accent-bg text-accent font-medium'
          : 'text-ink-soft hover:bg-surface-alt hover:text-ink'
      }`}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {isActive ? <FolderOpen size={16} className="shrink-0" /> : <FolderIcon size={16} className="shrink-0" />}
      <span className="truncate flex-1">{folder.name}</span>
      <span className="text-[11px] text-ink-faint mr-5">{docCount}</span>

      <div className={`absolute shadow-2xl bg-surface-alt dark:bg-surface-alt/95 right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-lg px-1 py-0.5 z-10 transition-opacity duration-150 ${show ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onShare() }}
          className="rounded-md p-1 text-ink-faint hover:text-accent hover:bg-accent-bg/50 transition-colors"
          title="Share folder"
        >
          <Share2 size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRename() }}
          className="rounded-md p-1 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
          title="Rename folder"
        >
          <Edit3 size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="rounded-md p-1 text-ink-faint hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete folder"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
})

export function HistoryModal({ open, onClose, showToast, initialFolderId }: HistoryModalProps) {
  const docsVersion = useDocumentStore((s) => s._docsVersion)
  const foldersVersion = useDocumentStore((s) => s._foldersVersion)
  const activeDocId = useDocumentStore((s) => s.activeDocId)
  const setActiveDoc = useDocumentStore((s) => s.setActiveDoc)
  const removeDocuments = useDocumentStore((s) => s.removeDocuments)
  const createFolder = useDocumentStore((s) => s.createFolder)
  const renameFolder = useDocumentStore((s) => s.renameFolder)
  const deleteFolderAction = useDocumentStore((s) => s.deleteFolder)
  const moveDocumentsToFolder = useDocumentStore((s) => s.moveDocumentsToFolder)
  const removeDocumentsFromFolder = useDocumentStore((s) => s.removeDocumentsFromFolder)

  const [documents, setDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const mobileRenameInputRef = useRef<HTMLInputElement>(null)
  const mobileNewFolderInputRef = useRef<HTMLInputElement>(null)
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false)
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null)
  const [sharingFolder, setSharingFolder] = useState<string | null>(null)
  const [sharingSelected, setSharingSelected] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareSuccess, setShareSuccess] = useState<string | null>(null)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [showBulkRemoveModal, setShowBulkRemoveModal] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [showMoveConfirmModal, setShowMoveConfirmModal] = useState(false)
  const [pendingMoveFolderId, setPendingMoveFolderId] = useState<string | null>(null)
  const [moveConfirmDocCount, setMoveConfirmDocCount] = useState(0)
  const [moveConfirmOtherFolders, setMoveConfirmOtherFolders] = useState('')
  const [showMobileFolderList, setShowMobileFolderList] = useState(false)
  const [showAddToFolderModal, setShowAddToFolderModal] = useState(false)
  const mobileFolderRef = useRef<HTMLDivElement>(null)
  const folderPickerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const { documents: docs, folders: flds } = useDocumentStore.getState()
    setDocuments(docs)
    setFolders(flds)
  }, [docsVersion, foldersVersion])

  useEffect(() => {
    if (open && initialFolderId) {
      setActiveFolderId(initialFolderId)
    }
  }, [open, initialFolderId])

  useEffect(() => {
    if (showNewFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus()
    }
  }, [showNewFolder])

  useEffect(() => {
    if (renamingFolderId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingFolderId])

  useEffect(() => {
    if (renamingFolderId && mobileRenameInputRef.current) {
      mobileRenameInputRef.current.focus()
      mobileRenameInputRef.current.select()
    }
  }, [renamingFolderId])

  useEffect(() => {
    if (showNewFolder && mobileNewFolderInputRef.current) {
      mobileNewFolderInputRef.current.focus()
    }
  }, [showNewFolder])

  useEffect(() => {
    if (!showMobileFolderList) return
    const handler = (e: MouseEvent) => {
      if (mobileFolderRef.current && !mobileFolderRef.current.contains(e.target as Node)) {
        setShowMobileFolderList(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMobileFolderList])

  useEffect(() => {
    if (!showFolderPicker) return
    const handler = (e: MouseEvent) => {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setShowFolderPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFolderPicker])

  useEffect(() => {
    if (!open) return
    const mediaQuery = window.matchMedia('(min-width: 640px)')
    const handleFocus = () => {
      if (mediaQuery.matches && searchInputRef.current) {
        searchInputRef.current.focus()
      }
    }
    mediaQuery.addEventListener('change', handleFocus)
    handleFocus()
    return () => mediaQuery.removeEventListener('change', handleFocus)
  }, [open])

  const docsByFolder = useMemo(() => {
    if (!activeFolderId) return documents
    const folder = folders.find((f) => f.id === activeFolderId)
    if (!folder) return documents
    return documents.filter((d) => folder.documentIds.includes(d.id))
  }, [documents, folders, activeFolderId])

  const sortBy = useMemo(() => {
    return [...docsByFolder].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
  }, [docsByFolder])

  const filtered = useMemo(() => {
    if (!deferredQuery.trim()) return sortBy
    const q = deferredQuery.toLowerCase()
    return sortBy.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
    )
  }, [sortBy, deferredQuery])

  const folderDocCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of folders) {
      counts[f.id] = documents.filter((d) => f.documentIds.includes(d.id)).length
    }
    return counts
  }, [folders, documents])

  const docFolderMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const f of folders) {
      for (const docId of f.documentIds) {
        if (!map[docId]) {
          map[docId] = f.name
        }
      }
    }
    return map
  }, [folders])

  const deleteTargetTitle = useMemo(() => {
    if (!deleteTarget) return ''
    const doc = documents.find((d) => d.id === deleteTarget)
    return doc ? getItemTitle(doc) : ''
  }, [deleteTarget, documents])

  const folderDeleteName = useMemo(() => {
    if (!folderToDelete) return ''
    const f = folders.find((fld) => fld.id === folderToDelete)
    return f?.name || ''
  }, [folderToDelete, folders])

  const removeTargetTitle = useMemo(() => {
    if (!removeTarget) return ''
    const doc = documents.find((d) => d.id === removeTarget)
    return doc ? getItemTitle(doc) : ''
  }, [removeTarget, documents])

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

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDocClick = useCallback((id: string) => {
    setActiveDoc(id)
    onClose()
  }, [setActiveDoc, onClose])

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteTarget(id)
  }, [])

  const handleToolbarDelete = useCallback(() => {
    setShowDeleteModal(true)
  }, [])

  const handleOpenAddToFolder = useCallback(() => {
    setShowAddToFolderModal(true)
  }, [])

  const handleBulkRemoveFromFolder = useCallback(() => {
    if (!activeFolderId || selectedDocs.size === 0) return
    setShowBulkRemoveModal(true)
  }, [activeFolderId, selectedDocs])

  const handleConfirmBulkRemove = useCallback(() => {
    if (!activeFolderId) return
    removeDocumentsFromFolder(activeFolderId, Array.from(selectedDocs))
    setSelectedDocs(new Set())
    setShowBulkRemoveModal(false)
  }, [activeFolderId, selectedDocs, removeDocumentsFromFolder])

  const handleSingleRemoveClick = useCallback((id: string) => {
    setRemoveTarget(id)
  }, [])

  const handleConfirmSingleRemove = useCallback(() => {
    if (!activeFolderId || !removeTarget) return
    removeDocumentsFromFolder(activeFolderId, [removeTarget])
    setRemoveTarget(null)
  }, [activeFolderId, removeTarget, removeDocumentsFromFolder])

  const clearSelection = useCallback(() => {
    setSelectedDocs(new Set())
  }, [])

const handleCreateFolder = useCallback(() => {
  const name = newFolderName.trim()
  if (!name) return
  const exists = folders.some((f) => f.name === name)
  if (exists) {
    showToast?.('A folder with that name already exists', 'error')
    return
  }
  createFolder(name)
  setNewFolderName('')
  setShowNewFolder(false)
  setActiveFolderId(null)
}, [newFolderName, createFolder, folders, showToast])

  const handleNewFolderKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateFolder()
    } else if (e.key === 'Escape') {
      setShowNewFolder(false)
      setNewFolderName('')
    }
  }, [handleCreateFolder])

  const handleStartRename = useCallback((folder: Folder) => {
    setRenamingFolderId(folder.id)
    setRenameValue(folder.name)
  }, [])

  const handleFinishRename = useCallback(() => {
    if (!renamingFolderId || !renameValue.trim()) {
      setRenamingFolderId(null)
      setRenameValue('')
      return
    }
    const newName = renameValue.trim()
    const exists = folders.some((f) => f.id !== renamingFolderId && f.name === newName)
    if (exists) {
      showToast?.('A folder with that name already exists', 'error')
      return
    }
    renameFolder(renamingFolderId, newName)
    setRenamingFolderId(null)
    setRenameValue('')
  }, [renamingFolderId, renameValue, renameFolder, folders, showToast])

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename()
    } else if (e.key === 'Escape') {
      setRenamingFolderId(null)
      setRenameValue('')
    }
  }, [handleFinishRename])

  const handleFolderShare = useCallback(async (folder: Folder) => {
    const folderDocs = documents.filter((d) => folder.documentIds.includes(d.id))
    if (folderDocs.length === 0) return
    setSharingFolder(folder.id)
    setShareError(null)
    setShareSuccess(null)
    try {
      const entries = folderDocs.map((d) => ({ title: d.title || 'Untitled', content: d.content }))
      const url = await createBatchShareLink(entries, folder.name)
      await navigator.clipboard.writeText(url)
      setSharingFolder(null)
      setShareSuccess('Link copied!')
      setTimeout(() => setShareSuccess(null), 2000)
    } catch {
      setSharingFolder(null)
      setShareError('Failed to share folder')
      setTimeout(() => setShareError(null), 3000)
    }
  }, [documents])

  const handleShareSelected = useCallback(async () => {
    if (selectedDocs.size === 0) return
    const selected = documents.filter((d) => selectedDocs.has(d.id))
    setShareError(null)
    setShareSuccess(null)
    setSharingSelected(true)
    try {
      const entries = selected.map((d) => ({ title: d.title || 'Untitled', content: d.content }))
      const url = await createBatchShareLink(entries)
      await navigator.clipboard.writeText(url)
      setSelectedDocs(new Set())
      setSharingSelected(false)
      setShareSuccess('Link copied!')
      setTimeout(() => setShareSuccess(null), 2000)
    } catch {
      setSharingSelected(false)
      setShareError('Failed to share documents')
      setTimeout(() => setShareError(null), 3000)
    }
  }, [selectedDocs, documents])

  const handleMoveToFolder = useCallback((folderId: string) => {
    if (selectedDocs.size === 0) return

    const currentFolders = useDocumentStore.getState().folders
    const docsInOtherFolders: { folderName: string }[] = []
    const seenFolders = new Set<string>()

    for (const f of currentFolders) {
      if (f.id === folderId) continue
      for (const docId of selectedDocs) {
        if (f.documentIds.includes(docId) && !seenFolders.has(f.id)) {
          seenFolders.add(f.id)
          docsInOtherFolders.push({ folderName: f.name })
        }
      }
    }

    if (activeFolderId === null && docsInOtherFolders.length > 0) {
      const otherNames = [...new Set(docsInOtherFolders.map((d) => d.folderName))].join(', ')
      setPendingMoveFolderId(folderId)
      setMoveConfirmDocCount(selectedDocs.size)
      setMoveConfirmOtherFolders(otherNames)
      setShowMoveConfirmModal(true)
      return
    }

    moveDocumentsToFolder(folderId, Array.from(selectedDocs))
    setSelectedDocs(new Set())
    setShowFolderPicker(false)
    setActiveFolderId(folderId)
  }, [selectedDocs, moveDocumentsToFolder, activeFolderId])

  const handleConfirmMove = useCallback(() => {
    if (!pendingMoveFolderId) return
    moveDocumentsToFolder(pendingMoveFolderId, Array.from(selectedDocs))
    setSelectedDocs(new Set())
    setShowFolderPicker(false)
    setActiveFolderId(pendingMoveFolderId)
    setShowMoveConfirmModal(false)
    setPendingMoveFolderId(null)
    setMoveConfirmDocCount(0)
    setMoveConfirmOtherFolders('')
  }, [pendingMoveFolderId, selectedDocs, moveDocumentsToFolder])

  const handleCancelMove = useCallback(() => {
    setShowMoveConfirmModal(false)
    setPendingMoveFolderId(null)
    setMoveConfirmDocCount(0)
    setMoveConfirmOtherFolders('')
  }, [])

  const handleConfirmDeleteFolder = useCallback(() => {
    if (!folderToDelete) return
    deleteFolderAction(folderToDelete)
    if (activeFolderId === folderToDelete) {
      setActiveFolderId(null)
    }
    setFolderToDelete(null)
    setShowDeleteFolderModal(false)
  }, [folderToDelete, deleteFolderAction, activeFolderId])

  const allDocsCount = documents.length

  return createPortal(
    <div className={`fixed inset-0 z-65 flex items-center justify-center transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-[80vh] w-[calc(100%-1rem)] sm:w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl flex-col rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-accent-bg p-1.5">
              <DocListIcon />
            </div>
            <h2 className="font-sans text-base font-semibold text-ink">Documents</h2>
            <span className="rounded-md bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-ink-faint">
              {allDocsCount}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-alt hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Folder sidebar */}
          <div className="hidden md:flex w-52 shrink-0 border-r border-border flex-col">
            <div className="px-3 pt-3.5 pb-2">
              <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                Folders
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
              <button
                onClick={() => setActiveFolderId(null)}
                className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                  activeFolderId === null
                    ? 'bg-accent-bg text-accent font-medium'
                    : 'text-ink-soft hover:bg-surface-alt hover:text-ink'
                }`}
              >
                {activeFolderId === null ? <FolderOpen size={16} /> : <FolderIcon size={16} />}
                <span className="truncate flex-1">All Documents</span>
                <span className="text-[11px] text-ink-faint">{allDocsCount}</span>
              </button>

              {showNewFolder && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-surface-alt">
                  <FolderIcon size={16} className="text-ink-faint shrink-0" />
                  <input
                    ref={newFolderInputRef}
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={handleNewFolderKeyDown}
                    onBlur={() => {
                      if (!newFolderName.trim()) {
                        setShowNewFolder(false)
                      } else {
                        handleCreateFolder()
                      }
                    }}
                    placeholder="Folder name"
                    className="flex-1 bg-transparent text-sm text-ink outline-hidden placeholder:text-ink-faint"
                  />
                </div>
              )}

              {folders.map((folder) => (
                renamingFolderId === folder.id ? (
                  <div
                    key={folder.id}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 bg-surface-alt"
                  >
                    <FolderIcon size={16} className="text-ink-faint shrink-0" />
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={handleFinishRename}
                      className="flex-1 bg-transparent text-sm text-ink outline-hidden placeholder:text-ink-faint"
                    />
                  </div>
                ) : (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    docCount={folderDocCounts[folder.id] || 0}
                    isActive={activeFolderId === folder.id}
                    onSelect={() => setActiveFolderId(folder.id)}
                    onShare={() => handleFolderShare(folder)}
                    onRename={() => handleStartRename(folder)}
                    onDelete={() => { setFolderToDelete(folder.id); setShowDeleteFolderModal(true) }}
                  />
                )
              ))}
            </div>

            <div className="px-2 py-2 border-t border-border">
              <button
                onClick={() => { setShowNewFolder(true); setNewFolderName('') }}
                className="flex items-center gap-1.5 w-full rounded-lg px-3 py-1.5 text-xs text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
              >
                <Plus size={14} />
                New Folder
              </button>
            </div>
          </div>

          {/* Document panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Search */}
            <div className="px-5 pt-3.5 pb-2">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeFolderId ? 'Search in folder...' : 'Search documents...'}
                  className="w-full rounded-xl border border-border bg-surface-alt/50 py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint outline-hidden focus:border-accent/50 focus:bg-surface transition-colors"
                />
              </div>
            </div>

            {/* Mobile folder selector */}
            <div className="md:hidden px-5 pb-1">
              <div ref={mobileFolderRef} className="relative">
                <button
                  onClick={() => setShowMobileFolderList(!showMobileFolderList)}
                  className="flex items-center gap-2 w-full rounded-xl border border-border bg-surface-alt/50 px-3 py-2 text-sm text-ink hover:bg-surface-alt transition-colors"
                >
                  {activeFolderId ? (
                    <FolderOpen size={16} className="shrink-0 text-accent" />
                  ) : (
                    <FolderIcon size={16} className="shrink-0 text-ink-faint" />
                  )}
                  <span className="flex-1 text-left truncate">
                    {activeFolderId
                      ? folders.find((f) => f.id === activeFolderId)?.name || 'Folder'
                      : 'All Documents'}
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    {activeFolderId
                      ? (folderDocCounts[activeFolderId] ?? 0)
                      : allDocsCount}
                  </span>
                  <ChevronDown size={14} className="text-ink-faint" />
                </button>

                {showMobileFolderList && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-surface shadow-xl z-20 py-1 max-h-56 overflow-y-auto">
                    {showNewFolder && (
                      <div className="flex items-center gap-2 px-3 py-2 mx-2 mb-1 rounded-lg bg-surface-alt">
                        <FolderIcon size={16} className="text-ink-faint shrink-0" />
                        <input
                          ref={mobileNewFolderInputRef}
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={handleNewFolderKeyDown}
                          onBlur={() => {
                            if (!newFolderName.trim()) {
                              setShowNewFolder(false)
                            } else {
                              handleCreateFolder()
                            }
                          }}
                          placeholder="Folder name"
                          className="flex-1 bg-transparent text-sm text-ink outline-hidden placeholder:text-ink-faint"
                        />
                      </div>
                    )}

                    <button
                      onClick={() => { setActiveFolderId(null); setShowMobileFolderList(false) }}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${
                        activeFolderId === null
                          ? 'bg-accent-bg text-accent font-medium'
                          : 'text-ink-soft hover:bg-surface-alt hover:text-ink'
                      }`}
                    >
                      <FolderIcon size={16} className="shrink-0" />
                      <span className="flex-1 truncate">All Documents</span>
                      <span className="text-[11px] text-ink-faint">{allDocsCount}</span>
                    </button>
                    {folders.map((f) => (
                      <div key={f.id}>
                        {renamingFolderId === f.id ? (
                          <div className="flex items-center gap-2 px-3 py-2 mx-2 rounded-lg bg-surface-alt">
                            <FolderIcon size={16} className="text-ink-faint shrink-0" />
                            <input
                              ref={mobileRenameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={handleRenameKeyDown}
                              onBlur={handleFinishRename}
                              className="flex-1 bg-transparent text-sm text-ink outline-hidden placeholder:text-ink-faint"
                            />
                          </div>
                        ) : (
                          <div
                            className={`flex items-center gap-2 w-full px-2 text-sm transition-colors ${
                              activeFolderId === f.id
                                ? 'bg-accent-bg/30'
                                : ''
                            }`}
                          >
                            <button
                              onClick={() => { setActiveFolderId(f.id); setShowMobileFolderList(false) }}
                              className="flex items-center gap-2 flex-1 min-w-0 py-2 text-left truncate text-ink-soft hover:text-ink transition-colors"
                            >
                              <FolderIcon size={16} className="shrink-0 text-ink-faint" />
                              <span className="truncate">{f.name}</span>
                              <span className="text-[11px] text-ink-faint shrink-0">{folderDocCounts[f.id] || 0}</span>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); const folder = folders.find(x => x.id === f.id); if (folder) { setShowMobileFolderList(false); handleFolderShare(folder) } }}
                                className="rounded-md p-1.5 text-ink-faint hover:text-accent hover:bg-accent-bg/50 transition-colors"
                                title="Share folder"
                              >
                                <Share2 size={13} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStartRename(f) }}
                                className="rounded-md p-1.5 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
                                title="Rename folder"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowMobileFolderList(false); setFolderToDelete(f.id); setShowDeleteFolderModal(true) }}
                                className="rounded-md p-1.5 text-ink-faint hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete folder"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => { setShowNewFolder(true); setNewFolderName('') }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
                    >
                      <Plus size={14} />
                      <span>New Folder</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-evenly px-2 py-2">
              <div className="flex items-center sm:gap-2 shrink-0 min-w-0">
                <div className="flex items-center sm:gap-1 flex-wrap justify-end">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 sm:px-2.5 text-xs text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors font-sans whitespace-nowrap"
                  >
                    {selectedDocs.size === filtered.length ? (
                      <CheckSquare size={14} />
                    ) : (
                      <Square size={14} />
                    )}
                    Select all
                  </button>
                  <button
                    onClick={handleShareSelected}
                    disabled={selectedDocs.size === 0 || sharingSelected}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 sm:px-2.5 text-xs text-accent hover:text-accent/80 hover:bg-accent-bg/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-sans whitespace-nowrap"
                  >
                    {sharingSelected ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-r-transparent" />
                    ) : (
                      <Share2 size={14} />
                    )}
                    {sharingSelected ? 'Sharing...' : `Share (${selectedDocs.size})`}
                  </button>
                  {activeFolderId === null ? (
                    folders.length > 0 && (
                      <div ref={folderPickerRef} className="relative">
                        <button
                          onClick={() => setShowFolderPicker(!showFolderPicker)}
                          disabled={selectedDocs.size === 0}
                          className="flex items-center gap-1.5 rounded-lg px-2 py-1 sm:px-2.5 text-xs text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-sans whitespace-nowrap"
                        >
                          <FolderIcon size={14} />
                          Move
                        </button>
                        {showFolderPicker && (
                          <div className="absolute top-full right-0 z-50 mt-1 w-44 rounded-xl border border-border bg-surface shadow-xl py-1">
                            <p className="px-3 py-1.5 text-[11px] text-ink-faint uppercase tracking-wider font-semibold">
                              Move to folder
                            </p>
                            {folders.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => handleMoveToFolder(f.id)}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink hover:bg-surface-alt text-left transition-colors"
                              >
                                <FolderIcon size={14} className="shrink-0" />
                                <span className="truncate">{f.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <>
                      <button
                        onClick={handleOpenAddToFolder}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1 sm:px-2.5 text-xs text-accent hover:text-accent/80 hover:bg-accent-bg/50 transition-colors font-sans whitespace-nowrap"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                      <button
                        onClick={handleBulkRemoveFromFolder}
                        disabled={selectedDocs.size === 0}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1 sm:px-2.5 text-xs text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-sans whitespace-nowrap"
                      >
                        <X size={14} />
                        Remove ({selectedDocs.size})
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleToolbarDelete}
                    disabled={selectedDocs.size === 0}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 sm:px-2.5 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-sans whitespace-nowrap"
                  >
                    <Trash2 size={14} />
                    Delete ({selectedDocs.size})
                  </button>
                  {selectedDocs.size > 0 && (
                    <button
                      onClick={clearSelection}
                      className="max-sm:hidden rounded-lg px-2 py-1 sm:px-2.5 text-xs text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors font-sans whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Share feedback */}
            {sharingFolder && (
              <div className="px-5 pb-2">
                <div className="flex items-center gap-2 rounded-lg bg-accent-bg/50 px-3 py-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-r-transparent" />
                  <span className="text-xs text-accent">Sharing folder...</span>
                </div>
              </div>
            )}

            {shareSuccess && (
              <div className="px-5 pb-2">
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2">
                  <span className="text-xs text-green-400">{shareSuccess}</span>
                </div>
              </div>
            )}

            {shareError && !sharingFolder && (
              <div className="px-5 pb-2">
                <div className="rounded-lg bg-red-500/10 px-3 py-2">
                  <span className="text-xs text-red-400">{shareError}</span>
                </div>
              </div>
            )}

            {/* Document list */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-20 text-center">
                  <div className="mb-4 rounded-xl bg-surface-alt p-3">
                    <FileText size={32} className="text-ink-faint" />
                  </div>
                  <p className="text-sm font-medium text-ink font-sans">
                    {searchQuery
                      ? 'No matches found'
                      : activeFolderId
                        ? 'This folder is empty'
                        : 'No documents yet'
                    }
                  </p>
                  <p className="mt-1 text-xs text-ink-faint font-sans">
                    {searchQuery
                      ? 'Try a different search term'
                      : activeFolderId
                        ? 'Add documents to get started'
                        : 'Create or upload a document to get started'
                    }
                  </p>
                  {activeFolderId && !searchQuery && (
                    <button
                      onClick={handleOpenAddToFolder}
                      className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-soft transition-colors font-sans"
                    >
                      <Plus size={16} />
                      Add documents
                    </button>
                  )}
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
                      folderBadge={activeFolderId === null ? docFolderMap[doc.id] : undefined}
                      onDocClick={handleDocClick}
                      onDelete={handleDeleteClick}
                      onToggleSelect={handleToggleSelect}
                      onRemoveFromFolder={activeFolderId !== null ? handleSingleRemoveClick : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
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

      <ConfirmModal
        open={showDeleteFolderModal}
        title="Delete folder"
        message={`Delete folder "${folderDeleteName}"? Documents inside will not be deleted.`}
        onConfirm={handleConfirmDeleteFolder}
        onCancel={() => { setShowDeleteFolderModal(false); setFolderToDelete(null) }}
      />

      <ConfirmModal
        open={showMoveConfirmModal}
        title="Move documents"
        message={`${moveConfirmDocCount} of the selected document(s) belong to ${moveConfirmOtherFolders}. Continuing will remove them from their current folders and move them to the new one.`}
        confirmLabel="Move"
        destructive={false}
        onConfirm={handleConfirmMove}
        onCancel={handleCancelMove}
      />

      <ConfirmModal
        open={showBulkRemoveModal}
        title="Remove from folder"
        message={`Remove ${selectedDocs.size} document${selectedDocs.size !== 1 ? 's' : ''} from "${folders.find((f) => f.id === activeFolderId)?.name || ''}"? The document${selectedDocs.size !== 1 ? 's' : ''} will remain in All Documents.`}
        confirmLabel="Remove"
        destructive={false}
        onConfirm={handleConfirmBulkRemove}
        onCancel={() => setShowBulkRemoveModal(false)}
      />

      <ConfirmModal
        open={removeTarget !== null}
        title="Remove from folder"
        message={`Remove "${removeTargetTitle}" from "${folders.find((f) => f.id === activeFolderId)?.name || ''}"? The document will remain in All Documents.`}
        confirmLabel="Remove"
        destructive={false}
        onConfirm={handleConfirmSingleRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      {activeFolderId && (
        <AddToFolderModal
          open={showAddToFolderModal}
          onClose={() => setShowAddToFolderModal(false)}
          folderId={activeFolderId}
          folderName={folders.find((f) => f.id === activeFolderId)?.name || ''}
          existingDocIds={folders.find((f) => f.id === activeFolderId)?.documentIds || []}
        />
      )}
    </div>,
    document.body
  )
}

import { create } from 'zustand'
import type { Document, Folder } from '../types'
import {
  migrateFromLocalStorage,
  loadAllDocuments,
  saveDocument,
  bulkSaveDocuments,
  deleteDocuments,
  loadAllFolders,
  saveFolder,
  deleteFolders,
  persistActiveDocId,
  loadActiveDocId,
} from '../lib/db'

interface DocumentStore {
  documents: Document[]
  activeDocId: string | null
  folders: Folder[]
  _hydrated: boolean
  _migrationCount: number
  _docsVersion: number
  _foldersVersion: number

  createDocument: (content?: string, title?: string) => string
  createDocuments: (entries: { content: string; title: string }[]) => string[]
  updateContent: (id: string, content: string) => void
  updateTitle: (id: string, title: string) => void
  setActiveDoc: (id: string | null) => void
  updateScrollPosition: (id: string, position: number) => void
  removeDocuments: (ids: string[]) => void
  getActiveDoc: () => Document | undefined

  createFolder: (name: string, documentIds?: string[]) => string
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  moveDocumentsToFolder: (folderId: string, docIds: string[]) => void
  removeDocumentsFromFolder: (folderId: string, docIds: string[]) => void
}

export const useDocumentStore = create<DocumentStore>()((set, get) => ({
  documents: [],
  activeDocId: null,
  folders: [],
  _hydrated: false,
  _migrationCount: 0,
  _docsVersion: 0,
  _foldersVersion: 0,

  createDocument: (content = '', title = 'Untitled') => {
    const now = Date.now()
    const id = crypto.randomUUID()
    const doc: Document = {
      id,
      title,
      content,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      lastScrollPosition: 0,
    }
    set((s) => ({
      documents: [...s.documents, doc],
      activeDocId: id,
      _docsVersion: s._docsVersion + 1,
    }))
    saveDocument(doc)
    persistActiveDocId(id)
    return id
  },

  createDocuments: (entries) => {
    const base = Date.now()
    const ids: string[] = []
    const docs: Document[] = entries.map((entry, i) => {
      const now = base + i + 1
      const id = crypto.randomUUID()
      ids.push(id)
      return {
        id,
        title: entry.title || 'Untitled',
        content: entry.content,
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now,
        lastScrollPosition: 0,
      }
    })
    set((s) => ({
      documents: [...s.documents, ...docs],
      activeDocId: ids[0] ?? s.activeDocId,
      _docsVersion: s._docsVersion + 1,
    }))
    bulkSaveDocuments(docs)
    if (ids[0]) persistActiveDocId(ids[0])
    return ids
  },

  updateContent: (id, content) => {
    const updated = { content, updatedAt: Date.now() }
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, ...updated } : d
      ),
    }))
    const doc = get().documents.find((d) => d.id === id)
    if (doc) saveDocument(doc)
  },

  updateTitle: (id, title) => {
    const updated = { title, updatedAt: Date.now() }
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, ...updated } : d
      ),
      _docsVersion: s._docsVersion + 1,
    }))
    const doc = get().documents.find((d) => d.id === id)
    if (doc) saveDocument(doc)
  },

  setActiveDoc: (id) => {
    const now = Date.now()
    set((s) => ({
      activeDocId: id,
      _docsVersion: s._docsVersion + 1,
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, lastAccessedAt: now } : d
      ),
    }))
    persistActiveDocId(id)
    const doc = get().documents.find((d) => d.id === id)
    if (doc) saveDocument(doc)
  },

  updateScrollPosition: (id, position) => {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, lastScrollPosition: position } : d
      ),
    }))
  },

  removeDocuments: (ids) => {
    set((s) => ({
      documents: s.documents.filter((d) => !ids.includes(d.id)),
      activeDocId:
        s.activeDocId && ids.includes(s.activeDocId)
          ? (s.documents.find((d) => !ids.includes(d.id))?.id ?? null)
          : s.activeDocId,
      _docsVersion: s._docsVersion + 1,
      folders: s.folders.map((f) => ({
        ...f,
        documentIds: f.documentIds.filter((did) => !ids.includes(did)),
      })),
    }))
    deleteDocuments(ids)
  },

  getActiveDoc: () => {
    const { documents, activeDocId } = get()
    return documents.find((d) => d.id === activeDocId)
  },

  createFolder: (name, documentIds = []) => {
    const now = Date.now()
    const id = crypto.randomUUID()
    const folder: Folder = {
      id,
      name,
      documentIds,
      createdAt: now,
      updatedAt: now,
    }
    set((s) => ({
      folders: [...s.folders, folder],
      _foldersVersion: s._foldersVersion + 1,
    }))
    saveFolder(folder)
    return id
  },

  renameFolder: (id, name) => {
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, name, updatedAt: Date.now() } : f
      ),
      _foldersVersion: s._foldersVersion + 1,
    }))
    const folder = get().folders.find((f) => f.id === id)
    if (folder) saveFolder(folder)
  },

  deleteFolder: (id) => {
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      _foldersVersion: s._foldersVersion + 1,
    }))
    deleteFolders([id])
  },

  moveDocumentsToFolder: (folderId, docIds) => {
    set((s) => ({
      folders: s.folders.map((f) => {
        if (f.id !== folderId) {
          return {
            ...f,
            documentIds: f.documentIds.filter((did) => !docIds.includes(did)),
            updatedAt: Date.now(),
          }
        }
        const merged = new Set([...f.documentIds, ...docIds])
        return { ...f, documentIds: Array.from(merged), updatedAt: Date.now() }
      }),
      _foldersVersion: s._foldersVersion + 1,
    }))
    const allFolders = get().folders
    for (const f of allFolders) {
      saveFolder(f)
    }
  },

  removeDocumentsFromFolder: (folderId, docIds) => {
    set((s) => ({
      folders: s.folders.map((f) => {
        if (f.id !== folderId) return f
        return {
          ...f,
          documentIds: f.documentIds.filter((did) => !docIds.includes(did)),
          updatedAt: Date.now(),
        }
      }),
      _foldersVersion: s._foldersVersion + 1,
    }))
    const folder = get().folders.find((f) => f.id === folderId)
    if (folder) saveFolder(folder)
  },
}))

let hydrationPromise: Promise<void> | null = null

export function hydrateStore(
  onMigrated?: (count: number) => void
): Promise<void> {
  if (hydrationPromise) return hydrationPromise
  hydrationPromise = (async () => {
    const migrated = await migrateFromLocalStorage()
    const docs = await loadAllDocuments()
    const folders = await loadAllFolders()
    const activeDocId = loadActiveDocId()

    useDocumentStore.setState({
      documents: docs,
      folders,
      activeDocId,
      _hydrated: true,
      _migrationCount: migrated,
      _docsVersion: 1,
      _foldersVersion: 1,
    })

    if (migrated > 0) {
      onMigrated?.(migrated)
    }
  })()
  return hydrationPromise
}

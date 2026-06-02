import { create } from 'zustand'
import type { Document } from '../types'
import {
  migrateFromLocalStorage,
  loadAllDocuments,
  saveDocument,
  bulkSaveDocuments,
  deleteDocuments,
  persistActiveDocId,
  loadActiveDocId,
} from '../lib/db'

interface DocumentStore {
  documents: Document[]
  activeDocId: string | null
  _hydrated: boolean
  _migrationCount: number
  _docsVersion: number
  createDocument: (content?: string, title?: string) => string
  createDocuments: (entries: { content: string; title: string }[]) => string[]
  updateContent: (id: string, content: string) => void
  updateTitle: (id: string, title: string) => void
  setActiveDoc: (id: string | null) => void
  updateScrollPosition: (id: string, position: number) => void
  removeDocuments: (ids: string[]) => void
  getActiveDoc: () => Document | undefined
}

export const useDocumentStore = create<DocumentStore>()((set, get) => ({
  documents: [],
  activeDocId: null,
  _hydrated: false,
  _migrationCount: 0,
  _docsVersion: 0,

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
    }))
    deleteDocuments(ids)
  },

  getActiveDoc: () => {
    const { documents, activeDocId } = get()
    return documents.find((d) => d.id === activeDocId)
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
    const activeDocId = loadActiveDocId()

    useDocumentStore.setState({
      documents: docs,
      activeDocId,
      _hydrated: true,
      _migrationCount: migrated,
      _docsVersion: 1,
    })

    if (migrated > 0) {
      onMigrated?.(migrated)
    }
  })()
  return hydrationPromise
}

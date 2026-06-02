import { create } from 'zustand'
import type { Document } from '../types'
import {
  migrateFromLocalStorage,
  loadAllDocuments,
  saveDocument,
  deleteDocuments,
  persistActiveDocId,
  loadActiveDocId,
} from '../lib/db'

interface DocumentStore {
  documents: Document[]
  activeDocId: string | null
  _hydrated: boolean
  _migrationCount: number
  createDocument: (content?: string, title?: string) => string
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

  createDocument: (content = '', title = 'Untitled') => {
    const id = crypto.randomUUID()
    const doc: Document = {
      id,
      title,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastScrollPosition: 0,
    }
    set((s) => ({
      documents: [...s.documents, doc],
      activeDocId: id,
    }))
    saveDocument(doc)
    persistActiveDocId(id)
    return id
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
    }))
    const doc = get().documents.find((d) => d.id === id)
    if (doc) saveDocument(doc)
  },

  setActiveDoc: (id) => {
    set({ activeDocId: id })
    persistActiveDocId(id)
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
    })

    if (migrated > 0) {
      onMigrated?.(migrated)
    }
  })()
  return hydrationPromise
}

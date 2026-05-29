import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Document } from '../types'

interface DocumentStore {
  documents: Document[]
  activeDocId: string | null
  createDocument: (content?: string, title?: string) => string
  updateContent: (id: string, content: string) => void
  updateTitle: (id: string, title: string) => void
  setActiveDoc: (id: string | null) => void
  updateScrollPosition: (id: string, position: number) => void
  removeDocuments: (ids: string[]) => void
  getActiveDoc: () => Document | undefined
}

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set, get) => ({
      documents: [],
      activeDocId: null,

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
        return id
      },

      updateContent: (id, content) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, content, updatedAt: Date.now() } : d
          ),
        })),

      updateTitle: (id, title) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, title, updatedAt: Date.now() } : d
          ),
        })),

      setActiveDoc: (id) => set({ activeDocId: id }),

      updateScrollPosition: (id, position) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, lastScrollPosition: position } : d
          ),
        })),

      removeDocuments: (ids) =>
        set((s) => ({
          documents: s.documents.filter((d) => !ids.includes(d.id)),
          activeDocId: s.activeDocId && ids.includes(s.activeDocId)
            ? (s.documents.find((d) => !ids.includes(d.id))?.id ?? null)
            : s.activeDocId,
        })),

      getActiveDoc: () => {
        const { documents, activeDocId } = get()
        return documents.find((d) => d.id === activeDocId)
      },
    }),
    {
      name: 'inkview-documents',
      partialize: (state) => ({
        documents: state.documents,
        activeDocId: state.activeDocId,
      }),
    }
  )
)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDocumentStore } from './document-store'

export interface PendingChange {
  id: string
  documentId: string
  toolName: string
  title: string
  originalContent: string
  newContent: string
  createdAt: number
  oldString?: string
  newString?: string
}

export type DiffLine = { type: 'equal' | 'insert' | 'delete'; value: string }

export function computeDiff(original: string, modified: string): DiffLine[] {
  const dropTrailingEmpty = (a: string[]) =>
    a.length > 0 && a[a.length - 1] === '' ? a.slice(0, -1) : a
  const oLines = dropTrailingEmpty(original.split('\n'))
  const mLines = dropTrailingEmpty(modified.split('\n'))
  const oLen = oLines.length
  const mLen = mLines.length
  const dp: number[][] = Array.from({ length: oLen + 1 }, () => Array(mLen + 1).fill(0))

  for (let i = 1; i <= oLen; i++) {
    for (let j = 1; j <= mLen; j++) {
      dp[i][j] = oLines[i - 1] === mLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const result: DiffLine[] = []
  let i = oLen, j = mLen
  const temp: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oLines[i - 1] === mLines[j - 1]) {
      temp.push({ type: 'equal', value: oLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: 'insert', value: mLines[j - 1] })
      j--
    } else {
      temp.push({ type: 'delete', value: oLines[i - 1] })
      i--
    }
  }

  for (let k = temp.length - 1; k >= 0; k--) result.push(temp[k])
  return result
}

export function applyChange(change: PendingChange): void {
  const store = useDocumentStore.getState()
  const existing = store.documents.find((d) => d.id === change.documentId)

  if (existing) {
    if (change.oldString !== undefined && change.newString !== undefined && change.oldString) {
      const idx = existing.content.indexOf(change.oldString)
      if (idx !== -1) {
        const content = existing.content.slice(0, idx) + change.newString + existing.content.slice(idx + change.oldString.length)
        store.updateContent(change.documentId, content)
        if (change.title !== existing.title) {
          store.updateTitle(change.documentId, change.title)
        }
        return
      }
    }
    store.updateContent(change.documentId, change.newContent)
    if (change.title !== existing.title) {
      store.updateTitle(change.documentId, change.title)
    }
  } else {
    store.createDocument(change.newContent, change.title, change.documentId)
  }
}

interface PendingChangesStore {
  changes: PendingChange[]
  editedContent: Record<string, string>
  addChange: (change: PendingChange) => void
  approveChange: (id: string) => void
  rejectChange: (id: string) => void
  approveAll: (documentId: string) => void
  rejectAll: (documentId: string) => void
  setEditedContent: (documentId: string, content: string) => void
  clearEditedContent: (documentId: string) => void
  getChangesForDocument: (documentId: string) => PendingChange[]
  hasPendingChangesForDocument: (documentId: string) => boolean
}

export function getCumulativeContent(documentId: string): string | null {
  const store = usePendingChangesStore.getState()

  const edited = store.editedContent[documentId]
  if (edited !== undefined) return edited

  const changes = store.getChangesForDocument(documentId)
  if (changes.length === 0) return null

  let content = changes[0].originalContent

  for (const change of changes) {
    if (change.oldString !== undefined && change.newString !== undefined && change.oldString) {
      const idx = content.indexOf(change.oldString)
      if (idx !== -1) {
        content = content.slice(0, idx) + change.newString + content.slice(idx + change.oldString.length)
      } else if (change.newContent) {
        content = change.newContent
      }
    } else {
      content = change.newContent
    }
  }

  return content
}

function saveToDocumentStore(documentId: string, content: string, fallbackTitle?: string) {
  const docStore = useDocumentStore.getState()
  const existing = docStore.documents.find((d) => d.id === documentId)
  if (existing) {
    docStore.updateContent(documentId, content)
  } else if (fallbackTitle) {
    docStore.createDocument(content, fallbackTitle, documentId)
  }
}

export const usePendingChangesStore = create<PendingChangesStore>()(
  persist(
    (set, get) => ({
      changes: [],
      editedContent: {},

      addChange: (change) =>
        set((s) => {
          const edited = s.editedContent[change.documentId]
          if (edited !== undefined) {
            let updated = edited
            if (change.oldString !== undefined && change.newString !== undefined && change.oldString) {
              const idx = updated.indexOf(change.oldString)
              if (idx !== -1) {
                updated = updated.slice(0, idx) + change.newString + updated.slice(idx + change.oldString.length)
              }
            } else {
              updated = change.newContent
            }
            return {
              changes: [...s.changes, change],
              editedContent: { ...s.editedContent, [change.documentId]: updated },
            }
          }
          return { changes: [...s.changes, change] }
        }),

      approveChange: (id) => {
        const change = get().changes.find((c) => c.id === id)
        if (!change) return
        applyChange(change)
        set((s) => ({ changes: s.changes.filter((c) => c.id !== id) }))
      },

      rejectChange: (id) =>
        set((s) => ({ changes: s.changes.filter((c) => c.id !== id) })),

      approveAll: (documentId) => {
        const state = get()
        const docChanges = state.changes.filter((c) => c.documentId === documentId)
        if (docChanges.length === 0) return

        const edited = state.editedContent[documentId]
        if (edited !== undefined) {
          saveToDocumentStore(documentId, edited, docChanges[0]?.title)
        } else {
          saveToDocumentStore(documentId, getCumulativeContent(documentId) ?? '', docChanges[0]?.title)
        }

        set((s) => {
          const { [documentId]: _, ...rest } = s.editedContent
          return {
            changes: s.changes.filter((c) => c.documentId !== documentId),
            editedContent: rest,
          }
        })
      },

      rejectAll: (documentId) =>
        set((s) => {
          const { [documentId]: _, ...rest } = s.editedContent
          return {
            changes: s.changes.filter((c) => c.documentId !== documentId),
            editedContent: rest,
          }
        }),

      setEditedContent: (documentId, content) =>
        set((s) => ({ editedContent: { ...s.editedContent, [documentId]: content } })),

      clearEditedContent: (documentId) =>
        set((s) => {
          const { [documentId]: _, ...rest } = s.editedContent
          return { editedContent: rest }
        }),

      getChangesForDocument: (documentId) =>
        get().changes.filter((c) => c.documentId === documentId),

      hasPendingChangesForDocument: (documentId) =>
        get().changes.some((c) => c.documentId === documentId),
    }),
    { name: 'inkview-pending-changes' },
  ),
)

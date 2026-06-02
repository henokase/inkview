import Dexie, { type EntityTable } from 'dexie'
import type { Document, Folder } from '../types'

const LOCALSTORAGE_KEY = 'inkview-documents'
const ACTIVE_DOC_KEY = 'inkview-active-doc'

const db = new Dexie('InkViewDB') as Dexie & {
  documents: EntityTable<Document, 'id'>
  folders: EntityTable<Folder, 'id'>
}

db.version(1).stores({
  documents: 'id, updatedAt',
})

db.version(2).stores({
  documents: 'id, updatedAt',
  folders: 'id, name',
})

function extractFirstHeading(markdown: string): string | null {
  const lines = markdown.trim().split('\n')
  let inCodeBlock = false
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const match = /^#\s+(.+)$/.exec(line)
    if (match) return match[1].trim()
  }
  return null
}

export async function migrateFromLocalStorage(): Promise<number> {
  const raw = localStorage.getItem(LOCALSTORAGE_KEY)
  if (!raw) return 0

  try {
    const parsed = JSON.parse(raw)
    let docs: Document[] = parsed?.state?.documents ?? []
    if (docs.length === 0) return 0

    docs = docs.map((doc) => ({
      ...doc,
      title: doc.title || extractFirstHeading(doc.content) || 'Untitled',
      lastAccessedAt: (doc as any).lastAccessedAt || doc.updatedAt,
    }))

    await db.documents.bulkPut(docs)

    const activeDocId = parsed?.state?.activeDocId ?? null
    if (activeDocId) {
      localStorage.setItem(ACTIVE_DOC_KEY, activeDocId)
    }

    localStorage.removeItem(LOCALSTORAGE_KEY)
    return docs.length
  } catch {
    return 0
  }
}

export async function loadAllDocuments(): Promise<Document[]> {
  return db.documents.orderBy('updatedAt').reverse().toArray()
}

export async function saveDocument(doc: Document): Promise<void> {
  await db.documents.put(doc)
}

export async function bulkSaveDocuments(docs: Document[]): Promise<void> {
  await db.documents.bulkPut(docs)
}

export async function deleteDocuments(ids: string[]): Promise<void> {
  await db.documents.bulkDelete(ids)
}

export async function loadAllFolders(): Promise<Folder[]> {
  return db.folders.toArray()
}

export async function saveFolder(folder: Folder): Promise<void> {
  await db.folders.put(folder)
}

export async function bulkSaveFolders(folders: Folder[]): Promise<void> {
  await db.folders.bulkPut(folders)
}

export async function deleteFolders(ids: string[]): Promise<void> {
  await db.folders.bulkDelete(ids)
}

export function persistActiveDocId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_DOC_KEY, id)
  } else {
    localStorage.removeItem(ACTIVE_DOC_KEY)
  }
}

export function loadActiveDocId(): string | null {
  return localStorage.getItem(ACTIVE_DOC_KEY)
}

export { db }

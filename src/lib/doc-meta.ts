import type { EditorMode } from '../types'

const DOC_META_KEY = 'inkview-doc-states'

export interface DocMeta {
  lastMode?: EditorMode
  lastLine?: number
  lastScrollPosition?: number
  lastAccessedAt?: number
}

export type DocMetaMap = Record<string, DocMeta>

export function getAllDocMeta(): DocMetaMap {
  try {
    const raw = localStorage.getItem(DOC_META_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function getDocMeta(docId: string): DocMeta | undefined {
  if (!docId) return undefined
  const all = getAllDocMeta()
  return all[docId]
}

export function saveDocMeta(docId: string, updates: Partial<DocMeta>): void {
  if (!docId) return
  try {
    const all = getAllDocMeta()
    const existing = all[docId] || {}
    all[docId] = {
      ...existing,
      ...updates,
      lastAccessedAt: Date.now(),
    }
    localStorage.setItem(DOC_META_KEY, JSON.stringify(all))
  } catch {
    // Ignore quota or storage error
  }
}

export function removeDocMeta(docIds: string[]): void {
  try {
    const all = getAllDocMeta()
    let changed = false
    for (const id of docIds) {
      if (all[id]) {
        delete all[id]
        changed = true
      }
    }
    if (changed) {
      localStorage.setItem(DOC_META_KEY, JSON.stringify(all))
    }
  } catch {
    // Ignore error
  }
}

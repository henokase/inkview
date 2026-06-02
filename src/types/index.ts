export interface Document {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  lastAccessedAt: number
  lastScrollPosition: number
}

export interface Folder {
  id: string
  name: string
  documentIds: string[]
  createdAt: number
  updatedAt: number
}

export interface ShareEntry {
  title: string
  content: string
}

export interface ShareResponse {
  content?: string
  documents?: ShareEntry[]
  folderName?: string
}

export interface TocHeading {
  id: string
  text: string
  level: number
}

export type ThemeMode = 'light' | 'dark' | 'system'

export type EditorMode = 'edit' | 'preview' | 'split'

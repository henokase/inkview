export interface Document {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  lastScrollPosition: number
}

export interface TocHeading {
  id: string
  text: string
  level: number
}

export type ThemeMode = 'light' | 'dark' | 'system'

export type EditorMode = 'edit' | 'preview' | 'split'

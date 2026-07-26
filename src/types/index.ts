export interface Document {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  lastAccessedAt: number
  lastScrollPosition: number
  lastLine?: number
  lastMode?: EditorMode
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
  title?: string
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

export interface ToolCallPart {
  id: string
  type: 'tool_call'
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResultPart {
  id: string
  name: string
  result: string
  isError?: boolean
}

export interface TextPart {
  type: 'text'
  text: string
}

export interface ReasoningPart {
  type: 'reasoning'
  text: string
}

export interface ToolPart {
  id: string
  type: 'tool'
  name: string
  args: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: string
  error?: string
  metadata?: Record<string, unknown>
  startTime: number
  endTime?: number
}

export type Part = TextPart | ReasoningPart | ToolPart

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  tokensPrompt?: number
  tokensCompletion?: number
  parts?: Part[]
}

export interface Conversation {
  id: string
  documentId: string
  title: string
  createdAt: number
  updatedAt: number
}

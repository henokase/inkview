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
  type: 'tool_result'
  name: string
  result: string
  isError?: boolean
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  createdAt: number
  tokensPrompt?: number
  tokensCompletion?: number
  toolCalls?: ToolCallPart[]
  toolResults?: ToolResultPart[]
  contentParts?: string[]
}

export interface Conversation {
  id: string
  documentId: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface StreamChunk {
  content: string
  reasoning: string
  done: boolean
  usage?: { promptTokens: number; completionTokens: number }
}

export interface Usage {
  promptTokens: number
  completionTokens: number
}

export interface ApiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamCallbacks {
  onChunk: (chunk: StreamChunk) => void
  onUsage?: (usage: Usage) => void
  onError?: (error: Error) => void
  onDone?: () => void
}

export interface LLMConfig {
  model: string
  baseUrl: string
}

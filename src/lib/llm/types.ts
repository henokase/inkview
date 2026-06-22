export interface ToolCallChunk {
  id: string
  index: number
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface StreamChunk {
  content: string
  reasoning: string
  toolCalls?: ToolCallChunk[]
  done: boolean
  usage?: { promptTokens: number; completionTokens: number }
}

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-input-delta'; index: number; id: string; name: string; arguments: string }
  | { type: 'tool-call'; calls: ToolCallChunk[] }
  | { type: 'done'; usage?: Usage }

export interface Usage {
  promptTokens: number
  completionTokens: number
}

export interface ApiMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

export interface ToolResultMessage {
  role: 'tool'
  tool_call_id: string
  content: string
}

export interface ApiTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface StreamCallbacks {
  onChunk: (chunk: StreamChunk) => void
  onUsage?: (usage: Usage) => void
  onError?: (error: Error) => void
  onDone?: () => void
  onToolCalls?: (toolCalls: ToolCallChunk[]) => void
}

export interface LLMConfig {
  model: string
  baseUrl: string
}

export interface ToolDefinition {
  id: string
  description: string
  parameters: Record<string, ToolParameter>
  permission: string
  jsonSchema: Record<string, unknown>
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required?: boolean
  items?: ToolParameter
  properties?: Record<string, ToolParameter>
}

export interface ToolContext {
  sessionId: string
  callId: string
  abortSignal: AbortSignal
  evaluatePermission: (permission: string, pattern: string) => PermissionAction
}

export interface ToolResult {
  title: string
  output: string
  metadata?: Record<string, unknown>
}

export interface ToolCallState {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: ToolResult
  error?: string
  startTime: number
  endTime?: number
}

export interface PermissionRule {
  permission: string
  pattern: string
  action: PermissionAction
}

export type PermissionAction = 'allow' | 'ask' | 'deny'

export interface AgentInfo {
  name: string
  description?: string
  permission: PermissionRule[]
  model?: string
  prompt?: string
}

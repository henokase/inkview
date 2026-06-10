import { LLMClient } from '../llm/client'
import type { ApiMessage, StreamChunk, Usage, ToolCallChunk } from '../llm/types'
import { ToolRegistry, toolRegistry } from './tool-registry'
import { evaluatePermission } from './permission'
import type { ToolDefinition, ToolCallState, PermissionRule, ToolResult } from './types'

export interface PermissionRequest {
  id: string
  permission: string
  toolName: string
  args: Record<string, unknown>
}

export interface AgentLoopOptions {
  signal: AbortSignal
  maxTurns?: number
  agentPermissions?: PermissionRule[]
  onChunk: (chunk: StreamChunk) => void
  onToolCall?: (call: ToolCallState) => void
  onToolResult?: (result: ToolCallState) => void
  onAgentState?: (state: { turn: number; maxTurns: number }) => void
  onUsage?: (usage: Usage) => void
  onDone?: () => void
  onError?: (error: Error) => void
  onPermissionRequest?: (request: PermissionRequest) => Promise<'allow' | 'deny'>
}

export class AgentEngine {
  private client: LLMClient
  private registry: ToolRegistry

  constructor(client?: LLMClient, registry?: ToolRegistry) {
    this.client = client ?? new LLMClient()
    this.registry = registry ?? toolRegistry
  }

  async agentLoop(
    initialMessages: ApiMessage[],
    options: AgentLoopOptions,
  ): Promise<void> {
    const MAX_TURNS = options.maxTurns ?? 10
    const messages: ApiMessage[] = [...initialMessages]
    let turn = 0

    while (turn < MAX_TURNS) {
      turn++
      options.onAgentState?.({ turn, maxTurns: MAX_TURNS })

      const tools = this.registry.getAllowedTools(options.agentPermissions)
      const apiTools = this.registry.toApiTools(tools)
      let collectedToolCalls: ToolCallChunk[] = []

      try {
        for await (const chunk of this.client.streamChat(
          messages,
          options.signal,
          apiTools.length > 0 ? apiTools : undefined,
        )) {
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            collectedToolCalls.push(...chunk.toolCalls)
            if (chunk.content || chunk.reasoning) {
              options.onChunk({ content: chunk.content, reasoning: chunk.reasoning, done: false })
            }
          } else if (!chunk.done) {
            options.onChunk(chunk)
          }

          if (chunk.usage) {
            options.onUsage?.(chunk.usage)
          }
        }
      } catch (err) {
        if (options.signal.aborted) {
          options.onDone?.()
          return
        }
        options.onError?.(err instanceof Error ? err : new Error(String(err)))
        return
      }

      if (collectedToolCalls.length === 0) {
        options.onDone?.()
        return
      }

      const toolResults: Array<{ id: string; error?: string; result?: ToolResult }> = []

      for (const tc of collectedToolCalls) {
        const state: ToolCallState = {
          id: tc.id,
          name: tc.function.name,
          args: this._parseArgs(tc.function.arguments),
          status: 'pending',
          startTime: Date.now(),
        }

        const toolDef = this.registry.get(tc.function.name)

        state.status = 'running'
        options.onToolCall?.({ ...state })

        if (!toolDef) {
          state.status = 'failed'
          state.error = `Unknown tool: ${tc.function.name}`
          state.endTime = Date.now()
          options.onToolResult?.({ ...state })
          toolResults.push({ id: tc.id, error: state.error })
          continue
        }

        const action = evaluatePermission(
          toolDef.permission,
          '*',
          options.agentPermissions ?? [],
        )

        if (action === 'deny') {
          state.status = 'failed'
          state.error = `Permission denied: ${toolDef.permission}`
          state.endTime = Date.now()
          options.onToolResult?.({ ...state })
          toolResults.push({ id: tc.id, error: state.error })
          continue
        }

        if (action === 'ask') {
          if (!options.onPermissionRequest) {
            state.status = 'failed'
            state.error = `Permission required: ${toolDef.permission}`
            state.endTime = Date.now()
            options.onToolResult?.({ ...state })
            toolResults.push({ id: tc.id, error: state.error })
            continue
          }
          try {
            const decision = await options.onPermissionRequest({
              id: tc.id,
              permission: toolDef.permission,
              toolName: tc.function.name,
              args: this._parseArgs(tc.function.arguments),
            })
            if (decision === 'deny') {
              state.status = 'failed'
              state.error = `Permission denied by user: ${toolDef.permission}`
              state.endTime = Date.now()
              options.onToolResult?.({ ...state })
              toolResults.push({ id: tc.id, error: state.error })
              continue
            }
          } catch {
            state.status = 'failed'
            state.error = `Permission request cancelled: ${toolDef.permission}`
            state.endTime = Date.now()
            options.onToolResult?.({ ...state })
            toolResults.push({ id: tc.id, error: state.error })
            continue
          }
        }

        try {
          const args = this._parseArgs(tc.function.arguments)
          const result = await toolDef.execute(args, {
            sessionId: '',
            callId: tc.id,
            abortSignal: options.signal,
            evaluatePermission: (perm, pattern) =>
              evaluatePermission(perm, pattern, options.agentPermissions ?? []),
          })

          state.status = 'completed'
          state.result = result
          state.endTime = Date.now()
          options.onToolResult?.({ ...state })
          toolResults.push({ id: tc.id, result })
        } catch (err) {
          state.status = 'failed'
          state.error = err instanceof Error ? err.message : String(err)
          state.endTime = Date.now()
          options.onToolResult?.({ ...state })
          toolResults.push({ id: tc.id, error: state.error })
        }
      }

      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: collectedToolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      })

      for (const r of toolResults) {
        messages.push({
          role: 'tool' as const,
          tool_call_id: r.id,
          content: r.error || r.result!.output,
        })
      }
    }

    if (turn >= MAX_TURNS) {
      options.onChunk({
        content: '\n\n*Reached maximum steps. Please refine your request.*',
        reasoning: '',
        done: false,
      })
    }
    options.onDone?.()
  }

  private _abortController: AbortController | null = null

  setAbortController(ctrl: AbortController): void {
    this._abortController = ctrl
  }

  stop(): void {
    this._abortController?.abort()
    this._abortController = null
  }

  private _parseArgs(argsStr: string): Record<string, unknown> {
    try {
      return JSON.parse(argsStr)
    } catch {
      return {}
    }
  }
}

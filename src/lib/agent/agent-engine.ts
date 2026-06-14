import { LLMClient } from '../llm/client'
import type { ApiMessage, StreamChunk, Usage, ToolCallChunk } from '../llm/types'
import { ToolRegistry, toolRegistry } from './tool-registry'
import { evaluatePermission } from './permission'
import type { PendingChangeInfo, ToolCallState, PermissionRule, ToolResult } from './types'
import { useDocumentStore } from '../../stores/document-store'

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
  onTurnStart?: () => void
  onUsage?: (usage: Usage) => void
  onDone?: () => void
  onError?: (error: Error) => void
  onPermissionRequest?: (request: PermissionRequest) => Promise<'allow' | 'deny'>
  onPendingChange?: (change: PendingChangeInfo) => void
}

export class AgentEngine {
  private client: LLMClient
  private registry: ToolRegistry
  private readDocumentIds = new Set<string>()

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
    this.readDocumentIds = new Set<string>()
    let turn = 0

    while (turn < MAX_TURNS) {
      turn++
      options.onAgentState?.({ turn, maxTurns: MAX_TURNS })
      options.onTurnStart?.()

      const tools = this.registry.getAllowedTools(options.agentPermissions)
      const apiTools = this.registry.toApiTools(tools)
      let collectedToolCalls: ToolCallChunk[] = []
      let reasoningLoggedThisTurn = false

      try {
        for await (const chunk of this.client.streamChat(
          messages,
          options.signal,
          apiTools.length > 0 ? apiTools : undefined,
        )) {
          if (chunk.reasoning && !reasoningLoggedThisTurn) {
            console.log(`[Agent] Reasoning start (turn ${turn})`)
            reasoningLoggedThisTurn = true
          }
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
        console.log(`[Agent] Tool call: ${tc.function.name}`, this._parseArgs(tc.function.arguments))
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

        const isModifyingTool = tc.function.name === 'editDoc' || tc.function.name === 'writeDoc'
        const isReadTool = tc.function.name === 'readDoc'

        if (isModifyingTool) {
          const docId = this._parseArgs(tc.function.arguments).documentId as string | undefined
          if (docId && !this.readDocumentIds.has(docId)) {
            const doc = useDocumentStore.getState().documents.find((d) => d.id === docId)
            if (doc) {
              state.status = 'failed'
              state.error = `Cannot edit "${doc.title}" without reading it first. Use readDoc to read the document before editing.`
              state.endTime = Date.now()
              options.onToolResult?.({ ...state })
              toolResults.push({ id: tc.id, error: state.error })
              continue
            }
          }
        }

        // Yield to event loop so React flushes the loading state and the browser paints
        // before the tool executes. Using requestAnimationFrame + setTimeout ensures the
        // intermediate "running" state is painted even when the tool completes quickly.
        await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))

        try {
          let docSnapshot: string | null = null
          if (isModifyingTool || tc.function.name === 'createDoc') {
            const docId = this._parseArgs(tc.function.arguments).documentId as string | undefined
            if (docId) {
              const doc = useDocumentStore.getState().documents.find((d) => d.id === docId)
              docSnapshot = doc?.content ?? null
            }
          }

          const args = this._parseArgs(tc.function.arguments)
          const result = await toolDef.execute(args, {
            sessionId: '',
            callId: tc.id,
            abortSignal: options.signal,
            evaluatePermission: (perm, pattern) =>
              evaluatePermission(perm, pattern, options.agentPermissions ?? []),
            onPendingChange: options.onPendingChange,
          })

          if (isReadTool && result.metadata?.id) {
            this.readDocumentIds.add(result.metadata.id as string)
          }

          if (docSnapshot !== null && result.metadata?.pending) {
            const store = useDocumentStore.getState()
            const doc = store.documents.find((d) => d.id === this._parseArgs(tc.function.arguments).documentId)
            if (doc && doc.content !== docSnapshot) {
              store.updateContent(doc.id, docSnapshot)
            }
          }

          const isErrorResult = result.title === 'Error' || result.title === 'Not found'
          state.status = isErrorResult ? 'failed' : 'completed'
          state.error = isErrorResult ? result.output : undefined
          state.result = isErrorResult ? undefined : result
          state.endTime = Date.now()
          console.log(`[Agent] Tool complete: ${tc.function.name}`, { status: state.status, duration: state.endTime - state.startTime })
          options.onToolResult?.({ ...state })
          toolResults.push(isErrorResult
            ? { id: tc.id, error: result.output }
            : { id: tc.id, result })
        } catch (err) {
          state.status = 'failed'
          state.error = err instanceof Error ? err.message : String(err)
          state.endTime = Date.now()
          console.log(`[Agent] Tool failed: ${tc.function.name}`, { error: state.error, duration: state.endTime - state.startTime })
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

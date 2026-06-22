import { LLMClient } from '../llm/client'
import type { ApiMessage, StreamEvent, Usage, ToolCallChunk } from '../llm/types'
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
  onChunk: (chunk: { content: string; reasoning: string; done: boolean }) => void
  onToolCall?: (call: ToolCallState) => void
  onToolResult?: (result: ToolCallState) => void
  onAgentState?: (state: { turn: number; maxTurns: number }) => void
  onTurnStart?: () => void
  onUsage?: (usage: Usage) => void
  onDone?: () => void
  onError?: (error: Error) => void
  onPermissionRequest?: (request: PermissionRequest) => Promise<'allow' | 'deny'>
  onPendingChange?: (change: PendingChangeInfo) => void
  onToolProgress?: (data: { id: string; title?: string; metadata?: Record<string, unknown> }) => void
}

export class AgentEngine {
  private client: LLMClient
  private registry: ToolRegistry
  private readDocumentIds = new Set<string>()
  private _doomTracker: Array<{ name: string; argsJson: string }> = []

  constructor(client?: LLMClient, registry?: ToolRegistry) {
    this.client = client ?? new LLMClient()
    this.registry = registry ?? toolRegistry
  }

  markDocumentAsRead(docId: string) {
    this.readDocumentIds.add(docId)
  }

  private _checkDoomLoop(name: string, args: Record<string, unknown>): string | null {
    const argsJson = JSON.stringify(args)
    this._doomTracker.push({ name, argsJson })
    const len = this._doomTracker.length
    if (len >= 3) {
      const last3 = this._doomTracker.slice(-3)
      if (last3.every(t => t.name === name && t.argsJson === argsJson)) {
        return `Tool "${name}" called 3 times consecutively with identical arguments. This appears to be a loop — skipping.`
      }
    }
    return null
  }

  async agentLoop(
    initialMessages: ApiMessage[],
    options: AgentLoopOptions,
  ): Promise<void> {
    const MAX_TURNS = options.maxTurns ?? 50
    const messages: ApiMessage[] = [...initialMessages]
    this.readDocumentIds = new Set<string>()
    this._doomTracker = []
    let turn = 0

    while (turn < MAX_TURNS) {
      turn++
      options.onAgentState?.({ turn, maxTurns: MAX_TURNS })
      options.onTurnStart?.()

      const tools = this.registry.getAllowedTools(options.agentPermissions)
      const apiTools = this.registry.toApiTools(tools)
      let collectedToolCalls: ToolCallChunk[] = []
      let lastStreamError: Error | undefined
      const MAX_STREAM_RETRIES = 2

      for (let streamAttempt = 0; streamAttempt <= MAX_STREAM_RETRIES; streamAttempt++) {
        collectedToolCalls = []

        if (streamAttempt > 0) {
          options.onChunk({
            content: '',
            reasoning: `[Retrying stream (attempt ${streamAttempt}/${MAX_STREAM_RETRIES})...]`,
            done: false,
          })
        }

        try {
          for await (const event of this.client.streamChat(
            messages,
            options.signal,
            apiTools.length > 0 ? apiTools : undefined,
          )) {
            switch (event.type) {
              case 'text':
                options.onChunk({ content: event.content, reasoning: '', done: false })
                break
              case 'reasoning':
                options.onChunk({ content: '', reasoning: event.text, done: false })
                break
              case 'tool-input-delta':
                // Incremental tool args available for UI but collected at tool-call
                break
              case 'tool-call':
                for (const tc of event.calls) {
                  collectedToolCalls.push(tc)
                  options.onToolCall?.({
                    id: tc.id,
                    name: tc.function.name,
                    args: this._parseArgs(tc.function.arguments),
                    status: 'pending',
                    startTime: Date.now(),
                  })
                }
                break
              case 'done':
                if (event.usage) {
                  options.onUsage?.(event.usage)
                }
                break
            }
          }
          break
        } catch (err) {
          if (options.signal.aborted) {
            options.onDone?.()
            return
          }
          lastStreamError = err instanceof Error ? err : new Error(String(err))
          if (streamAttempt < MAX_STREAM_RETRIES) continue
          options.onError?.(lastStreamError)
          return
        }
      }

      if (options.signal.aborted || collectedToolCalls.length === 0) {
        options.onDone?.()
        return
      }

      const toolResults: Array<{ id: string; error?: string; result?: ToolResult }> = []

      for (const tc of collectedToolCalls) {
        const toolDef = this.registry.get(tc.function.name)

        if (!toolDef) {
          options.onToolResult?.({
            id: tc.id,
            name: tc.function.name,
            args: this._parseArgs(tc.function.arguments),
            status: 'failed',
            error: `Unknown tool: ${tc.function.name}`,
            startTime: Date.now(),
            endTime: Date.now(),
          })
          toolResults.push({ id: tc.id, error: `Unknown tool: ${tc.function.name}` })
          continue
        }

        const action = evaluatePermission(
          toolDef.permission,
          '*',
          options.agentPermissions ?? [],
        )

        if (action === 'deny') {
          options.onToolResult?.({
            id: tc.id,
            name: tc.function.name,
            args: this._parseArgs(tc.function.arguments),
            status: 'failed',
            error: `Permission denied: ${toolDef.permission}`,
            startTime: Date.now(),
            endTime: Date.now(),
          })
          toolResults.push({ id: tc.id, error: `Permission denied: ${toolDef.permission}` })
          continue
        }

        if (action === 'ask') {
          if (!options.onPermissionRequest) {
            options.onToolResult?.({
              id: tc.id,
              name: tc.function.name,
              args: this._parseArgs(tc.function.arguments),
              status: 'failed',
              error: `Permission required: ${toolDef.permission}`,
              startTime: Date.now(),
              endTime: Date.now(),
            })
            toolResults.push({ id: tc.id, error: `Permission required: ${toolDef.permission}` })
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
              options.onToolResult?.({
                id: tc.id,
                name: tc.function.name,
                args: this._parseArgs(tc.function.arguments),
                status: 'failed',
                error: `Permission denied by user: ${toolDef.permission}`,
                startTime: Date.now(),
                endTime: Date.now(),
              })
              toolResults.push({ id: tc.id, error: `Permission denied by user: ${toolDef.permission}` })
              continue
            }
          } catch {
            options.onToolResult?.({
              id: tc.id,
              name: tc.function.name,
              args: this._parseArgs(tc.function.arguments),
              status: 'failed',
              error: `Permission request cancelled: ${toolDef.permission}`,
              startTime: Date.now(),
              endTime: Date.now(),
            })
            toolResults.push({ id: tc.id, error: `Permission request cancelled: ${toolDef.permission}` })
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
              options.onToolResult?.({
                id: tc.id,
                name: tc.function.name,
                args: this._parseArgs(tc.function.arguments),
                status: 'failed',
                error: `Cannot edit "${doc.title}" without reading it first. Use readDoc to read the document before editing.`,
                startTime: Date.now(),
                endTime: Date.now(),
              })
              toolResults.push({ id: tc.id, error: `Cannot edit "${doc.title}" without reading it first.` })
              continue
            }
          }
        }

        // Doom loop detection: 3 identical consecutive tool calls
        const doomError = this._checkDoomLoop(tc.function.name, this._parseArgs(tc.function.arguments))
        if (doomError) {
          options.onToolResult?.({
            id: tc.id,
            name: tc.function.name,
            args: this._parseArgs(tc.function.arguments),
            status: 'failed',
            error: doomError,
            startTime: Date.now(),
            endTime: Date.now(),
          })
          toolResults.push({ id: tc.id, error: doomError })
          continue
        }

        // Transition from pending to running
        options.onToolCall?.({
          id: tc.id,
          name: tc.function.name,
          args: this._parseArgs(tc.function.arguments),
          status: 'running',
          startTime: Date.now(),
        })

        // Yield to event loop so React flushes the loading state and the browser paints
        await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))

        try {
          let docSnapshot: string | null = null
          if (isModifyingTool) {
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
            onProgress: options.onToolProgress
              ? (data) => options.onToolProgress!({ id: tc.id, ...data })
              : undefined,
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
          options.onToolResult?.({
            id: tc.id,
            name: tc.function.name,
            args: this._parseArgs(tc.function.arguments),
            status: isErrorResult ? 'failed' : 'completed',
            error: isErrorResult ? result.output : undefined,
            result: isErrorResult ? undefined : result,
            startTime: Date.now(),
            endTime: Date.now(),
          })
          toolResults.push(isErrorResult
            ? { id: tc.id, error: result.output }
            : { id: tc.id, result })
        } catch (err) {
          options.onToolResult?.({
            id: tc.id,
            name: tc.function.name,
            args: this._parseArgs(tc.function.arguments),
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            startTime: Date.now(),
            endTime: Date.now(),
          })
          toolResults.push({ id: tc.id, error: err instanceof Error ? err.message : String(err) })
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

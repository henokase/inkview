import type { ApiMessage, ApiTool, StreamCallbacks, Usage } from './types'
import { AbortError } from './errors'
import { LLMClient } from './client'

export class StreamEngine {
  private client: LLMClient
  private abortControllers = new Map<string, AbortController>()
  private flushTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(client?: LLMClient) {
    this.client = client ?? new LLMClient()
  }

  async start(
    id: string,
    messages: ApiMessage[],
    callbacks: StreamCallbacks,
    tools?: ApiTool[],
  ): Promise<void> {
    const abortController = new AbortController()
    this.abortControllers.set(id, abortController)

    let currentContent = ''
    let currentReasoning = ''
    let chunkCount = 0
    const PERSIST_INTERVAL = 30

    const flush = () => {
      this.flushTimeouts.delete(id)
      if (!currentContent && !currentReasoning) return
      const content = currentContent
      const reasoning = currentReasoning
      currentContent = ''
      currentReasoning = ''
      callbacks.onChunk({
        content,
        reasoning,
        done: false,
      })
    }

    const scheduleFlush = () => {
      if (this.flushTimeouts.has(id)) return
      this.flushTimeouts.set(
        id,
        setTimeout(() => flush(), 50),
      )
    }

    try {
      for await (const event of this.client.streamChat(
        messages,
        abortController.signal,
        tools,
      )) {
        switch (event.type) {
          case 'text':
            currentContent += event.content
            chunkCount++
            scheduleFlush()
            if (chunkCount % PERSIST_INTERVAL === 0) flush()
            break
          case 'reasoning':
            currentReasoning += event.text
            chunkCount++
            scheduleFlush()
            if (chunkCount % PERSIST_INTERVAL === 0) flush()
            break
          case 'tool-call':
            flush()
            callbacks.onToolCalls?.(event.calls)
            break
          case 'done':
            flush()
            if (event.usage) {
              callbacks.onUsage?.(event.usage as Usage)
            }
            callbacks.onDone?.()
            return
        }
      }

      flush()
      callbacks.onDone?.()
    } catch (err) {
      if (err instanceof AbortError) {
        flush()
        callbacks.onDone?.()
        return
      }
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))
    } finally {
      this.abortControllers.delete(id)
      const to = this.flushTimeouts.get(id)
      if (to) clearTimeout(to)
      this.flushTimeouts.delete(id)
    }
  }

  stop(id: string): void {
    this.abortControllers.get(id)?.abort()
    this.abortControllers.delete(id)
    const to = this.flushTimeouts.get(id)
    if (to) clearTimeout(to)
    this.flushTimeouts.delete(id)
  }

  hasActive(id: string): boolean {
    return this.abortControllers.has(id)
  }

  cancelAll(): void {
    for (const [id, ctrl] of this.abortControllers) {
      ctrl.abort()
      this.abortControllers.delete(id)
      const to = this.flushTimeouts.get(id)
      if (to) clearTimeout(to)
      this.flushTimeouts.delete(id)
    }
  }
}

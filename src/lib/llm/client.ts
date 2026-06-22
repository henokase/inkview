import type { StreamChunk, StreamEvent, ApiMessage, ApiTool, LLMConfig, ToolCallChunk } from './types'
import {
  LLMError,
  NetworkError,
  mapHttpStatusToError,
} from './errors'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface DeltaToolCall {
  index: number
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

function isValidChunkShape(value: unknown): value is {
  choices?: Array<{
    delta?: {
      content?: string
      reasoning?: string
      reasoning_content?: string
      thinking?: string
      thinking_content?: string
      tool_calls?: DeltaToolCall[]
    }
    message?: { content?: string }
    finish_reason?: string | null
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null
} {
  if (!isObject(value)) return false
  if (value.choices !== undefined && !Array.isArray(value.choices)) return false
  if (value.usage !== undefined && value.usage !== null && !isObject(value.usage)) return false
  return true
}

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export class LLMClient {
  private config: LLMConfig

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      model: config?.model ?? (import.meta.env.VITE_AI_MODEL as string) ?? 'openrouter/free',
      baseUrl: config?.baseUrl ?? '/api-ai',
    }
  }

  private buildMessages(messages: ApiMessage[]) {
    return messages.map((m) => {
      const msg: Record<string, unknown> = { role: m.role }
      if (m.content !== null && m.content !== undefined) msg.content = m.content
      if (m.tool_calls) msg.tool_calls = m.tool_calls
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
      return msg
    })
  }

  private static mapUsage(usage: {
    prompt_tokens?: number
    completion_tokens?: number
  }): { promptTokens: number; completionTokens: number } {
    return {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
    }
  }

  async *streamChat(
    messages: ApiMessage[],
    signal?: AbortSignal,
    tools?: ApiTool[],
  ): AsyncGenerator<StreamEvent> {
    const parsedMessages = this.buildMessages(messages)

    let lastError: Error | undefined
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        yield { type: 'reasoning', text: `[Retrying (attempt ${attempt}/${MAX_RETRIES})...]` }
        await sleep(RETRY_DELAY_MS * attempt)
      }

      const timeoutMs = Number(import.meta.env.VITE_LLM_TIMEOUT_MS) || 300000
      const timeoutSignal = AbortSignal.timeout(timeoutMs)
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal

      try {
        const url = `${this.config.baseUrl}/chat/completions`
        const body: Record<string, unknown> = {
          model: this.config.model,
          messages: parsedMessages,
          stream: true,
        }
        if (tools && tools.length > 0) {
          body.tools = tools
          body.tool_choice = 'auto'
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: combinedSignal,
        })

        if (!response.ok) {
          const bodyText = await response.text().catch(() => '(no body)')
          const err = mapHttpStatusToError(response.status, bodyText)
          if (err.retryable && attempt < MAX_RETRIES) {
            lastError = err
            continue
          }
          throw err
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new NetworkError('Failed to read response stream')
        }

        for await (const event of this.parseSSEStream(reader, combinedSignal)) {
          yield event
        }
        return
      } catch (err) {
        if (combinedSignal.aborted) {
          yield { type: 'done' }
          return
        }
        if (err instanceof LLMError && err.retryable && attempt < MAX_RETRIES) {
          lastError = err
          continue
        }
        if (err instanceof TypeError || err instanceof LLMError) {
          throw err instanceof LLMError ? err : new NetworkError(err.message)
        }
        throw err
      }
    }
    throw lastError ?? new LLMError('Request failed after retries')
  }

  async generateChat(
    messages: ApiMessage[],
    signal?: AbortSignal,
  ): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
    const parsedMessages = this.buildMessages(messages)
    const timeoutMs = Number(import.meta.env.VITE_LLM_TIMEOUT_MS) || 300000
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: parsedMessages,
        stream: false,
      }),
      signal: combinedSignal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => undefined)
      throw mapHttpStatusToError(response.status, body)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }

    const content = data.choices?.[0]?.message?.content ?? ''
    const usage = data.usage ? LLMClient.mapUsage(data.usage) : undefined
    return { content, usage }
  }

  async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const decoder = new TextDecoder()
    let buffer = ''
    const toolCallAccumulator = new Map<number, {
      id: string
      name: string
      arguments: string
    }>()

    function emitToolDelta(index: number, id: string, name: string, argsDelta: string): void {
      // no-op — we yield inline instead
    }

    function flushToolCalls(): ToolCallChunk[] | undefined {
      if (toolCallAccumulator.size === 0) return undefined
      const calls: ToolCallChunk[] = []
      const sorted = Array.from(toolCallAccumulator.entries()).sort(([a], [b]) => a - b)
      for (const [, tc] of sorted) {
        calls.push({
          id: tc.id,
          index: calls.length,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })
      }
      toolCallAccumulator.clear()
      return calls
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            const calls = flushToolCalls()
            if (calls) yield { type: 'tool-call', calls }
            yield { type: 'done' }
            return
          }

          try {
            const parsed = JSON.parse(data)
            if (!isValidChunkShape(parsed)) {
              continue
            }

            const delta = parsed.choices?.[0]?.delta
            const message = parsed.choices?.[0]?.message
            const reasoning = delta?.reasoning ?? delta?.reasoning_content ?? delta?.thinking ?? delta?.thinking_content ?? ''
            const content = (delta?.content || message?.content) ?? ''

            if (reasoning) {
              yield { type: 'reasoning', text: reasoning }
            }

            if (content) {
              yield { type: 'text', content }
            }

            const rawToolCalls = delta?.tool_calls
            if (rawToolCalls && Array.isArray(rawToolCalls)) {
              for (const tc of rawToolCalls) {
                const idx = tc.index
                let acc = toolCallAccumulator.get(idx)
                if (!acc) {
                  acc = { id: tc.id || '', name: tc.function?.name || '', arguments: '' }
                  toolCallAccumulator.set(idx, acc)
                }
                if (tc.id) acc.id = tc.id
                if (tc.function?.name) acc.name = tc.function.name
                if (tc.function?.arguments) {
                  acc.arguments += tc.function.arguments
                  yield { type: 'tool-input-delta', index: idx, id: acc.id, name: acc.name, arguments: tc.function.arguments }
                }
              }
            }

            const finishReason = parsed.choices?.[0]?.finish_reason

            if (finishReason === 'tool_calls') {
              const calls = flushToolCalls()
              const usage = parsed.usage
                ? LLMClient.mapUsage(parsed.usage)
                : undefined
              yield { type: 'tool-call', calls }
              yield { type: 'done', usage }
              return
            }

            if (finishReason) {
              if (!content && message?.content) {
                yield { type: 'text', content: message.content }
              }
              const usage = parsed.usage
                ? LLMClient.mapUsage(parsed.usage)
                : undefined
              yield { type: 'done', usage }
              return
            }
          } catch {
            continue
          }
        }
      }
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        yield { type: 'done' }
        return
      }
      throw err
    } finally {
      reader.cancel().catch(() => {})
    }

    yield { type: 'done' }
  }
}

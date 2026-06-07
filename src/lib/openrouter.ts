const API_KEY = import.meta.env.VITE_AI_API_KEY
const MODEL = import.meta.env.VITE_AI_MODEL || 'openrouter/free'
const BASE_URL = '/api-ai'

interface StreamChunk {
  content: string
  reasoning: string
  done: boolean
}

function buildMessages(messages: { role: string; content: string }[]) {
  return messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }))
}

export async function* streamChat(
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  if (!API_KEY) {
    yield {
      content: 'API key not configured. Set VITE_AI_API_KEY in your environment.',
      reasoning: '',
      done: true,
    }
    return
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: buildMessages(messages),
      stream: true,
      thinking: {"type": "disabled"}
    }),
    signal,
  })

  if (!response.ok) {
    let errorMsg = `API error (${response.status})`
    try {
      const body = await response.text()
      console.error(`[API] ${response.status} response:`, body)
      try {
        const err = JSON.parse(body)
        errorMsg = err.error?.message || err.message || errorMsg
      } catch {}
    } catch {}
    yield { content: errorMsg, reasoning: '', done: true }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    yield { content: 'Failed to read response stream', reasoning: '', done: true }
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

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
          yield { content: '', reasoning: '', done: true }
          return
        }

        try {
          const parsed = JSON.parse(data)
          const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || ''
          const content = parsed.choices?.[0]?.delta?.content || ''
          if (reasoning || content) {
            yield { reasoning, content, done: false }
          }
          if (parsed.choices?.[0]?.finish_reason === 'stop') {
            yield { content: '', reasoning: '', done: true }
            return
          }
        } catch {}
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }

  yield { content: '', reasoning: '', done: true }
}

const RAW_BASE_URL = import.meta.env.VITE_AI_BASE_URL || 'https://openrouter.ai/api/v1'
const API_KEY = import.meta.env.VITE_AI_API_KEY
const MODEL = import.meta.env.VITE_AI_MODEL || 'openrouter/free'

const BASE_URL = import.meta.env.DEV ? '/api-ai' : RAW_BASE_URL

interface StreamChunk {
  content: string
  done: boolean
}

function buildMessages(messages: { role: string; content: string }[]) {
  return messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }))
}

export async function generateTitle(firstMessage: string): Promise<string> {
  if (!API_KEY) return ''

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'Generate a very concise title (2-5 words) for a conversation based on the user\'s first message. Return ONLY the title, nothing else. No quotes, no punctuation.',
          },
          { role: 'user', content: `First message: "${firstMessage}"` },
        ],
        stream: false,
        max_tokens: 20,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error(`[API] generateTitle ${response.status}:`, body)
      return ''
    }
    const data = await response.json()
    const title = data.choices?.[0]?.message?.content?.trim() || ''
    return title.replace(/^["'\s]+|["'\s]+$/g, '')
  } catch {
    return ''
  }
}

export async function* streamChat(
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  if (!API_KEY) {
    yield {
      content: 'API key not configured. Set VITE_AI_API_KEY in your environment.',
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
    yield { content: errorMsg, done: true }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    yield { content: 'Failed to read response stream', done: true }
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
          yield { content: '', done: true }
          return
        }

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content || ''
          if (content) {
            yield { content, done: false }
          }
          if (parsed.choices?.[0]?.finish_reason === 'stop') {
            yield { content: '', done: true }
            return
          }
        } catch {}
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }

  yield { content: '', done: true }
}

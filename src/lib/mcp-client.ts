export const MCP_URLS = {
  exa: 'https://mcp.exa.ai/mcp',
  parallel: 'https://search.parallel.ai/mcp',
} as const

export type MCPProvider = 'exa' | 'parallel'

export interface McpCallOptions {
  provider: MCPProvider
  tool: string
  arguments: Record<string, unknown>
  signal?: AbortSignal
  timeout?: number
}

interface McpContentItem {
  type: string
  text?: string
}

interface McpResult {
  result: {
    content: McpContentItem[]
  }
}

function parsePayload(payload: string): string | undefined {
  const trimmed = payload.trim()
  if (!trimmed.startsWith('{')) return undefined
  try {
    const data = JSON.parse(trimmed) as McpResult
    const item = data.result?.content?.find((c) => c.type === 'text' && c.text)
    return item?.text
  } catch {
    return undefined
  }
}

function parseMcpResponse(body: string): string | undefined {
  const direct = body.trim() ? parsePayload(body) : undefined
  if (direct) return direct

  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const data = parsePayload(line.slice(6))
    if (data) return data
  }

  return undefined
}

export async function mcpCall(options: McpCallOptions): Promise<string | undefined> {
  const { provider, tool, arguments: args, signal, timeout = 25000 } = options

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: tool, arguments: args },
  })

  const controller = new AbortController()
  const onAbort = () => controller.abort()

  signal?.addEventListener('abort', onAbort, { once: true })
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`/api-search?provider=${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`MCP ${provider} error (${response.status}): ${text}`)
    }

    const text = await response.text()
    return parseMcpResponse(text)
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onAbort)
  }
}

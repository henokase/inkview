import type { ToolDefinition, ToolContext, ToolResult } from '../types'
import { mcpCall } from '../../mcp-client'
import type { MCPProvider } from '../../mcp-client'

const TAVILY_URL = 'https://api.tavily.com/search'

const jsonSchema = {
  type: 'object',
  required: ['query'],
  properties: {
    query: {
      type: 'string',
      description: 'The search query for finding web content.',
    },
    numResults: {
      type: 'number',
      description: 'Number of results to return (default: 8, max: 20).',
    },
    type: {
      type: 'string',
      enum: ['auto', 'fast', 'deep'],
      description: "Search type: 'auto' (balanced), 'fast' (quick), 'deep' (comprehensive).",
    },
    livecrawl: {
      type: 'string',
      enum: ['fallback', 'preferred'],
      description: "Live crawl mode: 'fallback' (cached, fallback to live), 'preferred' (prioritize live crawl).",
    },
  },
}

type QueryCategory = 'discovery' | 'research' | 'extraction'

function classifyQuery(query: string): QueryCategory {
  const q = query.toLowerCase()
  const discoveryWords = ['similar', 'related', 'best', 'top', 'compare', 'alternative', 'find', 'like', 'code', 'paper', 'examples']
  const researchWords = ['research', 'report', 'analyze', 'overview', 'comprehensive', 'deep dive', 'market', 'landscape', 'trend']
  const extractionWords = ['extract', 'structured', 'json', 'data', 'list', 'details', 'information about', 'profile']

  const discoveryScore = discoveryWords.filter(w => q.includes(w)).length
  const researchScore = researchWords.filter(w => q.includes(w)).length
  const extractionScore = extractionWords.filter(w => q.includes(w)).length

  if (extractionScore > researchScore && extractionScore >= discoveryScore) return 'extraction'
  if (researchScore >= extractionScore && researchScore >= discoveryScore) return 'research'
  return 'discovery'
}

function selectProvider(category: QueryCategory): MCPProvider {
  const override = import.meta.env.VITE_WEBSEARCH_PROVIDER as string | undefined
  if (override === 'exa' || override === 'parallel') return override

  if (category === 'research' || category === 'extraction') return 'parallel'
  return 'exa'
}

function formatExaArgs(query: string, numResults: number, type: string, livecrawl: string) {
  return {
    query,
    type,
    numResults,
    livecrawl,
  }
}

function formatParallelArgs(query: string) {
  return {
    objective: query,
    search_queries: [query],
  }
}

async function callTavily(query: string, numResults: number, signal?: AbortSignal): Promise<string | undefined> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tavily-Access-Mode': 'keyless',
      },
      body: JSON.stringify({ query, max_results: numResults, search_depth: 'basic' }),
      signal: controller.signal,
    })

    if (!res.ok) return undefined

    const data = await res.json()
    const results = data.results as Array<{ title: string; url: string; content: string; score: number }> | undefined
    if (!results || results.length === 0) return undefined

    const lines = results.map((r, i) =>
      `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content}`
    )

    return `Search results for "${query}":\n\n${lines.join('\n\n')}`
  } catch {
    return undefined
  } finally {
    clearTimeout(controller.signal instanceof AbortSignal ? undefined : undefined)
    signal?.removeEventListener('abort', onAbort)
  }
}

const webSearch: ToolDefinition = {
  id: 'webSearch',
  description:
    'Search the web for real-time information and current events. ' +
    'Returns a list of relevant results with titles, URLs, and descriptions. ' +
    'Use this when you need up-to-date information beyond the model\'s knowledge cutoff.',
  parameters: {
    query: {
      type: 'string',
      description: 'The search query',
      required: true,
    },
    numResults: {
      type: 'number',
      description: 'Number of results (default: 8)',
      required: false,
    },
    type: {
      type: 'string',
      description: "Search type: 'auto', 'fast', or 'deep'",
      required: false,
    },
    livecrawl: {
      type: 'string',
      description: "Live crawl mode: 'fallback' or 'preferred'",
      required: false,
    },
  },
  permission: 'web-search',
  jsonSchema,

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = ctx.evaluatePermission('web-search', '*')
    if (action === 'deny') {
      return { title: 'Permission denied', output: 'Web search is not permitted.' }
    }

    const query = (args.query as string)?.trim()
    if (!query) return { title: 'Error', output: 'Search query cannot be empty.' }

    const numResults = Math.min((args.numResults as number) || 8, 20)
    const type = (args.type as string) || 'auto'
    const livecrawl = (args.livecrawl as string) || 'fallback'

    const category = classifyQuery(query)
    const primary = selectProvider(category)
    const alternate: MCPProvider = primary === 'exa' ? 'parallel' : 'exa'

    async function tryProvider(provider: MCPProvider): Promise<string | undefined> {
      if (provider === 'exa') {
        return mcpCall({
          provider: 'exa',
          tool: 'web_search_exa',
          arguments: formatExaArgs(query, numResults, type, livecrawl),
          signal: ctx.abortSignal,
        })
      }

      return mcpCall({
        provider: 'parallel',
        tool: 'web_search',
        arguments: formatParallelArgs(query),
        signal: ctx.abortSignal,
      })
    }

    let result = await tryProvider(primary)

    if (!result) {
      result = await tryProvider(alternate)
    }

    if (!result) {
      result = await callTavily(query, numResults, ctx.abortSignal)
    }

    if (!result) {
      return {
        title: 'Error',
        output: `No search results found for "${query}". All providers returned empty or failed.`,
      }
    }

    return {
      title: `Web Search: ${query}`,
      output: result,
      metadata: { query, count: numResults },
    }
  },
}

export default webSearch

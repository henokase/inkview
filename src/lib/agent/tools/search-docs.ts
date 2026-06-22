import type { ToolDefinition, ToolContext, ToolResult } from '../types'
import { useDocumentStore } from '../../../stores/document-store'

const jsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Search query to match against document titles and content (case-insensitive).',
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results to return (default 20, max 100).',
    },
  },
  required: ['query'],
}

function extractSnippet(content: string, query: string, contextChars = 80): string {
  const lower = content.toLowerCase()
  const qLower = query.toLowerCase()

  const idx = lower.indexOf(qLower)
  if (idx !== -1) {
    const start = Math.max(0, idx - contextChars)
    const end = Math.min(content.length, idx + query.length + contextChars)
    let snippet = content.slice(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet = snippet + '...'
    return snippet
  }

  const keywords = qLower.split(/\s+/).filter(k => k.length > 1)
  for (const kw of keywords) {
    const ki = lower.indexOf(kw)
    if (ki !== -1) {
      const start = Math.max(0, ki - contextChars)
      const end = Math.min(content.length, ki + kw.length + contextChars)
      let snippet = content.slice(start, end)
      if (start > 0) snippet = '...' + snippet
      if (end < content.length) snippet = snippet + '...'
      return snippet
    }
  }

  return content.slice(0, contextChars * 2)
}

interface SearchResult {
  id: string
  title: string
  matchType: 'title' | 'content'
  snippet?: string
  updatedAt: number
}

const searchDocs: ToolDefinition = {
  id: 'searchDocs',
  description:
    'Search across all documents for matching content or titles. ' +
    'Returns a list of matching documents with snippets showing the context around matches. ' +
    'Search is case-insensitive and matches against both title and content.',
  parameters: {
    query: {
      type: 'string',
      description: 'Search query',
      required: true,
    },
    limit: {
      type: 'number',
      description: 'Max results (default 20)',
      required: false,
    },
  },
  permission: 'search',
  jsonSchema,

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    if (ctx.abortSignal.aborted) {
      return { title: 'Cancelled', output: 'Operation cancelled.' }
    }

    const query = (args.query as string) || ''
    const limit = Math.min((args.limit as number) || 20, 100)

    if (!query.trim()) {
      return { title: 'Error', output: 'Search query cannot be empty.' }
    }

    const { documents } = useDocumentStore.getState()
    const qLower = query.toLowerCase()
    const keywords = qLower.split(/\s+/).filter(k => k.length > 1)

    const results: SearchResult[] = []

    for (const doc of documents) {
      const titleLower = doc.title.toLowerCase()
      const contentLower = doc.content.toLowerCase()

      const titleMatch = titleLower.includes(qLower) || keywords.some(k => titleLower.includes(k))
      const contentMatch = !titleMatch && (contentLower.includes(qLower) || keywords.every(k => contentLower.includes(k)))

      if (titleMatch) {
        results.push({
          id: doc.id,
          title: doc.title,
          matchType: 'title',
          updatedAt: doc.updatedAt,
        })
      } else if (contentMatch) {
        results.push({
          id: doc.id,
          title: doc.title,
          matchType: 'content',
          snippet: extractSnippet(doc.content, query),
          updatedAt: doc.updatedAt,
        })
      }

      if (results.length >= limit) break
    }

    if (results.length === 0) {
      return {
        title: 'Error',
        output: `No documents found matching "${query}".`,
      }
    }

    const lines = results.map((r, i) => {
      const date = new Date(r.updatedAt).toLocaleDateString()
      let line = `${i + 1}. **${r.title}** (ID: \`${r.id}\`, updated: ${date})`
      if (r.matchType === 'title') {
        line += ' — matched in title'
      }
      if (r.snippet) {
        line += `\n   > ${r.snippet}`
      }
      return line
    })

    return {
      title: `Search results for "${query}"`,
      output: `Found ${results.length} matching document(s):\n\n${lines.join('\n')}`,
      metadata: {
        query,
        totalResults: results.length,
        limit,
      },
    }
  },
}

export default searchDocs

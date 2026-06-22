import type { ToolDefinition, ToolContext, ToolResult } from '../types'

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024

const jsonSchema = {
  type: 'object',
  required: ['url'],
  properties: {
    url: {
      type: 'string',
      description: 'The URL to fetch content from. Must start with http:// or https://.',
    },
    format: {
      type: 'string',
      enum: ['markdown', 'text', 'html'],
      description: "Output format: 'markdown' (default), 'text' (plain), or 'html' (raw).",
    },
    timeout: {
      type: 'number',
      description: 'Timeout in seconds (max 120, default 30).',
    },
  },
}

const webFetch: ToolDefinition = {
  id: 'webFetch',
  description:
    'Fetch content from a URL and return it in the requested format. ' +
    'HTML pages are converted to clean markdown by default. ' +
    'Use this to read web pages, documentation, or API responses.',
  parameters: {
    url: {
      type: 'string',
      description: 'The URL to fetch',
      required: true,
    },
    format: {
      type: 'string',
      description: 'Output format (default: markdown)',
      required: false,
    },
    timeout: {
      type: 'number',
      description: 'Timeout in seconds (max 120)',
      required: false,
    },
  },
  permission: 'web-fetch',
  jsonSchema,

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    if (ctx.abortSignal.aborted) {
      return { title: 'Cancelled', output: 'Operation cancelled.' }
    }

    const action = ctx.evaluatePermission('web-fetch', '*')
    if (action === 'deny') {
      return { title: 'Permission denied', output: 'Web fetching is not permitted.' }
    }

    const url = (args.url as string)?.trim()
    if (!url) return { title: 'Error', output: 'URL is required.' }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { title: 'Error', output: 'URL must start with http:// or https://.' }
    }

    const format = (args.format as string) || 'markdown'
    const timeoutMs = Math.min(((args.timeout as number) || 30) * 1000, 120_000)
    const controller = new AbortController()

    const onAbort = () => controller.abort()
    ctx.abortSignal.addEventListener('abort', onAbort, { once: true })
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const proxyResponse = await fetch('/api-fetch', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          headers: {
            Accept:
              format === 'html'
                ? 'text/html,application/xhtml+xml,*/*'
                : 'text/html,text/markdown,text/plain,*/*',
          },
        }),
      })

      if (!proxyResponse.ok) {
        const errText = await proxyResponse.text().catch(() => '')
        return { title: 'Error', output: `Proxy error (${proxyResponse.status}): ${errText}` }
      }

      const result = await proxyResponse.json() as { status: number; statusText: string; contentType: string; body: string; error?: string }
      if (result.error) {
        return { title: 'Error', output: result.error }
      }
      if (result.status >= 400) {
        return { title: 'Error', output: `HTTP ${result.status}: ${result.statusText}` }
      }

      if (result.body.length > MAX_RESPONSE_SIZE) {
        return { title: 'Error', output: 'Response too large (exceeds 5MB limit).' }
      }

      const mime = result.contentType.split(';')[0]?.trim().toLowerCase() || ''
      const content = result.body

      if (format === 'html') {
        return { title: url, output: content, metadata: { contentType: mime } }
      }

      if (format === 'text') {
        const text = extractTextFromHTML(content)
        return { title: url, output: text, metadata: { contentType: mime } }
      }

      if (mime.includes('text/html')) {
        const markdown = await htmlToMarkdown(content)
        return { title: url, output: markdown, metadata: { contentType: mime } }
      }

      return { title: url, output: content, metadata: { contentType: mime } }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { title: 'Error', output: 'Request was aborted or timed out.' }
      }
      const message =
        err instanceof TypeError
          ? `Network error: ${err.message}`
          : err instanceof Error
            ? err.message
            : 'An unknown error occurred.'
      return { title: 'Error', output: message }
    } finally {
      clearTimeout(timeoutId)
      ctx.abortSignal.removeEventListener('abort', onAbort)
    }
  },
}

function extractTextFromHTML(html: string): string {
  let text = ''
  let skipDepth = 0
  let inTag = false
  let tagName = ''
  let inSkipped = false

  for (let i = 0; i < html.length; i++) {
    const c = html[i]

    if (inTag) {
      if (c === '>') {
        inTag = false
        const name = tagName.toLowerCase()
        if (['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(name)) {
          inSkipped = true
          skipDepth++
        }
        if (name.startsWith('/') && ['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(name.slice(1))) {
          skipDepth--
          if (skipDepth <= 0) {
            inSkipped = false
            skipDepth = 0
          }
        }
        tagName = ''
      } else if (tagName === '' && c !== '/') {
        tagName += c
      } else if (tagName !== '' && c !== ' ' && c !== '/') {
        if (tagName.length < 20) tagName += c
      }
      continue
    }

    if (c === '<') {
      inTag = true
      tagName = ''
      continue
    }

    if (!inSkipped) {
      text += c
    }
  }

  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#?\w+;/g, '')
    .replace(/\n{4,}/g, '\n\n')
    .trim()
}

async function htmlToMarkdown(html: string): Promise<string> {
  try {
    const { default: TurndownService } = await import('turndown')
    const turndown = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
    })
    turndown.remove(['script', 'style', 'meta', 'link', 'noscript', 'iframe', 'object', 'embed'])
    return turndown.turndown(html)
  } catch {
    return extractTextFromHTML(html)
  }
}

export default webFetch

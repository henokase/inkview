import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import { URL } from 'node:url'
import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MCP_ENDPOINTS: Record<string, string> = {
  exa: 'https://mcp.exa.ai/mcp',
  parallel: 'https://search.parallel.ai/mcp',
}

function proxyRequest(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  signal: AbortSignal | undefined,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl)
    const isHttps = url.protocol === 'https:'
    const requestFn = isHttps ? httpsRequest : httpRequest

    const req = requestFn(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
      },
      (proxyRes) => {
        const chunks: Buffer[] = []
        proxyRes.on('data', (c) => chunks.push(c as Buffer))
        proxyRes.on('end', () => {
          const resHeaders: Record<string, string> = {}
          for (let i = 0; i < proxyRes.rawHeaders.length; i += 2) {
            resHeaders[proxyRes.rawHeaders[i].toLowerCase()] = proxyRes.rawHeaders[i + 1]
          }
          resolve({
            status: proxyRes.statusCode ?? 502,
            headers: resHeaders,
            body: Buffer.concat(chunks).toString(),
          })
        })
        proxyRes.on('error', reject)
      },
    )

    req.on('error', reject)
    if (signal) {
      signal.addEventListener('abort', () => {
        req.destroy()
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    }
    if (body) req.write(body)
    req.end()
  })
}

export function sseProxyPlugin(aiBaseUrl: string, apiKey: string | undefined): Plugin {
  console.log(`[sse-proxy] AI API target: ${aiBaseUrl}`)

  return {
    name: 'sse-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api-ai', async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== 'POST' || !req.url?.includes('/chat/completions')) {
          return next()
        }

        const upstreamPath = req.url.replace(/^\/api-ai/, '')
        const upstreamUrl = new URL(aiBaseUrl.replace(/\/+$/, '') + upstreamPath)

        const body = await new Promise<string>((resolve, reject) => {
          const chunks: Buffer[] = []
          req.on('data', (c) => chunks.push(c as Buffer))
          req.on('end', () => resolve(Buffer.concat(chunks).toString()))
          req.on('error', reject)
        })

        const proxyRes = await proxyRequest(
          upstreamUrl.href,
          'POST',
          {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(body).toString(),
            'Accept-Encoding': 'identity',
          },
          body,
          undefined,
        ).catch(() => null)

        if (!proxyRes) {
          if (!res.headersSent) {
            res.writeHead(502)
            res.end('Proxy error')
          }
          return
        }

        res.writeHead(proxyRes.status, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
          Connection: 'keep-alive',
        })
        res.end(proxyRes.body)
      })

      server.middlewares.use('/api-search', async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== 'POST') return next()

        const searchParams = new URLSearchParams(req.url?.split('?')[1] ?? '')
        const provider = searchParams.get('provider') ?? undefined

        const targetUrl = provider && MCP_ENDPOINTS[provider] ? MCP_ENDPOINTS[provider] : undefined
        if (!targetUrl) {
          res.writeHead(400)
          res.end('Invalid or missing provider (exa or parallel)')
          return
        }

        const body = await new Promise<string>((resolve, reject) => {
          const chunks: Buffer[] = []
          req.on('data', (c) => chunks.push(c as Buffer))
          req.on('end', () => resolve(Buffer.concat(chunks).toString()))
          req.on('error', reject)
        })

        const proxyRes = await proxyRequest(
          targetUrl,
          'POST',
          {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'Content-Length': Buffer.byteLength(body).toString(),
          },
          body,
          undefined,
        ).catch((err) => {
          console.error(`[sse-proxy] /api-search error: ${err.message}`)
          return null
        })

        if (!proxyRes) {
          res.writeHead(502)
          res.end('Search proxy error')
          return
        }

        res.writeHead(proxyRes.status, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(proxyRes.body)
      })

      server.middlewares.use('/api-fetch', async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== 'POST') return next()

        const body = await new Promise<string>((resolve, reject) => {
          const chunks: Buffer[] = []
          req.on('data', (c) => chunks.push(c as Buffer))
          req.on('end', () => resolve(Buffer.concat(chunks).toString()))
          req.on('error', reject)
        })

        let params: { url: string; headers?: Record<string, string> }
        try {
          params = JSON.parse(body)
        } catch {
          res.writeHead(400)
          res.end('Invalid JSON body')
          return
        }

        if (!params.url || !params.url.startsWith('http://') && !params.url.startsWith('https://')) {
          res.writeHead(400)
          res.end('Invalid URL')
          return
        }

        try {
          const fetchHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (compatible; InkView/1.0)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            ...params.headers,
          }
          delete fetchHeaders['host']
          delete fetchHeaders['Host']

          const fetchRes = await fetch(params.url, { headers: fetchHeaders })

          const responseBody = await fetchRes.text()
          const contentType = fetchRes.headers.get('content-type') || ''

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify({
            status: fetchRes.status,
            statusText: fetchRes.statusText,
            contentType,
            body: responseBody,
          }))
        } catch (err) {
          res.writeHead(502)
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Fetch failed' }))
        }
      })
    },
  }
}

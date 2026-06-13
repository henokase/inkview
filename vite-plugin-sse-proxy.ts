import { request as httpsRequest } from 'node:https'
import { URL } from 'node:url'
import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

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

        const proxyReq = httpsRequest(
          {
            hostname: upstreamUrl.hostname,
            port: upstreamUrl.port || 443,
            path: upstreamUrl.pathname + upstreamUrl.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
              'Content-Length': Buffer.byteLength(body).toString(),
              'Accept-Encoding': 'identity',
            },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              'X-Accel-Buffering': 'no',
              Connection: 'keep-alive',
            })

            proxyRes.on('data', (chunk) => {
              res.write(chunk)
            })
            proxyRes.on('end', () => {
              res.end()
            })
            proxyRes.on('error', (err) => {
              console.error(`[sse-proxy] error: ${err.message}`)
              res.destroy(err)
            })
          },
        )

        proxyReq.on('error', (err) => {
          console.error(`[sse-proxy] request error: ${err.message}`)
          if (!res.headersSent) {
            res.writeHead(502)
            res.end('Proxy error')
          }
        })

        proxyReq.write(body)
        proxyReq.end()
      })
    },
  }
}

export const config = {
  matcher: '/api-ai/:path*',
}

export default async function handler(request: Request) {
  const baseUrl = (process.env.VITE_AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  const apiKey = process.env.AI_API_KEY || process.env.VITE_AI_API_KEY

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI_API_KEY (or VITE_AI_API_KEY) not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/api-ai/, '')
  const targetUrl = `${baseUrl}${targetPath}${url.search}`

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()

  const proxyRes = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  })

  const contentType = proxyRes.headers.get('content-type') || 'text/event-stream'

  return new Response(proxyRes.body, {
    status: proxyRes.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)

    const aiBaseUrl = (process.env.VITE_AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
    const apiKey = process.env.AI_API_KEY

    if (!apiKey) {
      return Response.json({ error: 'AI_API_KEY not configured' }, { status: 500 })
    }

    const upstreamPath = url.pathname.replace(/^\/api\/ai/, '')
    const upstreamUrl = `${aiBaseUrl}${upstreamPath}${url.search}`

    const body = await request.text()

    const proxyRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    })

    const responseBody = proxyRes.body
    const contentType = proxyRes.headers.get('content-type') || 'text/event-stream'

    return new Response(responseBody, {
      status: proxyRes.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI proxy error'
    return Response.json({ error: message }, { status: 502 })
  }
}

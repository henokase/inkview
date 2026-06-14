const MCP_ENDPOINTS: Record<string, string> = {
  exa: 'https://mcp.exa.ai/mcp',
  parallel: 'https://search.parallel.ai/mcp',
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const provider = url.searchParams.get('provider')

    const targetUrl = provider && MCP_ENDPOINTS[provider] ? MCP_ENDPOINTS[provider] : undefined
    if (!targetUrl) {
      return Response.json({ error: 'Invalid or missing provider (exa or parallel)' }, { status: 400 })
    }

    const body = await request.text()

    const proxyRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body,
    })

    const responseBody = await proxyRes.text()
    const contentType = proxyRes.headers.get('content-type') || 'application/json'

    return new Response(responseBody, {
      status: proxyRes.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search proxy error'
    return Response.json({ error: message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url: targetUrl, headers: extraHeaders } = body as {
      url?: string
      headers?: Record<string, string>
    }

    if (!targetUrl || !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return Response.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...extraHeaders,
    }
    delete fetchHeaders['host']
    delete fetchHeaders['Host']

    const timeoutSignal = AbortSignal.timeout(15000)
    const fetchRes = await fetch(targetUrl, { headers: fetchHeaders, signal: timeoutSignal })

    const responseBody = await fetchRes.text()
    const contentType = fetchRes.headers.get('content-type') || ''

    return Response.json({
      status: fetchRes.status,
      statusText: fetchRes.statusText,
      contentType,
      body: responseBody,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fetch failed'
    return Response.json({ error: message }, { status: 502 })
  }
}

export const config = {
  matcher: '/api-ai/:path*',
}

export default async function handler(request: Request) {
  const baseUrl = process.env.VITE_AI_BASE_URL
  if (!baseUrl) {
    return new Response(JSON.stringify({ error: 'VITE_AI_BASE_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/api-ai/, '')
  const targetUrl = `${baseUrl}${targetPath}${url.search}`

  const headers = new Headers(request.headers)
  headers.delete('host')

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
  })
}

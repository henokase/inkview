import { Redis } from '@upstash/redis'

const url =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
  process.env.KV_REST_API_URL

const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
  process.env.KV_REST_API_TOKEN

const redis = url && token ? new Redis({ url, token }) : Redis.fromEnv()

const FIFTEEN_DAYS = 60 * 60 * 24 * 15

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (body.documents) {
      if (!Array.isArray(body.documents) || body.documents.length === 0) {
        return Response.json({ error: 'Documents array is required' }, { status: 400 })
      }
      const totalSize = body.documents.reduce(
        (sum: number, d: { content?: string }) => sum + (d.content?.length || 0),
        0
      )
      if (totalSize > 1_000_000) {
        return Response.json({ error: 'Total content exceeds 1 MB limit' }, { status: 413 })
      }
      const id = crypto.randomUUID()
      const payload = JSON.stringify({
        type: 'batch',
        folderName: body.folderName || 'Shared Documents',
        documents: body.documents.map((d: { title?: string; content?: string }) => ({
          title: d.title || 'Untitled',
          content: d.content || '',
        })),
      })
      await redis.set(`share:${id}`, payload, { ex: FIFTEEN_DAYS })
      return Response.json({ id })
    }

    const { content, title } = body
    if (!content || typeof content !== 'string') {
      return Response.json({ error: 'Content is required' }, { status: 400 })
    }
    if (content.length > 1_000_000) {
      return Response.json({ error: 'Content exceeds 1 MB limit' }, { status: 413 })
    }
    const id = crypto.randomUUID()
    const payload = JSON.stringify({ type: 'single', title: title || '', content })
    await redis.set(`share:${id}`, payload, { ex: FIFTEEN_DAYS })
    return Response.json({ id })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function nocache(init: ResponseInit = {}): ResponseInit {
  return {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> || {}),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'Missing id parameter' }, nocache({ status: 400 }))
    }
    const raw = await redis.get<string>(`share:${id}`)
    if (raw === null) {
      return Response.json({ error: 'Shared document not found or has expired' }, nocache({ status: 404 }))
    }

    // Try to handle JSON-wrapped format (new shares)
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        // Batch share
        if (parsed.type === 'batch' && Array.isArray(parsed.documents)) {
          return Response.json(
            { documents: parsed.documents, folderName: parsed.folderName },
            nocache()
          )
        }
        // Single share (new format: { type: 'single', title?: string, content: '...' })
        if (typeof parsed.content === 'string') {
          return Response.json({ content: parsed.content, title: parsed.title || undefined }, nocache())
        }
      }
    } catch {
      // raw is not JSON — legacy format (plain text content)
    }

    // Fallback: return the raw Redis value as-is
    return Response.json({ content: raw }, nocache())
  } catch {
    return Response.json({ error: 'Internal server error' }, nocache({ status: 500 }))
  }
}

import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

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

    const { content } = body
    if (!content || typeof content !== 'string') {
      return Response.json({ error: 'Content is required' }, { status: 400 })
    }
    if (content.length > 1_000_000) {
      return Response.json({ error: 'Content exceeds 1 MB limit' }, { status: 413 })
    }
    const id = crypto.randomUUID()
    const payload = JSON.stringify({ type: 'single', content })
    await redis.set(`share:${id}`, payload, { ex: FIFTEEN_DAYS })
    return Response.json({ id })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'Missing id parameter' }, { status: 400 })
    }
    const raw = await redis.get<string>(`share:${id}`)
    if (raw === null) {
      return Response.json({ error: 'Shared document not found or has expired' }, { status: 404 })
    }

    try {
      const parsed = JSON.parse(raw)
      if (parsed.type === 'batch') {
        return Response.json({
          documents: parsed.documents,
          folderName: parsed.folderName,
        })
      }
      if (parsed.content) {
        return Response.json({ content: parsed.content })
      }
    } catch {
      // Legacy format: raw content string
      return Response.json({ content: raw })
    }

    return Response.json({ content: raw })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

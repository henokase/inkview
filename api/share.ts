import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const FIFTEEN_DAYS = 60 * 60 * 24 * 15

export async function POST(request: Request) {
  try {
    const { content } = await request.json()
    if (!content || typeof content !== 'string') {
      return Response.json({ error: 'Content is required' }, { status: 400 })
    }
    if (content.length > 1_000_000) {
      return Response.json({ error: 'Content exceeds 1 MB limit' }, { status: 413 })
    }
    const id = crypto.randomUUID()
    await redis.set(`share:${id}`, content, { ex: FIFTEEN_DAYS })
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
    const content = await redis.get<string>(`share:${id}`)
    if (content === null) {
      return Response.json({ error: 'Shared document not found or has expired' }, { status: 404 })
    }
    return Response.json({ content })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const SHARE_PATH_PREFIX = '/share?'

export function buildShareUrl(id: string): string {
  const base = window.location.origin + window.location.pathname.replace(/\/$/, '')
  return `${base}/share?id=${encodeURIComponent(id)}`
}

export function parseShareUrl(): { id: string } | null {
  const path = window.location.pathname + window.location.search
  const idx = path.indexOf(SHARE_PATH_PREFIX)
  if (idx === -1) return null
  const query = path.slice(idx + SHARE_PATH_PREFIX.length)
  const params = new URLSearchParams(query)
  const id = params.get('id')
  if (!id) return null
  return { id }
}

export function hasShareUrl(): boolean {
  const path = window.location.pathname + window.location.search
  return path.includes(SHARE_PATH_PREFIX)
}

export async function createShareLink(
  content: string
): Promise<string> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to create share link')
  }
  const { id } = await res.json()
  return buildShareUrl(id)
}

export async function fetchSharedContent(id: string): Promise<string> {
  const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Shared document not found')
  }
  const { content } = await res.json()
  return content
}

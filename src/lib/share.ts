import type { Document, ShareEntry, ShareResponse } from '../types'

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

export async function createShareLink(content: string, title?: string): Promise<string> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, title }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to create share link')
  }
  const { id } = await res.json()
  return buildShareUrl(id)
}

export async function createBatchShareLink(
  documents: ShareEntry[],
  folderName?: string
): Promise<string> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documents,
      folderName: folderName || 'Shared Documents',
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to create share link')
  }
  const { id } = await res.json()
  return buildShareUrl(id)
}

export async function fetchSharedContent(id: string): Promise<ShareResponse> {
  async function doFetch(cache: RequestCache) {
    const res = await fetch(`/api/share?id=${encodeURIComponent(id)}&_t=${Date.now()}`, { cache })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Server returned ${res.status}`)
    }
    return res.json()
  }

  const data = await doFetch('no-cache')
  if (data && data.content !== undefined && typeof data.content !== 'string') {
    if (data.content && typeof data.content.content === 'string') {
      const shared = data.content as { content: string; title?: string }
      data.title = shared.title
      data.content = shared.content
    } else if (data.content && data.content.type === 'batch' && Array.isArray(data.content.documents)) {
      const shared = data.content as { documents: ShareEntry[]; folderName?: string }
      data.documents = shared.documents
      data.folderName = shared.folderName
      delete data.content
    }
  }
  return data
}

export function resolveImportEntries(
  entries: { title: string; content: string }[],
  existingDocs: Pick<Document, 'title' | 'content'>[]
): { entries: { title: string; content: string }[]; deleteIds: string[] } {
  const deleteIds: string[] = []
  const result: { title: string; content: string }[] = []

  for (const entry of entries) {
    const exactMatches = existingDocs.filter(
      (d) => d.title === entry.title && d.content === entry.content
    )
    const titleOnly = existingDocs.filter(
      (d) => d.title === entry.title && d.content !== entry.content
    )

    if (exactMatches.length > 0) {
      exactMatches.forEach((d) => {
        if ('id' in d) deleteIds.push((d as Document).id)
      })
      if (titleOnly.length > 0) {
        const remaining = existingDocs.filter((d) => !exactMatches.includes(d))
        result.push({ title: resolveTitleUnique(entry.title, remaining), content: entry.content })
      } else {
        result.push({ title: entry.title, content: entry.content })
      }
    } else {
      if (titleOnly.length > 0) {
        result.push({ title: resolveTitleUnique(entry.title, existingDocs), content: entry.content })
      } else {
        result.push({ title: entry.title, content: entry.content })
      }
    }
  }

  return { entries: result, deleteIds }
}

export function resolveTitleUnique(
  baseTitle: string,
  existingDocs: Pick<Document, 'title'>[]
): string {
  const escaped = baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}(?:-(\\d+))?$`)

  const nums: number[] = []
  for (const doc of existingDocs) {
    const match = doc.title.match(pattern)
    if (match) {
      nums.push(match[1] ? parseInt(match[1]) : 0)
    }
  }

  if (nums.length === 0) return baseTitle
  return `${baseTitle}-${Math.max(...nums) + 1}`
}

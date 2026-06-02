import type { TocHeading } from '../types'

export function extractTocHeadings(markdown: string): TocHeading[] {
  const lines = markdown.split('\n')
  const headings: TocHeading[] = []
  let inCodeBlock = false

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    const match = /^(#{1,6})\s+(.+)/.exec(line)
    if (!match) continue

    const level = match[1].length
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    headings.push({ id, text, level })
  }

  const seen = new Map<string, number>()
  for (const h of headings) {
    const count = seen.get(h.id) ?? 0
    seen.set(h.id, count + 1)
    if (count > 0) h.id = `${h.id}-${count + 1}`
  }

  return headings
}

export function extractTitle(markdown: string): string | null {
  const lines = markdown.trim().split('\n')
  let inCodeBlock = false
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const match = /^#\s+(.+)/.exec(line)
    if (match) return match[1].trim()
  }
  return null
}

import type { TocHeading } from '../types'

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/__(.+?)__/g, '$1') // bold (alt)
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/_(.+?)_/g, '$1') // italic (alt)
    .replace(/~~(.+?)~~/g, '$1') // strikethrough
    .replace(/`(.+?)`/g, '$1') // inline code
    .trim()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
}

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
    const text = stripMarkdown(match[2])
    const id = slugify(text)

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
    if (match) return stripMarkdown(match[1])
  }
  return null
}

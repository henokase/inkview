import type { TocHeading } from '../types'

export function extractTocHeadings(markdown: string): TocHeading[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: TocHeading[] = []
  let match

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    headings.push({ id, text, level })
  }

  return headings
}

export function extractTitle(markdown: string): string | null {
  const match = /^#\s+(.+)$/m.exec(markdown.trim())
  return match ? match[1].trim() : null
}

import { useMemo } from 'react'
import { extractTocHeadings } from '../lib/toc'
import { useActiveHeading } from '../lib/use-active-heading'
import type { TocHeading } from '../types'

interface TocSidebarProps {
  content: string
}

export function TocSidebar({ content }: TocSidebarProps) {
  const headings = useMemo(() => extractTocHeadings(content), [content])
  const ids = useMemo(() => headings.map((h) => h.id), [headings])
  const activeId = useActiveHeading(ids)

  if (headings.length === 0) return null

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav className="space-y-0.5">
      <h3 className="mb-3 font-sans text-xs font-semibold uppercase tracking-widest text-ink-faint">
        On this page
      </h3>
      {headings.map((h: TocHeading) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          onClick={(e) => handleClick(e, h.id)}
          className={`block truncate rounded-md py-1 pr-2 text-sm transition-all duration-150 ${
            activeId === h.id
              ? 'text-accent font-medium'
              : 'text-ink-soft hover:text-ink'
          }`}
          style={{ paddingLeft: `${(h.level - 1) * 14}px` }}
        >
          {h.text}
        </a>
      ))}
    </nav>
  )
}

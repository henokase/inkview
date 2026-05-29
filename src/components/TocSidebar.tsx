import { memo, useEffect, useMemo, useRef } from 'react'
import { extractTocHeadings } from '../lib/toc'
import { useActiveHeading } from '../lib/use-active-heading'
import type { TocHeading } from '../types'

interface TocSidebarProps {
  content: string
}

export const TocSidebar = memo(function TocSidebar({ content }: TocSidebarProps) {
  const navRef = useRef<HTMLElement>(null)
  const headings = useMemo(() => extractTocHeadings(content), [content])
  const ids = useMemo(() => headings.map((h) => h.id), [headings])
  const activeId = useActiveHeading(ids)

  useEffect(() => {
    if (!activeId || !navRef.current) return
    const activeLink = navRef.current.querySelector(`[href="#${activeId}"]`)
    if (activeLink) {
      activeLink.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeId])

  if (headings.length === 0) return null

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav ref={navRef} className="relative">
      {headings.map((h: TocHeading) => (
        <div key={h.id} className="relative flex">
          {activeId === h.id && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-accent" />
          )}
          <a
            href={`#${h.id}`}
            onClick={(e) => handleClick(e, h.id)}
            className={`block w-full rounded-r-md py-1.5 pr-2 text-sm transition-all duration-150 ${
              activeId === h.id
                ? 'text-accent font-medium'
                : 'text-ink-soft hover:text-ink'
            }`}
            style={{ paddingLeft: `${(h.level - 1) * 14 + 12}px` }}
          >
            {h.text}
          </a>
        </div>
      ))}
    </nav>
  )
})

import { memo, useEffect, useMemo, useRef } from 'react'
import { extractTocHeadings } from '../lib/toc'
import { useActiveHeading } from '../lib/use-active-heading'
import type { TocHeading } from '../types'

interface TocSidebarProps {
  content: string
  onHeadingClick?: () => void
}

export const TocSidebar = memo(function TocSidebar({ content, onHeadingClick }: TocSidebarProps) {
  const navRef = useRef<HTMLElement>(null)
  const headings = useMemo(() => extractTocHeadings(content), [content])
  const activeIndex = useActiveHeading(headings, content)

  useEffect(() => {
    if (!navRef.current || activeIndex < 0 || activeIndex >= headings.length) return
    const link = navRef.current.querySelector<HTMLAnchorElement>(`[data-toc-i="${activeIndex}"]`)
    if (link) {
      link.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeIndex, headings.length])

  if (headings.length === 0) return null

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, i: number) => {
    e.preventDefault()
    onHeadingClick?.()
    const container = document.querySelector<HTMLElement>('[data-preview-scroll]')
    if (!container) return
    const headingEls = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const el = headingEls[i]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav ref={navRef} className="relative">
      {headings.map((h: TocHeading, i) => (
        <div key={`${h.id}-${i}`} className="relative flex">
          {activeIndex === i && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-accent" />
          )}
          <a
            href={`#${h.id}`}
            data-toc-i={i}
            onClick={(e) => handleClick(e, i)}
            className={`block w-full rounded-r-md py-1.5 pr-2 text-sm transition-all duration-150 ${
              activeIndex === i
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

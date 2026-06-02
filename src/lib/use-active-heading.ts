import { useEffect, useState, useRef } from 'react'
import type { TocHeading } from '../types'

export function useActiveHeading(headings: TocHeading[], _content: string) {
  const [activeIndex, setActiveIndex] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    current.current = 0
    setActiveIndex(0)

    const container = document.querySelector<HTMLElement>('[data-preview-scroll]')
    if (!container) return

    const handleScroll = () => {
      const headingEls = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      let bestIdx = 0
      let bestDist = Infinity

      headingEls.forEach((el, i) => {
        const rect = el.getBoundingClientRect()
        const dist = Math.abs(rect.top - 80)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      })

      if (bestIdx !== current.current) {
        current.current = bestIdx
        setActiveIndex(bestIdx)
      }
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [headings, _content])

  return activeIndex
}

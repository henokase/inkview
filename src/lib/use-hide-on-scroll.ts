import { useEffect, useRef, useState } from 'react'

interface UseHideOnScrollOptions {
  scrollUpThreshold?: number
  scrollDownThreshold?: number
  topThreshold?: number
}

export function useHideOnScroll(
  elementRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  options: UseHideOnScrollOptions = {}
): boolean {
  const { scrollUpThreshold = 15, scrollDownThreshold = 20, topThreshold = 20 } = options
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)
  const accumulatedDelta = useRef(0)

  useEffect(() => {
    if (!active || !elementRef.current) {
      setHidden(false)
      return
    }
    const el = elementRef.current
    lastScrollY.current = el.scrollTop
    accumulatedDelta.current = 0

    const handleScroll = () => {
      const currentScrollY = el.scrollTop

      // Always show navbar near the top of the container
      if (currentScrollY <= topThreshold) {
        accumulatedDelta.current = 0
        lastScrollY.current = currentScrollY
        setHidden(false)
        return
      }

      const diff = currentScrollY - lastScrollY.current
      lastScrollY.current = currentScrollY

      // Reset accumulated distance if scroll direction changes
      if ((diff > 0 && accumulatedDelta.current < 0) || (diff < 0 && accumulatedDelta.current > 0)) {
        accumulatedDelta.current = 0
      }

      accumulatedDelta.current += diff

      if (accumulatedDelta.current >= scrollDownThreshold) {
        setHidden(true)
      } else if (accumulatedDelta.current <= -scrollUpThreshold) {
        setHidden(false)
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [active, elementRef, scrollUpThreshold, scrollDownThreshold, topThreshold])

  return hidden
}

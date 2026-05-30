import { useEffect, useRef, useState } from 'react'

interface UseHideOnScrollOptions {
  scrollUpThreshold?: number
  scrollDownThreshold?: number
}

export function useHideOnScroll(
  elementRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  options: UseHideOnScrollOptions = {}
): boolean {
  const { scrollUpThreshold = 15, scrollDownThreshold = 50 } = options
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    if (!active || !elementRef.current) return
    const el = elementRef.current
    lastScrollY.current = el.scrollTop

    const handleScroll = () => {
      const currentScrollY = el.scrollTop
      const delta = currentScrollY - lastScrollY.current

      if (delta > scrollDownThreshold) {
        setHidden(true)
      } else if (delta < -scrollUpThreshold) {
        setHidden(false)
      }
      lastScrollY.current = currentScrollY
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [active, elementRef, scrollUpThreshold, scrollDownThreshold])

  return hidden
}

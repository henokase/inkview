import { useEffect, useState, useRef } from 'react'

export function useActiveHeading(ids: string[]) {
  const [activeId, setActiveId] = useState<string>(ids[0] || '')
  const observer = useRef<IntersectionObserver | null>(null)
  const idsKey = ids.join(',')

  useEffect(() => {
    if (observer.current) observer.current.disconnect()

    observer.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '0% 0% -75% 0px', threshold: 0 }
    )

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.current?.observe(el)
    })

    return () => observer.current?.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  return activeId
}

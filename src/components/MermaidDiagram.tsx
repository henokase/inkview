import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { useTheme } from '../lib/use-theme'

let initialized = false

export function MermaidDiagram({ code }: { code: string }) {
  const { resolvedTheme } = useTheme()
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const id = useRef(`mermaid-${crypto.randomUUID()}`)

  useEffect(() => {
    if (!initialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      })
      initialized = true
    }
    setError(false)
    setSvg(null)
    mermaid
      .render(id.current, code)
      .then(({ svg: svgStr }) => setSvg(svgStr))
      .catch(() => setError(true))
  }, [code, resolvedTheme])

  if (error) {
    return (
      <div className="mb-5 my-4 rounded-lg border border-red-400/30 bg-red-50 dark:bg-red-950/20 p-6 text-center">
        <pre className="whitespace-pre-wrap font-mono text-sm text-red-600 dark:text-red-400">{code}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="mb-5 my-4 animate-pulse rounded-lg bg-surface-alt p-8 text-center text-ink-faint font-sans text-sm">
        Loading diagram…
      </div>
    )
  }

  return (
    <div
      className="mb-5 my-4 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

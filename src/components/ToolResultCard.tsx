import { useState } from 'react'
import { ChevronDown, ArrowRight, X } from 'lucide-react'
import type { ToolResultPart } from '../types'

interface ToolResultCardProps {
  result: ToolResultPart
}

export function ToolResultCard({ result }: ToolResultCardProps) {
  const [open, setOpen] = useState(false)
  const isError = result.isError

  const icon = isError ? (
    <X size={13} className="text-red-500 shrink-0" />
  ) : (
    <ArrowRight size={13} className="text-green-600 shrink-0" />
  )

  const truncated =
    result.result.length > 200
      ? result.result.slice(0, 200) + '...'
      : result.result

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isError
          ? 'border-red-200 bg-red-50'
          : 'border-emerald-200/60 bg-emerald-50/40'
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors duration-200 hover:bg-black/[0.02]"
      >
        {icon}
        <code className="text-[12px] font-mono font-medium text-ink flex-1">{result.name}</code>
        {result.result.length > 200 && (
          <ChevronDown
            size={12}
            className={`text-ink-faint/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      <div className="px-3 pb-3">
        <div className="rounded-lg bg-white/60 border border-border/30 px-3 py-2 max-h-48 overflow-y-auto">
          <pre
            className={`text-[11px] font-mono leading-relaxed whitespace-pre-wrap ${
              isError ? 'text-red-700' : 'text-ink-soft'
            }`}
          >
            {open ? result.result : truncated}
          </pre>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'

interface ThinkingViewProps {
  thinking?: string
  loading?: boolean
}

export function ThinkingView({ thinking, loading = true }: ThinkingViewProps) {
  const [open, setOpen] = useState(true)
  const hasContent = thinking && thinking.length > 0

  return (
    <div className="rounded-xl border border-accent/10 bg-accent/4 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3.5 py-2.5 text-left transition-colors duration-200 hover:bg-accent/4"
      >
        <Sparkles size={13} className="text-accent/50 shrink-0" />
        <span className="text-[11px] font-semibold text-accent/70 tracking-wider uppercase font-sans">
          Thinking
        </span>
        {loading && (
          <div className="flex gap-0.5 ml-1">
            <span className="w-1 h-1 rounded-full bg-accent/30 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-accent/30 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-accent/30 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {hasContent && (
          <ChevronDown
            size={13}
            className={`ml-auto text-accent/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {open && hasContent && (
        <div className="px-3.5 pb-3">
          <div className="rounded-lg bg-accent/4 border border-accent/8 px-3 py-2.5 max-h-48 overflow-y-auto">
            <p className="text-[12px] text-ink-soft leading-relaxed whitespace-pre-wrap font-sans">
              {thinking}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Loader2, Check, X, ChevronDown, Braces } from 'lucide-react'
import type { ToolCallPart } from '../types'

interface ToolCallCardProps {
  call: ToolCallPart
  status: 'pending' | 'running' | 'completed' | 'failed'
  output?: string
}

export function ToolCallCard({ call, status, output }: ToolCallCardProps) {
  const hasArgs = Object.keys(call.arguments).length > 0
  const hasOutput = output !== undefined
  const [open, setOpen] = useState(status === 'running' || status === 'failed')
  const isRunning = status === 'running' || status === 'pending'
  const isError = status === 'failed'

  const icon = isRunning ? (
    <Loader2 size={13} className="text-accent/60 animate-spin shrink-0" />
  ) : isError ? (
    <X size={13} className="text-red-500 shrink-0" />
  ) : (
    <Check size={13} className="text-green-600 shrink-0" />
  )

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        isError
          ? 'border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800'
          : 'border-border/50 bg-surface-alt/60'
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left transition-colors duration-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
      >
        {icon}
        <Braces size={11} className="text-ink-faint/50 shrink-0" />
        <code className="text-[11px] font-mono font-medium text-ink leading-tight">{call.name}</code>
        {(hasArgs || hasOutput) && (
          <ChevronDown
            size={11}
            className={`ml-auto text-ink-faint/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {open && (hasArgs || hasOutput) && (
        <div className="px-2.5 pb-2 space-y-1">
          {hasArgs && (
            <div className="rounded-md bg-surface/70 border border-border/30 px-2.5 py-1.5 max-h-36 overflow-y-auto">
              <pre className="text-[10px] font-mono text-ink-soft/80 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(call.arguments, null, 2)}
              </pre>
            </div>
          )}
          {hasOutput && (
            <div className={`rounded-md border px-2.5 py-1.5 max-h-36 overflow-y-auto ${
              isError
                ? 'bg-red-50/80 dark:bg-red-950/40 border-red-200 dark:border-red-800'
                : 'bg-surface/70 border-border/30'
            }`}>
              <pre className={`text-[10px] font-mono leading-relaxed whitespace-pre-wrap ${
                isError ? 'text-red-600 dark:text-red-400' : 'text-ink-soft/80'
              }`}>
                {output && output.length > 250 ? output.slice(0, 250) + '...' : output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Loader2, X, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import type { ToolCallPart } from '../types'

interface ToolCallCardProps {
  call: ToolCallPart
  status: 'pending' | 'running' | 'completed' | 'failed'
  output?: string
}

export function ToolCallCard({ call, status, output }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isRunning = status === 'running' || status === 'pending'
  const isError = status === 'failed'
  const isEditWrite = call.name === 'editDoc' || call.name === 'writeDoc'
  const hasDetails = output || Object.keys(call.arguments).length > 0

  const docLabel = (call.arguments.title as string)
    || (call.arguments.documentId as string)
    || ''

  const statusLabel = isRunning && isEditWrite
    ? call.name === 'editDoc' ? 'Editing…' : 'Writing…'
    : isRunning ? 'Running…'
    : status === 'completed' ? '' : ''

  const icon = isRunning ? (
    <Loader2 size={12} className="text-accent/60 animate-spin shrink-0" />
  ) : isError ? (
    <X size={12} className="text-red-500 shrink-0" />
  ) : null

  const toggleExpand = () => {
    if (hasDetails) setExpanded(!expanded)
  }

  const argEntries = Object.entries(call.arguments).filter(
    ([k]) => k !== 'title' && k !== 'documentId'
  )

  return (
    <div
      className={`rounded-lg border ${
        isError
          ? 'border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800'
          : 'border-border/50 bg-surface-alt/60'
      }`}
    >
      <button
        onClick={toggleExpand}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {icon}
        <Settings size={11} className="text-ink-faint/40 shrink-0" />
        <code className="text-[11px] font-mono font-medium text-ink leading-tight">{call.name}</code>
        {docLabel && (
          <span className="text-[11px] text-ink-soft/60 truncate max-w-[180px]">
            <span className="text-ink-faint/30 mx-0.5">→</span> {docLabel}
          </span>
        )}
        <span className="flex-1" />
        {statusLabel && (
          <span className="text-[11px] text-accent/70">{statusLabel}</span>
        )}
        {hasDetails && (
          expanded ? <ChevronDown size={12} className="text-ink-faint/40 shrink-0" />
                 : <ChevronRight size={12} className="text-ink-faint/40 shrink-0" />
        )}
      </button>
      {expanded && hasDetails && (
        <div className="border-t border-border/30 px-2.5 py-2 space-y-1.5">
          {argEntries.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-ink-faint/50 uppercase tracking-wide mb-1">Arguments</div>
              <pre className="text-[11px] font-mono text-ink-soft whitespace-pre-wrap break-words bg-surface rounded p-1.5">
                {JSON.stringify(Object.fromEntries(argEntries), null, 2)}
              </pre>
            </div>
          )}
          {output && (
            <div>
              <div className="text-[10px] font-medium text-ink-faint/50 uppercase tracking-wide mb-1">Result</div>
              <pre className="text-[11px] font-mono text-ink-soft whitespace-pre-wrap break-words bg-surface rounded p-1.5 max-h-40 overflow-y-auto">
                {output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

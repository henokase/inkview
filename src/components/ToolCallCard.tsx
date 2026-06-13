import { Loader2, X, Settings } from 'lucide-react'
import type { ToolCallPart } from '../types'

interface ToolCallCardProps {
  call: ToolCallPart
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export function ToolCallCard({ call, status }: ToolCallCardProps) {
  const isRunning = status === 'running' || status === 'pending'
  const isError = status === 'failed'
  const isEditWrite = call.name === 'editDoc' || call.name === 'writeDoc'

  const docLabel = (call.arguments.title as string)
    || (call.arguments.documentId as string)
    || ''

  const statusLabel = isRunning && isEditWrite
    ? call.name === 'editDoc' ? 'Editing…' : 'Writing…'
    : isRunning ? 'Running…'
    : ''

  const icon = isRunning ? (
    <Loader2 size={12} className="text-accent/60 animate-spin shrink-0" />
  ) : isError ? (
    <X size={12} className="text-red-500 shrink-0" />
  ) : null

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface-alt/60 px-2.5 py-1.5">
      {icon}
      <Settings size={11} className="text-ink-faint/40 shrink-0" />
      <code className="text-[11px] font-mono font-medium text-ink leading-tight">{call.name}</code>
      {docLabel && (
        <span className="text-[11px] text-ink-soft/60 truncate max-w-[180px]">
          <span className="text-ink-faint/30 mx-0.5">→</span> {docLabel}
        </span>
      )}
      {statusLabel && (
        <span className="ml-auto text-[11px] text-accent/70">{statusLabel}</span>
      )}
    </div>
  )
}

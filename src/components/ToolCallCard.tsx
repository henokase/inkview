import { useState } from 'react'
import { Loader2, Settings, ChevronDown } from 'lucide-react'
import type { ToolCallPart } from '../types'

interface ToolCallCardProps {
  call: ToolCallPart
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
  metadata?: Record<string, unknown>
}

export function ToolCallCard({ call, status, result, metadata: _metadata }: ToolCallCardProps) {
  const isError = status === 'failed'
  const isRunning = status === 'running' || status === 'pending'
  const isReadDoc = call.name === 'readDoc'
  const canExpand = !isRunning && !isReadDoc
  const hasResult = canExpand && !!result

  const [collapsed, setCollapsed] = useState(true)

  const docLabel = (call.arguments.url as string)
    || (call.arguments.query as string)
    || (call.arguments.title as string)
    || (call.arguments.documentId as string)
    || ''

  const statusLabel = isRunning
    ? call.name === 'editDoc' ? 'Editing…'
      : call.name === 'writeDoc' ? 'Writing…'
      : 'Running…'
    : ''

  const icon = isRunning ? (
    <Loader2 size={12} className="text-accent/60 animate-spin shrink-0" />
  ) : null

  return (
    <div className="rounded-xl border overflow-hidden border-border/50">
      <button
        onClick={() => canExpand && setCollapsed(!collapsed)}
        className={`w-full flex items-center gap-1.5 bg-surface-alt/60 px-2.5 py-1.5 text-left ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {icon}
        <Settings size={11} className="text-ink-faint/40 shrink-0" />
        <code className={`text-[11px] font-mono font-medium leading-tight ${isError ? 'text-red-500' : 'text-ink'}`}>{call.name}</code>
        {docLabel && (
          <span className={`text-[11px] ${isError ? 'text-red-500' : 'text-ink'} truncate max-w-45`}>
            <span className="text-ink-faint/30 mx-0.5">→</span> {docLabel}
          </span>
        )}
        {statusLabel && (
          <span className="text-[11px] text-accent/70">{statusLabel}</span>
        )}
        {canExpand && (
          <ChevronDown size={12} className={`ml-auto text-ink-faint/50 transition-transform duration-200 ${!collapsed ? 'rotate-180' : ''}`} />
        )}
      </button>
      {!collapsed && hasResult && (
        <div className="px-3 pb-3 pt-1.5 animate-in slide-in-from-top-1 fade-in duration-200">
          <div className="rounded-lg bg-surface dark:bg-black/40 border border-border/30 px-3 py-2 max-h-48 overflow-y-auto">
            <pre className={`text-[11px] font-mono leading-relaxed whitespace-pre-wrap ${isError ? 'text-red-700 dark:text-red-400' : 'text-ink-soft'}`}>
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

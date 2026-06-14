import { useState } from 'react'
import { Loader2, X, Settings, ChevronDown, FileText } from 'lucide-react'
import type { ToolCallPart } from '../types'
import { useDocumentStore } from '../stores/document-store'

interface ToolCallCardProps {
  call: ToolCallPart
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
  metadata?: Record<string, unknown>
}

export function ToolCallCard({ call, status, result, metadata }: ToolCallCardProps) {
  const [collapsed, setCollapsed] = useState(true)
  const isRunning = status === 'running' || status === 'pending'
  const isError = status === 'failed'
  const isEditWrite = call.name === 'editDoc' || call.name === 'writeDoc'
  const isReadDoc = call.name === 'readDoc'
  const showResult = !isRunning && result && !isReadDoc
  const isNewDocWrite = call.name === 'writeDoc' && !call.arguments.documentId && !isRunning && !isError
  const isCreateDoc = call.name === 'createDoc' && !isRunning && !isError
  const isNewlyCreated = isCreateDoc || isNewDocWrite
  const createdDocId = isNewlyCreated ? (metadata?.id as string) : undefined
  const createdDocTitle = isNewlyCreated ? (metadata?.title as string) || (call.arguments.title as string) : undefined
  const hasExpandableContent = showResult || !!createdDocId

  const docLabel = (call.arguments.url as string)
    || (call.arguments.query as string)
    || (call.arguments.title as string)
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
    <div className="rounded-xl border overflow-hidden border-border/50">
      <button
        onClick={() => hasExpandableContent && setCollapsed(!collapsed)}
        className={`w-full flex items-center gap-1.5 bg-surface-alt/60 px-2.5 py-1.5 text-left ${hasExpandableContent ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {icon}
        <Settings size={11} className="text-ink-faint/40 shrink-0" />
        <code className="text-[11px] font-mono font-medium text-ink leading-tight">{call.name}</code>
        {docLabel && (
          <span className="text-[11px] text-ink-soft/60 truncate max-w-[180px]">
            <span className="text-ink-faint/30 mx-0.5">→</span> {docLabel}
          </span>
        )}
        {statusLabel && (
          <span className="text-[11px] text-accent/70">{statusLabel}</span>
        )}
        {hasExpandableContent && (
          <ChevronDown size={12} className={`ml-auto text-ink-faint/50 transition-transform duration-200 ${!collapsed ? 'rotate-180' : ''}`} />
        )}
      </button>
      {!collapsed && showResult && (
        <div className="px-3 pb-3 pt-1.5 space-y-2">
          <div className="rounded-lg bg-white/60 dark:bg-black/40 border border-border/30 px-3 py-2 max-h-48 overflow-y-auto">
            <pre className={`text-[11px] font-mono leading-relaxed whitespace-pre-wrap ${isError ? 'text-red-700 dark:text-red-400' : 'text-ink-soft'}`}>
              {result}
            </pre>
          </div>
          {createdDocId && createdDocTitle && (
            <button
              onClick={() => useDocumentStore.getState().setActiveDoc(createdDocId!)}
              className="flex items-center gap-1.5 w-full rounded-lg border border-accent/25 bg-accent/5 hover:bg-accent/10 active:bg-accent/15 px-3 py-2 transition-colors text-left group"
            >
              <FileText size={13} className="text-accent shrink-0" />
              <span className="text-[12px] font-medium text-accent truncate flex-1">{createdDocTitle}</span>
              <span className="text-[10px] text-ink-faint/60 group-hover:text-accent/70 transition-colors">Open document →</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

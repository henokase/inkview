import { useState } from 'react'
import { Shield, AlertTriangle, Braces, ChevronDown, Check } from 'lucide-react'
import type { PermissionRequest } from '../stores/agent-store'

interface PermissionDialogProps {
  request: PermissionRequest | null
  onResolve: (action: 'allow' | 'always' | 'deny') => void
}

function permLabel(perm: string): string {
  if (perm === 'read') return `read documents`
  if (perm === 'search') return `search documents`
  if (perm === 'list') return `list documents`
  if (perm === 'edit') return `edit documents`
  if (perm === 'create') return `create documents`
  if (perm === 'delete') return `delete documents`
  return `use ${perm}`
}

export function PermissionDialog({ request, onResolve }: PermissionDialogProps) {
  const [argsOpen, setArgsOpen] = useState(false)
  const [resolving, setResolving] = useState(false)

  if (!request) return null

  const hasArgs = Object.keys(request.args).length > 0
  const isDangerous = request.permission === 'delete'

  const handle = (action: 'allow' | 'always' | 'deny') => {
    setResolving(true)
    onResolve(action)
  }

  return (
    <div className="animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className={`rounded-xl border overflow-hidden ${
        isDangerous
          ? 'border-red-200 dark:border-red-800 bg-gradient-to-b from-red-50 to-red-50/60 dark:from-red-950/20 dark:to-red-950/10'
          : 'border-amber-200 dark:border-amber-800 bg-gradient-to-b from-amber-50 to-amber-50/60 dark:from-amber-950/20 dark:to-amber-950/10'
      }`}>
        <div className="px-3 pt-2.5 pb-2 space-y-2">
          <div className="flex items-start gap-2.5">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5 ${
              isDangerous
                ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
            }`}>
              {isDangerous ? <AlertTriangle size={13} /> : <Shield size={13} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <code className="text-[11px] font-mono font-semibold text-ink bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md">{request.toolName}</code>
                <span className="text-[13px] text-ink-soft leading-tight">
                  wants permission to <span className="font-medium text-ink">{permLabel(request.permission)}</span>
                </span>
              </div>
              {hasArgs && (
                <button
                  onClick={() => setArgsOpen(!argsOpen)}
                  className="flex items-center gap-1 mt-1 text-[11px] text-ink-faint/60 hover:text-ink-faint transition-colors"
                >
                  <Braces size={10} />
                  <span>arguments</span>
                  <ChevronDown size={10} className={`transition-transform duration-200 ${argsOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
              {hasArgs && argsOpen && (
                <pre className="mt-1.5 text-[11px] font-mono text-ink-soft/70 whitespace-pre-wrap bg-white/40 dark:bg-black/20 rounded-lg px-2.5 py-1.5 border border-black/[0.04] dark:border-white/[0.06] max-h-28 overflow-y-auto">
                  {JSON.stringify(request.args, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handle('allow')}
              disabled={resolving}
              className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-accent-soft transition-colors disabled:opacity-50"
            >
              <Check size={11} />
              Allow once
            </button>
            <button
              onClick={() => handle('always')}
              disabled={resolving}
              className="rounded-lg border border-black/[0.08] dark:border-white/[0.12] px-2.5 py-1.5 text-[11px] font-medium text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            >
              Always allow
            </button>
            <button
              onClick={() => handle('deny')}
              disabled={resolving}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ml-auto disabled:opacity-50 ${
                isDangerous
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'text-ink-faint hover:text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              {isDangerous ? 'Block' : 'Deny'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

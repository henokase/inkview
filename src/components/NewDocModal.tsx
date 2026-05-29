import { createPortal } from 'react-dom'
import { PenLine, X } from 'lucide-react'
import { FileDropZone } from './FileDropZone'

interface NewDocModalProps {
  open: boolean
  onClose: () => void
  onCreateBlank: () => void
  onFileUpload: (content: string, name: string) => void
}

export function NewDocModal({ open, onClose, onCreateBlank, onFileUpload }: NewDocModalProps) {
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl mx-4">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-accent-bg p-1.5">
              <PenLine size={16} className="text-accent" />
            </div>
            <h2 className="font-sans text-base font-semibold text-ink">New Document</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-alt hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          <FileDropZone onFile={onFileUpload} />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-xs font-medium text-ink-faint font-sans">or</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <button
            onClick={() => { onCreateBlank(); onClose() }}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border px-6 py-4 text-sm font-medium text-ink-soft hover:border-accent/40 hover:text-accent hover:bg-accent-bg/50 transition-all font-sans"
          >
            <PenLine size={18} />
            Start writing from scratch
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

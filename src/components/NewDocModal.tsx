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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl mx-4">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold text-ink">New Document</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <FileDropZone onFile={onFileUpload} />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-ink-faint">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={() => { onCreateBlank(); onClose() }}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border px-6 py-4 text-sm font-medium text-ink-soft hover:border-accent/50 hover:text-ink hover:bg-surface-alt/50 transition-all"
          >
            <PenLine size={20} />
            Start writing from scratch
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

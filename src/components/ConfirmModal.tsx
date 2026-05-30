import { X, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) el.showModal()
    else el.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-50 m-auto h-fit w-full max-w-sm rounded-xl border border-border bg-surface p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-sans text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg p-1 text-ink-faint hover:bg-surface-alt hover:text-ink transition-colors disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mb-5 text-sm text-ink-soft leading-relaxed font-sans">{message}</p>
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-alt transition-colors font-sans disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors font-sans disabled:opacity-60 ${
              destructive
                ? 'bg-red-500 hover:bg-red-600 disabled:hover:bg-red-500'
                : 'bg-accent hover:bg-accent-soft disabled:hover:bg-accent'
            }`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

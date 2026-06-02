import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PenLine, X, Loader2, FileText } from 'lucide-react'
import { FileDropZone } from './FileDropZone'

interface NewDocModalProps {
  open: boolean
  onClose: () => void
  onCreateBlank: () => void
  onFileUpload: (content: string, name: string) => void
  onFilesUpload: (files: { content: string; name: string }[]) => void
  loading?: boolean
}

export function NewDocModal({ open, onClose, onCreateBlank, onFileUpload, onFilesUpload, loading = false }: NewDocModalProps) {
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const abortRef = useRef(false)

  const handlePick = useCallback(async (files: File[]) => {
    if (files.length === 1) {
      const file = files[0]
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onFileUpload(reader.result, file.name.replace(/\.(md|markdown)$/i, ''))
        }
      }
      reader.readAsText(file)
      return
    }

    abortRef.current = false
    setImporting(true)
    setImportProgress({ current: 0, total: files.length })

    const results: { content: string; name: string }[] = []
    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break
      try {
        const text = await readFile(files[i])
        if (text !== null) {
          results.push({
            content: text,
            name: files[i].name.replace(/\.(md|markdown)$/i, ''),
          })
        }
      } catch {
        // skip failed files
      }
      setImportProgress({ current: i + 1, total: files.length })
    }

    setImporting(false)
    if (results.length > 0) {
      onFilesUpload(results)
    }
  }, [onFileUpload, onFilesUpload])

  const pct = importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={loading || importing ? undefined : onClose} />
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
            disabled={loading || importing}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-alt hover:text-ink transition-colors disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </div>

        {importing ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink font-sans">
                  Importing {importProgress.current} of {importProgress.total}
                </p>
                <p className="text-xs text-ink-faint font-sans mt-0.5">
                  {pct}% complete
                </p>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-alt overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <FileDropZone onPick={handlePick} disabled={loading} multiple />

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-xs font-medium text-ink-faint font-sans">or</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <button
              onClick={() => { if (!loading) { onCreateBlank(); onClose() } }}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border px-6 py-4 text-sm font-medium text-ink-soft hover:border-accent/40 hover:text-accent hover:bg-accent-bg/50 transition-all font-sans disabled:opacity-40 disabled:pointer-events-none"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <PenLine size={18} />}
              {loading ? 'Creating\u2026' : 'Start writing from scratch'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function readFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}

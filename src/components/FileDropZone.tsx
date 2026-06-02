import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'

interface FileDropZoneProps {
  onPick: (files: File[]) => void
  disabled?: boolean
  multiple?: boolean
}

export function FileDropZone({ onPick, disabled = false, multiple = false }: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (disabled) return
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) onPick(files)
    },
    [onPick, disabled]
  )

  const handleFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return
      const files = Array.from(e.target.files ?? [])
      if (files.length > 0) onPick(files)
      e.target.value = ''
    },
    [onPick, disabled]
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => { if (!disabled) inputRef.current?.click() }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200 ${
        disabled
          ? 'opacity-40 pointer-events-none'
          : dragging
            ? 'border-accent bg-accent-bg scale-[1.02]'
            : 'border-border hover:border-accent/40 hover:bg-accent-bg/30'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.txt"
        multiple={multiple}
        className="hidden"
        onChange={handleFilePick}
        disabled={disabled}
      />
      <div
        className={`rounded-xl p-3 transition-colors ${
          dragging ? 'bg-accent text-white' : 'bg-surface-alt text-ink-soft'
        }`}
      >
        <Upload size={22} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-ink font-sans">
          {dragging ? 'Drop your files here' : 'Click or drag to upload'}
        </p>
        <p className="mt-1 text-xs text-ink-faint font-sans">.md or .markdown files</p>
      </div>
    </div>
  )
}

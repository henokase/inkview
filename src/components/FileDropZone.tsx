import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'

interface FileDropZoneProps {
  onFile: (content: string, name: string) => void
}

export function FileDropZone({ onFile }: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onFile(reader.result, file.name.replace(/\.(md|markdown)$/i, ''))
        }
      }
      reader.readAsText(file)
    },
    [onFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200 ${
        dragging
          ? 'border-accent bg-accent-bg scale-[1.02]'
          : 'border-border hover:border-accent/40 hover:bg-accent-bg/30'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.txt"
        className="hidden"
        onChange={handleFilePick}
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
          {dragging ? 'Drop your file here' : 'Click or drag to upload'}
        </p>
        <p className="mt-1 text-xs text-ink-faint font-sans">.md or .markdown files</p>
      </div>
    </div>
  )
}

import React, { useCallback, useRef, useState } from 'react'
import { Plus, UploadCloud, Loader2 } from 'lucide-react'

interface EmptyDocStateProps {
  onNewDoc: () => void
  onFilesPick: (files: File[]) => void
  loading?: boolean
}

export function EmptyDocState({ onNewDoc, onFilesPick, loading = false }: EmptyDocStateProps) {
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)
      dragCounter.current = 0
      if (loading) return

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        onFilesPick(files)
      }
    },
    [loading, onFilesPick]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (loading) return
      const files = Array.from(e.target.files ?? [])
      if (files.length > 0) {
        onFilesPick(files)
      }
      e.target.value = ''
    },
    [loading, onFilesPick]
  )

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.txt"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        disabled={loading}
      />

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => {
          if (!loading) inputRef.current?.click()
        }}
        className={`group relative flex w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-300 ${
          dragging
            ? 'border-accent bg-accent-bg/60 scale-[1.02] shadow-xl shadow-accent/10'
            : 'border-border/80 bg-surface-alt/40 hover:border-accent/50 hover:bg-surface-alt/80 hover:shadow-lg'
        } ${loading ? 'pointer-events-none opacity-60' : ''}`}
      >
        {/* Animated Icon Container */}
        <div
          className={`mb-5 flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-300 ${
            dragging
              ? 'bg-accent text-white scale-110 shadow-lg shadow-accent/30'
              : 'bg-surface text-accent group-hover:scale-105 group-hover:shadow-md border border-border/50'
          }`}
        >
          {loading ? (
            <Loader2 size={36} className="animate-spin text-accent" />
          ) : dragging ? (
            <UploadCloud size={40} className="animate-bounce" />
          ) : (
            <UploadCloud size={38} className="text-accent" />
          )}
        </div>

        {/* Text Heading & Description */}
        <h3 className="font-sans text-lg font-semibold text-ink">
          {dragging ? 'Drop Markdown file(s) here' : 'Drag & drop files here'}
        </h3>
        <p className="mt-2 max-w-sm font-sans text-sm text-ink-soft leading-relaxed">
          {dragging ? (
            <span className="text-accent font-medium">Release to import your document(s)</span>
          ) : (
            <>
              Drop your <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">.md</code> or <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">.markdown</code> files here, or browse from your computer.
            </>
          )}
        </p>

        {/* Action Buttons */}
        <div
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-surface-alt border border-border/80 px-4 py-2.5 font-sans text-sm font-medium text-ink hover:bg-surface hover:border-accent/40 hover:text-accent shadow-xs transition-all disabled:opacity-50"
          >
            <UploadCloud size={16} className="text-accent" />
            Browse Files
          </button>

          <button
            type="button"
            onClick={onNewDoc}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-sans text-sm font-medium text-white shadow-xs hover:opacity-95 hover:shadow-md transition-all disabled:opacity-50"
          >
            <Plus size={16} />
            New Document
          </button>
        </div>
      </div>
    </div>
  )
}

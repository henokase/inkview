import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePendingChangesStore } from '../stores/pending-changes-store'
import { useDocumentStore } from '../stores/document-store'
import { useUiStore } from '../stores/ui-store'

export function PendingChangesBanner() {
  const changes = usePendingChangesStore((s) => s.changes)
  const setActiveDoc = useDocumentStore((s) => s.setActiveDoc)
  const setEditorMode = useUiStore((s) => s.setEditorMode)

  const docIds = useMemo(() => {
    const ids = new Set(changes.map((c) => c.documentId))
    return Array.from(ids)
  }, [changes])

  const [currentIndex, setCurrentIndex] = useState(0)

  if (docIds.length === 0) return null

  const safeIndex = Math.min(currentIndex, docIds.length - 1)
  const currentDocId = docIds[safeIndex]
  const docChanges = changes.filter((c) => c.documentId === currentDocId)
  const docTitle = docChanges[0]?.title || 'Untitled'

  const openDoc = (docId: string) => {
    setActiveDoc(docId)
    setEditorMode('edit')
  }

  const goPrev = () => {
    const nextIndex = (safeIndex - 1 + docIds.length) % docIds.length
    setCurrentIndex(nextIndex)
    openDoc(docIds[nextIndex])
  }

  const goNext = () => {
    const nextIndex = (safeIndex + 1) % docIds.length
    setCurrentIndex(nextIndex)
    openDoc(docIds[nextIndex])
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60] flex flex-col rounded-xl border border-border/60 bg-surface/95 backdrop-blur-md shadow-lg shadow-black/5">
      <div className="flex items-center gap-2 px-3 pt-1">
        <button
          onClick={goPrev}
          className="rounded-md p-1 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
          title="Previous document"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          onClick={() => openDoc(currentDocId)}
          className="text-xs text-ink-soft hover:text-ink transition-colors max-w-28 truncate"
          title={docTitle}
        >
          {docTitle}
        </button>
        <span className="text-[10px] text-orange-400 dark:text-orange-600 font-medium whitespace-nowrap">
          {docChanges.length} pending
        </span>

        <button
          onClick={goNext}
          className="rounded-md p-1 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors"
          title="Next document"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="flex justify-center pb-1">
        <span className="text-[10px] text-ink-faint font-medium tabular-nums">
          {safeIndex + 1}/{docIds.length}
        </span>
      </div>
    </div>
  )
}

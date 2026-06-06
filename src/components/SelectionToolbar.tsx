import { useEffect, useRef } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { useChatStore } from '../stores/chat-store'

interface SelectionToolbarProps {
  position: { x: number; y: number } | null
  onAskAi: () => void
}

export function SelectionToolbar({ position, onAskAi }: SelectionToolbarProps) {
  const selectedText = useChatStore((s) => s.selectedText)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        useChatStore.getState().setSelectedText('')
      }
    }
    if (selectedText) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedText])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedText) {
        useChatStore.getState().setSelectedText('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedText])

  if (!selectedText || !position) return null

  return (
    <div
      ref={ref}
      className="fixed z-50 flex items-center gap-1 rounded-xl border border-border bg-surface px-2 py-1.5 shadow-lg"
      style={{
        left: position.x,
        top: position.y + 8,
      }}
    >
      <button
        onClick={onAskAi}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent hover:opacity-90 transition-opacity"
      >
        <MessageSquarePlus size={13} />
        Ask AI
      </button>
    </div>
  )
}

import { useRef, useState, useEffect } from 'react'
import { ChevronDown, Trash2, MessageSquare } from 'lucide-react'
import type { Conversation } from '../types'

interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
}: ConversationListProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find((c) => c.id === activeId)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:text-ink hover:bg-surface-alt/60 border border-transparent hover:border-border/40 transition-all duration-200 group"
      >
        <span className="flex-1 truncate text-left">{activeConv?.title || 'Select session'}</span>
        <ChevronDown size={11} className={`shrink-0 text-ink-faint/40 group-hover:text-ink-faint/70 transition-all duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-border/70 bg-surface/95 backdrop-blur-lg shadow-lg shadow-black/5 z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">
          {conversations.length === 0 ? (
            <p className="px-3.5 py-3 text-xs text-ink-faint/50 font-sans italic text-center leading-relaxed">
              No sessions yet
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto py-0.5">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group relative flex items-center gap-2 px-3.5 py-2 cursor-pointer transition-all duration-150 ${
                    conv.id === activeId
                      ? 'bg-accent/8 text-accent'
                      : 'text-ink-soft hover:bg-surface-alt/70 hover:text-ink'
                  }`}
                  onClick={() => { onSelect(conv.id); setOpen(false) }}
                >
                  {conv.id === activeId && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-accent" />
                  )}
                  <MessageSquare size={12} className="shrink-0 opacity-40 group-hover:opacity-60 transition-opacity" />
                  <span className="flex-1 truncate text-xs font-medium leading-relaxed">{conv.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(conv.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-ink-faint/50 hover:text-red-500 hover:bg-red-500/10 transition-all duration-150"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

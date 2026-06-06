import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X, MessageSquare } from 'lucide-react'
import { useChatStore } from '../stores/chat-store'
import { useDocumentStore } from '../stores/document-store'
import { ConversationList } from './ConversationList'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'

const STORAGE_KEY = 'inkview-chat-width'
const MIN_WIDTH = 300
const MAX_WIDTH = 600

function loadWidth(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(saved)))
  } catch {}
  return 380
}

function saveWidth(w: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(w))
  } catch {}
}

export function ChatPanel() {
  const conversationsByDoc = useChatStore((s) => s.conversationsByDoc)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const messagesByConv = useChatStore((s) => s.messagesByConv)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const isChatOpen = useChatStore((s) => s.isChatOpen)
  const setChatOpen = useChatStore((s) => s.setChatOpen)
  const createConversation = useChatStore((s) => s.createConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)
  const setChatPanelWidth = useChatStore((s) => s.setChatPanelWidth)
  const sendMessage = useChatStore((s) => s.sendMessage)

  const activeDoc = useDocumentStore((s) => {
    const docs = s.documents
    const id = s.activeDocId
    return id ? docs.find((d) => d.id === id) : undefined
  })

  const [width, setWidth] = useState(loadWidth)
  const isDragging = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX))
      setWidth(newWidth)
    }
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setWidth((w) => {
          saveWidth(w)
          setChatPanelWidth(w)
          return w
        })
      }
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [setChatPanelWidth])

  useEffect(() => {
    setChatPanelWidth(width)
  }, [width, setChatPanelWidth])

  if (!isChatOpen) return null

  const activeDocId = activeDoc?.id || ''
  const conversations = conversationsByDoc[activeDocId] || []
  const messages = activeConversationId ? messagesByConv[activeConversationId] || [] : []

  const handleSend = (content: string) => {
    sendMessage(content, activeDoc?.content || '', activeDocId)
  }

  const handleCreate = () => {
    const activeConv = conversations.find((c) => c.id === activeConversationId)
    const activeHasMessages = activeConv && (messagesByConv[activeConv.id] || []).length > 0
    if (activeHasMessages || !activeConv) {
      const id = createConversation(activeDocId)
      setActiveConversation(id)
    }
  }

  const handleDelete = (id: string) => {
    if (id === activeConversationId) {
      setActiveConversation(null)
    }
    deleteConversation(id)
  }

  const handleSelect = (id: string) => {
    setActiveConversation(id)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/20 backdrop-blur-xs lg:hidden"
        onClick={() => setChatOpen(false)}
      />

      <aside
        className="fixed inset-y-0 right-0 z-40 lg:relative lg:shrink-0 flex flex-col border-l border-border/60 bg-surface shadow-2xl lg:shadow-xl animate-in slide-in-from-right duration-200"
        style={{ width }}
      >
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize group z-10"
        >
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border/40 group-hover:bg-accent/40 transition-colors duration-300" />
          <div className="absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 bg-linear-to-b from-accent/60 via-accent/30 to-accent/60 transition-opacity duration-300" />
        </div>

        <div className="relative shrink-0">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-accent/80 via-accent-soft/60 to-transparent" />
          <div className="flex items-center justify-between px-4 pt-5 pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 text-accent">
                  <MessageSquare size={14} />
                </div>
                <h2 className="text-sm font-bold text-ink font-sans tracking-tight">AI Chat</h2>
              </div>
              <ConversationList
                conversations={conversations}
                activeId={activeConversationId}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
              <button
                onClick={handleCreate}
                className="rounded-lg p-1 text-ink-faint hover:text-accent hover:bg-accent/8 transition-all duration-200 active:scale-95"
                title="New session"
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="shrink-0 rounded-lg p-1.5 text-ink-faint hover:text-ink hover:bg-surface-alt/80 transition-all duration-200 active:scale-95"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <ChatMessages messages={messages} isStreaming={isStreaming} />

        <div className="shrink-0 border-t border-border/50">
          <ChatInput onSend={handleSend} />
        </div>
      </aside>
    </>
  )
}

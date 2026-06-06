import { useEffect } from 'react'
import { Plus, X, MessageSquare } from 'lucide-react'
import { useChatStore } from '../stores/chat-store'
import { useDocumentStore } from '../stores/document-store'
import { ConversationList } from './ConversationList'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'

const CHAT_WIDTH = 500

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

  useEffect(() => {
    setChatPanelWidth(CHAT_WIDTH)
  }, [setChatPanelWidth])

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
        className="fixed inset-y-0 right-0 z-40 lg:relative lg:shrink-0 flex flex-col border-l border-border/40 bg-surface shadow-2xl lg:shadow-[-8px_0_32px_-8px_rgba(0,0,0,0.12)] animate-in slide-in-from-right duration-200"
        style={{ width: CHAT_WIDTH }}
      >
        <div className="relative shrink-0">
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

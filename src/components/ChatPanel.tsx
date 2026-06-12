import { useEffect, useState, useRef } from 'react'
import { Plus, X, MessageSquare } from 'lucide-react'
import { useChatStore } from '../stores/chat-store'
import { useDocumentStore } from '../stores/document-store'
import { useAgentStore } from '../stores/agent-store'
import { ConversationList } from './ConversationList'
import { ChatMessages } from './ChatMessages'
import { ChatInput, type ChatInputHandle } from './ChatInput'
import { ConfirmModal } from './ConfirmModal'
import { PermissionDialog } from './PermissionDialog'

const CHAT_WIDTH_SM = 340
const CHAT_WIDTH_MD = 400
const CHAT_WIDTH_LG = 500

export function ChatPanel() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [screenWidth, setScreenWidth] = useState(window.innerWidth)
  const chatInputRef = useRef<ChatInputHandle>(null)

  const conversationsByDoc = useChatStore((s) => s.conversationsByDoc)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const messagesByConv = useChatStore((s) => s.messagesByConv)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const activeThinking = useChatStore((s) => s.activeThinking)
  const isChatOpen = useChatStore((s) => s.isChatOpen)
  const setChatOpen = useChatStore((s) => s.setChatOpen)
  const createConversation = useChatStore((s) => s.createConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)
  const setChatPanelWidth = useChatStore((s) => s.setChatPanelWidth)
  const draftConversations = useChatStore((s) => s.draftConversations)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const editMessage = useChatStore((s) => s.editMessage)

  const permissionQueue = useAgentStore((s) => s.permissionQueue)
  const resolvePermission = useAgentStore((s) => s.resolvePermission)

  const activeDoc = useDocumentStore((s) => {
    const docs = s.documents
    const id = s.activeDocId
    return id ? docs.find((d) => d.id === id) : undefined
  })

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const getChatWidth = () => {
    if (screenWidth < 768) return CHAT_WIDTH_SM
    if (screenWidth < 1024) return CHAT_WIDTH_MD
    return CHAT_WIDTH_LG
  }

  useEffect(() => {
    setChatPanelWidth(getChatWidth())
  }, [screenWidth, setChatPanelWidth])

  if (!isChatOpen) return null

  const activeDocId = activeDoc?.id || ''
  const allConversations = conversationsByDoc[activeDocId] || []
  const conversations = allConversations.filter(c => !draftConversations[c.id])
  const messages = activeConversationId ? messagesByConv[activeConversationId] || [] : []
  const deleteConv = conversations.find((c) => c.id === deleteConfirmId)

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

  const handleEdit = (msgId: string, newContent: string) => {
    if (activeConversationId) {
      editMessage(activeConversationId, msgId, newContent, activeDoc?.content || '')
    }
  }

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (deleteConfirmId) {
      if (deleteConfirmId === activeConversationId) {
        setActiveConversation(null)
      }
      deleteConversation(deleteConfirmId)
      setDeleteConfirmId(null)
      // Focus input after deletion
      setTimeout(() => chatInputRef.current?.focus(), 0)
    }
  }

  const handleSelect = (id: string) => {
    setActiveConversation(id)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-55 bg-black/20 backdrop-blur-xs lg:hidden"
        onClick={() => setChatOpen(false)}
      />

      <aside
        className="fixed inset-y-0 right-0 z-60 lg:relative lg:shrink-0 flex flex-col border-l border-border/40 bg-surface shadow-2xl lg:shadow-[-8px_0_32px_-8px_rgba(0,0,0,0.12)] animate-in slide-in-from-right duration-200"
        style={{ width: getChatWidth() }}
      >
        <div className="relative shrink-0 pb-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 text-accent ring-1 ring-accent/15 shrink-0">
                <MessageSquare size={13} />
              </div>
              {/* <h2 className="text-sm font-bold text-ink font-sans tracking-tight shrink-0">Chat</h2> */}
              <div className="flex-1 min-w-0">
                <ConversationList
                  conversations={conversations}
                  activeId={activeConversationId}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                />
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCreate}
                className="rounded-lg p-1.5 text-ink-faint hover:text-accent hover:bg-accent/8 transition-all duration-200 active:scale-95"
                title="New session"
              >
                <Plus size={15} />
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-ink-faint hover:text-ink hover:bg-surface-alt/80 transition-all duration-200 active:scale-95"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>

        <ChatMessages messages={messages} isStreaming={isStreaming} activeThinking={activeThinking} onEdit={handleEdit} />

        <div className="shrink-0 border-t border-border/50">
          {permissionQueue[0] && (
            <div className="px-3 pt-2.5 pb-1">
              <PermissionDialog
                request={permissionQueue[0]}
                onResolve={(action) => {
                  resolvePermission(permissionQueue[0].id, action)
                }}
              />
            </div>
          )}
          <ChatInput ref={chatInputRef} key={activeConversationId ?? 'no-session'} onSend={handleSend} />
        </div>
      </aside>

      <ConfirmModal
        open={!!deleteConfirmId}
        title="Delete session"
        message={`Are you sure you want to delete "${deleteConv?.title || 'this session'}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </>
  )
}

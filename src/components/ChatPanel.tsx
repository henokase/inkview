import { useEffect, useState, useRef, useCallback } from 'react'
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
  const [panelWidth, setPanelWidth] = useState<number | null>(null)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

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
  const storedPanelWidth = useChatStore((s) => s.chatPanelWidth)
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

  const getMinWidth = () => {
    if (screenWidth < 768) return CHAT_WIDTH_SM
    if (screenWidth < 1024) return CHAT_WIDTH_MD
    return CHAT_WIDTH_LG
  }

  const getMaxWidth = () => Math.min(screenWidth * 0.6, 800)

  useEffect(() => {
    if (!panelWidth) {
      setPanelWidth(storedPanelWidth)
    }
  }, [storedPanelWidth, panelWidth])

  useEffect(() => {
    setChatPanelWidth(panelWidth || getMinWidth())
  }, [panelWidth, screenWidth, setChatPanelWidth])

  const updateWidth = useCallback((clientX: number) => {
    const newWidth = window.innerWidth - clientX
    const minW = getMinWidth()
    const maxW = getMaxWidth()
    const clamped = Math.max(minW, Math.min(newWidth, maxW))
    setPanelWidth(clamped)
  }, [screenWidth])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const currentWidth = panelWidth || getMinWidth()
    dragRef.current = { startX, startWidth: currentWidth }

    const handleMouseMove = (e: MouseEvent) => {
      updateWidth(e.clientX)
    }

    const handleMouseUp = () => {
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelWidth, updateWidth])

  if (!isChatOpen) return null

  const activeDocId = activeDoc?.id || ''
  const allConversations = Object.values(conversationsByDoc).flat()
  const sorted = [...allConversations].sort((a, b) => b.updatedAt - a.updatedAt)
  const conversations = sorted.filter(c => !draftConversations[c.id])
  const messages = activeConversationId ? messagesByConv[activeConversationId] || [] : []
  const deleteConv = conversations.find((c) => c.id === deleteConfirmId)

  const handleSend = (content: string) => {
    sendMessage(content, activeDocId)
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
      editMessage(activeConversationId, msgId, newContent)
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
        style={{ width: panelWidth || getMinWidth() }}
      >
        <div
          onMouseDown={handleDragStart}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 transition-colors group z-10"
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-border/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="relative shrink-0 pb-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 text-accent ring-1 ring-accent/15 shrink-0">
                <MessageSquare size={13} />
              </div>
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

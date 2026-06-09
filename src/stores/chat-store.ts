import { create } from 'zustand'
import type { Conversation, Message } from '../types'
import {
  loadConversationsForDocument,
  saveConversation,
  deleteConversation,
  deleteMessagesSince,
  loadMessagesForConversation,
  saveMessage,
} from '../lib/db'
import { StreamEngine } from '../lib/llm/stream-engine'
import type { Usage } from '../lib/llm/types'

interface ChatStore {
  conversationsByDoc: Record<string, Conversation[]>
  messagesByConv: Record<string, Message[]>
  activeConversationId: string | null
  isStreaming: boolean
  activeThinking: string
  selectedText: string
  contextText: string
  isChatOpen: boolean
  chatPanelWidth: number
  draftConversations: Record<string, boolean>
  _hydrated: boolean
  _engine: StreamEngine

  setSelectedText: (text: string) => void
  setContextText: (text: string) => void
  setChatOpen: (open: boolean) => void
  setChatPanelWidth: (width: number) => void

  init: (documentId: string) => Promise<void>
  createConversation: (documentId: string) => string
  deleteConversation: (convId: string) => void
  renameConversation: (id: string, title: string) => void
  setActiveConversation: (id: string | null) => void

  sendMessage: (content: string, documentContent: string, documentId?: string) => Promise<void>
  clearActiveThinking: () => void
  editMessage: (convId: string, msgId: string, newContent: string, documentContent: string) => Promise<void>
  _streamResponse: (convId: string, documentContent: string) => Promise<void>
  stopGeneration: () => void
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversationsByDoc: {},
  messagesByConv: {},
  activeConversationId: null,
  isStreaming: false,
  activeThinking: '',
  selectedText: '',
  contextText: '',
  isChatOpen: false,
  chatPanelWidth: 500,
  draftConversations: {},
  _hydrated: false,
  _engine: new StreamEngine(),

  setSelectedText: (text) => set({ selectedText: text }),
  setContextText: (text) => set({ contextText: text }),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setChatPanelWidth: (width) => set({ chatPanelWidth: width }),
  clearActiveThinking: () => set({ activeThinking: '' }),

  init: async (documentId) => {
    const convs = await loadConversationsForDocument(documentId)
    const msgsByConv: Record<string, Message[]> = {}
    for (const conv of convs) {
      msgsByConv[conv.id] = await loadMessagesForConversation(conv.id)
    }
    set((s) => ({
      conversationsByDoc: { ...s.conversationsByDoc, [documentId]: convs },
      messagesByConv: { ...s.messagesByConv, ...msgsByConv },
      activeConversationId: null,
      _hydrated: true,
    }))
  },

  createConversation: (documentId) => {
    const id = crypto.randomUUID()
    const now = Date.now()
    const conv: Conversation = {
      id,
      documentId,
      title: 'New Chat',
      createdAt: now,
      updatedAt: now,
    }
    set((s) => ({
      conversationsByDoc: {
        ...s.conversationsByDoc,
        [documentId]: [...(s.conversationsByDoc[documentId] || []), conv],
      },
      activeConversationId: id,
      messagesByConv: { ...s.messagesByConv, [id]: [] },
      draftConversations: { ...s.draftConversations, [id]: true },
    }))
    return id
  },

  deleteConversation: (convId) => {
    const state = get()
    state._engine.stop(convId)
    if (!state.draftConversations[convId]) {
      deleteConversation(convId)
    }
    const { [convId]: _, ...remainingDrafts } = state.draftConversations
    const newMessagesByConv = { ...state.messagesByConv }
    delete newMessagesByConv[convId]
    const newConvsByDoc = { ...state.conversationsByDoc }
    for (const docId of Object.keys(newConvsByDoc)) {
      newConvsByDoc[docId] = newConvsByDoc[docId].filter((c) => c.id !== convId)
    }
    set({
      conversationsByDoc: newConvsByDoc,
      messagesByConv: newMessagesByConv,
      draftConversations: remainingDrafts,
      activeConversationId:
        state.activeConversationId === convId ? null : state.activeConversationId,
    })
  },

  renameConversation: (id, title) => {
    const isDraft = get().draftConversations[id]
    set((s) => {
      const newConvsByDoc = { ...s.conversationsByDoc }
      for (const docId of Object.keys(newConvsByDoc)) {
        newConvsByDoc[docId] = newConvsByDoc[docId].map((c) =>
          c.id === id ? { ...c, title, updatedAt: Date.now() } : c
        )
      }
      return { conversationsByDoc: newConvsByDoc }
    })
    if (!isDraft) {
      const conv = Object.values(get().conversationsByDoc)
        .flat()
        .find((c) => c.id === id)
      if (conv) saveConversation(conv)
    }
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id })
    if (id && !get().messagesByConv[id]) {
      set({ messagesByConv: { ...get().messagesByConv, [id]: [] } })
      loadMessagesForConversation(id).then((msgs) => {
        set((s) => ({
          messagesByConv: { ...s.messagesByConv, [id]: msgs },
        }))
      })
    }
  },

  sendMessage: async (content, documentContent, documentId) => {
    const state = get()
    const { activeConversationId } = state
    let convId = activeConversationId

    if (!convId) {
      convId = get().createConversation(documentId || '')
    }

    const isNewConversation = !!get().draftConversations[convId]
    const existingMessages = get().messagesByConv[convId!] || []
    const isFirstMessage = existingMessages.length === 0

    if (isNewConversation) {
      const conv = Object.values(get().conversationsByDoc)
        .flat()
        .find((c) => c.id === convId)
      if (conv) {
        saveConversation(conv)
        set((s) => {
          const { [convId!]: _, ...rest } = s.draftConversations
          return { draftConversations: rest }
        })
      }
    }

    const contextText = state.contextText
    let userContent = content
    if (contextText) {
      userContent = `Regarding this selected text from the document:\n> ${contextText}\n\n${content}`
    }

    const now = Date.now()
    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'user',
      content: userContent,
      createdAt: now,
    }

    saveMessage(userMsg)

    set((s) => ({
      messagesByConv: {
        ...s.messagesByConv,
        [convId!]: [...(s.messagesByConv[convId!] || []), userMsg],
      },
      contextText: '',
    }))

    if (isFirstMessage) {
      get().renameConversation(convId, content)
    }

    await get()._streamResponse(convId, documentContent)
  },

  editMessage: async (convId, msgId, newContent, documentContent) => {
    const messages = get().messagesByConv[convId]
    if (!messages) return

    const msgIndex = messages.findIndex((m) => m.id === msgId)
    if (msgIndex === -1) return
    if (messages[msgIndex].content === newContent) return

    const editedMsg = { ...messages[msgIndex], content: newContent }
    const truncated = messages.slice(0, msgIndex).concat([editedMsg])

    saveMessage(editedMsg)
    deleteMessagesSince(convId, editedMsg.createdAt + 1)

    set((s) => ({
      messagesByConv: {
        ...s.messagesByConv,
        [convId]: truncated,
      },
    }))

    await get()._streamResponse(convId, documentContent)
  },

  _streamResponse: async (convId, documentContent) => {
    if (get().isStreaming) return

    const messages = get().messagesByConv[convId] || []

    const systemMessage = {
      role: 'system' as const,
      content: `You are a helpful AI assistant analyzing a document. I will ask questions based on the below document, and you will provide the answer accordingly.

DOCUMENT CONTENT:
${documentContent}

Instructions:
- When answering you may use the document as context, but not solely depend on it.
- Use markdown formatting in your responses.`,
    }

    const apiMessages = [
      systemMessage,
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
    ]

    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantId,
      conversationId: convId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    }

    set((s) => ({
      isStreaming: true,
      messagesByConv: {
        ...s.messagesByConv,
        [convId]: [...(s.messagesByConv[convId] || []), assistantMsg],
      },
    }))

    const engine = get()._engine
    let fullContent = ''
    let accumulatedThinking = ''
    let hasContentStarted = false
    let finalUsage: Usage | undefined

    try {
      await engine.start(convId, apiMessages, {
        onChunk: (chunk) => {
          if (chunk.reasoning) {
            accumulatedThinking += chunk.reasoning
            if (!hasContentStarted) {
              set({ activeThinking: accumulatedThinking })
            }
          }
          if (chunk.content) {
            if (!hasContentStarted && accumulatedThinking) {
              set((s) => ({
                activeThinking: '',
                messagesByConv: {
                  ...s.messagesByConv,
                  [convId]: (s.messagesByConv[convId] || []).map((m) =>
                    m.id === assistantId ? { ...m, thinking: accumulatedThinking } : m
                  ),
                },
              }))
            }
            hasContentStarted = true
            fullContent += chunk.content
            set((s) => ({
              messagesByConv: {
                ...s.messagesByConv,
                [convId]: (s.messagesByConv[convId] || []).map((m) =>
                  m.id === assistantId ? { ...m, content: fullContent } : m
                ),
              },
            }))
          }
        },
        onUsage: (usage) => {
          finalUsage = usage
        },
        onDone: () => {
          if (!fullContent && accumulatedThinking) {
            set((s) => ({
              messagesByConv: {
                ...s.messagesByConv,
                [convId]: (s.messagesByConv[convId] || []).map((m) =>
                  m.id === assistantId ? { ...m, thinking: accumulatedThinking } : m
                ),
              },
            }))
          }
          const final = get().messagesByConv[convId]?.find((m) => m.id === assistantId)
          if (final) {
            saveMessage({
              ...final,
              tokensPrompt: finalUsage?.promptTokens,
              tokensCompletion: finalUsage?.completionTokens,
            })
          }
        },
        onError: (err) => {
          const errorText = err instanceof Error ? err.message : 'An error occurred'
          const errorMsg: Message = {
            id: assistantId,
            conversationId: convId,
            role: 'assistant',
            content: errorText,
            createdAt: Date.now(),
            thinking: accumulatedThinking || undefined,
          }
          set((s) => ({
            messagesByConv: {
              ...s.messagesByConv,
              [convId]: (s.messagesByConv[convId] || []).map((m) =>
                m.id === assistantId ? errorMsg : m
              ),
            },
          }))
          saveMessage(errorMsg)
        },
      })
    } finally {
      set({ isStreaming: false, activeThinking: '' })
    }
  },

  stopGeneration: () => {
    const state = get()
    if (state.activeConversationId) {
      state._engine.stop(state.activeConversationId)
    }
  },
}))

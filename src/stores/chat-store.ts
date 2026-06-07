import { create } from 'zustand'
import type { Conversation, Message } from '../types'
import {
  loadConversationsForDocument,
  saveConversation,
  deleteConversation,
  loadMessagesForConversation,
  saveMessage,
} from '../lib/db'
import { streamChat } from '../lib/openrouter'

interface ChatStore {
  conversationsByDoc: Record<string, Conversation[]>
  messagesByConv: Record<string, Message[]>
  activeConversationId: string | null
  isStreaming: boolean
  selectedText: string
  contextText: string
  isChatOpen: boolean
  chatPanelWidth: number
  draftConversations: Record<string, boolean>
  _hydrated: boolean

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
  stopGeneration: () => void
}

const abortControllers = new Map<string, AbortController>()

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversationsByDoc: {},
  messagesByConv: {},
  activeConversationId: null,
  isStreaming: false,
  selectedText: '',
  contextText: '',
  isChatOpen: false,
  chatPanelWidth: 500,
  draftConversations: {},
  _hydrated: false,

  setSelectedText: (text) => set({ selectedText: text }),
  setContextText: (text) => set({ contextText: text }),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setChatPanelWidth: (width) => set({ chatPanelWidth: width }),

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

    const currentMessages = get().messagesByConv[convId!] || []

    const systemMessage = {
      role: 'system',
      content: `You are a helpful AI assistant analyzing a document. I'll as questions based on the below document, and you provid the answer accrodingly.

DOCUMENT CONTENT:
${documentContent}

Instructions:
- When answering you may use the document as context, but not solely depend on it.
- Use markdown formatting in your responses.`,
    }

    const apiMessages = [
      systemMessage,
      ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
    ]

    const assistantId = crypto.randomUUID()
    const now2 = Date.now()
    const assistantMsg: Message = {
      id: assistantId,
      conversationId: convId,
      role: 'assistant',
      content: '',
      createdAt: now2,
    }

    set((s) => ({
      isStreaming: true,
      messagesByConv: {
        ...s.messagesByConv,
        [convId!]: [...(s.messagesByConv[convId!] || []), assistantMsg],
      },
    }))

    const abortController = new AbortController()
    abortControllers.set(convId, abortController)

    try {
      let fullContent = ''
      let flushRaf: number | null = null
      const flush = () => {
        flushRaf = null
        set((s) => ({
          messagesByConv: {
            ...s.messagesByConv,
            [convId!]: (s.messagesByConv[convId!] || []).map((m) =>
              m.id === assistantId ? { ...m, content: fullContent } : m
            ),
          },
        }))
      }
      for await (const chunk of streamChat(apiMessages, abortController.signal)) {
        if (chunk.done) break
        fullContent += chunk.content
        if (flushRaf === null) {
          flushRaf = requestAnimationFrame(flush)
        }
      }
      if (flushRaf !== null) cancelAnimationFrame(flushRaf)
      flush()

      const final = get().messagesByConv[convId!]?.find((m) => m.id === assistantId)
      if (final) {
        saveMessage(final)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        const finalMsg = get().messagesByConv[convId!]?.find((m) => m.id === assistantId)
        if (finalMsg && finalMsg.content) {
          saveMessage(finalMsg)
        }
      } else {
        const errorText = err instanceof Error ? err.message : 'An error occurred'
        set((s) => ({
          messagesByConv: {
            ...s.messagesByConv,
            [convId!]: (s.messagesByConv[convId!] || []).map((m) =>
              m.id === assistantId ? { ...m, content: errorText } : m
            ),
          },
        }))
      }
    } finally {
      abortControllers.delete(convId)
      set({ isStreaming: false })
    }
  },

  stopGeneration: () => {
    const state = get()
    if (state.activeConversationId) {
      abortControllers.get(state.activeConversationId)?.abort()
    }
  },
}))

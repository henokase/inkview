import { create } from 'zustand'
import { flushSync } from 'react-dom'
import type { Conversation, Message, Part, TextPart, ReasoningPart, ToolPart } from '../types'
import {
  loadAllConversations,
  saveConversation,
  deleteConversation,
  deleteMessagesSince,
  loadMessagesForConversation,
  saveMessage,
} from '../lib/db'
import { StreamEngine } from '../lib/llm/stream-engine'
import type { ApiMessage, Usage } from '../lib/llm/types'
import { AgentEngine } from '../lib/agent/agent-engine'
import { registerDefaultTools } from '../lib/agent/tools'
import { DEFAULT_PERMISSIONS } from '../lib/agent/permission'
import type { PermissionRule } from '../lib/agent/types'
import { useAgentStore } from './agent-store'
import { usePendingChangesStore } from './pending-changes-store'
import { useDocumentStore } from './document-store'
import { buildSystemPrompt } from '../prompts'

const CHAT_PERMISSIONS: PermissionRule[] = [
  { permission: 'read', pattern: '*', action: 'allow' },
  { permission: 'search', pattern: '*', action: 'allow' },
  { permission: 'list', pattern: '*', action: 'allow' },
  { permission: 'web-search', pattern: '*', action: 'allow' },
  { permission: 'web-fetch', pattern: '*', action: 'allow' },
  { permission: 'edit', pattern: '*', action: 'deny' },
  { permission: 'create', pattern: '*', action: 'deny' },
  { permission: 'delete', pattern: '*', action: 'deny' },
]

registerDefaultTools()

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
  _agentEngine: AgentEngine
  _agentAbortController: AbortController | null
  _generation: number
  agentMode: boolean

  setSelectedText: (text: string) => void
  setContextText: (text: string) => void
  setChatOpen: (open: boolean) => void
  setChatPanelWidth: (width: number) => void
  setAgentMode: (mode: boolean) => void

  init: (documentId?: string) => Promise<void>
  createConversation: (documentId: string) => string
  deleteConversation: (convId: string) => void
  renameConversation: (id: string, title: string) => void
  setActiveConversation: (id: string | null) => void

  sendMessage: (content: string, documentId?: string) => Promise<void>
  clearActiveThinking: () => void
  editMessage: (convId: string, msgId: string, newContent: string) => Promise<void>
  _streamAgentResponse: (convId: string, permissions?: PermissionRule[]) => Promise<void>
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
  _agentEngine: new AgentEngine(),
  _agentAbortController: null,
  _generation: 0,
  agentMode: true,

  setSelectedText: (text) => set({ selectedText: text }),
  setContextText: (text) => set({ contextText: text }),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setChatPanelWidth: (width) => set({ chatPanelWidth: width }),
  clearActiveThinking: () => set({ activeThinking: '' }),
  setAgentMode: (mode) => set({ agentMode: mode }),

  init: async (_documentId?: string) => {
    const allConvs = await loadAllConversations()
    const byDoc: Record<string, Conversation[]> = {}
    const msgsByConv: Record<string, Message[]> = {}
    for (const conv of allConvs) {
      ;(byDoc[conv.documentId] ??= []).push(conv)
      msgsByConv[conv.id] = await loadMessagesForConversation(conv.id)
    }
    set({
      conversationsByDoc: byDoc,
      messagesByConv: msgsByConv,
      _hydrated: true,
    })
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

  sendMessage: async (content, documentId) => {
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

    if (get().agentMode) {
      await get()._streamAgentResponse(convId)
    } else {
      await get()._streamAgentResponse(convId, CHAT_PERMISSIONS)
    }
  },

  editMessage: async (convId, msgId, newContent) => {
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

    if (get().agentMode) {
      await get()._streamAgentResponse(convId)
    } else {
      await get()._streamAgentResponse(convId, CHAT_PERMISSIONS)
    }
  },

  _streamAgentResponse: async (convId, permissions) => {
    if (get().isStreaming) return

    const gen = ++get()._generation
    const isStillValid = () => get()._generation === gen

    const isChatMode = !!permissions
    const messages = get().messagesByConv[convId] || []

    const activeDoc = useDocumentStore.getState().getActiveDoc()
    const mode = isChatMode ? 'chat' : 'agent'
    const systemContent = buildSystemPrompt(mode, activeDoc ?? undefined)

    const systemMessage = { role: 'system' as const, content: systemContent }

    const apiMessages: ApiMessage[] = [systemMessage]
    for (const m of messages) {
      const entry: ApiMessage = {
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }
      if (m.parts) {
        const toolParts = m.parts.filter((p): p is ToolPart => p.type === 'tool')
        if (toolParts.length > 0) {
          const pendingTool = toolParts.find(t => t.status === 'pending' || t.status === 'running')
          entry.tool_calls = toolParts.map((tp) => ({
            id: tp.id,
            type: 'function' as const,
            function: { name: tp.name, arguments: JSON.stringify(tp.args) },
          }))
          entry.content = pendingTool ? null : entry.content
        }
      }
      apiMessages.push(entry)
      if (m.parts) {
        for (const tp of m.parts.filter(p => p.type === 'tool')) {
          const tool = tp as ToolPart
          if (tool.status === 'completed' || tool.status === 'error') {
            apiMessages.push({
              role: 'tool',
              tool_call_id: tool.id,
              content: tool.result || tool.error || '',
            })
          }
        }
      }
    }

    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantId,
      conversationId: convId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      parts: [],
    }

    set((s) => ({
      isStreaming: true,
      messagesByConv: {
        ...s.messagesByConv,
        [convId]: [...(s.messagesByConv[convId] || []), assistantMsg],
      },
    }))

    let parts: Part[] = []
    let accumulatedText = ''
    let accumulatedReasoning = ''
    let finalUsage: Usage | undefined

    const engine = get()._agentEngine
    const abortController = new AbortController()
    engine.setAbortController(abortController)
    set({ _agentAbortController: abortController })

    if (activeDoc?.id) {
      engine.markDocumentAsRead(activeDoc.id)
    }

    const alwaysAllowRules = useAgentStore.getState().persistentPermissions
    const agentPermissions: PermissionRule[] = [...DEFAULT_PERMISSIONS, ...alwaysAllowRules]

    function flushText() {
      if (!accumulatedText) return
      parts.push({ type: 'text', text: accumulatedText } satisfies TextPart)
      accumulatedText = ''
    }

    function flushReasoning() {
      if (!accumulatedReasoning) return
      parts.push({ type: 'reasoning', text: accumulatedReasoning } satisfies ReasoningPart)
      accumulatedReasoning = ''
    }

    let flushTimer: ReturnType<typeof setTimeout> | null = null
    let chunkCount = 0
    const DEBOUNCE_MS = 50
    const FLUSH_EVERY_N = 30

    function scheduleFlush() {
      if (flushTimer) return
      flushTimer = setTimeout(() => {
        flushTimer = null
        applyUpdate()
      }, DEBOUNCE_MS)
    }

    function cancelFlush() {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
    }

    function applyUpdate() {
      set((s) => ({
        activeThinking: accumulatedReasoning,
        messagesByConv: {
          ...s.messagesByConv,
          [convId]: (s.messagesByConv[convId] || []).map((m) =>
            m.id === assistantId ? { ...m, parts: [...parts], content: accumulatedText } : m
          ),
        },
      }))
    }

    function debouncedUpdate() {
      chunkCount++
      scheduleFlush()
      if (chunkCount % FLUSH_EVERY_N === 0) {
        cancelFlush()
        applyUpdate()
      }
    }

    try {
      await engine.agentLoop(apiMessages, {
        signal: abortController.signal,
        agentPermissions,
        onChunk: (chunk) => {
          if (!isStillValid()) return
          if (chunk.reasoning) {
            accumulatedReasoning += chunk.reasoning
            set({ activeThinking: accumulatedReasoning })
          }
          if (chunk.content) {
            if (accumulatedReasoning) {
              flushReasoning()
              cancelFlush()
              applyUpdate()
            }
            accumulatedText += chunk.content
            debouncedUpdate()
          }
        },
        onUsage: (usage) => {
          finalUsage = usage
        },
        onTurnStart: () => {
          if (!isStillValid()) return
          cancelFlush()
          flushReasoning()
          flushText()
          applyUpdate()
          set({ activeThinking: '' })
        },
        onToolCall: (call) => {
          if (!isStillValid()) return
          cancelFlush()
          flushReasoning()
          flushText()
          const existing = parts.findIndex((p) => p.type === 'tool' && p.id === call.id)
          if (existing !== -1) {
            const t = parts[existing] as ToolPart
            t.status = call.status === 'failed' ? 'error' : call.status
          } else {
            parts.push({
              id: call.id,
              type: 'tool',
              name: call.name,
              args: call.args,
              status: call.status === 'failed' ? 'error' : call.status,
              startTime: Date.now(),
            } satisfies ToolPart)
          }
          flushSync(() => {
            applyUpdate()
          })
        },
        onToolResult: (result) => {
          if (!isStillValid()) return
          cancelFlush()
          flushReasoning()
          flushText()
          const idx = parts.findIndex((p) => p.type === 'tool' && p.id === result.id)
          if (idx !== -1) {
            const t = parts[idx] as ToolPart
            t.status = result.status === 'failed' ? 'error' : 'completed'
            t.endTime = Date.now()
            if (result.status === 'failed') {
              t.error = result.error
            } else {
              t.result = result.result?.output
              t.metadata = result.result?.metadata
            }
          }
          applyUpdate()
        },
        onPermissionRequest: async (request) => {
          const agentState = useAgentStore.getState()
          const existingRule = agentState.persistentPermissions.find(
            (r) => r.permission === request.permission
          )
          if (existingRule) return existingRule.action === 'allow' ? 'allow' : 'deny'

          return new Promise<'allow' | 'deny'>((resolve) => {
            const timeout = setTimeout(() => resolve('deny'), 30000)
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(timeout)
              resolve('deny')
            })
            agentState.queuePermissionRequest({
              id: request.id,
              permission: request.permission,
              toolName: request.toolName,
              args: request.args,
              resolve: (action: 'allow' | 'always' | 'deny') => {
                clearTimeout(timeout)
                if (action === 'always') {
                  useAgentStore.getState().addPersistentPermission({
                    permission: request.permission,
                    pattern: '*',
                    action: 'allow',
                  })
                  resolve('allow')
                } else if (action === 'allow') {
                  resolve('allow')
                } else {
                  resolve('deny')
                }
              },
            })
          })
        },
        onPendingChange: (change) => {
          usePendingChangesStore.getState().addChange({
            id: crypto.randomUUID(),
            documentId: change.documentId,
            toolName: change.toolName,
            title: change.title,
            originalContent: change.originalContent,
            newContent: change.newContent,
            createdAt: Date.now(),
            oldString: change.oldString,
            newString: change.newString,
          })
        },
        onDone: () => {
          if (!isStillValid()) return
          cancelFlush()
          flushReasoning()
          flushText()
          applyUpdate()
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
          if (!isStillValid()) return
          cancelFlush()
          flushReasoning()
          flushText()
          const errorText = err instanceof Error ? err.message : 'An error occurred'
          parts.push({ type: 'text', text: `**Error**: ${errorText}` } satisfies TextPart)
          applyUpdate()
          const errorMsg: Message = {
            id: assistantId,
            conversationId: convId,
            role: 'assistant',
            content: accumulatedText,
            createdAt: Date.now(),
            parts,
          }
          saveMessage(errorMsg)
        },
      })
    } finally {
      if (flushTimer) clearTimeout(flushTimer)
      if (isStillValid()) {
        set({ isStreaming: false, activeThinking: '', _agentAbortController: null })
      }
    }
  },

  stopGeneration: () => {
    const state = get()
    if (state.activeConversationId) {
      state._generation++ // invalidates isStillValid() in all callbacks
      state._engine.stop(state.activeConversationId)
      state._agentEngine.stop()
      state._agentAbortController?.abort()
      set({ _agentAbortController: null })
    }
  },
}))

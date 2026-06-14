import { create } from 'zustand'
import { flushSync } from 'react-dom'
import type { Conversation, Message, ToolCallPart, ToolResultPart } from '../types'
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
import { toolPrompts } from '../lib/agent/prompts'

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

  sendMessage: (content: string, documentContent: string, documentId?: string) => Promise<void>
  clearActiveThinking: () => void
  editMessage: (convId: string, msgId: string, newContent: string, documentContent: string) => Promise<void>
  _streamResponse: (convId: string, documentContent: string) => Promise<void>
  _streamAgentResponse: (convId: string) => Promise<void>
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
  agentMode: false,

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

    if (get().agentMode) {
      await get()._streamAgentResponse(convId)
    } else {
      await get()._streamResponse(convId, documentContent)
    }
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

    if (get().agentMode) {
      await get()._streamAgentResponse(convId)
    } else {
      await get()._streamResponse(convId, documentContent)
    }
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

  _streamAgentResponse: async (convId) => {
    if (get().isStreaming) return

    const messages = get().messagesByConv[convId] || []

    const systemToolPrompts = Object.values(toolPrompts).join('\n\n')
    const systemMessage = {
      role: 'system' as const,
      content: `You are an AI assistant for the InkView document editor.
You have access to tools to read, search, create, and edit documents.

## Available Tools

- **readDoc**: Read the full content of a document by ID or title search
- **writeDoc**: Create a new document or overwrite an existing one with new content
- **editDoc**: Edit specific text in a document by finding and replacing (preferred for targeted changes)
- **searchDocs**: Search across all documents for matching content or titles
- **listDocs**: List all documents with their titles and IDs
- **createDoc**: Create a new document with a title and optional initial content
- **deleteDoc**: Permanently delete a document by its ID

## Tool Usage Guidelines

${systemToolPrompts}`,
    }

    const apiMessages: ApiMessage[] = [systemMessage]
    for (const m of messages) {
      const entry: ApiMessage = {
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }
      if (m.toolCalls?.length) {
        entry.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))
      }
      apiMessages.push(entry)
      if (m.toolResults?.length) {
        for (const tr of m.toolResults) {
          apiMessages.push({
            role: 'tool',
            tool_call_id: tr.id,
            content: tr.result,
          })
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
      toolCalls: [],
      toolResults: [],
      contentParts: [''],
    }

    set((s) => ({
      isStreaming: true,
      messagesByConv: {
        ...s.messagesByConv,
        [convId]: [...(s.messagesByConv[convId] || []), assistantMsg],
      },
    }))

    let fullContent = ''
    let contentParts: string[] = ['']
    let accumulatedThinking = ''
    let hasContentStarted = false
    let finalUsage: Usage | undefined

    const engine = get()._agentEngine
    const abortController = new AbortController()
    engine.setAbortController(abortController)
    set({ _agentAbortController: abortController })

    const alwaysAllowRules = useAgentStore.getState().persistentPermissions
    const agentPermissions: PermissionRule[] = [...DEFAULT_PERMISSIONS, ...alwaysAllowRules]

    try {
      await engine.agentLoop(apiMessages, {
        signal: abortController.signal,
        agentPermissions,
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
            contentParts[contentParts.length - 1] += chunk.content
            set((s) => ({
              messagesByConv: {
                ...s.messagesByConv,
                [convId]: (s.messagesByConv[convId] || []).map((m) =>
                  m.id === assistantId ? { ...m, content: fullContent, contentParts: [...contentParts] } : m
                ),
              },
            }))
          }
        },
        onUsage: (usage) => {
          finalUsage = usage
        },
        onToolCall: (call) => {
          contentParts.push('')
          flushSync(() => {
            set((s) => {
              const existing = s.messagesByConv[convId] || []
              const msgs = existing.map((m) => {
                if (m.id !== assistantId) return m
                const part: ToolCallPart = {
                  id: call.id,
                  type: 'tool_call',
                  name: call.name,
                  arguments: call.args,
                }
                return {
                  ...m,
                  toolCalls: [...(m.toolCalls || []), part],
                  contentParts: [...contentParts],
                }
              })
              return {
                messagesByConv: { ...s.messagesByConv, [convId]: msgs },
              }
            })
          })
        },
        onPermissionRequest: async (request) => {
          const agentState = useAgentStore.getState()
          const existingRule = agentState.persistentPermissions.find(
            (r) => r.permission === request.permission
          )
          if (existingRule) return existingRule.action === 'allow' ? 'allow' : 'deny'

          return new Promise<'allow' | 'deny'>((resolve) => {
            agentState.queuePermissionRequest({
              id: request.id,
              permission: request.permission,
              toolName: request.toolName,
              args: request.args,
              resolve: (action: 'allow' | 'always' | 'deny') => {
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
        onToolResult: (result) => {
          set((s) => {
            const existing = s.messagesByConv[convId] || []
            const msgs = existing.map((m) => {
              if (m.id !== assistantId) return m
              const part: ToolResultPart = {
                id: result.id,
                type: 'tool_result',
                name: result.name,
                result: result.result?.output || result.error || '',
                isError: result.status === 'failed',
                metadata: result.result?.metadata,
              }
              return {
                ...m,
                toolResults: [...(m.toolResults || []), part],
                contentParts: [...contentParts],
              }
            })
            return {
              messagesByConv: { ...s.messagesByConv, [convId]: msgs },
            }
          })
        },
        onDone: () => {
          set((s) => ({
            messagesByConv: {
              ...s.messagesByConv,
              [convId]: (s.messagesByConv[convId] || []).map((m) =>
                m.id === assistantId ? { ...m, contentParts: [...contentParts] } : m
              ),
            },
          }))
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
      set({ isStreaming: false, activeThinking: '', _agentAbortController: null })
    }
  },

  stopGeneration: () => {
    const state = get()
    if (state.activeConversationId) {
      state._engine.stop(state.activeConversationId)
      state._agentEngine.stop()
      state._agentAbortController?.abort()
      set({ _agentAbortController: null, isStreaming: false })
    }
  },
}))

import { create } from 'zustand'
import type { AgentInfo, PermissionRule, ToolCallState } from '../lib/agent/types'

export interface PermissionRequest {
  id: string
  permission: string
  toolName: string
  args: Record<string, unknown>
  resolve: (action: 'allow' | 'always' | 'deny') => void
}

interface AgentStore {
  agents: AgentInfo[]
  currentAgentId: string
  activeToolCalls: ToolCallState[]
  permissionQueue: PermissionRequest[]
  agentTurn: number
  agentMaxTurns: number
  persistentPermissions: PermissionRule[]

  setCurrentAgent: (id: string) => void
  registerAgents: (agents: AgentInfo[]) => void
  addToolCall: (call: ToolCallState) => void
  updateToolCall: (id: string, update: Partial<ToolCallState>) => void
  clearToolCalls: () => void
  setAgentTurn: (turn: number, maxTurns: number) => void
  queuePermissionRequest: (request: PermissionRequest) => void
  resolvePermission: (id: string, action: 'allow' | 'always' | 'deny') => void
  clearPermissionQueue: () => void
  addPersistentPermission: (rule: PermissionRule) => void
}

const DEFAULT_AGENTS: AgentInfo[] = [
  {
    name: 'agent',
    description: 'Default agent with full document access',
    permission: [
      { permission: 'read', pattern: '*', action: 'allow' },
      { permission: 'search', pattern: '*', action: 'allow' },
      { permission: 'list', pattern: '*', action: 'allow' },
      { permission: 'edit', pattern: '*', action: 'ask' },
      { permission: 'create', pattern: '*', action: 'ask' },
      { permission: 'delete', pattern: '*', action: 'deny' },
    ],
    prompt: 'You are an AI assistant for the InkView document editor.',
  },
]

export const useAgentStore = create<AgentStore>()((set) => ({
  agents: DEFAULT_AGENTS,
  currentAgentId: 'agent',
  activeToolCalls: [],
  permissionQueue: [],
  agentTurn: 0,
  agentMaxTurns: 10,
  persistentPermissions: [],

  setCurrentAgent: (id) => set({ currentAgentId: id }),

  registerAgents: (agents) =>
    set((s) => ({
      agents: [...s.agents, ...agents.filter((a) => !s.agents.find((x) => x.name === a.name))],
    })),

  addToolCall: (call) =>
    set((s) => ({
      activeToolCalls: [...s.activeToolCalls, call],
    })),

  updateToolCall: (id, update) =>
    set((s) => ({
      activeToolCalls: s.activeToolCalls.map((tc) =>
        tc.id === id ? { ...tc, ...update } : tc
      ),
    })),

  clearToolCalls: () => set({ activeToolCalls: [] }),

  setAgentTurn: (turn, maxTurns) => set({ agentTurn: turn, agentMaxTurns: maxTurns }),

  queuePermissionRequest: (request) =>
    set((s) => ({
      permissionQueue: [...s.permissionQueue, request],
    })),

  resolvePermission: (id, action) =>
    set((s) => {
      const request = s.permissionQueue.find((r) => r.id === id)
      if (request) request.resolve(action)
      return {
        permissionQueue: s.permissionQueue.filter((r) => r.id !== id),
      }
    }),

  clearPermissionQueue: () => {
    const queue = get().permissionQueue
    for (const r of queue) r.resolve('deny')
    set({ permissionQueue: [] })
  },

  addPersistentPermission: (rule) =>
    set((s) => ({
      persistentPermissions: [...s.persistentPermissions.filter(
        (r) => !(r.permission === rule.permission && r.pattern === rule.pattern)
      ), rule],
    })),
}))

function get(): AgentStore {
  return useAgentStore.getState()
}

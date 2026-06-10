import readDoc from './read-doc'
import { toolRegistry } from '../tool-registry'

const allTools = [
  readDoc,
]

export function registerDefaultTools(): void {
  for (const tool of allTools) {
    toolRegistry.register(tool)
  }
}

export { toolRegistry }
export { evaluatePermission, DEFAULT_PERMISSIONS } from '../permission'
export type {
  ToolDefinition,
  ToolContext,
  ToolResult,
  ToolCallState,
  PermissionRule,
  PermissionAction,
  AgentInfo,
  ToolParameter,
} from '../types'

import readDoc from './read-doc'
import writeDoc from './write-doc'
import editDoc from './edit-doc'
import searchDocs from './search-docs'
import listDocs from './list-docs'
import createDoc from './create-doc'
import deleteDoc from './delete-doc'
import { toolRegistry } from '../tool-registry'

const allTools = [
  readDoc,
  writeDoc,
  editDoc,
  searchDocs,
  listDocs,
  createDoc,
  deleteDoc,
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

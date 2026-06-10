import type { PermissionRule, ToolDefinition } from './types'
import { evaluatePermission, DEFAULT_PERMISSIONS } from './permission'

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool)
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id)
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  getAllowedTools(ruleset?: PermissionRule[]): ToolDefinition[] {
    const all = this.getAll()
    return all.filter((t) => {
      const action = evaluatePermission(t.permission, '*', ruleset ?? DEFAULT_PERMISSIONS)
      return action !== 'deny'
    })
  }

  toApiTools(tools: ToolDefinition[]): Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, unknown>
    }
  }> {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.id,
        description: t.description,
        parameters: t.jsonSchema as Record<string, unknown>,
      },
    }))
  }
}

export const toolRegistry = new ToolRegistry()

import type { ToolDefinition, ToolContext, ToolResult } from '../types'
import { useDocumentStore } from '../../../stores/document-store'

const jsonSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'The title for the new document.',
    },
    content: {
      type: 'string',
      description: 'The initial markdown content for the new document.',
    },
  },
  required: ['title', 'content'],
}

const createDoc: ToolDefinition = {
  id: 'createDoc',
  description:
    'Create a new document with the given title and markdown content. ' +
    'Returns the new document ID. To update an existing document use writeDoc.',
  parameters: {
    title: {
      type: 'string',
      description: 'Document title',
      required: true,
    },
    content: {
      type: 'string',
      description: 'Markdown content',
      required: true,
    },
  },
  permission: 'create',
  jsonSchema,

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = ctx.evaluatePermission('create', '*')
    if (action === 'deny') {
      return { title: 'Permission denied', output: 'Creating documents is not permitted.' }
    }

    const store = useDocumentStore.getState()
    const previousDocId = store.activeDocId
    const title = (args.title as string) || 'Untitled'
    const content = (args.content as string) || ''

    const lines = content.split('\n').length
    const chars = content.length
    const changeSummary = `${lines} lines (${chars} chars)`

    const id = store.createDocument(content, title)
    // Restore previous active doc so the agent doesn't steal navigation
    if (previousDocId && previousDocId !== id) {
      store.setActiveDoc(previousDocId)
    }

    return {
      title,
      output: `Created "${title}" — ${changeSummary}.`,
      metadata: { id, title },
    }
  },
}

export default createDoc

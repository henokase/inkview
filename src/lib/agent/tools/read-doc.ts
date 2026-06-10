import type { ToolDefinition, ToolContext, ToolResult } from '../types'
import { useDocumentStore } from '../../../stores/document-store'

const jsonSchema = {
  type: 'object',
  properties: {
    documentId: {
      type: 'string',
      description: 'The document ID to read. If omitted, reads the active document.',
    },
    search: {
      type: 'string',
      description: 'Search by title fragment to find a document (case-insensitive).',
    },
  },
}

const readDoc: ToolDefinition = {
  id: 'readDoc',
  description:
    'Read the full content of a document by ID or by searching its title. ' +
    'If called with no arguments, returns the currently active document. ' +
    'Returns the document title, content, and metadata.',
  parameters: {
    documentId: {
      type: 'string',
      description: 'The document ID to read',
      required: false,
    },
    search: {
      type: 'string',
      description: 'Search by title fragment to find a document',
      required: false,
    },
  },
  permission: 'read',
  jsonSchema,

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = ctx.evaluatePermission('read', (args.documentId as string) || '*')
    if (action === 'deny') {
      return { title: 'Permission denied', output: 'Reading documents is not permitted.' }
    }

    const { documents, activeDocId } = useDocumentStore.getState()

    let doc = undefined

    if (args.documentId) {
      doc = documents.find((d) => d.id === args.documentId)
    } else if (args.search) {
      const query = (args.search as string).toLowerCase()
      doc = documents.find((d) => d.title.toLowerCase().includes(query))
    } else if (activeDocId) {
      doc = documents.find((d) => d.id === activeDocId)
    }

    if (!doc) {
      return {
        title: 'Not found',
        output: args.documentId
          ? `Document with ID "${args.documentId}" not found.`
          : args.search
            ? `No document found with title matching "${args.search}".`
            : 'No active document.',
      }
    }

    const lines = doc.content.split('\n')
    const maxLines = 2000
    let output = `# ${doc.title}\n\n${doc.content}`
    if (lines.length > maxLines) {
      output = `# ${doc.title}\n\n${lines.slice(0, maxLines).join('\n')}\n\n*... (${lines.length - maxLines} more lines)*`
    }

    return {
      title: doc.title,
      output,
      metadata: {
        id: doc.id,
        title: doc.title,
        updatedAt: doc.updatedAt,
        createdAt: doc.createdAt,
        lineCount: lines.length,
      },
    }
  },
}

export default readDoc

import type { ToolDefinition, ToolContext, ToolResult } from '../types'
import { useDocumentStore } from '../../../stores/document-store'

const jsonSchema = {
  type: 'object',
  properties: {
    documentId: {
      type: 'string',
      description: 'The document ID to permanently delete.',
    },
  },
  required: ['documentId'],
}

const deleteDoc: ToolDefinition = {
  id: 'deleteDoc',
  description:
    'Permanently delete a document by its ID. This action cannot be undone. ' +
    'The user must explicitly approve this operation.',
  parameters: {
    documentId: {
      type: 'string',
      description: 'Document ID to delete',
      required: true,
    },
  },
  permission: 'delete',
  jsonSchema,

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = ctx.evaluatePermission('delete', (args.documentId as string) || '*')
    if (action === 'deny') {
      return { title: 'Permission denied', output: 'Deleting documents is not permitted by default.' }
    }

    const store = useDocumentStore.getState()
    const documentId = args.documentId as string

    const doc = store.documents.find((d) => d.id === documentId)
    if (!doc) {
      return {
        title: 'Not found',
        output: `Document with ID "${documentId}" not found.`,
      }
    }

    const title = doc.title
    store.removeDocuments([documentId])

    return {
      title: 'Deleted',
      output: `Document "${title}" has been permanently deleted.`,
      metadata: { id: documentId, title },
    }
  },
}

export default deleteDoc

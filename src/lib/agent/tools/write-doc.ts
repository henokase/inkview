import type { ToolDefinition, ToolContext, ToolResult } from '../types'
import { useDocumentStore } from '../../../stores/document-store'

const jsonSchema = {
  type: 'object',
  properties: {
    documentId: {
      type: 'string',
      description: 'The document ID to overwrite. Omit to create a new document.',
    },
    title: {
      type: 'string',
      description: 'The document title.',
    },
    content: {
      type: 'string',
      description: 'The full markdown content for the document.',
    },
  },
  required: ['title', 'content'],
}

const writeDoc: ToolDefinition = {
  id: 'writeDoc',
  description:
    'Create a new document or overwrite an existing one with new content. ' +
    'Provide a documentId to update an existing document, or omit it to create a new one. ' +
    'Requires title and content. Returns the document ID and title.',
  parameters: {
    documentId: {
      type: 'string',
      description: 'Existing document ID to overwrite (omit to create new)',
      required: false,
    },
    title: {
      type: 'string',
      description: 'Document title',
      required: true,
    },
    content: {
      type: 'string',
      description: 'Full markdown content',
      required: true,
    },
  },
  permission: 'edit',
  jsonSchema,

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = ctx.evaluatePermission('edit', (args.documentId as string) || '*')
    if (action === 'deny') {
      return { title: 'Permission denied', output: 'Editing documents is not permitted.' }
    }

    const store = useDocumentStore.getState()
    const title = args.title as string
    const content = args.content as string
    let docId = args.documentId as string | undefined

    if (ctx.onPendingChange) {
      const existing = docId ? store.documents.find((d) => d.id === docId) : undefined
      const pendingId = docId || crypto.randomUUID()
      ctx.onPendingChange({
        documentId: pendingId,
        toolName: 'writeDoc',
        title,
        originalContent: existing?.content || '',
        newContent: content,
      })
      return {
        title,
        output: existing
          ? `Write pending approval for "${title}".`
          : `Create pending approval for "${title}".`,
        metadata: { id: pendingId, title, pending: true },
      }
    }

    if (docId) {
      const existing = store.documents.find((d) => d.id === docId)
      if (!existing) {
        return {
          title: 'Not found',
          output: `Document with ID "${docId}" not found. Use createDoc to create a new document.`,
        }
      }
      store.updateContent(docId, content)
      store.updateTitle(docId, title)
    } else {
      docId = store.createDocument(content, title)
    }

    return {
      title,
      output: `Document "${title}" saved.`,
      metadata: { id: docId, title },
    }
  },
}

export default writeDoc

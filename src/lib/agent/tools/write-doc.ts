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
    const store = useDocumentStore.getState()
    let docId = args.documentId as string | undefined

    const perm = docId ? 'edit' : 'create'
    const action = ctx.evaluatePermission(perm, docId || '*')
    if (action === 'deny') {
      const msg = perm === 'edit' ? 'Editing' : 'Creating'
      return { title: 'Permission denied', output: `${msg} documents is not permitted.` }
    }

    const title = args.title as string
    const content = args.content as string
    const previousDocId = store.activeDocId

    const existing = docId ? store.documents.find((d) => d.id === docId) : undefined
    const oldChars = existing?.content.length ?? 0
    const newChars = content.length
    const charDiff = newChars - oldChars
    const diffSign = charDiff > 0 ? '+' : ''
    const oldLines = existing ? existing.content.split('\n').length : 0
    const newLines = content.split('\n').length
    const changeSummary = existing
      ? `${oldLines}→${newLines} lines (${oldChars}→${newChars} chars, ${diffSign}${charDiff})`
      : `${newLines} lines (${newChars} chars)`

    if (ctx.onPendingChange && docId) {
      ctx.onPendingChange({
        documentId: docId,
        toolName: 'writeDoc',
        title,
        originalContent: existing?.content || '',
        newContent: content,
      })
      return {
        title,
        output: `"${title}" update (${changeSummary}) — pending approval.`,
        metadata: { id: docId, title, pending: true },
      }
    }

    if (docId) {
      if (!existing) {
        return {
          title: 'Not found',
          output: `Document with ID "${docId}" not found. Omit documentId to create a new document.`,
        }
      }
      store.updateContent(docId, content)
      store.updateTitle(docId, title)
    } else {
      docId = store.createDocument(content, title)
      if (previousDocId && previousDocId !== docId) {
        store.setActiveDoc(previousDocId)
      }
    }

    return {
      title,
      output: existing
        ? `Updated "${title}" — ${changeSummary}.`
        : `Created "${title}" — ${changeSummary}.`,
      metadata: { id: docId, title },
    }
  },
}

export default writeDoc

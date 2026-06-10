import type { ToolDefinition, ToolContext, ToolResult } from '../types'
import { useDocumentStore } from '../../../stores/document-store'

const jsonSchema = {
  type: 'object',
  properties: {},
}

const listDocs: ToolDefinition = {
  id: 'listDocs',
  description:
    'List all documents with their titles, IDs, folders, and last-updated timestamps. ' +
    'Returns a formatted overview of the entire document library.',
  parameters: {},
  permission: 'list',
  jsonSchema,

  async execute(_args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const { documents, folders } = useDocumentStore.getState()

    if (documents.length === 0) {
      return {
        title: 'Document library',
        output: 'No documents found. Create one with createDoc.',
        metadata: { totalDocuments: 0 },
      }
    }

    const folderMap = new Map<string, string[]>()
    for (const folder of folders) {
      folderMap.set(
        folder.id,
        (folderMap.get(folder.id) || []).concat(folder.documentIds),
      )
    }

    const docFolderMap = new Map<string, string>()
    for (const folder of folders) {
      for (const docId of folder.documentIds) {
        docFolderMap.set(docId, folder.name)
      }
    }

    const sorted = [...documents].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    )

    const lines: string[] = [`Total: ${documents.length} document(s)\n`]
    for (const doc of sorted) {
      const date = new Date(doc.updatedAt).toLocaleDateString()
      const folderName = docFolderMap.get(doc.id)
      const folderTag = folderName ? ` [${folderName}]` : ''
      const chars = doc.content.length
      lines.push(
        `- **${doc.title}**${folderTag} (ID: \`${doc.id}\`, updated: ${date}, ${chars} chars)`,
      )
    }

    return {
      title: 'Document library',
      output: lines.join('\n'),
      metadata: {
        totalDocuments: documents.length,
        totalFolders: folders.length,
      },
    }
  },
}

export default listDocs

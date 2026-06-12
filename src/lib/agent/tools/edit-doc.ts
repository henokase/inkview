import type { ToolDefinition, ToolContext, ToolResult } from '../types'
import { useDocumentStore } from '../../../stores/document-store'

const jsonSchema = {
  type: 'object',
  properties: {
    documentId: {
      type: 'string',
      description: 'The document ID to edit.',
    },
    oldString: {
      type: 'string',
      description: 'The exact text to find and replace.',
    },
    newString: {
      type: 'string',
      description: 'The replacement text.',
    },
    replaceAll: {
      type: 'boolean',
      description: 'Replace all occurrences instead of just the first one.',
    },
  },
  required: ['documentId', 'oldString', 'newString'],
}

function findExactMatch(
  content: string,
  oldString: string,
): { startIndex: number; endIndex: number } | null {
  const idx = content.indexOf(oldString)
  if (idx === -1) return null
  return { startIndex: idx, endIndex: idx + oldString.length }
}

function matchesWithNormalizedWhitespace(
  content: string,
  pos: number,
  pattern: string,
): boolean {
  let ci = pos
  let pi = 0
  while (ci < content.length && pi < pattern.length) {
    const cc = content[ci]
    const pc = pattern[pi]
    if (/\s/.test(cc) && /\s/.test(pc)) {
      ci++; pi++
      while (ci < content.length && /\s/.test(content[ci])) ci++
      while (pi < pattern.length && /\s/.test(pattern[pi])) pi++
    } else if (cc === pc) {
      ci++; pi++
    } else {
      return false
    }
  }
  return pi === pattern.length
}

function findNormalizedMatch(
  content: string,
  oldString: string,
): { startIndex: number; endIndex: number } | null {
  if (oldString.length === 0) return null
  for (let i = 0; i <= content.length; i++) {
    if (matchesWithNormalizedWhitespace(content, i, oldString)) {
      let end = i
      let pi = 0
      while (end < content.length && pi < oldString.length) {
        if (/\s/.test(content[end]) && /\s/.test(oldString[pi])) {
          end++; pi++
          while (end < content.length && /\s/.test(content[end])) end++
          while (pi < oldString.length && /\s/.test(oldString[pi])) pi++
        } else {
          end++; pi++
        }
      }
      return { startIndex: i, endIndex: end }
    }
  }
  return null
}

function findTrimmedLineMatch(
  content: string,
  oldString: string,
): { startIndex: number; endIndex: number } | null {
  const oldLines = oldString.split('\n').map((l) => l.trim())
  if (oldLines.length === 0) return null
  const contentLines = content.split('\n')

  for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
    let match = true
    for (let j = 0; j < oldLines.length; j++) {
      if (contentLines[i + j].trim() !== oldLines[j]) {
        match = false
        break
      }
    }
    if (match) {
      const startIndex = contentLines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0)
      const endIndex =
        contentLines.slice(0, i + oldLines.length).join('\n').length +
        (i + oldLines.length > 0 ? 1 : 0)
      return { startIndex, endIndex }
    }
  }
  return null
}

interface MatchResult {
  startIndex: number
  endIndex: number
}

function findAllMatches(content: string, oldString: string): MatchResult[] {
  const matches: MatchResult[] = []
  let searchFrom = 0
  while (searchFrom < content.length) {
    const idx = content.indexOf(oldString, searchFrom)
    if (idx === -1) break
    matches.push({ startIndex: idx, endIndex: idx + oldString.length })
    searchFrom = idx + 1
  }
  return matches
}

const editDoc: ToolDefinition = {
  id: 'editDoc',
  description:
    'Edit specific text in a document by finding and replacing. ' +
    'Tries exact match first, then whitespace-normalized matching, then trimmed-line matching. ' +
    'If replaceAll is true, replaces all occurrences. ' +
    'If multiple matches are found without replaceAll, returns an error asking for more context.',
  parameters: {
    documentId: {
      type: 'string',
      description: 'Document ID to edit',
      required: true,
    },
    oldString: {
      type: 'string',
      description: 'Text to find and replace',
      required: true,
    },
    newString: {
      type: 'string',
      description: 'Replacement text',
      required: true,
    },
    replaceAll: {
      type: 'boolean',
      description: 'Replace all occurrences',
      required: false,
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
    const documentId = args.documentId as string
    const oldString = args.oldString as string
    const newString = args.newString as string
    const replaceAll = args.replaceAll as boolean | undefined

    if (!oldString) {
      return { title: 'Error', output: 'oldString cannot be empty.' }
    }

    const doc = store.documents.find((d) => d.id === documentId)
    if (!doc) {
      return {
        title: 'Not found',
        output: `Document with ID "${documentId}" not found.`,
      }
    }

    const { content } = doc

    let match: MatchResult | null = null
    let matchStrategy = ''

    const exactMatches = findAllMatches(content, oldString)
    if (exactMatches.length > 0) {
      if (exactMatches.length > 1 && !replaceAll) {
        return {
          title: 'Multiple matches',
          output:
            `Found ${exactMatches.length} exact matches for the given text. ` +
            'Provide more surrounding context in oldString to narrow the match, or set replaceAll to true.',
        }
      }
      match = exactMatches[0]
      matchStrategy = 'exact'
    }

    if (!match) {
      const normalized = findNormalizedMatch(content, oldString)
      if (normalized) {
        match = normalized
        matchStrategy = 'whitespace-normalized'
      }
    }

    if (!match) {
      const trimmed = findTrimmedLineMatch(content, oldString)
      if (trimmed) {
        match = trimmed
        matchStrategy = 'trimmed-line'
      }
    }

    if (!match) {
      return {
        title: 'Not found',
        output:
          'Could not find the specified text in the document. ' +
          'Try providing more context around the text you want to replace.',
      }
    }

    let newContent: string
    if (replaceAll && matchStrategy === 'exact') {
      newContent = content.split(oldString).join(newString)
    } else {
      newContent =
        content.slice(0, match.startIndex) + newString + content.slice(match.endIndex)
    }

    const actualOldString = content.slice(match.startIndex, match.endIndex)

    if (ctx.onPendingChange) {
      ctx.onPendingChange({
        documentId: doc.id,
        toolName: 'editDoc',
        title: doc.title,
        originalContent: doc.content,
        newContent,
        oldString: actualOldString,
        newString,
      })
      return {
        title: doc.title,
        output: `Edit pending approval for "${doc.title}".`,
        metadata: { id: doc.id, title: doc.title, pending: true, matchStrategy },
      }
    }

    store.updateContent(documentId, newContent)

    return {
      title: doc.title,
      output: `Edited document "${doc.title}" using ${matchStrategy} matching.`,
      metadata: {
        id: doc.id,
        title: doc.title,
        matchStrategy,
        oldLength: oldString.length,
        newLength: newString.length,
      },
    }
  },
}

export default editDoc

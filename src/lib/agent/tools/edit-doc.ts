import type { ToolDefinition, ToolContext, ToolResult } from '../types'
import { useDocumentStore } from '../../../stores/document-store'

// ── Types ──

interface ReplaceResult {
  newContent: string
  actualOldString: string
  matchStrategy: string
}

// ── Line ending helpers ──

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

function detectLineEnding(text: string): '\n' | '\r\n' {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

function convertToLineEnding(text: string, ending: '\n' | '\r\n'): string {
  if (ending === '\n') return text
  return text.replace(/\n/g, '\r\n')
}

// ── Levenshtein distance ──

function levenshtein(a: string, b: string): number {
  if (a === '' || b === '') return Math.max(a.length, b.length)
  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[a.length][b.length]
}

// ── Replacer type ──

type Replacer = (content: string, find: string) => Generator<string, void, unknown>

// ── 9 replacer strategies ──

export const SimpleReplacer: Replacer = function* (_content, find) {
  yield find
}

export const LineTrimmedReplacer: Replacer = function* (content, find) {
  const originalLines = content.split('\n')
  const searchLines = find.split('\n')
  if (searchLines[searchLines.length - 1] === '') searchLines.pop()

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false
        break
      }
    }
    if (matches) {
      let matchStartIndex = 0
      for (let k = 0; k < i; k++) matchStartIndex += originalLines[k].length + 1
      let matchEndIndex = matchStartIndex
      for (let k = 0; k < searchLines.length; k++) {
        matchEndIndex += originalLines[i + k].length
        if (k < searchLines.length - 1) matchEndIndex += 1
      }
      yield content.substring(matchStartIndex, matchEndIndex)
    }
  }
}

export const BlockAnchorReplacer: Replacer = function* (content, find) {
  const originalLines = content.split('\n')
  const searchLines = find.split('\n')
  if (searchLines.length < 3) return
  if (searchLines[searchLines.length - 1] === '') searchLines.pop()

  const firstLineSearch = searchLines[0].trim()
  const lastLineSearch = searchLines[searchLines.length - 1].trim()
  const searchBlockSize = searchLines.length
  const maxLineDelta = Math.max(1, Math.floor(searchBlockSize * 0.25))

  const candidates: Array<{ startLine: number; endLine: number }> = []
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== firstLineSearch) continue
    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === lastLineSearch) {
        const actualBlockSize = j - i + 1
        if (Math.abs(actualBlockSize - searchBlockSize) <= maxLineDelta) {
          candidates.push({ startLine: i, endLine: j })
        }
        break
      }
    }
  }

  if (candidates.length === 0) return

  const singleThreshold = 0.65
  const multiThreshold = 0.65

  if (candidates.length === 1) {
    const { startLine, endLine } = candidates[0]
    const actualBlockSize = endLine - startLine + 1
    let similarity = 0
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)
    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const ol = originalLines[startLine + j].trim()
        const sl = searchLines[j].trim()
        const maxLen = Math.max(ol.length, sl.length)
        if (maxLen === 0) continue
        const distance = levenshtein(ol, sl)
        similarity += (1 - distance / maxLen) / linesToCheck
        if (similarity >= singleThreshold) break
      }
    } else {
      similarity = 1.0
    }
    if (similarity >= singleThreshold) {
      let ms = 0
      for (let k = 0; k < startLine; k++) ms += originalLines[k].length + 1
      let me = ms
      for (let k = startLine; k <= endLine; k++) {
        me += originalLines[k].length
        if (k < endLine) me += 1
      }
      yield content.substring(ms, me)
    }
    return
  }

  let bestMatch: { startLine: number; endLine: number } | null = null
  let maxSimilarity = -1
  for (const candidate of candidates) {
    const { startLine, endLine } = candidate
    const actualBlockSize = endLine - startLine + 1
    let similarity = 0
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)
    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const ol = originalLines[startLine + j].trim()
        const sl = searchLines[j].trim()
        const maxLen = Math.max(ol.length, sl.length)
        if (maxLen === 0) continue
        similarity += 1 - levenshtein(ol, sl) / maxLen
      }
      similarity /= linesToCheck
    } else {
      similarity = 1.0
    }
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity
      bestMatch = candidate
    }
  }
  if (maxSimilarity >= multiThreshold && bestMatch) {
    const { startLine, endLine } = bestMatch
    let ms = 0
    for (let k = 0; k < startLine; k++) ms += originalLines[k].length + 1
    let me = ms
    for (let k = startLine; k <= endLine; k++) {
      me += originalLines[k].length
      if (k < endLine) me += 1
    }
    yield content.substring(ms, me)
  }
}

export const WhitespaceNormalizedReplacer: Replacer = function* (content, find) {
  const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim()
  const normalizedFind = normalizeWhitespace(find)

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (normalizeWhitespace(line) === normalizedFind) {
      yield line
    } else {
      const normalizedLine = normalizeWhitespace(line)
      if (normalizedLine.includes(normalizedFind)) {
        const words = find.trim().split(/\s+/)
        if (words.length > 0) {
          const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
          try {
            const regex = new RegExp(pattern)
            const match = line.match(regex)
            if (match) yield match[0]
          } catch {
            // Invalid regex pattern, skip
          }
        }
      }
    }
  }

  const findLines = find.split('\n')
  if (findLines.length > 1) {
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length)
      if (normalizeWhitespace(block.join('\n')) === normalizedFind) {
        yield block.join('\n')
      }
    }
  }
}

export const IndentationFlexibleReplacer: Replacer = function* (content, find) {
  const removeIndentation = (text: string) => {
    const lines = text.split('\n')
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0)
    if (nonEmptyLines.length === 0) return text
    const minIndent = Math.min(
      ...nonEmptyLines.map((l) => {
        const m = l.match(/^(\s*)/)
        return m ? m[1].length : 0
      }),
    )
    return lines.map((l) => (l.trim().length === 0 ? l : l.slice(minIndent))).join('\n')
  }

  const normalizedFind = removeIndentation(find)
  const contentLines = content.split('\n')
  const findLines = find.split('\n')

  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const block = contentLines.slice(i, i + findLines.length).join('\n')
    if (removeIndentation(block) === normalizedFind) {
      yield block
    }
  }
}

export const EscapeNormalizedReplacer: Replacer = function* (content, find) {
  const unescapeString = (str: string): string => {
    return str.replace(/\\([nrt'"`\\$])/g, (_, c) => {
      switch (c) {
        case 'n': return '\n'
        case 't': return '\t'
        case 'r': return '\r'
        case "'": return "'"
        case '"': return '"'
        case '`': return '`'
        case '\\': return '\\'
        case '$': return '$'
        default: return _
      }
    })
  }

  const unescapedFind = unescapeString(find)
  if (content.includes(unescapedFind)) yield unescapedFind

  const lines = content.split('\n')
  const findLines = unescapedFind.split('\n')
  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join('\n')
    if (unescapeString(block) === unescapedFind) yield block
  }
}

export const TrimmedBoundaryReplacer: Replacer = function* (content, find) {
  const trimmedFind = find.trim()
  if (trimmedFind === find) return
  if (content.includes(trimmedFind)) yield trimmedFind

  const lines = content.split('\n')
  const findLines = find.split('\n')
  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join('\n')
    if (block.trim() === trimmedFind) yield block
  }
}

export const ContextAwareReplacer: Replacer = function* (content, find) {
  const findLines = find.split('\n')
  if (findLines.length < 3) return
  if (findLines[findLines.length - 1] === '') findLines.pop()

  const contentLines = content.split('\n')
  const firstLine = findLines[0].trim()
  const lastLine = findLines[findLines.length - 1].trim()

  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].trim() !== firstLine) continue
    for (let j = i + 2; j < contentLines.length; j++) {
      if (contentLines[j].trim() === lastLine) {
        const blockLines = contentLines.slice(i, j + 1)
        if (blockLines.length === findLines.length) {
          let matchingLines = 0
          let totalNonEmptyLines = 0
          for (let k = 1; k < blockLines.length - 1; k++) {
            const bl = blockLines[k].trim()
            const fl = findLines[k].trim()
            if (bl.length > 0 || fl.length > 0) {
              totalNonEmptyLines++
              if (bl === fl) matchingLines++
            }
          }
          if (totalNonEmptyLines === 0 || matchingLines / totalNonEmptyLines >= 0.5) {
            yield blockLines.join('\n')
            break
          }
        }
        break
      }
    }
  }
}

export const MultiOccurrenceReplacer: Replacer = function* (content, find) {
  let startIndex = 0
  while (true) {
    const index = content.indexOf(find, startIndex)
    if (index === -1) break
    yield find
    startIndex = index + 1
  }
}

// ── isDisproportionateMatch ──

function isDisproportionateMatch(search: string, oldString: string): boolean {
  const oldLines = oldString.split('\n').length
  const searchLines = search.split('\n').length
  if (searchLines >= Math.max(oldLines + 3, oldLines * 2)) return true
  if (oldLines === 1) return false
  return search.trim().length > Math.max(oldString.trim().length + 500, oldString.trim().length * 4)
}

// ── replace ──

function replace(content: string, oldString: string, newString: string, replaceAll = false): ReplaceResult {
  if (!oldString) throw new Error('oldString cannot be empty.')
  if (oldString === newString) throw new Error('oldString and newString are identical. No changes to apply.')

  const ending = detectLineEnding(content)
  const old = convertToLineEnding(normalizeLineEndings(oldString), ending)
  const replacement = convertToLineEnding(normalizeLineEndings(newString), ending)

  let notFound = true

  const strategies: Array<{ name: string; fn: Replacer }> = [
    { name: 'simple', fn: SimpleReplacer },
    { name: 'line-trimmed', fn: LineTrimmedReplacer },
    { name: 'block-anchor', fn: BlockAnchorReplacer },
    { name: 'whitespace-normalized', fn: WhitespaceNormalizedReplacer },
    { name: 'indentation-flexible', fn: IndentationFlexibleReplacer },
    { name: 'escape-normalized', fn: EscapeNormalizedReplacer },
    { name: 'trimmed-boundary', fn: TrimmedBoundaryReplacer },
    { name: 'context-aware', fn: ContextAwareReplacer },
    { name: 'multi-occurrence', fn: MultiOccurrenceReplacer },
  ]

  for (const { name, fn } of strategies) {
    for (const search of fn(content, old)) {
      const index = content.indexOf(search)
      if (index === -1) continue
      notFound = false
      if (isDisproportionateMatch(search, old)) {
        throw new Error(
          'Refusing replacement because the matched span is much larger than oldString. ' +
          'Re-read the document and provide the full exact oldString for the intended replacement.',
        )
      }
      if (replaceAll) {
        return {
          newContent: content.replaceAll(search, replacement),
          actualOldString: search,
          matchStrategy: name,
        }
      }
      const lastIndex = content.lastIndexOf(search)
      if (index !== lastIndex) continue
      const actualOldString = content.substring(index, index + search.length)
      return {
        newContent: content.substring(0, index) + replacement + content.substring(index + search.length),
        actualOldString,
        matchStrategy: name,
      }
    }
  }

  if (notFound) {
    throw new Error(
      'Could not find oldString in the document. It must match the document text including whitespace, indentation, and line endings. ' +
      'Read the document content first and copy the exact text you want to replace.',
    )
  }
  throw new Error(
    'Found multiple matches for oldString. Provide more surrounding context in oldString to make the match unique, or set replaceAll to true.',
  )
}

// ── Tool definition ──

const jsonSchema = {
  type: 'object',
  properties: {
    documentId: {
      type: 'string',
      description: 'The document ID to edit.',
    },
    oldString: {
      type: 'string',
      description: 'The text to find and replace.',
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

const editDoc: ToolDefinition = {
  id: 'editDoc',
  description:
    'Edit specific text in a document by finding and replacing. ' +
    'Tries 9 matching strategies in order: exact, line-trimmed, block-anchor (Levenshtein), whitespace-normalized, ' +
    'indentation-flexible, escape-normalized, trimmed-boundary, context-aware, and multi-occurrence. ' +
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

    try {
      const { newContent, actualOldString, matchStrategy } = replace(
        doc.content,
        oldString,
        newString,
        replaceAll,
      )

      const oldLines = oldString.split('\n').length
      const newLines = newString.split('\n').length
      const charDiff = newString.length - oldString.length
      const diffSign = charDiff > 0 ? '+' : ''
      const summary = `${oldLines}→${newLines} line(s) (${diffSign}${charDiff} chars) in "${doc.title}"`

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
          output: `Replacing ${summary} — pending approval. (match: ${matchStrategy})`,
          metadata: { id: doc.id, title: doc.title, pending: true, matchStrategy },
        }
      }

      store.updateContent(documentId, newContent)

      return {
        title: doc.title,
        output: `Replaced ${summary}. (match: ${matchStrategy})`,
        metadata: {
          id: doc.id,
          title: doc.title,
          matchStrategy,
          oldLength: oldString.length,
          newLength: newString.length,
        },
      }
    } catch (err) {
      return {
        title: 'Error',
        output: err instanceof Error ? err.message : 'An error occurred while editing the document.',
      }
    }
  },
}

export default editDoc

import { memo, useMemo, useCallback } from 'react'
import type { PendingChange } from '../stores/pending-changes-store'
import { computeDiff, usePendingChangesStore } from '../stores/pending-changes-store'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView, Decoration, WidgetType } from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'
import { StateField } from '@codemirror/state'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

interface DiffEditorProps {
  documentId: string
  pendingChanges: PendingChange[]
}

const insertLine = Decoration.line({ class: 'diff-ins' })

class DeleteWidget extends WidgetType {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }
  eq(other: DeleteWidget) { return this.text === other.text }

  toDOM() {
    const wrap = document.createElement('div')
    wrap.className = 'diff-del'
    wrap.textContent = this.text.split('\n').map((l) => '− ' + l).join('\n')
    return wrap
  }

  ignoreEvent() { return true }
}

function diffDecoField(original: string) {
  function compute(cleanDoc: string): DecorationSet {
    const diff = computeDiff(original, cleanDoc)
    const decos: any[] = []
    const cleanLines = cleanDoc.split('\n')
    let cleanIdx = 0

    for (const part of diff) {
      const partLines = part.value.split('\n')

      if (part.type === 'equal') {
        cleanIdx += partLines.length
      } else if (part.type === 'delete') {
        const targetLine = cleanIdx < cleanLines.length ? cleanIdx : cleanIdx
        let pos: number
        if (targetLine < cleanLines.length) {
          pos = cleanLines.slice(0, targetLine).join('\n').length
          if (targetLine > 0) pos += 1
        } else {
          pos = cleanDoc.length
        }
        const widget = new DeleteWidget(part.value)
        decos.push(Decoration.widget({ widget, side: -1, block: true }).range(pos))
      } else if (part.type === 'insert') {
        for (let i = 0; i < partLines.length; i++) {
          if (cleanIdx < cleanLines.length) {
            const pos = cleanLines.slice(0, cleanIdx).join('\n').length
            decos.push(insertLine.range(cleanIdx === 0 ? 0 : pos + 1))
          }
          cleanIdx++
        }
      }
    }

    return Decoration.set(decos, true)
  }

  return StateField.define<DecorationSet>({
    create(state) { return compute(state.doc.toString()) },
    update(deco, tr) {
      if (!tr.docChanged) return deco
      return compute(tr.state.doc.toString())
    },
    provide: (f) => EditorView.decorations.from(f),
  })
}

const syntaxStyle = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.8em', fontWeight: '700' },
  { tag: tags.heading2, fontSize: '1.4em', fontWeight: '600' },
  { tag: tags.heading3, fontSize: '1.2em', fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)' },
  { tag: tags.blockComment, fontFamily: 'var(--font-mono)' },
])

const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent !important', height: '100%' },
  '.cm-scroller': {
    fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: '1.75',
    padding: '0', overflow: 'auto',
  },
  '.cm-content': { padding: '0' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-cursor': { borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'var(--color-accent-bg) !important' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--color-accent-bg) !important' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--color-accent)' },
  '&.cm-focused': { outline: 'none' },

  '.cm-line.diff-ins': {
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  '.cm-line.diff-ins::before': {
    content: '"+ "',
    color: '#16a34a',
    fontWeight: '600',
    userSelect: 'none',
    pointerEvents: 'none',
  },
  '.diff-del': {
    minHeight: '1.5em',
    backgroundColor: 'rgba(244,63,94,0.08)',
    color: '#dc2626',
    userSelect: 'none',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
})

function computeBaseContent(changes: PendingChange[]): string {
  if (changes.length === 0) return ''
  let c = changes[0].originalContent
  for (const ch of changes) {
    if (ch.oldString !== undefined && ch.newString !== undefined && ch.oldString) {
      const idx = c.indexOf(ch.oldString)
      if (idx !== -1) c = c.slice(0, idx) + ch.newString + c.slice(idx + ch.oldString.length)
    } else {
      c = ch.newContent
    }
  }
  return c
}

export const DiffEditor = memo(function DiffEditor({ documentId, pendingChanges }: DiffEditorProps) {
  const originalContent = pendingChanges[0]?.originalContent ?? ''
  const cumulativeContent = useMemo(() => computeBaseContent(pendingChanges), [pendingChanges])

  const editedSaved = usePendingChangesStore((s) => s.editedContent[documentId])
  const cleanContent = editedSaved ?? cumulativeContent

  const decoExtension = useMemo(() => diffDecoField(originalContent), [originalContent])

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
      syntaxHighlighting(syntaxStyle),
      EditorView.lineWrapping,
      editorTheme,
      decoExtension,
    ],
    [decoExtension]
  )

  const handleChange = useCallback(
    (val: string) => {
      usePendingChangesStore.getState().setEditedContent(documentId, val)
    },
    [documentId]
  )

  const approveAll = useCallback(() => {
    usePendingChangesStore.getState().approveAll(documentId)
  }, [documentId])

  const rejectAll = useCallback(() => {
    usePendingChangesStore.getState().rejectAll(documentId)
  }, [documentId])

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex justify-end items-center gap-2 px-4 py-2 border-b border-border/40 bg-surface z-10">
        <span className="text-xs text-ink-faint mr-auto">
          {pendingChanges.length} pending change{pendingChanges.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={rejectAll}
          className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors"
        >
          Reject All
        </button>
        <button
          onClick={approveAll}
          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
        >
          Approve All
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <CodeMirror
          className="h-full"
          value={cleanContent}
          onChange={handleChange}
          theme="light"
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: false,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            history: true,
          }}
        />
      </div>
    </div>
  )
})

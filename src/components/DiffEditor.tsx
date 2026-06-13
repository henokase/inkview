import { memo, useMemo, useCallback } from 'react'
import type { PendingChange } from '../stores/pending-changes-store'
import { usePendingChangesStore } from '../stores/pending-changes-store'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { unifiedMergeView } from '@codemirror/merge'

interface DiffEditorProps {
  documentId: string
  pendingChanges: PendingChange[]
}

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
  '.cm-content': { padding: '0 0 40vh 0' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-cursor': { borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'var(--color-accent-bg) !important' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--color-accent-bg) !important' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--color-accent)' },
  '&.cm-focused': { outline: 'none' },

  // Deleted chunk overlay (red)
  '.cm-deletedChunk': {
    backgroundColor: 'rgba(244,63,94,0.08)',
    color: '#dc2626',
    userSelect: 'none',
    pointerEvents: 'none',
  },
  '.cm-deletedLine': {
    backgroundColor: 'rgba(244,63,94,0.08)',
    color: '#dc2626',
    userSelect: 'none',
    pointerEvents: 'none',
  },
  '.cm-deletedText': {
    backgroundColor: 'rgba(244,63,94,0.15)',
    textDecoration: 'none',
  },

  // Inserted/changed lines (green)
  '.cm-insertedLine': {
    backgroundColor: 'rgba(16,185,129,0.08)',
  },

  // Gutter markers
  '.cm-deletedLineGutter': {
    backgroundColor: 'rgba(244,63,94,0.12)',
  },
  '.cm-insertedLineGutter': {
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
})

export const DiffEditor = memo(function DiffEditor({ documentId, pendingChanges }: DiffEditorProps) {
  const originalContent = pendingChanges[0]?.originalContent ?? ''
  const cumulativeContent = useMemo(() => computeBaseContent(pendingChanges), [pendingChanges])

  const editedSaved = usePendingChangesStore((s) => s.editedContent[documentId])
  const cleanContent = editedSaved ?? cumulativeContent

  const mergeExtension = useMemo(
    () => unifiedMergeView({
      original: originalContent,
      mergeControls: false,
      gutter: true,
      highlightChanges: true,
      allowInlineDiffs: true,
    }),
    [originalContent],
  )

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
      syntaxHighlighting(syntaxStyle),
      EditorView.lineWrapping,
      editorTheme,
      mergeExtension,
    ].flat(),
    [mergeExtension],
  )

  const handleChange = useCallback(
    (val: string) => {
      usePendingChangesStore.getState().setEditedContent(documentId, val)
    },
    [documentId],
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

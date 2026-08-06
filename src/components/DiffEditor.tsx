import { memo, useMemo, useCallback } from 'react'
import type { PendingChange } from '../stores/pending-changes-store'
import { usePendingChangesStore } from '../stores/pending-changes-store'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView, keymap } from '@codemirror/view'
import { syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language'
import { indentWithTab } from '@codemirror/commands'
import { tags } from '@lezer/highlight'
import { unifiedMergeView } from '@codemirror/merge'
import { pendingChangeScrollbarMarkers } from '../lib/codemirror/pending-change-scrollbar'

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
  { tag: tags.heading1, fontWeight: '700' },
  { tag: tags.heading2, fontWeight: '600' },
  { tag: tags.heading3, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)' },
  { tag: tags.blockComment, fontFamily: 'var(--font-mono)' },
])

const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent !important', height: '100%', position: 'relative' },
  '.cm-scroller': {
    fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: '1.75',
    padding: '0', overflow: 'auto',
  },
  '.cm-content': { padding: '0 0 40vh 0' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: 'none', fontVariantNumeric: 'tabular-nums' },
  '.cm-lineNumber': { padding: '0', fontSize: '12px', color: 'var(--ink-faint)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-cursor': { borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'var(--color-accent) !important' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--color-accent) !important' },
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

  // Scrollbar change indicators
  '.cm-pending-change-scrollbar': {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '10px',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '4',
  },
  '.cm-pending-change-scrollbar-marker': {
    position: 'absolute',
    right: '2px',
    width: '5px',
    borderRadius: '2px',
    minHeight: '3px',
    pointerEvents: 'auto',
    cursor: 'pointer',
    opacity: '0.85',
  },
  '.cm-pending-change-scrollbar-marker-insert': {
    backgroundColor: 'rgba(16,185,129,0.95)',
  },
  '.cm-pending-change-scrollbar-marker-delete': {
    backgroundColor: 'rgba(244,63,94,0.95)',
  },
  '.cm-pending-change-scrollbar-marker-change': {
    backgroundColor: 'rgba(245,158,11,0.95)',
  },
})

export const DiffEditor = memo(function DiffEditor({ documentId, pendingChanges }: DiffEditorProps) {
  const originalContent = pendingChanges[0]?.originalContent ?? ''
  const cumulativeContent = useMemo(() => computeBaseContent(pendingChanges), [pendingChanges])

  const editedSaved = usePendingChangesStore((s) => s.editedContent[documentId])
  const userModified = editedSaved !== undefined && editedSaved !== cumulativeContent
  const cleanContent = editedSaved ?? cumulativeContent

  const getOriginalContent = useCallback(() => originalContent, [originalContent])

  const scrollbarExtension = useMemo(
    () => pendingChangeScrollbarMarkers(getOriginalContent),
    [getOriginalContent],
  )

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
      keymap.of([indentWithTab]),
      indentUnit.of('    '),
      syntaxHighlighting(syntaxStyle),
      EditorView.lineWrapping,
      editorTheme,
      mergeExtension,
      scrollbarExtension,
    ].flat(),
    [mergeExtension, scrollbarExtension],
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
          {pendingChanges.length} pending change{pendingChanges.length !== 1 ? 's' : ''}{userModified ? ' — edited' : ''}
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

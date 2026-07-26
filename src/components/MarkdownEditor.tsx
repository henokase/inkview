import { memo, useCallback, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { PendingChange } from '../stores/pending-changes-store'
import { DiffEditor } from './DiffEditor'

const headingStyle = HighlightStyle.define([
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

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  pendingChanges?: PendingChange[]
  initialLine?: number
  onLineChange?: (line: number, scrollTop: number) => void
}

export interface MarkdownEditorHandle {
  scrollToHeading(headingText: string): void
  scrollToLine(line: number): void
}

export const MarkdownEditor = memo(forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, autoFocus, pendingChanges, initialLine, onLineChange }, ref) {
  const codemirrorRef = useRef<ReactCodeMirrorRef>(null)
  const onLineChangeRef = useRef(onLineChange)
  onLineChangeRef.current = onLineChange
  const hasRestoredLine = useRef(false)

  useImperativeHandle(ref, () => ({
    scrollToHeading(headingText: string) {
      const view = codemirrorRef.current?.view
      if (!view) return
      const doc = view.state.doc.toString()
      const lines = doc.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^(#{1,6})\s+(.+)/)
        if (match && match[2].trim() === headingText.trim()) {
          const pos = view.state.doc.line(i + 1).from
          view.dispatch({
            effects: EditorView.scrollIntoView(pos, { y: 'start' })
          })
          return
        }
      }
    },
    scrollToLine(line: number) {
      const view = codemirrorRef.current?.view
      if (!view) return
      const lineNum = Math.max(1, Math.min(line, view.state.doc.lines))
      const pos = view.state.doc.line(lineNum).from
      view.dispatch({
        effects: EditorView.scrollIntoView(pos, { y: 'start' })
      })
    }
  }))

  useEffect(() => {
    hasRestoredLine.current = false
  }, [value])

  useEffect(() => {
    if (initialLine && initialLine > 1 && !hasRestoredLine.current) {
      const timer = setTimeout(() => {
        const view = codemirrorRef.current?.view
        if (!view) return
        hasRestoredLine.current = true
        const lineNum = Math.max(1, Math.min(initialLine, view.state.doc.lines))
        const pos = view.state.doc.line(lineNum).from
        view.dispatch({
          effects: EditorView.scrollIntoView(pos, { y: 'start' })
        })
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [initialLine])

  const handleChange = useCallback(
    (val: string) => onChange(val),
    [onChange]
  )

  const extensions = useMemo(() => [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      addKeymap: true,
    }),
    syntaxHighlighting(headingStyle),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.geometryChanged || update.selectionSet) {
        const view = update.view
        const scrollTop = view.scrollDOM.scrollTop
        if (view.state.doc.lines > 0) {
          const lineBlock = view.lineBlockAtHeight(scrollTop)
          const lineNum = view.state.doc.lineAt(lineBlock.from).number
          onLineChangeRef.current?.(lineNum, scrollTop)
        }
      }
    }),
    EditorView.theme({
      '&': {
        backgroundColor: 'transparent !important',
        height: '100%',
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-sans)',
        fontSize: '15px',
        lineHeight: '1.75',
        padding: '0',
        overflow: 'auto',
      },
      '.cm-content': {
        padding: '0 0 20vh 0',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        borderRight: 'none',
        fontVariantNumeric: 'tabular-nums',
      },
      '.cm-lineNumber': {
        padding: '0',
        fontSize: '12px',
        color: 'var(--ink-faint)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
      },
      '.cm-cursor': {
        borderLeftWidth: '2px',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'var(--color-accent) !important',
      },
      '.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--color-accent) !important',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--color-accent)',
      },
      '&.cm-focused': {
        outline: 'none',
      },
    }),
  ], [])

  const hasPending = pendingChanges && pendingChanges.length > 0

  if (hasPending) {
    return (
      <DiffEditor
        documentId={pendingChanges[0].documentId}
        pendingChanges={pendingChanges}
      />
    )
  }

  return (
    <CodeMirror
      ref={codemirrorRef}
      className="h-full"
      value={value}
      onChange={handleChange}
      autoFocus={autoFocus}
      theme="light"
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
      }}
    />
  )
}))

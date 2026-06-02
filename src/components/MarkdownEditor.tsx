import { memo, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const headingStyle = HighlightStyle.define([
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

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export interface MarkdownEditorHandle {
  scrollToHeading(headingText: string): void
}

export const MarkdownEditor = memo(forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, autoFocus }, ref) {
  const codemirrorRef = useRef<ReactCodeMirrorRef>(null)

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
    }
  }))

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
        padding: '0',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        borderRight: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
      },
      '.cm-cursor': {
        borderLeftWidth: '2px',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'var(--color-accent-bg) !important',
      },
      '.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--color-accent-bg) !important',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--color-accent)',
      },
      '&.cm-focused': {
        outline: 'none',
      },
    }),
  ], [])

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
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
      }}
    />
  )
}))

import { useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { useTheme } from '../lib/use-theme'

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
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const handleChange = useCallback(
    (val: string) => onChange(val),
    [onChange]
  )

  return (
    <CodeMirror
      value={value}
      onChange={handleChange}
      height="100%"
      theme={isDark ? 'dark' : 'light'}
      extensions={[
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          addKeymap: true,
        }),
        syntaxHighlighting(headingStyle),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { backgroundColor: 'transparent !important', height: '100%' },
          '.cm-scroller': {
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            lineHeight: '1.75',
            padding: '0',
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
      ]}
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
}

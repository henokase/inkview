import { memo, useState, useEffect, useCallback, type ReactNode, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkEmoji from 'remark-emoji'
import remarkFootnotes from 'remark-footnotes'
import remarkGitHubAlerts from 'remark-github-markdown-alerts'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark as oneDarkRaw, oneLight as oneLightRaw } from 'react-syntax-highlighter/dist/esm/styles/prism'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import { Copy, Check } from 'lucide-react'
import type { Components } from 'react-markdown'
import { MermaidDiagram } from './MermaidDiagram'

function cleanTheme(theme: Record<string, React.CSSProperties>): Record<string, React.CSSProperties> {
  const cleaned: Record<string, React.CSSProperties> = {}
  for (const [key, val] of Object.entries(theme)) {
    cleaned[key] = { ...val, background: 'transparent', backgroundColor: 'transparent' }
  }
  return cleaned
}

const oneDark = cleanTheme(oneDarkRaw)
const oneLight = cleanTheme(oneLightRaw)

SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('jsx', jsx)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('py', python)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('css', css)

function convertYouTubeUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      const videoId = u.pathname.slice(1).split('/')[0]
      if (videoId) return `https://www.youtube.com/embed/${videoId}${u.search}`
    }
    if (/^(www\.|m\.)?youtube\.com$/.test(u.hostname) && u.pathname === '/watch') {
      const videoId = u.searchParams.get('v')
      if (videoId) {
        u.searchParams.delete('v')
        return `https://www.youtube.com/embed/${videoId}${u.search}`
      }
    }
  } catch { /* ignore */ }
  return url
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const H1 = ({ children }: { children?: ReactNode }) => {
  const id = slugify(String(children))
  return (
    <h1 id={id} className="mb-6 mt-12 text-3xl font-bold font-sans text-accent first:mt-0 tracking-tight">
      {children}
    </h1>
  )
}

const H2 = ({ children }: { children?: ReactNode }) => {
  const id = slugify(String(children))
  return (
    <h2 id={id} className="mb-4 mt-10 text-2xl font-semibold font-sans text-accent-soft tracking-tight first:mt-0">
      {children}
    </h2>
  )
}

const H3 = ({ children }: { children?: ReactNode }) => {
  const id = slugify(String(children))
  return (
    <h3 id={id} className="mb-3 mt-8 text-xl font-semibold font-sans text-accent-soft/80 tracking-tight first:mt-0">
      {children}
    </h3>
  )
}

const H4 = ({ children }: { children?: ReactNode }) => {
  const id = slugify(String(children))
  return (
    <h4 id={id} className="mb-2 mt-6 text-lg font-medium font-sans text-ink-soft tracking-tight first:mt-0">
      {children}
    </h4>
  )
}

const P = ({ children }: { children?: ReactNode }) => (
  <p className="mb-5 leading-[1.75] text-ink font-serif text-[1.05rem] wrap-break-word">{children}</p>
)

const Ul = ({ children }: { children?: ReactNode }) => (
  <ul className="mb-5 ml-6 list-disc space-y-1.5 text-ink font-serif text-[1.05rem]">{children}</ul>
)

const Ol = ({ children }: { children?: ReactNode }) => (
  <ol className="mb-5 ml-6 list-decimal space-y-1.5 text-ink font-serif text-[1.05rem]">{children}</ol>
)

const Li = ({ children }: { children?: ReactNode }) => (
  <li className="leading-relaxed wrap-break-word">{children}</li>
)

const Blockquote = ({ children }: { children?: ReactNode }) => (
  <blockquote className="mb-5 border-l-4 border-accent/25 pl-5 italic text-ink-soft font-serif wrap-break-word">
    {children}
  </blockquote>
)

const A = ({ href: hrefProp, children, ...props }: ComponentPropsWithoutRef<'a'>) => {
  const href = hrefProp ?? ''
  const isHash = href.startsWith('#')
  return (
    <a
      href={href || undefined}
      target={href.startsWith('http') && !isHash ? '_blank' : undefined}
      rel={href.startsWith('http') && !isHash ? 'noopener noreferrer' : undefined}
      onClick={isHash ? (e) => { e.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' }) } : undefined}
      className="break-all text-accent underline decoration-accent/25 underline-offset-2 transition-colors hover:decoration-accent/60"
      {...props}
    >
      {children}
    </a>
  )
}

const Hr = () => <hr className="my-10 border-border/60" />

const Table = ({ children }: { children?: ReactNode }) => (
  <div className="mb-5 overflow-x-auto rounded-lg border border-border">
    <table className="w-full border-collapse text-sm text-ink font-sans">{children}</table>
  </div>
)

const Th = ({ children }: { children?: ReactNode }) => (
  <th className="bg-surface-alt px-4 py-2.5 text-left font-semibold text-ink border-b border-border wrap-break-word">{children}</th>
)

const Td = ({ children }: { children?: ReactNode }) => (
  <td className="px-4 py-2.5 border-b border-border last:border-b-0 wrap-break-word">{children}</td>
)

const ThemedCodeBlock = memo(function ThemedCodeBlock({ code, language }: { code: string; language: string }) {
  const [themeKey, setThemeKey] = useState(0)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeKey(k => k + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const isDark = document.documentElement.classList.contains('dark')

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }, [code])

  return (
    <div className="group relative mb-5 mt-3 rounded-lg border border-border overflow-hidden bg-surface-alt">
      <div className="flex items-center justify-between bg-surface-alt/80 px-4 py-1.5 text-xs text-ink-faint border-b border-border">
        <span className="font-sans font-medium">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface/50"
        >
          {copiedCode === code ? <Check size={13} /> : <Copy size={13} />}
          {copiedCode === code ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        key={themeKey}
        style={isDark ? oneDark : oneLight}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.85rem',
          lineHeight: '1.6',
          background: 'transparent',
          overflowX: 'auto',
        }}
        codeTagProps={{ style: { background: 'transparent' } }}
        showLineNumbers
        lineNumberStyle={{ color: 'var(--color-ink-faint)', opacity: 0.5 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
})

const Div = ({ className, children, ...props }: ComponentPropsWithoutRef<'div'>) => {
  if (className?.includes('markdown-alert')) {
    const type = className?.includes('note') ? 'note'
      : className?.includes('tip') ? 'tip'
      : className?.includes('warning') ? 'warning'
      : className?.includes('important') ? 'important'
      : className?.includes('caution') ? 'caution'
      : 'note'

    const config = {
      note: { icon: 'ℹ️', label: 'Note', color: 'border-l-note bg-note/5' },
      tip: { icon: '💡', label: 'Tip', color: 'border-l-tip bg-tip/5' },
      warning: { icon: '⚠️', label: 'Warning', color: 'border-l-warning bg-warning/5' },
      important: { icon: '🔔', label: 'Important', color: 'border-l-important bg-important/5' },
      caution: { icon: '🚨', label: 'Caution', color: 'border-l-warning bg-warning/10' },
    } as const

    const c = config[type as keyof typeof config]

    return (
      <div
        className={`mb-5 rounded-lg border-l-4 p-4 ${c.color}`}
        {...props}
      >
        <strong className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint font-sans">
          {c.icon} {c.label}
        </strong>
        <div className="text-sm text-ink font-serif">{children}</div>
      </div>
    )
  }
  return <div className={className} {...props}>{children}</div>
}

const Img = ({ src, alt }: ComponentPropsWithoutRef<'img'>) => (
  <img
    src={src}
    alt={alt || ''}
    className="mb-5 rounded-xl max-w-full h-auto"
    loading="lazy"
  />
)

const Iframe = (props: ComponentPropsWithoutRef<'iframe'>) => (
  <iframe
    {...props}
    src={props.src ? convertYouTubeUrl(props.src) : undefined}
    allowFullScreen
    allow="fullscreen"
    className="mb-5 rounded-xl max-w-full border border-border"
  />
)

const Input = ({ type, checked, ...props }: ComponentPropsWithoutRef<'input'>) => (
  <input
    type={type}
    defaultChecked={checked}
    className="mr-1.5 h-4 w-4 rounded-sm border-border accent-accent"
    {...props}
  />
)

const CodeBlock = ({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) => {
  const match = /language-(\w+)/.exec(className || '')
  const code = String(children)
  const isFenced = /\n/.test(code)
  const trimmed = code.replace(/\n$/, '')
  if (!match) {
    if (isFenced) {
      return (
        <div className="group relative mb-5 mt-3 rounded-lg border border-border overflow-hidden bg-surface-alt">
          <pre className="overflow-x-auto px-4 py-3 font-mono text-sm leading-relaxed text-ink whitespace-pre">
            <code>{trimmed}</code>
          </pre>
        </div>
      )
    }
    return (
      <code
        className="rounded-md bg-surface-alt px-1.5 py-0.5 font-mono text-sm text-accent"
        {...props}
      >
        {children}
      </code>
    )
  }
  const language = match[1]

  if (language === 'mermaid') {
    return <MermaidDiagram code={trimmed} />
  }
  return <ThemedCodeBlock code={trimmed} language={language} />
}

const components: Components = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  p: P,
  ul: Ul,
  ol: Ol,
  li: Li,
  blockquote: Blockquote,
  a: A,
  hr: Hr,
  table: Table,
  th: Th,
  td: Td,
  code: CodeBlock,
  div: Div,
  img: Img,
  iframe: Iframe,
  input: Input,
}

interface MarkdownRendererProps {
  content: string
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="font-sans wrap-break-word">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkEmoji, remarkFootnotes as any, remarkGitHubAlerts]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

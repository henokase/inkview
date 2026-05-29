import { useMemo, useState, useCallback, type ReactNode, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkGitHubAlerts from 'remark-github-markdown-alerts'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
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
import { useTheme } from '../lib/use-theme'

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

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

interface MarkdownRendererProps {
  content: string
  onHeadingsRendered?: (ids: string[]) => void
}

export function MarkdownRenderer({ content, onHeadingsRendered }: MarkdownRendererProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleCopy = useCallback(async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }, [])

  const components: Components = useMemo(
    () => ({
      h1: ({ children }: { children?: ReactNode }) => {
        const id = slugify(String(children))
        return <h1 id={id} className="mb-6 mt-10 text-3xl font-bold font-sans text-ink first:mt-0">{children}</h1>
      },
      h2: ({ children }: { children?: ReactNode }) => {
        const id = slugify(String(children))
        return <h2 id={id} className="mb-4 mt-8 text-2xl font-semibold font-sans text-ink">{children}</h2>
      },
      h3: ({ children }: { children?: ReactNode }) => {
        const id = slugify(String(children))
        return <h3 id={id} className="mb-3 mt-6 text-xl font-semibold font-sans text-ink">{children}</h3>
      },
      h4: ({ children }: { children?: ReactNode }) => {
        const id = slugify(String(children))
        return <h4 id={id} className="mb-2 mt-4 text-lg font-medium font-sans text-ink">{children}</h4>
      },
      p: ({ children }: { children?: ReactNode }) => (
        <p className="mb-4 leading-relaxed text-ink">{children}</p>
      ),
      ul: ({ children }: { children?: ReactNode }) => (
        <ul className="mb-4 ml-6 list-disc space-y-1 text-ink">{children}</ul>
      ),
      ol: ({ children }: { children?: ReactNode }) => (
        <ol className="mb-4 ml-6 list-decimal space-y-1 text-ink">{children}</ol>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li className="leading-relaxed">{children}</li>
      ),
      blockquote: ({ children }: { children?: ReactNode }) => (
        <blockquote className="mb-4 border-l-4 border-accent/30 pl-4 italic text-ink-soft">
          {children}
        </blockquote>
      ),
      a: ({ href, children }: ComponentPropsWithoutRef<'a'>) => (
        <a
          href={href}
          target={href?.startsWith('http') ? '_blank' : undefined}
          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent"
        >
          {children}
        </a>
      ),
      hr: () => <hr className="my-8 border-border" />,
      table: ({ children }: { children?: ReactNode }) => (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm text-ink">{children}</table>
        </div>
      ),
      th: ({ children }: { children?: ReactNode }) => (
        <th className="border border-border bg-surface-alt px-3 py-2 text-left font-semibold">{children}</th>
      ),
      td: ({ children }: { children?: ReactNode }) => (
        <td className="border border-border px-3 py-2">{children}</td>
      ),
      code: ({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) => {
        const match = /language-(\w+)/.exec(className || '')
        const code = String(children).replace(/\n$/, '')
        if (!match) {
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
        return (
          <div className="group relative mb-4 mt-2">
            <div className="flex items-center justify-between rounded-t-lg bg-[#282c34] px-4 py-1.5 text-xs text-[#abb2bf]">
              <span>{language}</span>
              <button
                onClick={() => handleCopy(code)}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
              >
                {copiedCode === code ? <Check size={14} /> : <Copy size={14} />}
                {copiedCode === code ? 'Copied' : 'Copy'}
              </button>
            </div>
            <SyntaxHighlighter
              style={isDark ? oneDark : oneLight}
              language={language}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderBottomLeftRadius: '0.5rem',
                borderBottomRightRadius: '0.5rem',
                fontSize: '0.875rem',
                lineHeight: '1.5',
              }}
              showLineNumbers
            >
              {code}
            </SyntaxHighlighter>
          </div>
        )
      },
      div: ({ className, children, ...props }: ComponentPropsWithoutRef<'div'>) => {
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
              className={`mb-4 rounded-lg border-l-4 p-4 ${c.color}`}
              {...props}
            >
              <strong className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                {c.icon} {c.label}
              </strong>
              <div className="text-sm text-ink">{children}</div>
            </div>
          )
        }
        return <div className={className} {...props}>{children}</div>
      },
      img: ({ src, alt }: ComponentPropsWithoutRef<'img'>) => (
        <img
          src={src}
          alt={alt || ''}
          className="mb-4 rounded-xl max-w-full h-auto"
          loading="lazy"
        />
      ),
      input: ({ type, checked, ...props }: ComponentPropsWithoutRef<'input'>) => (
        <input
          type={type}
          defaultChecked={checked}
          className="mr-1.5 h-4 w-4 rounded-sm border-border accent-accent"
          {...props}
        />
      ),
    }),
    [isDark, handleCopy, copiedCode]
  )

  return (
    <div
      className="prose-custom font-serif text-base"
      ref={(el) => {
        if (el && onHeadingsRendered) {
          const ids = Array.from(el.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .map((h) => h.id)
            .filter(Boolean)
          onHeadingsRendered(ids)
        }
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkGitHubAlerts]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

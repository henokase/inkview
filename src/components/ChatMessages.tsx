import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, MessageSquare } from 'lucide-react'
import type { Message } from '../types'

interface ChatMessagesProps {
  messages: Message[]
  isStreaming: boolean
}

function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed text-[13px]">{children}</p>,
        ul: ({ children }) => <ul className="mb-2.5 ml-4 list-disc space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed text-[13px]">{children}</li>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/25 underline-offset-2 hover:decoration-accent/60 transition-all duration-200">
            {children}
          </a>
        ),
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '')
          const code = String(children).replace(/\n$/, '')
          if (match) {
            return (
              <div className="my-2.5 rounded-lg border border-border/60 bg-surface-alt/80 overflow-x-auto backdrop-blur-sm">
                <pre className="px-3.5 py-2.5 text-xs font-mono leading-relaxed text-ink whitespace-pre">
                  <code>{code}</code>
                </pre>
              </div>
            )
          }
          return (
            <code className="rounded-md bg-accent/8 px-1.5 py-0.5 text-xs font-mono text-accent" {...props}>
              {children}
            </code>
          )
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="mb-2.5 border-l-2 border-accent/20 pl-3.5 italic text-ink-soft text-[13px]">{children}</blockquote>
        ),
        hr: () => <hr className="my-4 border-border/40" />,
        table: ({ children }) => (
          <div className="mb-2.5 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="bg-surface-alt/80 px-3 py-1.5 text-left font-semibold text-ink border-b border-border/60">{children}</th>,
        td: ({ children }) => <td className="px-3 py-1.5 border-b border-border/60 text-[13px]">{children}</td>,
        h1: ({ children }) => <h1 className="mb-2.5 mt-4 text-base font-bold text-ink first:mt-0 tracking-tight">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-3.5 text-sm font-bold text-ink first:mt-0 tracking-tight">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-[13px] font-bold text-ink first:mt-0 tracking-tight">{children}</h3>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export function ChatMessages({ messages, isStreaming }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const prevLengthRef = useRef(messages.length)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    setUserScrolledUp(!isAtBottom)
  }, [messages.length])

  useEffect(() => {
    const length = messages.length
    if (length > prevLengthRef.current && !userScrolledUp && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevLengthRef.current = length
  }, [messages.length, userScrolledUp])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    setUserScrolledUp(!isAtBottom)
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="w-12 h-12 rounded-2xl bg-accent/8 flex items-center justify-center mb-4">
          <MessageSquare size={20} className="text-accent/60" />
        </div>
        <p className="text-xs text-ink-faint/50 font-sans text-center leading-relaxed max-w-50">
          Send a message to start chatting with AI about this document.
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-3 py-4 space-y-4 scroll-smooth"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
          >
            <div className="flex items-start gap-2 max-w-[88%]">
              {msg.role === 'assistant' && (
                <div className="shrink-0 w-6 h-6 rounded-full bg-linear-to-br from-accent/15 to-accent/5 flex items-center justify-center mt-1 border border-accent/10">
                  <Bot size={12} className="text-accent/60" />
                </div>
              )}
              <div
                className={`relative ${
                  msg.role === 'user'
                    ? 'bg-linear-to-br from-accent to-accent-soft text-white rounded-2xl rounded-br-md shadow-sm shadow-accent/15'
                    : 'bg-surface-alt/70 text-ink border border-border/40 rounded-2xl rounded-bl-md shadow-sm'
                } ${msg.role === 'user' ? 'px-3.5 py-2.5' : 'px-4 py-3'}`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed font-medium">{msg.content}</p>
                ) : msg.content ? (
                  <div className="prose prose-sm max-w-none">
                    <ChatMarkdown content={msg.content} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-ink-faint">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
                {isStreaming && msg === messages[messages.length - 1] && msg.role === 'assistant' && msg.content && (
                  <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 rounded-sm animate-pulse align-text-bottom" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {userScrolledUp && (
        <button
          onClick={() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
            setUserScrolledUp(false)
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 backdrop-blur-sm border border-border/60 px-3.5 py-1.5 text-xs text-ink-soft hover:text-ink shadow-lg shadow-black/5 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          Jump to latest ↓
        </button>
      )}
    </div>
  )
}

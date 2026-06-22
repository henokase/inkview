import { memo, useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { MessageSquare, Copy, Pencil, Check, X } from 'lucide-react'
import type { Message, Part, ToolPart, TextPart, ReasoningPart } from '../types'
import { ThinkingView } from './ThinkingView'
import { ToolCallCard } from './ToolCallCard'

function snapToWordBoundary(text: string, fromIndex: number): number {
  if (fromIndex >= text.length) return text.length
  const rest = text.slice(fromIndex)
  const nextSpace = rest.indexOf(' ')
  const nextNewline = rest.indexOf('\n')
  let snap = -1
  if (nextSpace >= 0 && nextSpace <= 5) snap = fromIndex + nextSpace + 1
  if (nextNewline >= 0 && nextNewline <= 5) {
    snap = snap >= 0 ? Math.min(snap, fromIndex + nextNewline + 1) : fromIndex + nextNewline + 1
  }
  return snap >= 0 ? snap : fromIndex
}

function usePacedText(text: string, streaming: boolean): string {
  const [displayed, setDisplayed] = useState(text)
  const textRef = useRef(text)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const posRef = useRef(text.length)
  textRef.current = text

  if (!streaming && displayed !== text) {
    posRef.current = text.length
    setDisplayed(text)
  }

  useEffect(() => {
    if (!streaming) {
      posRef.current = text.length
      setDisplayed(text)
      return
    }
    if (posRef.current >= text.length) return
    const end = snapToWordBoundary(text, posRef.current + 1)
    if (end <= posRef.current) {
      posRef.current = text.length
      setDisplayed(text)
      return
    }
    timerRef.current = setTimeout(() => {
      const latest = textRef.current
      const revealEnd = Math.min(end, latest.length)
      posRef.current = revealEnd
      setDisplayed(latest.slice(0, revealEnd))
      timerRef.current = undefined
    }, 24)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
    }
  }, [text, streaming])

  return displayed
}

interface ChatMessagesProps {
  messages: Message[]
  isStreaming: boolean
  activeThinking?: string
  onEdit?: (msgId: string, newContent: string) => void
}

function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
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
          const codeStr = String(children)
          const isFenced = /\n/.test(codeStr)
          const trimmed = codeStr.replace(/\n$/, '')
          if (match) {
            return (
              <div className="my-2.5 rounded-lg border border-border/60 bg-surface-alt/80 overflow-x-auto backdrop-blur-sm">
                <pre className="px-3.5 py-2.5 text-xs font-mono leading-relaxed text-ink w-max min-w-full">
                  <code>{trimmed}</code>
                </pre>
              </div>
            )
          }
          if (isFenced) {
            return (
              <div className="my-2.5 rounded-lg border border-border/60 bg-surface-alt/80 overflow-x-auto backdrop-blur-sm">
                <pre className="px-3.5 py-2.5 text-xs font-mono leading-relaxed text-ink w-max min-w-full">
                  <code>{trimmed}</code>
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
          <div className="mb-3 overflow-x-auto rounded-xl border border-border/50 shadow-xs">
            <table className="w-max min-w-full border-collapse text-xs chat-table">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="bg-surface-alt/90 px-3.5 py-2 text-left font-semibold text-ink text-[11px] tracking-wider uppercase border-b border-border/40">{children}</th>,
        td: ({ children }) => <td className="px-3.5 py-2 border-b border-border/30 text-[13px] leading-relaxed">{children}</td>,
        h1: ({ children }) => <h1 className="mb-2.5 mt-4 text-base font-bold text-ink first:mt-0 tracking-tight">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-3.5 text-sm font-bold text-ink first:mt-0 tracking-tight">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-[13px] font-bold text-ink first:mt-0 tracking-tight">{children}</h3>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

const ChatMarkdownMemo = memo(ChatMarkdown)

function StreamingText({ text }: { text: string }) {
  const paced = usePacedText(text, true)
  return (
    <div className="prose prose-sm max-w-none">
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{paced}</p>
      {paced.length < text.length && (
        <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 rounded-sm animate-pulse align-text-bottom" />
      )}
    </div>
  )
}

function PartRenderer({ part, isStreaming, isLast }: { part: Part; isStreaming: boolean; isLast: boolean }) {
  switch (part.type) {
    case 'text': {
      const text = (part as TextPart).text
      if (isStreaming && isLast) {
        return <StreamingText text={text} />
      }
      return (
        <div className="prose prose-sm max-w-none">
          <ChatMarkdownMemo content={text} />
        </div>
      )
    }
    case 'reasoning':
      return <ThinkingView thinking={(part as ReasoningPart).text} loading={false} />
    case 'tool': {
      const t = part as ToolPart
      return (
        <ToolCallCard
          call={{ id: t.id, type: 'tool_call', name: t.name, arguments: t.args }}
          status={t.status === 'error' ? 'failed' : t.status}
          result={t.result}
          metadata={t.metadata}
        />
      )
    }
    default:
      return null
  }
}

const PartRendererMemo = memo(PartRenderer)

interface MessageBubbleProps {
  msg: Message
  isLastStreaming: boolean
  isLastUserMessage: boolean
  activeThinking?: string
  onEdit?: (msgId: string, newContent: string) => void
}

const COLLAPSE_LINE_THRESHOLD = 5

const MessageBubble = memo(function MessageBubble({ msg, isLastStreaming, isLastUserMessage, activeThinking, onEdit }: MessageBubbleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)
  const [copied, setCopied] = useState(false)
  const [userExpanded, setUserExpanded] = useState(false)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isUser = msg.role === 'user'
  const lineCount = isUser ? msg.content.split('\n').length : 0
  const isLong = lineCount > COLLAPSE_LINE_THRESHOLD
  const isCollapsed = isLong && !userExpanded
  const hasParts = msg.parts && msg.parts.length > 0

  useEffect(() => {
    if (!isLong || !userExpanded) return
    const handler = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setUserExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isLong, userExpanded])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(draft.length, draft.length)
    }
  }, [editing])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [msg.content])

  const handleSave = useCallback(() => {
    if (draft.trim() && draft !== msg.content) {
      onEdit?.(msg.id, draft)
    }
    setEditing(false)
  }, [draft, msg.content, msg.id, onEdit])

  const handleCancel = useCallback(() => {
    setDraft(msg.content)
    setEditing(false)
  }, [msg.content])

  useKeydown(editing, handleSave, handleCancel)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}>
      <div className={`${isUser ? (editing ? 'w-full' : 'max-w-[88%]') : 'w-full'}`}>
        <div
          className={`relative ${
            isUser
              ? 'bg-accent/15 border border-accent/30 text-ink rounded-xl rounded-br-md'
              : `text-ink ${hasParts || msg.content ? 'bg-surface-alt border border-border/40 rounded-xl rounded-tl-md' : ''}`
          } ${isUser ? `${editing ? 'p-2 border-2 border-slate-500' : 'p-2'}` : 'p-2'}`}
        >
          {editing ? (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-lg text-[13px] leading-relaxed font-medium text-ink resize-none outline-none"
              rows={3}
            />
          ) : isUser ? (
            <div ref={bubbleRef}>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed font-medium">
                {isCollapsed
                  ? msg.content.split('\n').slice(0, COLLAPSE_LINE_THRESHOLD).join('\n')
                  : msg.content}
              </p>
              {isLong && (
                <button
                  onClick={() => setUserExpanded(!userExpanded)}
                  className="mt-1 text-[11px] text-accent/70 hover:text-accent transition-colors"
                >
                  {userExpanded ? 'Show less' : `Show more (${lineCount - COLLAPSE_LINE_THRESHOLD} more lines)`}
                </button>
              )}
            </div>
          ) : hasParts ? (
            <div className="space-y-2">
              {msg.parts!.map((part, i) => (
                <PartRendererMemo
                  key={part.type === 'tool' ? (part as ToolPart).id : `part-${i}`}
                  part={part}
                  isStreaming={isLastStreaming}
                  isLast={isLastStreaming && i === msg.parts!.length - 1}
                />
              ))}
              {isLastStreaming && activeThinking && (
                <div className="pt-1">
                  <ThinkingView thinking={activeThinking} loading={true} />
                </div>
              )}
            </div>
          ) : msg.content ? (
            isLastStreaming ? (
              <>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 rounded-sm animate-pulse align-text-bottom" />
              </>
            ) : (
              <div className="prose prose-sm max-w-none">
                <ChatMarkdownMemo content={msg.content} />
              </div>
            )
          ) : isLastStreaming ? (
            <div className="flex items-center gap-2 text-ink-faint">
              <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : null}
        </div>

        <div className={`flex items-center gap-1 mt-1.5 px-1 justify-end ${editing ? 'justify-end' : ''}`}>
          {editing ? (
            <>
              <button onClick={handleCancel} className="rounded-md p-1.5 text-ink-faint/70 hover:text-ink hover:bg-surface-alt transition-all duration-150" title="Cancel">
                <X size={13} />
              </button>
              <button onClick={handleSave} className="rounded-md p-1.5 text-accent hover:bg-accent/10 transition-all duration-150" title="Save">
                <Check size={13} />
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCopy} className="rounded-md p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-150" title="Copy">
                {copied ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
              </button>
              {isUser && isLastUserMessage && (
                <button onClick={() => { setEditing(true); setDraft(msg.content) }} className="rounded-md p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-150" title="Edit">
                  <Pencil size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
})

function useKeydown(active: boolean, onSave: () => void, onCancel: () => void) {
  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.shiftKey)) {
        onSave()
      } else if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [active, onSave, onCancel])
}

export function ChatMessages({ messages, isStreaming, activeThinking, onEdit }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const prevLengthRef = useRef(messages.length)
  const mountedRef = useRef(false)

  const lastUserMsgIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return i
    }
    return -1
  })()

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (!mountedRef.current) {
      mountedRef.current = true
      el.scrollTop = el.scrollHeight
      prevLengthRef.current = messages.length
      return
    }

    if (messages.length > prevLengthRef.current) {
      prevLengthRef.current = messages.length
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

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
        className="h-full overflow-y-auto px-2.5 pt-4 scroll-smooth"
      >
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isLastStreaming={isStreaming && msg.role === 'assistant' && index === messages.length - 1}
              isLastUserMessage={msg.role === 'user' && index === lastUserMsgIndex}
              activeThinking={activeThinking}
              onEdit={onEdit}
            />
          ))}
        </div>
        <div className="h-20" />
      </div>

      {userScrolledUp && (
        <button
          onClick={() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
            setUserScrolledUp(false)
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 backdrop-blur-sm border border-border/60 px-3.5 py-1.5 text-xs text-ink-soft hover:text-ink shadow-lg shadow-black/5 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          ↓
        </button>
      )}
    </div>
  )
}

import { useRef, useCallback, useState } from 'react'
import { Send, Square, X, Quote } from 'lucide-react'
import { useChatStore } from '../stores/chat-store'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const contextText = useChatStore((s) => s.contextText)
  const setContextText = useChatStore((s) => s.setContextText)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const stopGeneration = useChatStore((s) => s.stopGeneration)
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isStreaming) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, isStreaming, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }, [])

  return (
    <div className="px-3 pt-2.5 pb-3">
      {contextText && (
        <div className="mb-2.5 flex items-start gap-2.5 rounded-xl bg-accent/6 border border-accent/15 px-3.5 py-2.5 group">
          <div className="shrink-0 w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
            <Quote size={11} className="text-accent/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-accent font-sans mb-0.5 tracking-wider uppercase">Context</p>
            <p className="text-xs text-ink-soft font-sans leading-relaxed line-clamp-2">
              {contextText}
            </p>
          </div>
          <button
            onClick={() => setContextText('')}
            className="shrink-0 rounded-lg p-1 text-ink-faint/40 hover:text-ink hover:bg-surface-alt/60 transition-all duration-200 opacity-0 group-hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={contextText ? 'Ask about this selection...' : 'Ask about the document...'}
            rows={1}
            disabled={isStreaming}
            className="w-full resize-none rounded-xl border border-border/60 bg-surface-alt/50 px-3.5 py-2.5 pr-10 text-sm text-ink placeholder-ink-faint/40 outline-hidden focus:border-accent/30 focus:bg-surface-alt/80 focus:shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.15)] transition-all duration-200 font-sans disabled:opacity-50 leading-relaxed"
            style={{ maxHeight: '120px' }}
          />
        </div>
        {isStreaming ? (
          <button
            onClick={stopGeneration}
            className="shrink-0 rounded-xl border border-border/50 bg-surface-alt/50 p-2.5 text-ink-faint hover:text-ink hover:bg-surface-alt hover:border-border/80 transition-all duration-200 active:scale-95"
            title="Stop generating"
          >
            <Square size={15} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className="shrink-0 rounded-xl bg-gradient-to-br from-accent to-accent-soft p-2.5 text-white shadow-sm shadow-accent/20 hover:shadow-md hover:shadow-accent/25 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm"
            title="Send message"
          >
            <Send size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

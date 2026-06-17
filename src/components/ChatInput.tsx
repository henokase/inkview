import { useRef, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Square, X, Quote, ArrowUp } from 'lucide-react'
import { useChatStore } from '../stores/chat-store'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export interface ChatInputHandle {
  focus: () => void
}

const ChatInputComponent = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ onSend, disabled }, ref) => {
  const contextText = useChatStore((s) => s.contextText)
  const setContextText = useChatStore((s) => s.setContextText)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const agentMode = useChatStore((s) => s.agentMode)
  const setAgentMode = useChatStore((s) => s.setAgentMode)
  const stopGeneration = useChatStore((s) => s.stopGeneration)
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    if (mq.matches && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // Autofocus after AI finishes responding on larger screens
  useEffect(() => {
    if (!isStreaming) {
      const mq = window.matchMedia('(min-width: 1024px)')
      if (mq.matches && textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }, [isStreaming])

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus()
    }
  }), [])

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
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }, [])

  return (
    <div className="px-3 pt-2.5 pb-3">
      <div className="flex flex-col border border-border/80 bg-surface-alt/60 focus-within:border-accent/50 focus-within:bg-surface-alt/80 transition-all duration-200 rounded-xl p-3 shadow-sm">
        {contextText && (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-accent/8 border border-accent/20 px-3 py-2 group">
            <div className="shrink-0 w-5 h-5 rounded bg-accent/10 flex items-center justify-center mt-0.5">
              <Quote size={10} className="text-accent/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-accent font-sans mb-0.5 tracking-wider uppercase">Context</p>
              <p className="text-xs text-ink-soft font-sans leading-relaxed line-clamp-2">
                {contextText}
              </p>
            </div>
            <button
              onClick={() => setContextText('')}
              className="shrink-0 rounded p-0.5 text-ink-faint/40 hover:text-ink hover:bg-surface-alt/60 transition-all duration-200 opacity-0 group-hover:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            contextText
              ? 'Ask about this selection...'
              : agentMode
                ? 'Describe changes or edits to make to the document...'
                : 'Ask about the document...'
          }
          rows={2}
          disabled={isStreaming}
          className="w-full resize-none bg-transparent p-0 text-sm text-ink placeholder-ink-faint/60 outline-none border-none focus:ring-0 focus:outline-none font-sans disabled:opacity-50 leading-relaxed min-h-[2.6em] max-h-40"
        />

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60">
          <div className="flex items-center text-xs text-ink-faint select-none">
            <div className="relative flex items-center bg-surface-alt rounded-md p-0.5 border border-border/60 select-none w-24">
              <div
                className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-accent shadow-[0_2px_8px_rgba(var(--accent-rgb),0.2)] dark:shadow-none transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={{ transform: agentMode ? 'translateX(100%)' : 'translateX(0)' }}
              />
              <button
                type="button"
                onClick={() => setAgentMode(false)}
                disabled={isStreaming}
                className={`relative z-10 w-1/2 py-1 text-[10px] font-semibold text-center transition-colors duration-200 select-none cursor-pointer ${
                  !agentMode ? 'text-white' : 'text-ink-faint hover:text-ink'
                } ${isStreaming ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setAgentMode(true)}
                disabled={isStreaming}
                className={`relative z-10 w-1/2 py-1 text-[10px] font-semibold text-center transition-colors duration-200 select-none cursor-pointer ${
                  agentMode ? 'text-white' : 'text-ink-faint hover:text-ink'
                } ${isStreaming ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                Agent
              </button>
            </div>
          </div>

          <div className="flex items-center">
            {isStreaming ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="p-1.5 rounded-full hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer active:scale-95"
                title="Stop generating"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!value.trim() || disabled}
                className={`p-1.5 rounded-full transition-all duration-150 ${
                  value.trim() && !disabled
                    ? 'bg-accent text-white hover:scale-105 active:scale-95 shadow-sm shadow-accent/20 cursor-pointer'
                    : 'text-ink-faint/40 bg-surface-alt/50 cursor-not-allowed'
                }`}
                title="Send message"
              >
                <ArrowUp size={13} className="stroke-[3.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

ChatInputComponent.displayName = 'ChatInput'

export const ChatInput = ChatInputComponent

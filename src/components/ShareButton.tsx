import { Share2, Check, AlertCircle, Loader2 } from 'lucide-react'
import { useState, useCallback } from 'react'
import { createShareLink } from '../lib/share'

interface ShareButtonProps {
  content: string
}

const COPIED_DURATION = 2000
const ERROR_DURATION = 3000

export function ShareButton({ content }: ShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')

  const handleShare = useCallback(async () => {
    if (!content.trim() || status === 'loading') return
    setStatus('loading')
    try {
      const url = await createShareLink(content)
      await navigator.clipboard.writeText(url)
      setStatus('copied')
      setTimeout(() => setStatus('idle'), COPIED_DURATION)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), ERROR_DURATION)
    }
  }, [content, status])

  return (
    <button
      onClick={handleShare}
      title="Share document"
      disabled={!content.trim()}
      className="rounded-lg p-2 sm:p-2.5 text-ink-faint hover:text-ink hover:bg-surface-alt transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {status === 'loading' ? (
        <Loader2 size={18} className="animate-spin" />
      ) : status === 'copied' ? (
        <span className="flex items-center gap-1.5 text-green-500 text-xs sm:text-sm font-medium font-sans">
          <Check size={16} />
          Copied!
        </span>
      ) : status === 'error' ? (
        <span className="flex items-center gap-1.5 text-red-500 text-xs sm:text-sm font-medium font-sans">
          <AlertCircle size={16} />
          Failed
        </span>
      ) : (
        <Share2 size={18} />
      )}
    </button>
  )
}

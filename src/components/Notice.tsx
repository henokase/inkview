import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X } from 'lucide-react'

interface NoticeProps {
  title: string
  message: string
  visible: boolean
  onClose: () => void
}

export function Notice({ title, message, visible, onClose }: NoticeProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
    } else {
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!mounted) return null

  return createPortal(
    <div
      className={`fixed top-0 left-0 right-0 z-200 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
      }`}
    >
      <div className="mx-auto max-w-4xl m-4">
        <div className="flex items-start gap-3 rounded-xl bg-linear-to-r from-accent/10 to-accent/5 shadow-lg border border-accent/20 px-4 py-3.5 font-sans text-sm text-ink backdrop-blur-sm">
          <Sparkles size={18} className="text-accent shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-accent mb-0.5">{title}</p>
            <p className="text-ink-soft leading-relaxed">{message}</p>
          </div>
          <button 
            onClick={onClose} 
            className="shrink-0 rounded-lg p-1 text-ink-faint hover:text-ink hover:bg-accent/10 transition-colors"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

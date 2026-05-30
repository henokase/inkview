import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  visible: boolean
  onClose: () => void
  duration?: number
}

export function Toast({ message, type, visible, onClose, duration = 4000 }: ToastProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
    } else {
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [visible, duration, onClose])

  if (!mounted) return null

  const Icon = type === 'success' ? CheckCircle2 : AlertCircle

  return createPortal(
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="flex items-center gap-2.5 rounded-xl bg-surface shadow-lg border border-border/80 px-4 py-3 font-sans text-sm text-ink">
        <Icon size={18} className={type === 'success' ? 'text-green-500 shrink-0' : 'text-red-500 shrink-0'} />
        <span className="flex-1">{message}</span>
        <button onClick={onClose} className="rounded-lg p-0.5 text-ink-faint hover:text-ink transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>,
    document.body
  )
}

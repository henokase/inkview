import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { hydrateStore } from './stores/document-store'

registerSW({
  onNeedRefresh() {
    window.location.reload()
  },
  onOfflineReady() {
    const toast = document.createElement('div')
    toast.className =
      'fixed bottom-4 right-4 z-[100] bg-accent text-white text-sm font-sans px-4 py-2.5 rounded-xl shadow-lg transition-all duration-300 opacity-0 translate-y-2'
    toast.textContent = 'Offline ready — all features available offline'
    document.body.appendChild(toast)
    requestAnimationFrame(() => {
      toast.classList.remove('opacity-0', 'translate-y-2')
    })
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2')
      setTimeout(() => toast.remove(), 300)
    }, 4000)
  },
})

// Start hydration immediately — loads documents from IndexedDB
// (or migrates from localStorage on first run after deploy)
hydrateStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

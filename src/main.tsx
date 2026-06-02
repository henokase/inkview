import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { hydrateStore } from './stores/document-store'

registerSW({
  onNeedRefresh() {
    // Automatically update when a new SW is ready
    window.location.reload()
  },
  onOfflineReady() {
    console.log('InkView is ready for offline use')
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

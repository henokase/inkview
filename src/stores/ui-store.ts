import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EditorMode, ThemeMode } from '../types'

interface UiStore {
  editorMode: EditorMode
  theme: ThemeMode
  setEditorMode: (mode: EditorMode) => void
  setTheme: (theme: ThemeMode) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      editorMode: 'preview',
      theme: 'system',
      setEditorMode: (mode) => set({ editorMode: mode }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'inkview-ui',
      partialize: (state) => ({
        theme: state.theme,
        editorMode: state.editorMode,
      }),
    }
  )
)

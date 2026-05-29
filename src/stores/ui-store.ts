import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EditorMode, ThemeMode } from '../types'

interface UiStore {
  sidebarOpen: boolean
  editorMode: EditorMode
  theme: ThemeMode
  searchQuery: string
  selectedDocs: Set<string>
  selectionMode: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setEditorMode: (mode: EditorMode) => void
  setTheme: (theme: ThemeMode) => void
  setSearchQuery: (query: string) => void
  toggleDocSelection: (id: string) => void
  selectAllDocs: (ids: string[]) => void
  clearSelection: () => void
  setSelectionMode: (mode: boolean) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      editorMode: 'preview',
      theme: 'system',
      searchQuery: '',
      selectedDocs: new Set<string>(),
      selectionMode: false,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setEditorMode: (mode) => set({ editorMode: mode }),

      setTheme: (theme) => set({ theme }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      toggleDocSelection: (id) =>
        set((s) => {
          const next = new Set(s.selectedDocs)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return { selectedDocs: next, selectionMode: next.size > 0 }
        }),

      selectAllDocs: (ids) =>
        set({ selectedDocs: new Set(ids), selectionMode: true }),

      clearSelection: () =>
        set({ selectedDocs: new Set<string>(), selectionMode: false }),

      setSelectionMode: (mode) =>
        set({
          selectionMode: mode,
          selectedDocs: mode ? get().selectedDocs : new Set<string>(),
        }),
    }),
    {
      name: 'inkview-ui',
      partialize: (state) => ({
        theme: state.theme,
        editorMode: state.editorMode,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)

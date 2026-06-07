# InkView

A modern Markdown viewer and editor built with React 19, TypeScript 6, Vite 8, and Tailwind CSS 4.

## Features

- **Three editing modes**: Edit (full-screen editor), Preview (rendered output), and Split (side-by-side)
- **Live Markdown rendering** with GFM tables, task lists, and GitHub-style alerts
- **Code syntax highlighting** via `react-syntax-highlighter` with dark/light Prism themes
- **Table of Contents** sidebar with auto-scroll tracking via IntersectionObserver
- **Document history** modal with search, bulk select/delete, and per-document deletion
- **Inline title editing** — click the document title in the navbar to rename
- **File import** — drag-and-drop or click to upload `.md` files
- **Dark/Light theme** with system preference support, solarized light + warm dark palette, anti-FOUC
- **Persistent state** — documents and theme saved to `localStorage`

## Tech Stack

| Tool | Version |
|------|---------|
| [React](https://react.dev/) | 19 |
| [TypeScript](https://www.typescriptlang.org/) | 6 |
| [Vite](https://vite.dev/) | 8 |
| [Tailwind CSS](https://tailwindcss.com/) | 4 (CSS-first config) |
| [Zustand](https://github.com/pmndrs/zustand) | 5 |
| [CodeMirror](https://codemirror.net/) | 6 |
| [react-markdown](https://github.com/remarkjs/react-markdown) | 10 |
| [Lucide](https://lucide.dev/) icons | — |
| Font: [Red Hat Display](https://fonts.google.com/specimen/Red+Hat+Display) | — |

## Getting Started

```bash
git clone https://github.com/henokase/inkview.git
cd inkview 

npm install
npm run dev
```

Open the URL shown in terminal (default `http://localhost:3000

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── App.tsx              # Main layout, routing between modes, split divider, modals
├── main.tsx             # Entry point
├── index.css            # Tailwind v4 theme tokens, dark overrides, base styles
├── components/
│   ├── NavBar.tsx        # Responsive navigation bar with inline title editing
│   ├── MarkdownEditor.tsx # CodeMirror 6 editor
│   ├── MarkdownRenderer.tsx # react-markdown with GFM, alerts, syntax highlight
│   ├── TocSidebar.tsx     # Table of contents with active heading tracking
│   ├── ThemeToggle.tsx    # Moon/Sun theme switcher
│   ├── HistoryModal.tsx   # Portal-based document history modal
│   ├── NewDocModal.tsx    # Portal-based new document modal
│   ├── ConfirmModal.tsx   # Delete confirmation dialog
│   └── FileDropZone.tsx   # Drag-and-drop file upload
├── stores/
│   ├── document-store.ts  # Zustand store for documents (CRUD, persist)
│   └── ui-store.ts        # Zustand store for UI state (theme, editor mode)
├── lib/
│   ├── use-theme.ts       # Theme management hook
│   ├── use-active-heading.ts # IntersectionObserver for TOC
│   ├── use-keyboard.ts    # Keyboard shortcut hook
│   └── toc.ts             # Heading extraction utilities
└── types/
    └── index.ts           # Shared TypeScript types
```

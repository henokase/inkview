# InkView

A modern Markdown document editor with an integrated AI agent.

## Features

### Editing

- **Three modes** — Edit (fullscreen editor), Preview (rendered output), Split (side-by-side with draggable divider)
- **CodeMirror 6 editor** with GitHub theme, Markdown language support, and inline diff decorations
- **Live rendering** — GFM tables, task lists, GitHub-style alerts, KaTeX math, and Mermaid diagrams
- **Code syntax highlighting** via `react-syntax-highlighter` with Prism themes
- **Table of Contents** sidebar with active-heading tracking via IntersectionObserver
- **Selection toolbar** — select text in preview to ask AI about it

### Document Management

- **Folders** — organise documents into named folders
- **History modal** — search, bulk select/delete, per-document management
- **Inline title editing** — click the document title in the navbar to rename
- **File import** — drag-and-drop or click to upload `.md` files (single or batch)
- **Document sharing** — generate share links (15-day expiry via Upstash Redis)

### AI Agent

- **Chat panel** — resizable sidebar with per-document conversation history
- **Agentic tool loop** — the AI can read, create, edit, write, search, and delete documents across multiple turns
- **Built-in tools** — `read-doc`, `create-doc`, `edit-doc`, `write-doc`, `delete-doc`, `list-docs`, `search-docs`, `web-search`, `web-fetch`
- **Permission system** — agent actions are governed by configurable allow/deny/ask rules
- **Pending-changes review** — edits are deferred into a diff viewer; you approve or reject before they are applied
- **Streaming responses** — SSE proxy for token-by-token output from OpenRouter-compatible LLMs
- **MCP search** — web search via Exa or Parallel MCP endpoints

### Offline & PWA

- **IndexedDB persistence** — documents, folders, conversations, and messages stored via Dexie
- **localStorage migration** — legacy data is automatically migrated on first load
- **Service worker** — auto-updating PWA with asset and font caching (`vite-plugin-pwa`)

### Theme

- **Dark / Light** with system-preference detection
- **Solarized palette** — warm light and cool dark oklch tokens defined in CSS
- **Anti-FOUC** — inline script in `index.html` applies the stored theme before React hydrates

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| UI | [React](https://react.dev/) | 19 |
| Language | [TypeScript](https://www.typescriptlang.org/) | 6 |
| Bundler | [Vite](https://vite.dev/) | 8 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) | 4 (CSS-first config) |
| State | [Zustand](https://github.com/pmndrs/zustand) | 5 |
| Editor | [CodeMirror](https://codemirror.net/) 6 via `@uiw/react-codemirror` | — |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) 10, `remark-gfm`, `remark-math`, `rehype-katex` | — |
| Math | [KaTeX](https://katex.org/) | 0.17 |
| Diagrams | [Mermaid](https://mermaid.js.org/) | 11 |
| Storage | [Dexie](https://dexie.org/) (IndexedDB) | 4 |
| Sharing | [Upstash Redis](https://upstash.com/) | — |
| Icons | [Lucide](https://lucide.dev/) React | — |
| Font | [Red Hat Display](https://fonts.google.com/specimen/Red+Hat+Display) | — |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | 1 |

## Getting Started

```bash
git clone https://github.com/henokase/inkview.git
cd inkview
npm install
npm run dev
```

Open the URL shown in the terminal (default `http://localhost:3000`).

### Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
VITE_AI_API_KEY=sk-or-v1-your-openrouter-api-key
VITE_AI_BASE_URL=https://openrouter.ai/api/v1
VITE_AI_MODEL=openrouter/model
```

| Variable | Description |
|----------|-------------|
| `VITE_AI_API_KEY` | API key for the LLM provider (OpenRouter default) |
| `VITE_AI_BASE_URL` | Base URL for chat completions (`/chat/completions` is appended) |
| `VITE_AI_MODEL` | Model identifier sent in requests |

For deployment, the same variables are read server-side as `AI_API_KEY` and `VITE_AI_BASE_URL`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 3000) |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Project Structure

```
├── api/                          # Vercel serverless functions
│   ├── ai.ts                     #   AI proxy (OpenRouter streaming)
│   ├── search.ts                 #   MCP search proxy (Exa / Parallel)
│   ├── fetch.ts                  #   Web fetch proxy
│   └── share.ts                  #   Document sharing via Upstash Redis
├── src/
│   ├── App.tsx                   # Main layout, mode routing, split divider, modals
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Tailwind v4 theme tokens (oklch), dark overrides
│   ├── components/
│   │   ├── NavBar.tsx            #   Responsive nav with inline title editing
│   │   ├── MarkdownEditor.tsx    #   CodeMirror 6 editor wrapper
│   │   ├── MarkdownRenderer.tsx  #   react-markdown with GFM, math, alerts
│   │   ├── TocSidebar.tsx        #   Table of contents with active tracking
│   │   ├── ChatPanel.tsx         #   Resizable AI chat sidebar
│   │   ├── ChatInput.tsx         #   Chat message input
│   │   ├── ChatMessages.tsx      #   Chat message list
│   │   ├── ConversationList.tsx  #   Conversation history list
│   │   ├── DiffEditor.tsx        #   CodeMirror diff for pending changes
│   │   ├── SelectionToolbar.tsx  #   Floating toolbar on text selection
│   │   ├── PendingChangesBanner.tsx  # Banner for pending agent edits
│   │   ├── ToolCallCard.tsx      #   Agent tool-call display
│   │   ├── ToolResultCard.tsx    #   Agent tool-result display
│   │   ├── ThinkingView.tsx      #   Agent thinking indicator
│   │   ├── MermaidDiagram.tsx    #   Mermaid diagram renderer
│   │   ├── HistoryModal.tsx      #   Document history modal
│   │   ├── NewDocModal.tsx       #   New document modal
│   │   ├── ConfirmModal.tsx      #   Confirmation dialog
│   │   ├── ShareButton.tsx       #   Document sharing button
│   │   ├── ThemeToggle.tsx       #   Moon/Sun theme switcher
│   │   ├── FileDropZone.tsx      #   Drag-and-drop file upload
│   │   ├── Toast.tsx             #   Toast notifications
│   │   └── Notice.tsx            #   Feature notices
│   ├── stores/
│   │   ├── document-store.ts     #   Documents & folders (CRUD, persist to IndexedDB)
│   │   ├── ui-store.ts           #   Theme, editor mode
│   │   ├── chat-store.ts         #   Conversations, messages, streaming, agent loop
│   │   ├── agent-store.ts        #   Agent info, tool calls, permission queue
│   │   └── pending-changes-store.ts  # Pending agent edits with LCS diff
│   ├── lib/
│   │   ├── agent/
│   │   │   ├── agent-engine.ts   #   Agentic tool-use loop
│   │   │   ├── tool-registry.ts  #   Tool registration & permission filtering
│   │   │   ├── permission.ts     #   Permission evaluation logic
│   │   │   ├── prompts.ts        #   Agent prompt construction
│   │   │   ├── types.ts          #   Agent type definitions
│   │   │   └── tools/            #   Tool implementations (read, write, edit, search, …)
│   │   ├── llm/
│   │   │   ├── client.ts         #   HTTP client for chat completions
│   │   │   ├── stream-engine.ts  #   SSE stream parser
│   │   │   ├── errors.ts         #   LLM error types
│   │   │   └── types.ts          #   API message / chunk types
│   │   ├── codemirror/           #   CodeMirror extensions & themes
│   │   ├── diff/                 #   Diff utilities for pending changes
│   │   ├── db.ts                 #   Dexie schema, migrations, CRUD helpers
│   │   ├── share.ts              #   Share URL parsing & content fetching
│   │   ├── toc.ts                #   Heading extraction utilities
│   │   ├── mcp-client.ts         #   MCP client for external search providers
│   │   ├── use-theme.ts          #   Theme management hook
│   │   ├── use-active-heading.ts #   IntersectionObserver for TOC
│   │   ├── use-keyboard.ts       #   Keyboard shortcut hook
│   │   └── use-hide-on-scroll.ts #   Auto-hide navbar on scroll
│   ├── prompts/
│   │   ├── index.ts              #   System prompt builder
│   │   ├── system/               #   System prompt fragments
│   │   └── tools/                #   Tool definition prompts
│   └── types/
│       └── index.ts              #   Shared TypeScript types
├── middleware.ts                  # Vercel Edge middleware (AI proxy rewrite)
├── vite-plugin-sse-proxy.ts      # Vite dev-server SSE proxy plugin
├── vite.config.ts                # Vite config (React, Tailwind, PWA, SSE proxy)
├── vercel.json                   # Vercel rewrites & SPA fallback
├── eslint.config.js              # ESLint flat config
└── tsconfig.json                 # TypeScript project references
```

## Deployment

The project is configured for [Vercel](https://vercel.com/) with:

- **Serverless functions** in `api/` for AI proxy, search proxy, web fetch, and document sharing
- **SPA fallback** via rewrites in `vercel.json`
- **PWA** with service worker generated by `vite-plugin-pwa`

Deploy with:

```bash
npx vercel
```

Set the environment variables (`AI_API_KEY`, `VITE_AI_BASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) in your Vercel project dashboard.

## License

This project is licensed under the [MIT License](LICENSE).

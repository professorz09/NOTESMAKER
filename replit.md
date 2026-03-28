# AI Book Writer (Professor UPSC)

A React 19 + TypeScript + Vite 6 SPA using the Google Gemini API to generate structured notes, UPSC answers, research papers, AI-enhanced tables, and AI images (Imagen 4). Includes Supabase-backed project/history management.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite 6
- **CSS**: Tailwind CSS v4 (via `@tailwindcss/postcss`) — compiled, not CDN
- **AI Text**: Google Gemini API via `@google/genai` — models: `gemini-3.1-pro-preview` (main), `gemini-3-flash-preview` (fast edits)
- **AI Image**: Imagen 4 REST API — models: `imagen-4.0-fast-generate-001`, `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`
- **Storage**: Supabase (projects table) with localStorage fallback
- **UI Icons**: lucide-react
- **Port**: 5000 (dev server)

## Project Structure

```
src/
  App.tsx                   - Thin orchestrator; glues hooks + JSX only
  index.tsx                 - Entry point (imports index.css)
  index.css                 - Tailwind v4 CSS entry
  types.ts                  - TypeScript types (GenerationStatus, ImageStyle, ImageAspectRatio, ImageModelId)

  hooks/
    useHistory.ts           - History state (entries + index as one object), pushToHistory, resetHistory
    useEditorContent.ts     - Editor state, DOM sync, autosave, font size, keyboard shortcuts
    useGeneration.ts        - AI generation inputs + handleGenerate/Table/Image/ClearCanvas; image state
    useAIEdit.ts            - AI edit trigger buttons, section/selection rewrite modal, handleRewriteSubmit
    useProjects.ts          - Supabase + localStorage project CRUD; auto-save with debounce

  utils/
    editorUtils.ts          - STORAGE_KEY const, getSectionNodes(), buildPrintHtml()

  components/
    Button.tsx              - Reusable button component
    RewriteModal.tsx        - Modal for AI rewrites
    Sidebar.tsx             - Sidebar: output style selector (notes/upsc/research/table/image),
                              image config UI (style/aspect ratio/model), generation controls
    Toolbar.tsx             - Toolbar (undo/redo, edit, export)
    ProjectsPanel.tsx       - Claude-style history sidebar (Today/Yesterday/This Week/Earlier)

  services/
    ai.ts                   - All Gemini + Imagen API functions (generateContent, generateImage, etc.)

index.html                  - HTML entry point (styles, fonts, favicon)
vite.config.ts              - Vite configuration (port 5000, allowedHosts: true)
postcss.config.js           - PostCSS config for Tailwind v4
```

## Key Design Decisions

- **`useHistory`**: Uses a single `{ entries, index }` state object to avoid nested-setState stale closure bugs.
- **`useEditorContent`**: Accepts `pushToHistory` from `useHistory` as a parameter. Owns `editorRef`, `isResettingRef`, `generatedHtml`, `isEditing`, `fontSize`.
- **`useGeneration`**: Accepts `pushToHistory`, `isResettingRef`, `setGeneratedHtml`, `resetHistory`, `setIsEditing`, `setSidebarOpen` as params.
- **`useAIEdit`**: Accepts the editor's shared refs and helpers as params. Manages the full AI edit trigger + rewrite modal lifecycle.
- **Undo/Redo** are tiny (3 lines each) and kept in `App.tsx` because they need both `history`/`historyIndex` (from `useHistory`) and `setGeneratedHtml` (from `useEditorContent`).

## Environment Variables

- `GEMINI_API_KEY` — Required. Your Google Gemini API key (set in Secrets panel).

## Development

```bash
npm install
npm run dev
```

Dev server runs on port 5000 with `host: '0.0.0.0'` and `allowedHosts: true` for Replit proxy compatibility.

## Deployment

Configured as a static site:
- Build: `npm run build`
- Public dir: `dist`

## Bug Fixes Applied

1. **Tailwind CDN → PostCSS**: Replaced CDN script with properly compiled Tailwind v4 via `@tailwindcss/postcss`.
2. **Removed unused importmap**: Dead code in `index.html`.
3. **Fixed `pushToHistory` stale closure**: Combined history+index into a single state object.
4. **Fixed `handleSectionEdit` stale closure**: `useCallback` with correct deps in `useAIEdit`.
5. **Fixed `handleEditorClick` dependency**: `handleSectionEdit` correctly listed as dep.
6. **Moved `getSectionNodes` to `utils/editorUtils.ts`**: Pure function, no component dependency.
7. **Removed unused types**: Cleaned `types.ts` of unused enum values.
8. **Added favicon**: Inline SVG emoji favicon.

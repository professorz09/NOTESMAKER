# AI Book Writer (Professor UPSC)

A React + Vite frontend application that uses the Google Gemini API to generate structured notes, UPSC answers, research papers, and AI-enhanced book content.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite 6
- **CSS**: Tailwind CSS v4 (via `@tailwindcss/postcss`) — compiled, not CDN
- **AI**: Google Gemini API via `@google/genai`
- **UI Icons**: lucide-react
- **Port**: 5000 (dev server)

## Project Structure

```
src/
  App.tsx                   - Thin orchestrator (~220 lines); glues hooks + JSX only
  index.tsx                 - Entry point (imports index.css)
  index.css                 - Tailwind v4 CSS entry
  types.ts                  - TypeScript types (GenerationStatus enum)

  hooks/
    useHistory.ts           - History state (entries + index as one object), pushToHistory, resetHistory
    useEditorContent.ts     - Editor state, DOM sync, autosave, font size, keyboard shortcuts
    useGeneration.ts        - AI generation inputs + handleGenerate/Table/DetailedTable/ClearCanvas
    useAIEdit.ts            - AI edit trigger buttons, section/selection rewrite modal, handleRewriteSubmit

  utils/
    editorUtils.ts          - STORAGE_KEY const, getSectionNodes(), buildPrintHtml()

  components/
    Button.tsx              - Reusable button component
    RewriteModal.tsx        - Modal for AI rewrites
    Sidebar.tsx             - Sidebar with generation controls
    Toolbar.tsx             - Toolbar (undo/redo, edit, export)

  services/
    ai.ts                   - All Gemini API functions

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

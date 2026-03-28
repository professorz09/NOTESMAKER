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
  App.tsx            - Main application component
  index.tsx          - Entry point (imports index.css)
  index.css          - Tailwind v4 CSS entry
  types.ts           - TypeScript types (GenerationStatus enum)
  components/
    Button.tsx       - Reusable button component
    RewriteModal.tsx - Modal for AI rewrites
    Sidebar.tsx      - Sidebar with generation controls
    Toolbar.tsx      - Toolbar (undo/redo, edit, export)
  services/
    ai.ts            - All Gemini API functions
index.html           - HTML entry point (styles, fonts)
vite.config.ts       - Vite configuration
postcss.config.js    - PostCSS config for Tailwind v4
```

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

1. **Tailwind CDN → PostCSS**: Replaced CDN script with properly compiled Tailwind v4 via `@tailwindcss/postcss`. No more production CDN warnings.
2. **Removed unused importmap**: The `<script type="importmap">` in `index.html` was dead code — Vite bundles all imports.
3. **Fixed `pushToHistory` stale closure**: Used functional state updates so both `setHistory` and `setHistoryIndex` always read current state, preventing history corruption on fast edits.
4. **Fixed `handleSectionEdit` stale closure**: Wrapped in `useCallback` and moved before the click-handler `useEffect`, ensuring AI edit triggers always use the latest content reference.
5. **Fixed `handleEditorClick` dependency array**: Added `handleSectionEdit` as a dependency so the event listener is properly refreshed when the function changes.
6. **Moved `getSectionNodes` outside component**: Pure function with no state dependencies — moving it outside prevents needless re-creation on every render.
7. **Removed unused types**: Cleaned `types.ts` of `BookMetadata`, `ChapterOutline`, `ChapterContent`, `GENERATING_OUTLINE`, and `ERROR` enum values that were never used.
8. **Added favicon**: Inline SVG emoji favicon to fix the 404 console error.

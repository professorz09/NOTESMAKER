# AI Book Writer

A React + Vite frontend application that uses the Google Gemini API to help users write and generate book content.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite 6
- **AI**: Google Gemini API via `@google/genai`
- **UI Components**: lucide-react icons
- **Port**: 5000 (dev server)

## Project Structure

```
src/
  App.tsx            - Main application component
  index.tsx          - Entry point
  types.ts           - TypeScript types
  components/
    Button.tsx       - Reusable button component
    RewriteModal.tsx - Modal for rewriting content
    Sidebar.tsx      - Sidebar navigation
    Toolbar.tsx      - Toolbar actions
  services/
    ai.ts            - Gemini API service functions
index.html           - HTML entry point
vite.config.ts       - Vite configuration
```

## Environment Variables

- `GEMINI_API_KEY` - Required. Your Google Gemini API key. Set this in the Secrets panel.

## Development

```bash
npm install
npm run dev
```

The dev server runs on port 5000 with `0.0.0.0` host and `allowedHosts: true` for Replit proxy compatibility.

## Deployment

Configured as a static site deployment:
- Build: `npm run build`
- Public dir: `dist`

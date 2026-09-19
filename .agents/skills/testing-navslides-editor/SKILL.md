---
name: testing-navslides-editor
description: How to run and manually test the NavSlidesEditor app locally (dev servers, dashboard, file-import dialogs, seed state).
---

# Testing NavSlidesEditor locally

## Dev environment

- MUST export Node first, or npm hooks fail with `npx: not found`:
  `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`
- `npm run dev` from repo root starts BOTH servers concurrently:
  - Vite client at http://localhost:5173 (UI under test)
  - Express API at http://localhost:3002 (REST + Socket.IO)
- Verify readiness: `curl -s localhost:5173` → 200; `curl -s localhost:3002/api/presentations` → JSON array.
- Vite proxies `/api`, `/uploads`, `/vendor`, `/ws` to 3002 automatically — no CORS/auth needed.

## Data state

- File-based storage in `server/data/` — starts empty (no presentations/templates/trash). The home
  dashboard then shows a welcome empty-state ("Create your first presentation"). Data created during
  testing persists across restarts; delete `server/data/` contents to reset.
- Marketplace templates are served locally from `server/data/built-in-templates.json` — no network needed.

## Dashboard specifics

- Home page: `/` — header (search, theme toggle via `data-theme` attr + localStorage `editor-theme`,
  Settings → `/settings`, New). Sidebar view switcher: Recent / All Presentations / Built-in /
  My Templates / Marketplace / Trash; Import section has 4 hidden file inputs triggered by
  ref-clicks: PPTX, PDF, Markdown, Project (.navslides/.json).
- Testids: `home-new-presentation-btn`, `home-import-pptx-btn`, `home-import-pptx-input`,
  `home-import-markdown-btn`, `home-import-markdown-input`.
- File imports open a GTK file dialog: use Ctrl+L to type an absolute path, then Enter.
- Markdown import is fully client-side (split on `\n---\n` or `## ` headings), then
  `api.createPresentation` → opens `/editor/:id`. PPTX import is a server job (upload → SSE progress).
- Delete flow: card trash icon → "Move to Trash" confirm dialog (variant warning → button reads
  **Confirm**); Trash view offers Restore / Delete permanently / Empty Trash (variant danger →
  button reads **Delete**). Duplicate names the copy `"<title> (copy)"`.
- At <768px the sidebar collapses to a horizontal scrollable strip on top.

## Known quirks (pre-existing, not bugs to flag on refactors)

- Editor shows a product-tour overlay ("Welcome to NavSlidesEditor!") on each editor mount;
  "Skip Tour" may not respond to clicks — navigate via URL bar to leave the editor.
- Console shows highlight.js warnings `Could not find the language 'asm'` when viewing decks with
  unrecognized code blocks — harmless.

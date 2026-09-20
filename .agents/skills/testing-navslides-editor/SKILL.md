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
  fixed on master — Escape and Skip Tour now dismiss it. If on an old branch, navigate via URL
  bar to leave the editor. Clear `localStorage.navSlidesTutorialSeen` + reload to re-trigger it.
- Console shows highlight.js warnings `Could not find the language 'asm'` when viewing decks with
  unrecognized code blocks — harmless.

## Browser/automation specifics

- Launch Chrome with `--remote-debugging-port=<port>` or `browser_console`/CDP won't connect;
  add `--disable-popup-blocking` when testing blob-URL exports (File→Export PDF opens
  `window.open(blob:)`) — otherwise they silently fail and look like dead buttons.
- Tool→DOM coordinate mapping on this box (1024×768 tool space, maximized window):
  `DOM_x = tool_x × 1.5`, `DOM_y = tool_y × 1.5 − 93.5` (browser chrome offset).
  Verify against a known-good target (e.g. File button DOM center ~(445,23) ↔ tool (297,78)).
- `browser_console` quirks: scripts with `var`/`;`-separated statements or top-level Promises
  return `undefined`/fail — use single bare expressions; React state reads (e.g. `aria-expanded`)
  must be done in a SEPARATE call after the triggering action since updates are async.
- Ribbon chevron dropdowns (`RibbonDropdownMenuGroup`, e.g. Insert→Advanced "More advanced
  insert options" → Games gallery) toggle on `mousedown`/`Enter` on the FOCUSED trigger —
  synthetic `.click()` does NOT work. Reliable path: `el.focus()` in console, then press Enter,
  then click menu items (which also fire on mousedown).
- Navigating decks: use Ctrl+L + type URL (clicking the omnibox can race with open menus).

## Server-side rasterization dependency (PPTX export)

- Export PPTX rasterizes latex/html/game/QR elements via headless Chromium
  (`server/utils/server-raster.js`). Requires `npx playwright install chromium` matching the
  installed playwright version (`~/.cache/ms-playwright/chromium_headless_shell-<build>`);
  a missing/mismatched build fails the whole export with the opaque "PPTX element
  rasterization failed" — check server log for the real reason (it prints the fix command).
- `validateRasterTargetIds` hard-fails export when ANY raster-target element lacks an `id`;
  legacy decks with pre-PR-#32 id-less game elements are permanently un-exportable
  (heal path: export project → import). Minimal repro: fresh deck + Insert→Games element
  exports fine on master.

### Reading live element state via React fiber (browser_console)

Canvas elements expose aria-labels like `text element` / `game element` / `qrcode element` — but never the element `id` in the DOM. To verify ids/state without instrumenting React, walk `__reactFiber*` upward until a node whose `memoizedProps.element` exists:

```js
;(function () {
  const els = [
    ...document.querySelectorAll('div[aria-label$="element"],div[aria-label*=" element,"]'),
  ]
  const out = []
  els.forEach((e) => {
    const k = Object.keys(e).find((k) => k.startsWith('__reactFiber'))
    let n = e[k],
      el = null
    for (let i = 0; i < 10 && n; i++) {
      if (n.memoizedProps && n.memoizedProps.element) {
        el = n.memoizedProps.element
        break
      }
      n = n.return
    }
    if (el) out.push(el.type + ':' + el.id)
  })
  return out.join(' ;; ')
})()
```

The canvas wrapper div carries `element` in its props (~1-3 hops up). This is the reliable way to confirm migration/heal fixes that change element fields invisible in the DOM — pair with `node -e` reads of `server/data/presentations.json` for the persisted side.

### Omnibox history trap

Ctrl+L + typing `localhost:5173/editor/<id>` can autocomplete to a _different_ previously-visited path containing the same id (e.g. `/api/presentations/<id>/present` from an earlier Present test) when you hit Enter. Always type the full `http://localhost:5173/editor/<id>` URL, or verify the final URL after navigation.

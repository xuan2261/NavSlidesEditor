# NavSlides Editor

[![CI](https://github.com/xuan2261/NavSlidesEditor/actions/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml/badge.svg?branch=master)](https://github.com/xuan2261/NavSlidesEditor/actions/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml)

A self-hostable WYSIWYG presentation editor powered by [reveal.js](https://revealjs.com/). Build, present, and broadcast slides in the browser — no account, no cloud, no tracking. Also available as a standalone desktop app via Electron.

Current release: **v1.9.6** — Upstream parity evidence, animation UI refinements, and release docs refreshed.

## Features

### Editing

- **WYSIWYG editing** — click and type directly on slides with TipTap rich text
- **Tab-based ribbon UI** — Home / Insert / Design / Transitions / Animations / View / Format tabs replace the old toolbar/menu system; active tab persists across sessions (`Ctrl+Alt+R` toggles)
- **Rich formatting** — headings, bold/italic/underline/strikethrough, text color, highlight, font family, font size, font weight, line height, alignment, lists, tables, code blocks, links, images, inline math
- **Multi-select** — shift-click to select multiple elements, move or delete them together
- **Group / ungroup** — group multiple elements so they select, move, and resize as a unit (`Ctrl+G` / `Ctrl+Shift+G`)
- **Align & distribute** — align selected elements left/center/right/top/middle/bottom, or distribute evenly
- **Element rotation** — rotate any element by dragging the rotation handle or entering a degree value (`Shift` snaps to 15°)
- **Smart guides & snapping** — alignment lines appear when dragging near other elements' edges or the canvas center; toggle with the magnet icon
- **Rulers & guides** — toggle pixel rulers on the top/left edges; drag from a ruler onto the canvas to place persistent guide lines; double-click a guide to remove it
- **Element controls** — resize, reposition, lock, z-order, drop shadow, aspect-ratio lock (`Shift` while resizing)
- **Round corners** — adjustable border radius on images and code blocks
- **Find & replace** — `Ctrl+F` to search text across all slides with case-sensitive matching, navigate matches, replace one or all
- **Undo / redo** — `Ctrl+Z` / `Ctrl+Y` with 50-step bounded history
- **Clipboard** — `Ctrl+C/X/V` and `Ctrl+D` to copy/cut/paste/duplicate elements
- **Auto-save** — debounced saves every 1.5 s with last-saved timestamp; visible failure status with `Retry` action
- **Command palette** — `Ctrl+K` for quick command lookup
- **Touch gestures** — tap, double-tap, long-press, swipe, and 2-finger pinch zoom for tablets and trackpads
- **Translucent presenter UI** — floating tools and slide navigation dim to 15% opacity when idle
- **Interactive onboarding** — step-by-step product tour via React-Joyride
- **Copy URL** — right-click images/videos to copy their resolved media URL

### Element Types

19 element types: text (TipTap rich text), image (upload/URL, crop, filters, round corners), shape (rectangle, circle, triangle, arrow, star), code (10 themes, 25+ languages), LaTeX / TikZ (KaTeX + TikZJax), HTML embeds, Markdown, Chart.js charts (bar, line, pie, doughnut, radar, polar area), video / audio (with start/end trim, playback speed), table (drag-resize, inline editing), QR code, icon (60+ Lucide icons), callout, drawing, line, SVG, timeline, and **game** (7 interactive game types). The Insert ribbon shows ~27 actions because shapes (rectangle, circle, triangle, arrow, star) and games (7 variants) expose sub-variants from a single element type. The 19 canonical types are listed in `client/src/data/element-defaults.js`.

### Slides

8 layouts (blank, title, two-column, three-column, image+text, section header, comparison, big number) + 20+ full-deck templates including interactive simulations and quiz decks. Per-slide backgrounds (solid, gradient, image), fragment animations with visual timeline editor and preview modal, per-slide page numbers, hidden slides, footer system (basic / sequence modes), and global presentation settings (auto-slide, loop, navigation modes).

### Live Presentation

Broadcast to viewers via Socket.IO with a server-issued presenter token. Includes a separate **speaker view** (notes, next-slide preview, timer), **remote control** from a phone or second device, **annotation tools** (pen, laser pointer, highlighter, eraser) that sync to viewers in real time and persist per slide on rejoin, **black/white screen overlays** (`B` / `W`), shared **live timer**, and PowerPoint-style navigation (`F5`, `Home`, `End`, arrows).

### Game Mode

7 interactive game element types with a dedicated player join page (`/player/:slideId/:elementId`), game-specific socket handler, leaderboard, scoring, and presenter shortcuts (HUD, timer, reveal, leaderboard, pause, team select).

### AI Tools

AI copywriter (rewrite slide text), AI generator (full presentation drafts from a prompt), AI translate (translate slide content), and a media library with Unsplash and Giphy search.

### Themes & Templates

11 reveal.js themes (black, white, league, beige, sky, night, serif, simple, solarized, moon, dracula), 6 transitions (none, fade, slide, convex, concave, zoom), 6 preset design themes (Minimal Dark, Minimal Light, Academic, Gradient, Corporate, Neon), custom user templates, and a dark/light editor theme toggle.

### Export & Sharing

Present mode (reveal.js, press `S` for speaker notes), export HTML (CDN-backed), export offline HTML (inlined runtime assets), export PDF (one page per slide with expanded fragments), export PPTX (hybrid: editable primitives + Playwright-rasterized fallback for unsupported elements), shareable links with optional password, GitHub push with auto-generated README, Markdown import, project export/import (`.navslides` archive with manifest v1.1).

### Cloud Sync

rclone-based sync to Proton Drive or any rclone-supported provider (Google Drive, S3, etc.). Configure credentials in-app; sync a single presentation or all at once. Docker image ships with rclone preinstalled.

### Version History

Named snapshots saved per presentation, restore any previous version, delete individual snapshots.

---

## Installation

### Option A — Desktop App (Electron)

Run as a native desktop app (no server, no Docker). Download pre-built Windows packages from [Releases](https://github.com/xuan2261/NavSlidesEditor/releases). The current GitHub release workflow publishes Windows artifacts automatically; Linux/macOS packages can still be built locally with the scripts below (requires **Node.js 20+**):

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git && cd NavSlidesEditor && npm install
npm run electron:build:linux   # → .AppImage + .deb
npm run electron:build:mac     # → .zip
npm run electron:build:win     # → .exe
npm run electron:dev           # dev mode (no package)
```

Data stored at: Linux `~/.config/NavSlides Editor/`, macOS `~/Library/Application Support/NavSlides Editor/`, Windows `%APPDATA%/NavSlides Editor/`.

### Option B — Docker (recommended for servers)

Requires Docker 20.10+ and Docker Compose v2+.

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git && cd NavSlidesEditor
docker compose up -d
```

Opens at `http://localhost:3002`. Use `docker compose logs -f`, `docker compose down`, `docker compose up -d --build` to rebuild. Edit `docker-compose.yml` port mapping for a custom port.

### Option C — Node.js from source

Requires **Node.js 20+** and npm 8+.

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git && cd NavSlidesEditor && npm install
npm run dev          # Vite dev (5173) + Express API (3002) concurrently
npm run build && npm start   # production: builds React, serves on port 3002
PORT=8080 npm start  # custom port
```

## Data & Persistence

All data lives in `server/data/` (presentations, templates, share tokens, GitHub config, settings, analytics, media metadata, history snapshots, rclone config) and `server/uploads/` (media). Docker uses named volumes `revealjs-data` and `revealjs-uploads`. All locations are created automatically on first run.

---

## Security Model

NavSlides Editor is designed as a single-user, self-hosted presentation tool where rich programmable content is a core feature. HTML embeds, custom CSS, inline SVG, Markdown-generated HTML, and exported reveal.js HTML are treated as **trusted author content**.

Code reviews and security scans should not flag trusted author-controlled HTML/CSS/JS execution as a blocking XSS issue by itself. This behavior is intentional because the editor must support interactive embeds, simulations, diagrams, and custom presentation styling.

Still review issues that cross a trust boundary, including:

- untrusted uploads or imported files executing outside the author's intent
- public share links exposing admin/editor capabilities
- stored content from one user/session affecting another user
- credential leakage, path traversal, SSRF, command injection, or data loss
- missing auth protections when deploying beyond local/private single-user use

For internet-facing or multi-user deployments, place NavSlides Editor behind an external authentication layer and treat all shared/editable content as privileged.

---

## Save to GitHub

1. Create a [fine-grained PAT](https://github.com/settings/personal-access-tokens/new) with repository contents read/write.
2. Click **GitHub** in the editor, enter owner, repo name, and token → **Save Settings**.
3. Click **Push to GitHub** (optionally with a commit message).

Output structure:
```
my-repo/
├── README.md                          ← auto-generated
├── my_first_talk/
│   ├── presentation.html              ← viewable in browser
│   └── presentation.json              ← full project data
└── another_presentation/
```

---

## Cloud Sync (rclone)

Sync via in-app Sync button. Configure Proton Drive (or any rclone provider) credentials, then use **Sync This Presentation** or **Sync All**. Docker includes rclone; for the desktop app, install rclone separately.

Files are exported as HTML + JSON and uploaded via rclone. The Docker image includes rclone pre-installed. For the desktop app, install rclone separately on your system.

---

## Reverse Proxy (optional)

**Nginx:**

```nginx
server {
    listen 443 ssl;
    server_name slides.example.com;

    ssl_certificate     /etc/letsencrypt/live/slides.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/slides.example.com/privkey.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass         http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

**Caddy:**

```
slides.example.com {
    reverse_proxy localhost:3002
}
```

---

## Keyboard Shortcuts

### Editor

| Shortcut                       | Action                                |
| ------------------------------ | ------------------------------------- |
| `Ctrl+Z`                       | Undo                                  |
| `Ctrl+Y` / `Ctrl+Shift+Z`      | Redo                                  |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / cut / paste element            |
| `Ctrl+D`                       | Duplicate element                     |
| `Ctrl+F`                       | Find & replace                        |
| `Ctrl+K`                       | Command palette                       |
| `Ctrl+M`                       | Insert new slide                      |
| `Ctrl+G` / `Ctrl+Shift+G`      | Group / ungroup elements              |
| `Ctrl+]` / `Ctrl+[`            | Bring forward / send backward         |
| `Ctrl+0` / `Ctrl++` / `Ctrl+-` | Zoom fit / zoom in / zoom out         |
| `Tab` / `Shift+Tab`            | Cycle through elements                |
| `Delete` / `Backspace`         | Delete selected element(s)            |
| `Escape`                       | Deselect / stop editing / close panel |
| `Shift+drag`                   | Maintain aspect ratio while resizing  |
| `Shift+rotate`                 | Snap rotation to 15-degree increments |
| `Ctrl+Alt+R`                   | Toggle ribbon panel                   |

### Presentation Mode

| Shortcut                     | Action                                  |
| ---------------------------- | --------------------------------------- |
| `F5` / `Shift+F5`            | Start presentation / from current slide |
| `Arrow Left` / `Arrow Right` | Previous / next slide                   |
| `Home` / `End`               | First / last slide                      |
| `B` / `W`                    | Black / white screen overlay            |
| `Escape`                     | End presentation                        |
| `S`                          | Open speaker notes view                 |
| `Ctrl+P`                     | Pen annotation                          |
| `Ctrl+I`                     | Highlighter                             |
| `Y`                          | Laser pointer                           |
| `E`                          | Eraser                                  |

### Game Mode (presenter)

| Shortcut  | Action              |
| --------- | ------------------- |
| `G`       | Toggle HUD          |
| `Space`   | Start / pause timer |
| `Enter`   | Next phase          |
| `R`       | Reveal answer       |
| `L`       | Show leaderboard    |
| `P`       | Pause game          |
| `+` / `-` | Adjust timer        |
| `1`–`4`   | Select team         |

---

## Requirements

| Method       | Requirement                                        |
| ------------ | -------------------------------------------------- |
| Desktop app  | Node.js 20+ (build only)                           |
| Docker       | Docker 20.10+ and Docker Compose v2+               |
| Node.js      | Node.js 20+ and npm 8+                             |
| Load Testing | [k6](https://k6.io/docs/get-started/installation/) |

---

## Testing & Performance

Verification typically runs in this order:

1. Lint and build:
   ```bash
   npm run lint
   npm run build
   ```
2. Unit tests:
   ```bash
   npm run test
   ```
3. Browser tests:
   ```bash
   npm run test:e2e
   ```
4. PPTX corpus check:
   ```bash
   npm run test:corpus
   ```
5. Load tests with `k6`:
   ```bash
   npm run test:load:api
   npm run test:load:ws
   ```

Install `k6` from the official guide if you want to run the load suite locally.

### E2E conventions

- Use `testPresentation` from `tests/e2e/fixtures/test-fixtures.js` for presentation create/cleanup.
- Prefer `data-testid` selectors for editor controls, canvas handles, and repeated UI; keep page objects in `tests/e2e/pages/` using kebab-case filenames.
- Use state-based waits: `expect.poll`, locator assertions with timeouts, and `waitForResponse`. Do not add `waitForTimeout`.
- Reuse helper modules such as `tests/e2e/pages/wait-helpers.js` instead of duplicating timing logic.

---

## Tech Stack

| Layer                | Technology                                    |
| -------------------- | --------------------------------------------- |
| Frontend             | React 18, Vite 5, React Router 7              |
| State management     | Zustand (3 stores: editor, presentation, UI)  |
| Rich text editor     | TipTap 2                                      |
| Presentation engine  | reveal.js 5                                   |
| Math rendering       | KaTeX                                         |
| Diagrams             | TikZJax                                       |
| Charts               | Chart.js 4                                    |
| Syntax highlighting  | highlight.js                                  |
| Markdown             | Built-in converter + marked.js (export)       |
| Icons                | Lucide (editor UI) + inline SVG (slide icons) |
| PowerPoint export    | pptxgenjs + Playwright raster fallback        |
| PowerPoint import    | pptxtojson with pptx2json fallback            |
| Backend              | Node.js 20+, Express 4                        |
| Real-time transport  | Socket.IO                                     |
| Desktop app          | Electron 33                                   |
| Cloud sync           | rclone                                        |
| Validation           | Zod (mutation endpoints)                      |
| Testing              | Vitest, Playwright, k6                        |
| Linting & Formatting | ESLint 9 (flat config), Prettier              |
| Storage              | JSON files + local filesystem                 |

---

## License

NavSlides Editor is licensed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE).

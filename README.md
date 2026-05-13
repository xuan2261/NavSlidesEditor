# NavSlides Editor

A self-hostable WYSIWYG presentation editor powered by [reveal.js](https://revealjs.com/). Build and present slides in the browser — no account, no cloud, no tracking. Also available as a standalone desktop app via Electron.

## Features

### Editing

- **WYSIWYG editing** — click and type directly on slides with TipTap rich text
- **Rich formatting** — headings, bold/italic/underline/strikethrough, text color, text highlighting, font family, font size, alignment, lists, tables, code blocks, links, images
- **Multi-select** — shift-click to select multiple elements, move or delete them together
- **Group / ungroup** — group multiple elements so they select, move, and resize as a unit
- **Align & distribute** — align selected elements left/center/right/top/middle/bottom, or distribute evenly
- **Element rotation** — rotate any element by dragging the rotation handle or entering a degree value
- **Smart guides & snapping** — alignment lines appear when dragging near other elements' edges or the canvas center; toggle with the magnet icon
- **Rulers & guides** — toggle pixel rulers on the top/left edges; drag from a ruler onto the canvas to place persistent guide lines; double-click a guide to remove it
- **Element controls** — resize, reposition, lock, z-order, drop shadow, aspect-ratio lock (hold Shift while resizing)
- **Round corners** — adjustable border radius on images and code blocks
- **Find & replace** — Ctrl+F to search text across all slides with case-sensitive matching, navigate between matches, replace one or all
- **Undo / redo** — Ctrl+Z / Ctrl+Y with 50-step history
- **Clipboard** — Ctrl+C/X/V and Ctrl+D to copy/cut/paste/duplicate elements
- **Auto-save** — debounced saves every 1.5 s with last-saved timestamp display
- **Translucent Presenter UI** — floating tools and slide navigation dim to 15% opacity when idle to minimize distraction during presentations
- **Interactive Onboarding** — comprehensive step-by-step product tour using React-Joyride to guide new users

### Element Types

17 element types: text (TipTap rich text), image (upload/URL, crop, filters, round corners), shape (16 shapes), code (10 themes, 25+ languages), LaTeX / TikZ (KaTeX + TikZJax), HTML embeds, Markdown, Chart.js charts, video / audio, table (drag-resize, inline editing), QR code, icon (60+ Lucide icons), callout, drawing, line, SVG.

### Slides

8 layouts (blank, title, two-column, three-column, image+text, section header, comparison, big number) + 20+ full-deck templates. Per-slide backgrounds (solid, gradient, image), fragment animations with visual timeline, per-slide page numbers, hidden slides, footer system (basic / sequence modes).

### Footer System

- **Basic mode** — section label on the left, page number on the right
- **Sequence mode** — define section titles (e.g., Intro / Methods / Results / Discussion) that display evenly spaced at the bottom; the active section appears bold, others appear faded; customizable active and inactive colors
- **Footer styling** — configurable font family, size, active color, and inactive color

### Themes & Templates

11 reveal.js themes (black, white, league, beige, sky, night, serif, simple, solarized, moon, dracula), 6 transitions, 6 preset design themes, custom templates, and dark/light editor theme toggle.

### Export & Sharing

Present mode (reveal.js, press `S` for speaker notes), export HTML (CDN-backed or fully offline), export PDF, export PPTX (hybrid native + raster), shareable links (with optional password), GitHub push with auto-generated README, Markdown import, rclone cloud sync to Proton Drive or any supported provider.

### Cloud Sync

rclone-based sync to Proton Drive or any supported cloud provider (Google Drive, S3, etc.). Configure credentials in-app; sync single presentation or all at once.

### Version History

- **Named snapshots** — save named versions of your presentation at any point
- **Restore** — restore any previous snapshot, overwriting the current state
- **Delete** — remove individual snapshots

---

## Installation

### Option A — Desktop App (Electron)

Run as a native desktop app (no server, no Docker). Download pre-built packages from [Releases](https://github.com/Xuan2261/navslides-editor/releases). The current GitHub release workflow publishes a Windows artifact automatically; Linux/macOS packages can still be built locally with the scripts below (requires **Node.js 20+**):

```bash
git clone https://github.com/Xuan2261/navslides-editor.git && cd navslides-editor && npm install
npm run electron:build:linux   # → .AppImage + .deb
npm run electron:build:mac     # → .zip
npm run electron:build:win     # → .exe
npm run electron:dev           # dev mode (no package)
```

Data stored at: Linux `~/.config/NavSlides Editor/`, macOS `~/Library/Application Support/NavSlides Editor/`, Windows `%APPDATA%/NavSlides Editor/`.

### Option B — Docker (recommended for servers)

Requires Docker 20.10+ and Docker Compose v2+.

```bash
git clone https://github.com/Xuan2261/navslides-editor.git && cd navslides-editor
docker compose up -d
```

Opens at `http://localhost:3002`. Use `docker compose logs -f`, `docker compose down`, `docker compose up -d --build` to rebuild. Edit `docker-compose.yml` port mapping for a custom port.

### Option C — Node.js from source

Requires **Node.js 20+** and npm 8+.

```bash
git clone https://github.com/Xuan2261/navslides-editor.git && cd navslides-editor && npm install
npm run dev          # Vite dev (5173) + Express API (3002) concurrently
npm run build && npm start   # production: builds React, serves on port 3002
PORT=8080 npm start  # custom port
```

## Data & Persistence

All data lives in `server/data/` (presentations, templates, share tokens, GitHub config, history snapshots) and `server/uploads/` (media). Docker uses named volumes `revealjs-data` and `revealjs-uploads`. All locations are created automatically on first run.

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

| Shortcut                  | Action                                |
| ------------------------- | ------------------------------------- |
| `Ctrl+Z`                  | Undo                                  |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo                                  |
| `Ctrl+C`                  | Copy element                          |
| `Ctrl+X`                  | Cut element                           |
| `Ctrl+V`                  | Paste element                         |
| `Ctrl+D`                  | Duplicate element                     |
| `Ctrl+F`                  | Find & replace                        |
| `Delete` / `Backspace`    | Delete selected element(s)            |
| `Escape`                  | Deselect / stop editing / close panel |
| `Shift+drag`              | Maintain aspect ratio while resizing  |
| `Shift+rotate`            | Snap rotation to 15-degree increments |
| `S` (in presentation)     | Open speaker notes view               |

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

---

## Tech Stack

| Layer                | Technology                                    |
| -------------------- | --------------------------------------------- |
| Frontend             | React 18, Vite 5                              |
| Rich text editor     | TipTap 2                                      |
| Presentation engine  | reveal.js 5                                   |
| Math rendering       | KaTeX                                         |
| Diagrams             | TikZJax                                       |
| Charts               | Chart.js 4                                    |
| Syntax highlighting  | highlight.js                                  |
| Markdown             | Built-in converter + marked.js (export)       |
| Icons                | Lucide (editor UI) + inline SVG (slide icons) |
| PowerPoint export    | pptxgenjs                                     |
| Backend              | Node.js, Express 4                            |
| Desktop app          | Electron                                      |
| Cloud sync           | rclone                                        |
| Testing              | Vitest, Playwright, k6                        |
| Linting & Formatting | ESLint, Prettier                              |
| Storage              | JSON files + local filesystem                 |

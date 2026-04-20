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

### Element Types

- **Text boxes** — rich HTML content with full TipTap formatting
- **Images** — upload or URL, crop, pan, brightness/contrast/grayscale filters, round corners
- **Shapes** — rectangle, circle, triangle, arrow, star, line with fill/stroke/opacity/corner radius
- **Code blocks** — syntax-highlighted code with 10 themes and 25+ languages, round corners
- **LaTeX / TikZ** — full LaTeX math blocks and TikZ diagrams rendered via KaTeX and TikZJax, with a split-pane editor showing live preview
- **Inline math** — inline and display KaTeX math within text elements
- **HTML embeds** — arbitrary HTML/CSS/JS or D3 visualizations in iframes
- **Markdown blocks** — write raw Markdown that renders as formatted content
- **Charts** — bar, line, pie, doughnut, radar, and polar area charts via Chart.js with editable data
- **Video / audio** — embed media files via URL or upload with playback controls, autoplay, loop, and muted options
- **Tables** — first-class drag/resize table elements with header row, inline cell editing, and style controls
- **Icons** — searchable library of 60+ Lucide-style SVG icons with color and stroke customization
- **Callout bubbles** — numbered annotation circles with customizable color and size

### Slides

- **Slide templates** — blank, title, two-column, three-column, image+text, section header, comparison, big number
- **Slide backgrounds** — solid color, CSS gradient, or image per slide via toolbar popup
- **Fragment animations** — per-element appear animations with visual timeline editor for sequencing
- **Per-slide page numbers** — toggle page numbers on/off per slide; skipped slides don't count in numbering
- **Hidden slides** — mark slides as hidden to skip during presentation

### Footer System

- **Basic mode** — section label on the left, page number on the right
- **Sequence mode** — define section titles (e.g., Intro / Methods / Results / Discussion) that display evenly spaced at the bottom; the active section appears bold, others appear faded; customizable active and inactive colors
- **Footer styling** — configurable font family, size, active color, and inactive color

### Themes & Templates

- **11 reveal.js themes** — black, white, league, beige, sky, night, serif, simple, solarized, moon, dracula
- **Transitions** — none, fade, slide, convex, concave, zoom
- **Preset themes** — 6 built-in design presets: Minimal Dark, Minimal Light, Academic, Gradient, Corporate, Neon
- **Custom templates** — create, edit, and manage your own reusable presentation templates; start new presentations from any template
- **Dark / light editor theme** — toggle the editor UI between dark and light mode

### Export & Sharing

- **Present mode** — full-screen reveal.js presentation with speaker notes (press `S`)
- **Export HTML** — download as a self-contained HTML file
- **Export offline HTML** — inlines all CDN resources (Reveal.js, KaTeX, highlight.js) and correctly resolves local iframes/plugins so the file works entirely without internet
- **Export PDF** — print-ready layout with one page per slide, fragment states expanded, with improved iframe initialization for embeds
- **Export PPTX** — generate a PowerPoint file for sharing with non-technical users
- **Shareable links** — generate public URLs to view presentations without the editor; toggle on/off per presentation
- **GitHub integration** — push presentations directly to a GitHub repo with auto-generated README

### Cloud Sync

- **Proton Drive sync** — sync presentations to Proton Drive via rclone; configure credentials in-app, sync individual presentations or all at once
- **Configurable remote** — works with any rclone-supported cloud provider (Proton Drive, Google Drive, S3, etc.)

### Version History

- **Named snapshots** — save named versions of your presentation at any point
- **Restore** — restore any previous snapshot, overwriting the current state
- **Delete** — remove individual snapshots

---

## Installation

### Option A — Desktop App (Electron)

Run NavSlides Editor as a native desktop application. No server, no Docker, no browser needed.

#### Pre-built packages

Download from the [Releases](https://github.com/jbirky/revealjs_gui/releases) page:

| Platform | Format                                                  |
| -------- | ------------------------------------------------------- |
| Linux    | `.AppImage` (run directly) or `.deb` (install via dpkg) |
| macOS    | `.zip` (extract and open the `.app`)                    |
| Windows  | `.exe` installer or portable `.exe`                     |

**Linux `.deb` install:**

```bash
sudo dpkg -i revealjs-editor_1.0.0_amd64.deb
```

**Linux `.AppImage`:**

```bash
chmod +x Slides\ Editor-1.0.0.AppImage
./Slides\ Editor-1.0.0.AppImage
```

#### Build from source

Requires **Node.js 18+**.

```bash
git clone https://github.com/jbirky/revealjs_gui.git
cd revealjs_gui
npm install
```

Build for your platform:

```bash
npm run electron:build:linux   # → .AppImage + .deb
npm run electron:build:mac     # → .zip (extract for .app)
npm run electron:build:win     # → .exe installer + portable
```

Output goes to `dist-electron/`.

Or run in dev mode without building a package:

```bash
npm run electron:dev
```

#### Data location

The desktop app stores data in your OS app data folder:

| Platform | Path                                           |
| -------- | ---------------------------------------------- |
| Linux    | `~/.config/NavSlides Editor/`                     |
| macOS    | `~/Library/Application Support/NavSlides Editor/` |
| Windows  | `%APPDATA%/NavSlides Editor/`                     |

---

### Option B — Docker (recommended for servers)

Requires [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/).

#### 1. Clone the repository

```bash
git clone https://github.com/jbirky/revealjs_gui.git
cd revealjs_gui
```

#### 2. Start with Docker Compose

```bash
docker compose up -d
```

This will:

- Build the React frontend and bundle it with the Express server
- Install rclone for cloud sync support
- Start the container on port **3002**
- Create two named Docker volumes to persist your data across restarts:
  - `revealjs-data` — presentation data, templates, share tokens, version history
  - `revealjs-uploads` — uploaded images, videos, and audio files

Open `http://localhost:3002` in your browser.

#### Useful commands

```bash
# View logs
docker compose logs -f

# Stop the container
docker compose down

# Rebuild after pulling new source changes
docker compose up -d --build

# Remove containers AND volumes (deletes all presentations and uploads)
docker compose down -v
```

#### Run on a custom port

Edit `docker-compose.yml` and change the host port (left side of the mapping):

```yaml
ports:
  - '8080:3002' # now accessible at http://localhost:8080
```

---

### Option C — Node.js / npm from source

Requires **Node.js 18+** and npm 8+.

#### 1. Clone the repository

```bash
git clone https://github.com/jbirky/revealjs_gui.git
cd revealjs_gui
```

#### 2. Install dependencies

```bash
npm install
```

#### 3a. Development mode

Runs the Vite dev server and the Express API server concurrently with hot-reload:

```bash
npm run dev
```

| Service               | URL                   |
| --------------------- | --------------------- |
| Frontend (Vite)       | http://localhost:5173 |
| Backend (Express API) | http://localhost:3002 |

Open `http://localhost:5173`. The Vite dev server proxies `/api` and `/uploads` to the Express server automatically.

#### 3b. Production mode

Build the frontend, then serve everything from the Express server on a single port:

```bash
npm run build   # compiles React → client/dist/
npm start       # serves client/dist/ + API on port 3002
```

Open `http://localhost:3002`.

#### Run on a custom port

```bash
PORT=8080 npm start
```

---

## Data & Persistence

| Path                             | Contents                                 |
| -------------------------------- | ---------------------------------------- |
| `server/data/presentations.json` | All presentation data                    |
| `server/data/templates.json`     | Custom presentation templates            |
| `server/data/share-tokens.json`  | Shareable link tokens                    |
| `server/data/github-config.json` | GitHub integration credentials           |
| `server/data/history/`           | Version history snapshots                |
| `server/uploads/`                | Uploaded images, videos, and audio files |

All locations are created automatically on first run. Back them up to preserve your work.

**Docker:** data lives in named volumes (`revealjs-data`, `revealjs-uploads`). To back up:

```bash
# Copy presentations JSON out of the volume
docker run --rm \
  -v revealjs-data:/data \
  -v $(pwd):/backup \
  alpine cp /data/presentations.json /backup/presentations.json
```

---

## Save to GitHub

Push presentations directly to a GitHub repository from the editor.

### 1. Create a GitHub Personal Access Token

Go to **GitHub → Settings → Developer settings → [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new)** and create a token with:

| Setting                    | Value                                                  |
| -------------------------- | ------------------------------------------------------ |
| **Repository access**      | **Only select repositories** → select your target repo |
| **Permissions → Contents** | **Read and write**                                     |

### 2. Create a target repository

Create a new repo on GitHub (e.g. `presentations`). It can be empty.

### 3. Configure in the editor

1. Open any presentation and click the **GitHub** button.
2. Enter your GitHub username as **Repository Owner**.
3. Enter the repository name.
4. Paste your token and click **Save Settings**.

### 4. Push a presentation

Click **GitHub** → optionally enter a commit message → **Push to GitHub**.

```
my-repo/
├── README.md                          ← auto-generated with links
├── my_first_talk/
│   ├── presentation.html              ← viewable in browser
│   └── presentation.json              ← full project data
└── another_presentation/
    ├── presentation.html
    └── presentation.json
```

---

## Cloud Sync (Proton Drive)

Sync presentations to Proton Drive or any rclone-supported cloud provider.

1. Click the **Sync** button in the editor header.
2. Enter your Proton Drive username and password.
3. Click **Connect** to verify the connection.
4. Use **Sync This Presentation** or **Sync All** to upload.

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

| Method      | Requirement                          |
| ----------- | ------------------------------------ |
| Desktop app | Node.js 18+ (build only)             |
| Docker      | Docker 20.10+ and Docker Compose v2+ |
| Node.js     | Node.js 18+ and npm 8+               |
| Load Testing| [k6](https://k6.io/docs/get-started/installation/) |

---

## Testing & Performance

This project uses `k6` for load testing to simulate high traffic on the REST API and WebSockets.

1. Install k6 on your system ([Installation Guide](https://k6.io/docs/get-started/installation/)).
2. Make sure your server is running (`npm run dev` or `npm start`).
3. Run the API load test (HTTP POST with large JSON payloads):
   ```bash
   npm run test:load:api
   ```
4. Run the WebSocket load test (Socket.IO Engine.IO handshake and real-time events):
   ```bash
   npm run test:load:ws
   ```

---

## Tech Stack

| Layer               | Technology                                    |
| ------------------- | --------------------------------------------- |
| Frontend            | React 18, Vite 5                              |
| Rich text editor    | TipTap 2                                      |
| Presentation engine | reveal.js 5                                   |
| Math rendering      | KaTeX                                         |
| Diagrams            | TikZJax                                       |
| Charts              | Chart.js 4                                    |
| Syntax highlighting | highlight.js                                  |
| Markdown            | Built-in converter + marked.js (export)       |
| Icons               | Lucide (editor UI) + inline SVG (slide icons) |
| PowerPoint export   | pptxgenjs                                     |
| Backend             | Node.js, Express 4                            |
| Desktop app         | Electron                                      |
| Cloud sync          | rclone                                        |
| Storage             | JSON files + local filesystem                 |

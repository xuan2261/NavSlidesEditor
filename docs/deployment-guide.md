# Deployment Guide — NavSlides Editor

## Deployment Options

| Method               | Best For                        | Requirements                      |
| -------------------- | ------------------------------- | --------------------------------- |
| Docker (recommended) | Server / VPS                    | Docker 20.10+, Docker Compose v2+ |
| Node.js from source  | Development, lightweight server | Node.js 20+, npm 8+               |
| Electron desktop     | Single-user desktop app         | Node.js 20+ (build only)          |

---

## Docker (Recommended)

### Quick Start

```bash
git clone https://github.com/Xuan2261/navslides-editor.git
cd navslides-editor
docker compose up -d
```

Open `http://localhost:3002`.

The container:

- Builds React frontend and bundles it with the Express server
- Installs rclone for cloud sync support
- Creates two named volumes for persistence:
  - `revealjs-data` — presentations, templates, share tokens, version history
  - `revealjs-uploads` — uploaded images, videos, audio

### docker-compose.yml

```yaml
services:
  revealjs-editor:
    build: .
    ports:
      - '3002:3002'
    volumes:
      - revealjs-data:/app/server/data
      - revealjs-uploads:/app/server/uploads
    restart: unless-stopped

volumes:
  revealjs-data:
  revealjs-uploads:
```

### Custom Port

Edit `docker-compose.yml`, change the host port (left side):

```yaml
ports:
  - '8080:3002' # accessible at http://localhost:8080
```

### Common Commands

```bash
# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after source changes
docker compose up -d --build

# Remove containers AND volumes (deletes all data)
docker compose down -v
```

### Dockerfile Summary

Multi-stage build (confirmed at `Dockerfile` in root):

1. **Builder stage** — uses Node 20 Alpine, installs all deps, runs `npm run vendor` + `npm run build` (compiles React → `client/dist/`)
2. **Production stage** — uses `mcr.microsoft.com/playwright:v1.59.1-noble` so server-side PPTX element rasterization has Chromium available, installs only server prod deps, copies `server/` + `client/dist/` + `server/vendor/`, and installs rclone via `apt`

Final image runs: `node server/index.js`

---

## Node.js from Source

### Development Mode

Runs Vite dev server + Express API concurrently with hot-reload:

```bash
git clone https://github.com/Xuan2261/navslides-editor.git
cd navslides-editor
npm install
npm run dev
```

| Service           | URL                   |
| ----------------- | --------------------- |
| Frontend (Vite)   | http://localhost:5173 |
| Backend (Express) | http://localhost:3002 |

Open `http://localhost:5173`. Vite proxies `/api` and `/uploads` to Express automatically.

### Production Mode

```bash
npm run build    # compiles React → client/dist/
npm start        # serves client/dist/ + API on port 3002
```

Open `http://localhost:3002`.

### Custom Port

```bash
PORT=8080 npm start
```

---

## Electron Desktop

### Pre-built Packages

Download from the [Releases](https://github.com/Xuan2261/navslides-editor/releases) page:

| Platform | Format                              |
| -------- | ----------------------------------- |
| Linux    | `.AppImage` or `.deb`               |
| macOS    | `.zip` (extract → `.app`)           |
| Windows  | `.exe` installer or portable `.exe` |

```bash
# Linux .deb
sudo dpkg -i revealjs-editor_1.0.0_amd64.deb

# Linux AppImage
chmod +x "NavSlides Editor-1.0.0.AppImage"
./"NavSlides Editor-1.0.0.AppImage"
```

### Build from Source

```bash
npm install

npm run electron:build:linux   # → dist-electron/ (.AppImage + .deb)
npm run electron:build:mac     # → dist-electron/ (.zip)
npm run electron:build:win     # → dist-electron/ (.exe installer + portable)
```

Dev mode (no package):

```bash
npm run electron:dev
```

### Data Location

| Platform | Path                                              |
| -------- | ------------------------------------------------- |
| Linux    | `~/.config/NavSlides Editor/`                     |
| macOS    | `~/Library/Application Support/NavSlides Editor/` |
| Windows  | `%APPDATA%/NavSlides Editor/`                     |

Electron sets `SLIDES_DATA_DIR` and `SLIDES_UPLOADS_DIR` to subdirectories of `app.getPath('userData')` before starting the embedded Express server.

---

## Environment Variables

| Variable             | Default           | Purpose                                                            |
| -------------------- | ----------------- | ------------------------------------------------------------------ |
| `PORT`               | `3002`            | HTTP listen port                                                   |
| `SLIDES_DATA_DIR`    | `server/data/`    | Directory for JSON data files                                      |
| `SLIDES_UPLOADS_DIR` | `server/uploads/` | Directory for uploaded files                                       |
| `NODE_ENV`           | `development`     | Set to `production` to disable Vite proxy and serve `client/dist/` |
| `NAVSLIDES_CHROMIUM_PATH` | bundled Playwright Chromium | Optional custom Chromium executable for server-side PPTX element rasterization |
| `NAVSLIDES_PPTX_SCALE` | `2` | Screenshot scale used for PPTX HTML/LaTeX raster elements |

Set via shell, `.env` file (manually), or Docker environment config.

---

## Data Persistence

### File Paths (Node.js / Docker)

| Path                             | Contents                       |
| -------------------------------- | ------------------------------ |
| `server/data/presentations.json` | All presentation data          |
| `server/data/templates.json`     | Custom presentation templates  |
| `server/data/share-tokens.json`  | Shareable link tokens          |
| `server/data/github-config.json` | GitHub integration credentials |
| `server/data/rclone.conf`        | rclone configuration           |
| `server/data/history/`           | Version history snapshots      |
| `server/uploads/`                | Uploaded images, videos, audio |

All directories are created automatically on first run.

### Backup (Docker)

```bash
# Export presentations JSON from volume
docker run --rm \
  -v revealjs-data:/data \
  -v $(pwd):/backup \
  alpine cp /data/presentations.json /backup/presentations.json

# Export entire data directory
docker run --rm \
  -v revealjs-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/revealjs-data-backup.tar.gz /data
```

---

## Reverse Proxy

### Nginx

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

### Caddy

```
slides.example.com {
    reverse_proxy localhost:3002
}
```

Note: Set `client_max_body_size` (Nginx) or the equivalent to at least 100MB to match the server's upload limit.

---

## CI/CD

The repository includes a GitHub Actions workflow that builds the Windows Electron package on push/tag.

Current state:

- Windows build only (Linux and macOS targets planned — see `docs/project-roadmap.md` Phase D)
- 510 Vitest unit tests + 127 Playwright E2E tests verified before each push
- No automatic publish to GitHub Releases yet

To trigger a release build manually: push a tag matching `v*` (e.g. `v1.0.1`).

Test commands run locally:
```bash
npm run lint     # ESLint flat config
npm run test     # Vitest — 510 tests
npm run test:e2e # Playwright — 127 tests in 27 spec files
npm run build    # Vite production build
```

---

## E2E Visual Baseline

Visual regression uses Playwright built-in screenshots. Update baseline snapshots
only when intentional UI changes are reviewed:

```bash
npx playwright test tests/e2e/visual-regression.spec.js --update-snapshots
```

Current baseline file:

- `tests/e2e/visual-regression.spec.js-snapshots/editor-canvas-basic-chromium-win32.png`

---

## Security Notes

- The application has **no built-in authentication**. Do not expose port 3002 directly to the internet without a reverse proxy + auth layer (e.g., Nginx + HTTP Basic Auth, Authelia, Cloudflare Access).
- GitHub tokens are stored in plaintext in `github-config.json`. Restrict filesystem access accordingly.
- CORS is open (all origins). In a restricted environment, add a CORS origin list to `server/index.js`.

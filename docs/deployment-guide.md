# Deployment Guide — NavSlides Editor

## Deployment Options

| Method               | Best For                        | Requirements                      |
| -------------------- | ------------------------------- | --------------------------------- |
| Docker (recommended) | Server / VPS                    | Docker 20.10+, Docker Compose v2+ |
| Node.js from source  | Development, lightweight server | Node.js >=22.13.0, npm         |
| Electron desktop     | Single-user desktop app         | Node.js >=22.13.0 (build only) |

---

## Docker (Recommended)

### Quick Start

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git
cd NavSlidesEditor
docker compose up -d
```

Open `http://127.0.0.1:3002` by default. The container listens on
`0.0.0.0:3002` so Docker networking works, while the host publishes to
`127.0.0.1` unless `NAVSLIDES_PUBLISH_HOST` is set. Publishing on a non-loopback
host requires an external authentication layer and reverse proxy.

The container:

- Builds React frontend and bundles it with the Express server
- Installs rclone for cloud sync support
- Creates two named volumes for persistence:
  - `revealjs-data` — presentations, templates, share tokens, version history
  - `revealjs-uploads` — uploaded images, videos, audio

Set `NAVSLIDES_PUBLISH_HOST=0.0.0.0` only when the deployment's proxy/firewall
provides the required external authentication.

### docker-compose.yml

```yaml
services:
  revealjs-editor:
    build: .
    environment:
      NAVSLIDES_LISTEN_HOST: 0.0.0.0
      NAVSLIDES_PUBLISH_HOST: ${NAVSLIDES_PUBLISH_HOST:-127.0.0.1}
    ports:
      - '${NAVSLIDES_PUBLISH_HOST:-127.0.0.1}:3002:3002'
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

1. **Builder stage** — pins Node.js 22.22.0 on Debian Bookworm Slim, installs the workspace lockfile without lifecycle scripts, then runs vendor publication and the client build.
2. **Production stage** — pins the same Node.js 22.22.0 image, installs rclone and the lock-derived server runtime dependency set, installs Playwright Chromium, copies the built client and published vendor assets, then verifies runtime closure.

The final command re-runs runtime-closure verification before `node server/index.js`.

---

## Node.js from Source

### Development Mode

Runs Vite dev server + Express API concurrently with hot-reload:

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git
cd NavSlidesEditor
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

On Windows PowerShell, use `$env:PORT=8080; npm start` or run the command inside Git Bash / WSL.

---

## Electron Desktop

### Pre-built Packages

Download Windows packages from the [Releases](https://github.com/xuan2261/NavSlidesEditor/releases) page. The current GitHub release workflow publishes Windows packages only; Linux and macOS packages can be built locally from source.

| Platform | Format                              |
| -------- | ----------------------------------- |
| Windows  | `.exe` installer or portable `.exe` |
| Linux    | local build: `.AppImage` or `.deb`  |
| macOS    | local build: `.zip`                 |

```bash
# Linux .deb
sudo dpkg -i "NavSlides Editor_<version>_amd64.deb"

# Linux AppImage
chmod +x "NavSlides Editor-<version>.AppImage"
./"NavSlides Editor-<version>.AppImage"
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

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3002` | HTTP listen port |
| `NAVSLIDES_LISTEN_HOST` | `127.0.0.1` | Server bind host; Docker sets `0.0.0.0` inside the container |
| `NAVSLIDES_PUBLISH_HOST` | `127.0.0.1` | Docker host-side publish address; changing it does not provide authentication |
| `SLIDES_DATA_DIR` | `server/data/` | Directory for JSON data files |
| `SLIDES_UPLOADS_DIR` | `server/uploads/` | Directory for uploaded files |
| `NODE_ENV` | `development` | Set to `production` to disable Vite proxy and serve `client/dist/` |
| `NAVSLIDES_CHROMIUM_PATH` | bundled Playwright Chromium | Optional custom Chromium executable for server-side PPTX element rasterization |
| `NAVSLIDES_PPTX_SCALE` | `2` | Screenshot scale used for PPTX HTML/LaTeX raster elements |
| `PPTX_IMPORT_MEDIA_ORIGINS` | unset | Comma-separated exact `http(s)` origins permitted for external media referenced by PPTX imports; default policy blocks them |
| `PPTX_EMF_CONVERT` | unset | Set to `1` to request EMF/WMF conversion; conversion remains disabled otherwise |
| `PPTX_EMF_BINARY` | no policy-valid default | Absolute converter path, validated by the EMF/WMF policy |
| `PPTX_EMF_BINARY_ROOT` | unset | Absolute trusted root required by the EMF/WMF policy |
| `PPTX_EMF_BINARY_SHA256` | unset | SHA-256 pin required by the EMF/WMF policy |

Set via shell, `.env` file (manually), or Docker environment config.

### Local mutation ingress and reverse proxy

The server has no built-in user authentication. Keep browser mutation routes on
loopback by default, or put an external authentication layer in front of any
non-loopback deployment. The local ingress policy uses these exact-match
settings:

- `NAVSLIDES_LOCAL_ALLOWED_HOSTS` — comma-separated `host[:port]` values accepted
  for browser mutations. When unset, `localhost`, `127.0.0.1`, and `[::1]` are
  allowed.
- `NAVSLIDES_LOCAL_ALLOWED_ORIGINS` — optional comma-separated canonical
  `http(s)://host[:port]` origins. Paths, credentials, query strings, and
  fragments are rejected.
- `NAVSLIDES_TRUSTED_PROXY_ADDRESSES` — comma-separated proxy IP addresses.
  `X-Forwarded-Host` and `X-Forwarded-Proto` are honored only when the direct
  peer address is in this list; forwarded values are never trusted broadly.
- `NAVSLIDES_ALLOW_MISSING_ORIGIN` — missing `Origin` is allowed by default to
  preserve non-browser clients and existing integrations. Set it to `false`
  (`0`) for an exposed deployment that requires every mutation request to carry
  a same-origin `Origin` header.

An `Origin` header, when present, must match the effective request host and
protocol and any configured origin allowlist. These settings are a local
deployment/CSRF boundary, not authentication or tenant isolation.

`/api/analytics/:id` is an owner/editor route. It intentionally does not accept
a share token as authorization and returns `Cache-Control: no-store`; the
response redacts raw share tokens and full referrer URLs. An internet-facing
proxy must keep this route behind the same operator authentication as the
editor. If `/share/:token` is made public, do not exempt `/api/analytics` or
other editor APIs from authentication, and do not use a share-token query
parameter as a proxy bypass rule.

## PPTX Import Policy
Before package mapping, PPTX import validates ZIP structure, entry count, declared
uncompressed size, bounded streamed decompressed size, and each entry's CRC32.
CRC or resource-budget failures are fail-closed.

Parser-relative corpus metrics and browser layout audits are regression signals,
not native-complete or PowerPoint-fidelity claims. Release qualification uses
two additional fail-closed gates: the manifest-bound importer-native strict lane
(`npm run test:pptx:importer-qualification`) and the Microsoft PowerPoint visual
oracle described in [`pptx-visual-evidence-runbook.md`](pptx-visual-evidence-runbook.md).
Any blocked deck, missing evidence, or below-policy SSIM result blocks those
claims even when best-effort import remains usable.


### External media

External `http(s)` media references in an imported PPTX are blocked by default. To allow a controlled source, set `PPTX_IMPORT_MEDIA_ORIGINS` to comma-separated full origins (scheme, hostname, and optional port), not URLs with paths or credentials. Invalid entries and local/private URL forms are rejected by the importer. Use only origins you trust to serve presentation media. The policy owner is [`constants.js`](../server/services/pptx-import/constants.js); URL enforcement is in [`map-media.js`](../server/services/pptx-import/mapper/map-media.js).

### EMF/WMF conversion

EMF/WMF conversion is disabled unless `PPTX_EMF_CONVERT=1` and the remaining EMF policy settings validate. A policy-valid converter has an absolute path, sits below the configured absolute trusted root, and matches the configured SHA-256 pin; the accepted executable set is owned by [`emf-wmf-sandbox.js`](../server/services/pptx-import/emf-wmf-sandbox.js). The child runs without a shell and with a narrow environment, but these checks are not an OS or network sandbox.

### Job stream logging

PPTX admission returns a one-time per-job capability. Its plaintext handoff is memory-only; job state retains a verifier hash. Status and cancellation use a request header, but browser `EventSource` cannot set one, so the SSE route carries the capability in `?capability=`. Configure any reverse proxy to scrub or drop query strings from access logs for `/api/pptx/jobs/*/stream`. The route owner is [`pptx-import.js`](../server/routes/pptx-import.js).

---

## Data Persistence

### File Paths (Node.js / Docker)

| Path                             | Contents                       |
| -------------------------------- | ------------------------------ |
| `server/data/presentations.json` | All presentation data          |
| `server/data/templates.json`     | Custom presentation templates  |
| `server/data/share-tokens.json`  | Shareable link tokens          |
| `server/data/github-config.json` | GitHub integration credentials |
| `server/data/settings.json`      | Editor settings and AI API key |
| `server/data/analytics.json`     | Share-view analytics records    |
| `server/data/media.json`         | Uploaded media metadata        |
| `server/data/upload-hashes.json` | SHA256 dedup index for uploaded files |
| `server/data/rclone.conf`        | rclone configuration           |
| `server/data/history/`           | Version history snapshots      |
| `server/data/sync-export/`       | rclone export staging          |
| `server/data/tmp-pptx-imports/`  | Temporary PPTX import uploads  |
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

The repository includes GitHub Actions workflows for validation and Electron release.

### Required CI Jobs (blocking)

| Job | What it runs |
| --- | --- |
| `lint` | ESLint across all packages |
| `unit-coverage` | Vitest with coverage thresholds |
| `build` | `npm run build` (React → client/dist/) |
| `e2e-chromium` | Playwright E2E, 4 shards |
| `e2e-live` | Playwright live presentation flows |
| `e2e-mobile` | Playwright mobile / a11y |
| `e2e-visual` | Playwright visual regression |
| `pptx-corpus` | PPTX semantic fidelity + round-trip corpus |
| `load-smoke` | k6 REST + WebSocket load smoke |
| `required-checks` | Fan-in gate — all above must pass |

### Non-Required (warn-first)

| Job | What it runs |
| --- | --- |
| `feature-coverage-gate` | `npm run matrix:gate` + drift-check on committed matrix |

### Release

- `Build & Release Electron` builds the Windows Electron package and creates a GitHub Release asset when a `v*` tag is pushed or a manual dispatch is used.
- Linux and macOS Electron packages exist as local `electron-builder` scripts but are not part of the current release workflow.

Test commands run locally:
```bash
npm run lint
npm run test
npm run test:e2e
npm run build
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
- Public share capabilities authorize only their `/share/:token` presentation flow. They do not authorize `/api/analytics/:id`; keep analytics and editor APIs behind operator authentication.
- GitHub tokens are stored in plaintext in `github-config.json`. Restrict filesystem access accordingly.
- File-backed settings may contain sensitive values such as API keys or sync credentials. Do not commit or deploy those files publicly.
- CORS is open in development; production disables cross-origin requests by default. Add an explicit allowlist in `server/index.js` only for a trusted deployment boundary.
- PPTX import job capabilities and stream-log handling are documented in [PPTX Import Policy](#pptx-import-policy). Scrub or drop the SSE stream query string in proxy access logs.
- Uploaded SVG is sanitized on upload and at the serving boundary, including legacy files, and served with sandbox CSP, `nosniff`, and same-origin resource policy headers.

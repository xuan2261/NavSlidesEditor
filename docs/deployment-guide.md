# Deployment Guide — NavSlides Editor

## Deployment Options

| Method               | Best For                        | Requirements                      |
| -------------------- | ------------------------------- | --------------------------------- |
| Docker (recommended) | Server / VPS                    | Docker 20.10+, Docker Compose v2+ |
| Node.js from source  | Development, lightweight server | Node.js >=22.13.0, npm            |
| Electron desktop     | Single-user desktop app         | Node.js >=22.13.0 (build only)    |

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
- Runs as fixed unprivileged UID/GID `10001:10001`
- Uses `/health/ready` for Docker and Compose health
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
    user: '10001:10001'
    environment:
      NAVSLIDES_LISTEN_HOST: 0.0.0.0
      NAVSLIDES_PUBLISH_HOST: ${NAVSLIDES_PUBLISH_HOST:-127.0.0.1}
    ports:
      - '${NAVSLIDES_PUBLISH_HOST:-127.0.0.1}:3002:3002'
    volumes:
      - revealjs-data:/app/server/data
      - revealjs-uploads:/app/server/uploads
    healthcheck:
      test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3002/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 20s
      retries: 3
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

1. **Builder stage** — pins Node.js 22.23.3 on Debian Trixie Slim, installs the workspace lockfile without lifecycle scripts, publishes the Reveal.js 6.0.2 `dist/` tree plus other vendor assets, then builds the client.
2. **Production stage** — uses the same pinned base and installs the lock-derived server dependencies plus checksum-verified upstream rclone 1.75.1 packages for amd64/arm64. After Chromium installation it removes global npm/npx and smoke-checks Node, Playwright/Chromium, and rclone. Other rclone artifact architectures fail the build explicitly.

CI uses the separate `production-prebuilt` target. It downloads the single
manifest-bound client artifact for the exact subject SHA, verifies every byte,
and then assembles the image without recompiling the client. Normal local
`docker build .` keeps the source-build path.

Vendor publication records runtime versions and hashes in `server/vendor/vendor-manifest.json`. The final command and server prestart verification reject a missing required Reveal.js asset, a version other than 6.0.2, a hash mismatch, or a legacy `reveal.js/plugin/` tree before `node server/index.js` starts.

The final image creates both mount points for UID/GID `10001:10001` and never
falls back to root. Existing bind mounts or migrated named volumes must be made
writable by that identity before startup.

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

The desktop renderer runs sandboxed with context isolation, no Node integration or preload/IPC bridge. The application is served by its bundled loopback HTTP server; file exports use browser downloads and Blob URLs. Electron applies a desktop-only CSP to loopback responses (inline Reveal scripts/styles and local vendor assets are permitted, dynamic evaluation is not). Uploaded SVG keeps its separate, stricter sandbox CSP. Presentation popups stay inside the shell only for same-origin URLs; external HTTP(S) links open in the system browser.

To qualify an unpacked desktop build locally, run `npm run electron:prepare`, then `npm run electron:builder -- --win --dir --publish never` on Windows and verify `dist-electron/win-unpacked/resources` with `node scripts/verify-runtime-closure.js --root dist-electron/win-unpacked/resources --require-client-dist`. In the launched shell, F5 presents from the beginning, Shift+F5 presents from the selected slide, and confirmation dialogs are in-app rather than native blocking prompts.

### Data Location

| Platform | Path                                              |
| -------- | ------------------------------------------------- |
| Linux    | `~/.config/NavSlides Editor/`                     |
| macOS    | `~/Library/Application Support/NavSlides Editor/` |
| Windows  | `%APPDATA%/NavSlides Editor/`                     |

## Environment Variables

| Variable                    | Default                     | Purpose                                                                                                                     |
| --------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                      | `3002`                      | HTTP listen port                                                                                                            |
| `NAVSLIDES_LISTEN_HOST`     | `127.0.0.1`                 | Server bind host; Docker sets `0.0.0.0` inside the container                                                                |
| `NAVSLIDES_PUBLISH_HOST`    | `127.0.0.1`                 | Docker host-side publish address; changing it does not provide authentication                                               |
| `NAVSLIDES_WORKERS`         | `1`                         | Supported process count; values other than `1` fail with `UNSUPPORTED_MULTI_PROCESS_TOPOLOGY`                              |
| `SLIDES_DATA_DIR`           | `server/data/`              | Directory for JSON data files                                                                                               |
| `SLIDES_UPLOADS_DIR`        | `server/uploads/`           | Directory for uploaded files                                                                                                |
| `NODE_ENV`                  | `development`               | Set to `production` to disable Vite proxy and serve `client/dist/`                                                          |
| `NAVSLIDES_CHROMIUM_PATH`   | bundled Playwright Chromium | Optional custom Chromium executable for server-side PPTX element rasterization                                              |
| `NAVSLIDES_PPTX_SCALE`      | `2`                         | Screenshot scale used for PPTX HTML/LaTeX raster elements                                                                   |
| `PPTX_IMPORT_MEDIA_ORIGINS` | unset                       | Comma-separated exact `http(s)` origins permitted for external media referenced by PPTX imports; default policy blocks them |
| `PPTX_EMF_CONVERT`          | unset                       | Set to `1` to request EMF/WMF conversion; conversion remains disabled otherwise                                             |
| `PPTX_EMF_BINARY`           | no policy-valid default     | Absolute converter path, validated by the EMF/WMF policy                                                                    |
| `PPTX_EMF_BINARY_ROOT`      | unset                       | Absolute trusted root required by the EMF/WMF policy                                                                        |
| `PPTX_EMF_BINARY_SHA256`    | unset                       | SHA-256 pin required by the EMF/WMF policy                                                                                  |

Set via shell, `.env` file (manually), or Docker environment config.

### Health and supported topology

Health endpoints and HTTP mutation admission are owned by
[`server/index.js`](../server/index.js); the bounded response contract is owned by
[`health-state.js`](../server/services/health-state.js). Startup recovery and its
deadline/sticky degraded decision are owned by `recoverStartupState()` in
[`health-state-readiness.js`](../server/services/health-state-readiness.js).
Degraded readiness is not permission to discard uncertain intent: mutations must
remain blocked. Read/download paths still require their own valid authority;
liveness is not proof that every retained presentation can be opened.

Before readiness is decided, startup expires pending project-import admissions
through the existing session-lock and media-ownership recovery routine. Safe
expiration revokes admission and removes only proven session-owned staged media;
unreadable ledgers or uncertain upload ownership keep readiness and mutation
admission degraded. Do not sweep user uploads or retained winner media to clear
that decision. This is not destructive garbage collection or power-loss proof.

Only one NavSlides server process may use a deployment's persistent roots.
`NAVSLIDES_WORKERS`, `WEB_CONCURRENCY`, `PM2_INSTANCES`, `INSTANCE_COUNT`, and
`CLUSTER_WORKERS` must be unset or `1`; Node cluster workers are rejected.
Socket.IO rooms, import jobs, and file/package locks are process-local, so
horizontal scaling is unsupported.

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

Project import (`/api/project-imports/*`) is stricter than the general ingress
policy: it requires an `Origin` whose host equals the request `Host`, rejects
cross-site `Sec-Fetch-Site`, and rejects referers from share/live/remote/speaker/game
pages. A reverse proxy must preserve the client-facing `Host` header (as in the
Nginx example below). The policy owner is
[`project-import-origin.js`](../server/routes/project-import-origin.js).

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

| Path                             | Contents                              |
| -------------------------------- | ------------------------------------- |
| `server/data/presentations.json` | All presentation data                 |
| `server/data/templates.json`     | Custom presentation templates         |
| `server/data/share-tokens.json`  | Shareable link tokens                 |
| `server/data/github-config.json` | GitHub integration credentials        |
| `server/data/settings.json`      | Editor settings and AI API key        |
| `server/data/analytics.json`     | Share-view analytics records          |
| `server/data/media.json`         | Uploaded media metadata               |
| `server/data/upload-hashes.json` | SHA256 dedup index for uploaded files |
| `server/data/rclone.conf`        | rclone configuration                  |
| `server/data/history/`           | Version history snapshots             |
| `server/data/sync-export/`       | rclone export staging                 |
| `server/data/tmp-pptx-imports/`  | Temporary PPTX import uploads         |
| `server/uploads/`                | Uploaded images, videos, audio        |

All directories are created automatically on first run. On POSIX,
`share-tokens.json`, `github-config.json`, `settings.json`, `rclone.conf`, and
their atomic replacement candidates are created or tightened to owner-only
`0600`. Windows does not implement POSIX mode bits; use NTFS ACLs to restrict the
same files to the account running NavSlides. The application does not claim that
`chmod 0600` provides a Windows ACL guarantee.

### Durable recovery runbook

Use this route when readiness reports durable recovery uncertainty after an
interrupted import or when a session/media ownership ledger cannot be read.
Recovery must preserve evidence rather than make the service appear healthy.

1. Before repair, stop the affected application through its authorized operator
   and back up the **entire configured data and uploads roots together**, not
   just presentation JSON. Keep the retained package state, blobs, history,
   session/media ledgers and staging intents. Protect the copy like live data.
2. Inspect retained authority and the exact job/session/media intent before
   choosing a repair. The owners are
   [`package-store-runtime.js`](../server/services/pptx-import/package-store-runtime.js),
   [`project-import-media-session-store.js`](../server/services/project-import-media-session-store.js),
   [`project-import-media-session-recovery.js`](../server/services/project-import-media-session-recovery.js),
   and [`health-state-readiness.js`](../server/services/health-state-readiness.js).
   Package collection is an [audit-only owner](../server/services/pptx-import/package-store/collector.js),
   not authorization to delete an unreferenced-looking blob.
3. Repair only an evidenced prerequisite, then restart to retry the retained
   intent. Stop if package authority or media ownership remains ambiguous.
   **Never reset a corrupt ledger to an empty/default ledger, delete shared or
   winner media, or remove retained originals, snapshots or template blobs.**
   Do not introduce an unauthenticated repair endpoint, automatic destructive
   rollback or destructive garbage collection to clear readiness.
4. Exercise the backup in separate roots before touching the live copy. After
   restart, verify readiness and the presentation's authoritative head/job
   identity, immutable Original SHA-256 and referenced/shared media hashes;
   opening a list or receiving a healthy response alone is insufficient. The
   executable HTTP and copied-root verification owner is
   [`recovery-http-smoke.cjs`](../server/recovery-http-smoke.cjs), with startup
   regression coverage in
   [`index-project-recovery.test.js`](../server/index-project-recovery.test.js).

This runbook is an operator safety route, not permission to modify a user's
server or data. Obtain the applicable operational authorization first.

### Backup and Restore (Docker)

Backups contain credentials, share tokens, author content, package originals,
history, and media. Store them with the same care as the live volumes.

The executable owners are
[`backup-docker-volumes.ps1`](../scripts/backup-docker-volumes.ps1) and
[`restore-docker-volumes.ps1`](../scripts/restore-docker-volumes.ps1).
Their Docker procedure is separate from the source copied-root HTTP recovery
smoke. That smoke covers Windows process termination with a controlled importer,
not power-loss durability or native source lineage; neither procedure pointer
establishes Docker, Linux, Office or release qualification.

```powershell
# Captures pre-state, stops only a running service, archives both volumes,
# writes SHA-256 hashes to manifest.json, and restarts in finally.
npm run backup:docker -- -OutputDirectory .\backups\navslides-20260925

# Restore into a separate Compose project with new, empty volumes.
$env:COMPOSE_PROJECT_NAME = "navslides-restore-drill"
docker compose build
npm run restore:docker -- -BackupDirectory .\backups\navslides-20260925
```

Keep restore drills isolated from volumes containing data you need; remove the
drill only after verifying its result. Follow the script owners for archive and
basic restore checks, and the [durable recovery runbook](#durable-recovery-runbook)
for package-head, Original and media identity verification. Do not delete live
volumes or relax readiness to force a drill to pass.

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

| Job               | What it runs                               |
| ----------------- | ------------------------------------------ |
| `lint`            | ESLint across all packages                 |
| `unit-coverage`   | Vitest with coverage thresholds            |
| `build`           | `npm run build` (React → client/dist/)     |
| `e2e-chromium`    | Playwright E2E, 4 shards                   |
| `e2e-live`        | Playwright live presentation flows         |
| `e2e-mobile`      | Playwright mobile / a11y                   |
| `e2e-visual`      | Playwright visual regression               |
| `pptx-corpus`     | PPTX semantic fidelity + round-trip corpus |
| `load-smoke`      | k6 REST + WebSocket load smoke             |
| `required-checks` | Fan-in gate — all above must pass          |

### Non-Required (warn-first)

| Job                     | What it runs                                            |
| ----------------------- | ------------------------------------------------------- |
| `feature-coverage-gate` | `npm run matrix:gate` + drift-check on committed matrix |

### Release

- Main CI builds the client once as `client-dist-v1-<full-sha>`. Playwright,
  load, Docker, and Windows Electron consumers download and verify those exact
  bytes before use.
- `Build & Release Electron` accepts only an existing `v<package.version>` or
  `v<package.version>-rc.N` tag whose target is the exact successful main-CI
  subject. Manual dispatch is rerun/recovery by existing tag name only.
- Windows signing, draft staging, and final publication use separate protected
  environments. Missing physical Office/PowerPoint receipts, signing identity,
  trusted RFC 3161 timestamp, post-download verification, or attestation blocks
  publication. There is no unsigned public fallback.
- Windows attestation workflow identity is owned by
  [`windowsWorkflowIdentity`](../scripts/ci/release-receipt-canonical.mjs) in
  `release-receipt-canonical.mjs`. The runtime entry point in
  [`release-receipts.mjs`](../scripts/ci/release-receipts.mjs) supplies mandatory
  `windowsAttestationPolicy` from trusted `GITHUB_REPOSITORY` and `GITHUB_REF`
  context, using full `refs/heads/...` or `refs/tags/...` refs. Missing required
  policy fails closed; never derive approved identity from root or leaf receipt
  claims. This is an independent trust boundary, not a grant of new permissions.
- Policy-version labels are not approval authority. The canonical policy binding
  is owned by [`createGreenShaRoot`](../scripts/ci/release-receipts.mjs). Changed
  trusted target policy or a legacy unbound root requires explicit requalification,
  not relabeling old evidence.
- Linux and macOS Electron packages exist as local `electron-builder` scripts but are not part of the current release workflow.

For a failed rerun, keep the tag immutable and rerun against the same commit.
If the retained client or Linux receipt artifact expired, rerun full main CI for
that same SHA. Never move the tag, rebuild from a different SHA, or delete an
in-progress public release to hide a failed gate.

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
- The supported model is one operator, one server process, and one pair of
  persistent roots. There is no tenant isolation or supported HA/cluster mode.
- Public share capabilities authorize only their `/share/:token` presentation flow. They do not authorize `/api/analytics/:id`; keep analytics and editor APIs behind operator authentication.
- GitHub tokens are stored in plaintext in `github-config.json`. Restrict filesystem access accordingly.
- File-backed settings may contain sensitive values such as API keys or sync credentials. Do not commit or deploy those files publicly.
- CORS is open in development; production disables cross-origin requests by default. Add an explicit allowlist in `server/index.js` only for a trusted deployment boundary.
- PPTX import job capabilities and stream-log handling are documented in [PPTX Import Policy](#pptx-import-policy). Scrub or drop the SSE stream query string in proxy access logs.
- Uploaded SVG is sanitized on upload and at the serving boundary, including legacy files, and served with sandbox CSP, `nosniff`, and same-origin resource policy headers.

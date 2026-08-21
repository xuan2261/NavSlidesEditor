# Installation

NavSlides Editor can be run via Docker, as a desktop app, or directly from source with Node.js.

## Option 1: Docker (Recommended)

Docker is the easiest way to run NavSlides Editor as a persistent server.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose installed

### Steps

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git
cd NavSlidesEditor
docker compose up -d
```

Then open **http://127.0.0.1:3002** in your browser. The container listens on
`0.0.0.0` internally; host publication defaults to loopback. Set
`NAVSLIDES_PUBLISH_HOST` only behind an external authentication layer.

### Browser mutation and reverse-proxy policy

The server has no built-in authentication. Keep browser mutation routes on
loopback by default, or place an external authentication layer in front of any
non-loopback deployment. Configure the local CSRF boundary with:

- `NAVSLIDES_LOCAL_ALLOWED_HOSTS`: comma-separated `host[:port]` values; defaults
  to `localhost`, `127.0.0.1`, and `[::1]`.
- `NAVSLIDES_LOCAL_ALLOWED_ORIGINS`: optional exact `http(s)` origins; paths,
  credentials, queries, and fragments are rejected.
- `NAVSLIDES_TRUSTED_PROXY_ADDRESSES`: proxy IPs allowed to supply
  `X-Forwarded-Host` and `X-Forwarded-Proto`; forwarded headers are ignored for
  all other peers.
- `NAVSLIDES_ALLOW_MISSING_ORIGIN`: missing `Origin` is allowed by default to
  preserve non-browser clients and existing integrations. Set it to `0` when
  an exposed deployment must require same-origin `Origin` headers on every
  mutation request.

Present `Origin` headers must match the effective host/protocol and configured
allowlist. This policy is not application authentication or tenant isolation.

Uploaded SVG is sanitized on upload and again when served, including legacy
files, and is returned with sandbox CSP, `nosniff`, and same-origin resource
policy headers.

### Useful Docker commands

```bash
# Start in background
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after pulling updates
git pull
docker compose up -d --build
```

### Data persistence

| Path inside container | What it stores |
|---|---|
| `/app/presentations` | All saved presentation files |
| `/app/uploads` | Uploaded images and assets |

These are mounted to `./presentations` and `./uploads` on the host by default (see `docker-compose.yml`).

---

## Option 2: Desktop App (Electron)

The desktop app bundles the editor and server into a standalone application — no Docker or Node.js required.

### Download

Go to the [Releases page](https://github.com/xuan2261/NavSlidesEditor/releases) and download the build for your platform:

| Platform | File | Notes |
|---|---|---|
| Windows (installer) | `NavSlides Editor Setup x.x.x.exe` | Installs to Program Files and adds a Start menu shortcut |
| Windows (portable) | `NavSlides Editor x.x.x.exe` | Runs directly, no installation |

::: tip Linux & macOS
Prebuilt Linux and macOS packages are not published yet. You can build them yourself from source — see [Building from Source](/develop/building-from-source) (`npm run electron:build:linux` or `electron:build:mac`).
:::

::: tip
On first launch the desktop app will open both the editor window and a local server on port 3002. You can also access the editor from a browser at `http://127.0.0.1:3002`.
:::

---

## Option 3: Node.js from Source

For developers or anyone who wants to customize the editor.

### Prerequisites

- Node.js >=22.13.0 and npm. CI and container builds pin Node.js 22.22.0.

### Steps

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git
cd NavSlidesEditor
npm install
```

### Development mode (hot reload)

```bash
npm run dev
```

Opens the editor at `http://localhost:5173` with Vite HMR.

### Production mode

```bash
npm run build
npm start
```

Serves the built app at `http://127.0.0.1:3002`.

### Data persistence

Data files are stored under `server/data/` and uploaded assets under
`server/uploads/`. In Docker, named volumes mount these locations at
`/app/server/data` and `/app/server/uploads`.

Back up `server/data/` when running from source; it is not tracked by git.

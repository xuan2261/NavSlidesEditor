# Installation

NavSlides Editor can be run via Docker, as a desktop app, or directly from source with Node.js.

## Option 1: Docker (Recommended)

Docker is the easiest way to run NavSlides Editor as a persistent server.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose installed

### Steps

```bash
git clone https://github.com/jbirky/revealjs_gui.git
cd revealjs_gui
docker compose up -d
```

Then open **http://localhost:3002** in your browser.

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

Go to the [Releases page](https://github.com/jbirky/revealjs_gui/releases) and download the installer for your platform:

| Platform | File |
|---|---|
| Linux (AppImage) | `Slides-Editor-x.x.x.AppImage` |
| Linux (Debian/Ubuntu) | `parallax_x.x.x_amd64.deb` |
| macOS | `Slides-Editor-x.x.x.dmg` |
| Windows | `Slides-Editor-Setup-x.x.x.exe` |

### Linux AppImage

```bash
chmod +x Slides-Editor-*.AppImage
./Slides-Editor-*.AppImage
```

### Linux .deb

```bash
sudo dpkg -i parallax_*.deb
# Then launch from your application menu or run:
parallax
```

::: tip
On first launch the desktop app will open both the editor window and a local server on port 3002. You can also access the editor from a browser at `http://localhost:3002`.
:::

---

## Option 3: Node.js from Source

For developers or anyone who wants to customize the editor.

### Prerequisites

- Node.js 18+ and npm

### Steps

```bash
git clone https://github.com/jbirky/revealjs_gui.git
cd revealjs_gui
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

Serves the built app at `http://localhost:3002`.

### Data persistence

Presentations are saved to `./presentations/` and uploads to `./uploads/` in the project root.

::: warning
When running from source, make sure to back up the `presentations/` directory — it is not tracked by git.
:::

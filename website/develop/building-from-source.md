# Building from Source

How to run NavSlides Editor locally for development. Requires **Node.js >=22.13.0** and npm. CI and container builds pin Node.js 22.22.0.

## Clone and install

```bash
git clone https://github.com/xuan2261/NavSlidesEditor.git
cd NavSlidesEditor
npm install
```

`npm install` runs a `postinstall` step (`npm run vendor`) that copies vendored reveal.js assets into place.

## Run in development

```bash
npm run dev
```

This starts the Vite dev server (client) on **5173** and the Express API on **3002** concurrently. The Vite dev server proxies `/api`, `/uploads`, `/vendor`, and `/ws` to `:3002`, so open **http://localhost:5173** while developing.

## Production build

```bash
npm run build      # compile React → client/dist/
npm start          # serve the built client + API on :3002
PORT=8080 npm start # custom port
```

## Desktop app (Electron)

```bash
npm run electron:dev          # run in dev mode (no packaging)
npm run electron:build:win    # Windows .exe installer
npm run electron:build:linux  # Linux .AppImage + .deb
npm run electron:build:mac    # macOS .zip
```

## Docker

```bash
docker compose up -d          # server on :3002 with persistent volumes
docker compose logs -f        # tail logs
docker compose down -v        # stop + delete volumes
```

## Tests

```bash
npm run test          # unit tests (Vitest)
npm run test:e2e      # end-to-end tests (Playwright)
npm run test:corpus   # PPTX import/round-trip fidelity
npm run test:load:api # k6 load test — REST API
npm run test:load:ws  # k6 load test — WebSocket / Socket.IO
```

Run a single test file with `npx vitest run <path>` or `npx playwright test <path>`.

## Docs site

```bash
npm run docs:dev      # this VitePress site, locally
npm run docs:build    # production build
```

See also: [Architecture](/develop/architecture) · [Contributing](/develop/contributing).

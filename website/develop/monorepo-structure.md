# Monorepo Structure

NavSlides Editor uses npm workspaces. Each top-level package owns one concern. For the annotated codebase tour, see [`docs/codebase-summary.md`](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/codebase-summary.md).

## Workspace map

```
NavSlidesEditor/
├── client/    # React SPA (Vite) → client/dist/ in production
├── server/    # Express REST API + Socket.IO
├── shared/    # Pure Node.js utilities (client + server)
└── electron/  # Desktop shell embedding the server
```

## Where things live

**`client/src/`**
- `pages/` — route components: `EditorPage`, `HomePage`, `LiveViewPage`, `SpeakerViewPage`, settings, explore, game join
- `components/` — `SlideCanvas`, `PropertiesPanel`, `SlidePanel`, the `ribbon/` UI, and modals
- `stores/` — Zustand state: `editor-store`, `presentation-store`, `ui-store`
- `hooks/` — `use-keyboard`, `use-clipboard`, `use-live-presentation`, and more
- `extensions/` — TipTap extensions (FontSize, FontFamily, MathExtension, …)
- `data/` — `element-defaults.js` is the **canonical list of the 19 element types**

**`server/`**
- `index.js` — wires up Express and imports modular routes
- `routes/` — `presentations`, `templates`, `share`, `upload`, `github`, `sync`, `history`, `media`, `live`, `pptx-import`, `ai`, game endpoints, …
- `services/` — `storage` (file-based JSON), `socket-handler`, `live-rooms`, `pptx-exporter`, the `pptx-import/` pipeline, AI provider + guard
- `data/` + `uploads/` — runtime storage (JSON files + media), created on first run

**`shared/src/`**
- `htmlGenerator.js` + `element-renderers.js` — JSON → reveal.js HTML
- `shapeUtils.js`, `presenterTools.js`, `content-safety.js`, and `shared-*` color/text/PPTX helpers
- `theme-presets.js` — the 39 design presets; `fx/` — the 8 animated backgrounds

## The `shared` symlink

Because `shared` is an npm workspace, `client` and `server` import it as a normal dependency (`revealjs-shared`). Any logic used by both sides belongs here — never copy it into one package.

See also: [Architecture](/develop/architecture) · [Contributing](/develop/contributing).

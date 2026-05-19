# Feature Comparison: parallax-presentations vs NavSlidesEditor

Generated: 2026-05-19
Mode: `--compare` (analysis only, no implementation plan)

## Source Manifest

| Field | Value |
|---|---|
| Repo | `jbirky/parallax-presentations` |
| Branch / SHA | `main` @ `ce548c535abc7701ac45cc3164560caba121adce` |
| Last commit | 2026-05-15 (`add line-arrow shape`) |
| License | AGPL-3.0-or-later |
| Stars / Forks | 11 / 0 |
| Description | "A WYSIWYG slides editor for reveal.js" |
| Author | `jbirky` |
| Demo / docs | https://parallax-presentations.com |

## Local Project

| Field | Value |
|---|---|
| Repo | `xuan2261/NavSlidesEditor` |
| Version | v1.9.0 |
| License | (file present, not inspected) |
| Description | Self-hostable WYSIWYG presentation editor |

## Provenance Note

Both projects share an obvious common ancestor: source's `package.json` is named `revealjs-editor`, monorepo layout (`client`+`server`), Vite+Express+TipTap+pptxgenjs+KaTeX+highlight.js stack, EditorPage.jsx as the central component. The two have since diverged into different products:

- `parallax-presentations` -> commercial SaaS direction (Clerk auth, Stripe billing, Postgres, R2, plan limits, public marketing site).
- `NavSlidesEditor` -> privacy-first self-hosted direction (Socket.IO live, game mode, AI tools, rclone sync, Electron, comprehensive tests).

This shared origin is why the comparison is unusually high-overlap on UI primitives but unusually low-overlap on platform layers.

## Source Anatomy

```
parallax-presentations/
  client/
    src/
      App.jsx, main.jsx, index.css
      pages/         EditorPage (~180k), HomePage (~37k), LandingPage (~7k)
      components/    AnimationTimeline, AnimeModal, DocsPage, FindReplaceBar,
                     KineticTextModal, MathGridModal, PropertiesPanel (~117k),
                     SlideCanvas (~112k), SlidePanel, ThreeModal, Toolbar (~91k),
                     TransitionPreview
      extensions/    (TipTap)
      plugins/       (client-side plugin loaders)
      utils/
    vite.config.js, package.json
  server/
    index.js
    middleware/      auth (Clerk + plan limits)
    services/        r2.js, stripe.js, upload-service.js
    storage/         interface.js, file-storage.js, pg-storage.js, index.js
    migrations/      001_initial..005_upload_hash + run.js
    data/, uploads/, package.json
  electron/main.js
  plugins/
    animated-counter/, manim/
  docs/              VitePress site (.vitepress, features, guide, tutorials, public)
  scripts/           prepare-electron.js, backup.sh
  Dockerfile, docker-compose.yml, .env.example, electron-builder.yml
```

Notable: no `shared/` package, no `tests/`, no Socket.IO, no game mode, no AI services, no PPTX import, no rclone, single-file Electron shell.

## Local Anatomy (recap)

```
NavSlidesEditor/
  client/  React SPA (ribbon UI, ~20 element types, 9 page routes incl. live/remote/speaker/game)
  server/  Express + Socket.IO with split routes/ and services/
           routes: presentations, templates, share, upload, github, sync, history,
                   settings, media, live, pptx-import, games-rest-api-handler, ai,
                   analytics, explore, marketplace
           services: storage, socket-handler, game-socket-handler, live-rooms,
                     pptx-exporter, pptx-import/, ai-provider, ai-endpoint-guard,
                     presentation-finder, game-room-manager-singleton-service
  shared/  Pure Node utilities consumed by both client & server (htmlGenerator, etc.)
  electron/ Full Electron package
  tests/   Vitest + Playwright + k6 + PPTX corpus
  docs/    Project docs (PDR, architecture, standards, roadmap)
```

## Dependency Matrix (source -> local)

| Source component | Local equivalent | Status |
|---|---|---|
| `client` workspace | `client/` | EXISTS (diverged) |
| `server` workspace | `server/` | EXISTS (diverged) |
| `electron/main.js` | `electron/` package | EXISTS (more complete) |
| `server/middleware/auth` (Clerk + plan limits) | none | NEW (out of scope) |
| `server/services/stripe.js` | none | NEW (out of scope) |
| `server/services/r2.js` + `upload-service.js` | `routes/upload.js` (multer + SHA-256 dedupe) | CONFLICT (different storage strategy) |
| `server/storage/{file,pg,interface,index}.js` | `services/storage.js` (file only) | CONFLICT (storage abstraction layer) |
| `server/migrations/*.sql` + `run.js` | none | NEW (out of scope unless Postgres added) |
| `client @clerk/clerk-react` | none | NEW (auth) |
| `plugins/animated-counter`, `plugins/manim` | none | NEW (plugin model) |
| `docs/` VitePress site | `docs/` markdown only | CONFLICT (project docs vs public docs site) |
| `LandingPage.jsx` | `HomePage.jsx` (dashboard) | CONFLICT (marketing vs app entry) |
| TipTap stack | TipTap stack + extra extensions | EXISTS (local has more) |
| reveal.js / KaTeX / highlight.js / pptxgenjs | same | EXISTS |
| Dockerfile / docker-compose | same idea | EXISTS |
| `.env.example` | none (file storage, no env needed) | N/A |

## Head-to-Head

| Aspect | Source (`parallax-presentations`) | Local (`NavSlidesEditor`) | Recommendation |
|---|---|---|---|
| Product mode | Dual: `selfhosted` + `cloud` (Clerk/Stripe/Postgres/R2) | Single: self-hosted only | Keep local mode-pure |
| Auth | Clerk required in cloud mode | None (trusted single user) | Do not adopt |
| Persistence | `file` or `postgres` via `storage/interface.js` | JSON files only | Keep file-only |
| Object storage | Local FS or Cloudflare R2 | Local FS + optional rclone | Keep, R2 not needed |
| Billing | Stripe + plan limits + webhook | None | Out of scope |
| Real-time | None visible | Socket.IO live presentation, remote, speaker, annotations, timer | Local advantage |
| Game mode | None | 7 game types + dedicated socket handler + leaderboard | Local advantage |
| AI tools | None | rewrite / generate / translate / Unsplash / Giphy | Local advantage |
| PPTX import | None | `pptxtojson` + `pptx2json` fallback + corpus tests | Local advantage |
| PPTX export | `pptxgenjs` (client) | `pptxgenjs` + Playwright raster fallback (server) | Local advantage |
| Markdown import | Unknown (not in tree) | Yes | Local advantage |
| Cloud sync (user-chosen) | None | rclone (Proton, Drive, S3, ...) | Local advantage |
| Version history | None | Named snapshots, restore, delete | Local advantage |
| GitHub push | Implied via `PARALLAX_PUBLIC_URL` | Built-in (PAT, auto README) | Comparable |
| Plugin architecture | `plugins/` (animated-counter, manim) loaded client+server | None (20 fixed element types) | Optional cherry-pick |
| Public docs site | VitePress @ `docs/` | `docs/` project markdown only | Optional cherry-pick |
| Landing page | `LandingPage.jsx` (marketing) | `HomePage.jsx` (app dashboard) | Different audience |
| Element type system | "kinetic text", "anime", "math grid", "three" modals | 20 typed elements (text/img/shape/code/latex/tikz/math/html/md/chart/video/audio/table/qr/icon/callout/drawing/line/svg/divider/timeline/game) | Local broader |
| Toolbar / UI shell | Single `Toolbar.jsx` (~91k) | Tab-based ribbon (Home/Insert/Design/Transitions/Animations/View/Format) | Local better-organized |
| Multi-select / groups | Not visible | Yes (incl. align/distribute, rotate, smart guides, rulers) | Local advantage |
| Find & replace | `FindReplaceBar.jsx` | Yes | Comparable |
| Command palette | Unknown | Yes (`Ctrl+K`) | Likely local advantage |
| Touch gestures | Unknown | Yes (tap/double-tap/long-press/swipe/pinch) | Likely local advantage |
| Code reuse client<->server | None (duplicated where needed) | `shared/` workspace pkg | Local cleaner |
| Tests | None visible | Vitest + Playwright + k6 + PPTX corpus + GH Actions CI | Local advantage |
| Migrations infra | SQL files + `run.js` | None (JSON only) | Out of scope |
| Email | Resend | None | Out of scope |
| Electron | Single `main.js` | Full package + electron-builder for win/linux/mac | Local advantage |
| Docker | Yes | Yes (with rclone preinstalled) | Comparable |
| License | AGPL-3.0 | (verify local) | N/A |

## Configuration Surface (source-only)

`.env.example` exposes 12 vars: `PARALLAX_MODE`, `PARALLAX_DB`, `DATABASE_URL`, `CLERK_*`, `STRIPE_*`, `PARALLAX_STORAGE`, `R2_*`, `RESEND_API_KEY`, `VITE_*`, `PORT`, `NODE_ENV`, `PARALLAX_PUBLIC_URL`. None apply to local unless adopting cloud mode wholesale.

## Challenge Framework Pass

| # | Question | Source answer | Local answer | Risk if wrong |
|---|---|---|---|---|
| 1 | Should local adopt Clerk auth? | Required in cloud mode | "Trusted author content" model is intentional per `README.md:117-130` | Adopting auth contradicts a documented security stance and breaks the single-user UX |
| 2 | Should local adopt the storage adapter (file/pg)? | Abstracted via `storage/interface.js` | Single `services/storage.js` against JSON | Premature abstraction; YAGNI unless multi-tenant need emerges |
| 3 | Should local adopt the plugin architecture? | Two plugins shipped (`animated-counter`, `manim`) | 20 typed elements + AI/charts/SVG cover the same surface | Plugin loader adds maintenance + sandbox/XSS concerns; local already supports HTML embeds and Markdown |
| 4 | Should local adopt VitePress docs site? | Public marketing/tutorial site | `docs/` is internal project docs | Different audience; pushing internal docs to a public site mixes concerns |
| 5 | Should local adopt Stripe + plan limits? | Cloud monetization | No business model | Out of scope; would require auth first |
| 6 | Is the source `LandingPage.jsx` worth porting? | Marketing landing | `HomePage.jsx` is the app dashboard | Different intent; could borrow visual ideas only |
| 7 | Are source's modal patterns (`AnimeModal`, `KineticTextModal`, `MathGridModal`, `ThreeModal`) worth porting? | Specialty content modals | Local has Chart.js, KaTeX, TikZJax, drawing, timeline, SVG -- coverage broad | Possibly worth porting `ThreeModal` (3D) and `AnimeModal` (anime.js) as new element types if user demand exists |
| 8 | Is source's `manim` plugin worth porting? | Server-side Manim render via plugin | Local has TikZJax + LaTeX | Manim is Python-heavy; would require Python + ffmpeg in server image; significant infra cost |

## Decision Matrix

| Decision | Source's way | Local's way | Recommendation |
|---|---|---|---|
| Multi-user / cloud | Clerk + Postgres + R2 + Stripe | Single user, file-based | Reject. Conflicts with stated security model. |
| Storage abstraction | `storage/interface.js` adapter | Direct file ops | Reject (YAGNI). Reconsider only if Postgres becomes a real requirement. |
| Plugin system | `plugins/` loaded client+server | Fixed element types | Reject. Element-type model already covers the use cases at lower complexity. |
| Public docs site | VitePress site under `docs/` | Internal `docs/` only | Defer. Useful only when local goes public-facing; if pursued, do it in `website/` not `docs/`. |
| 3D / anime modals | Dedicated modals | Not present | Cherry-pick candidates (low priority). Add as element types under existing taxonomy. |
| Manim integration | Server plugin | Not present | Reject for default; ship as optional Docker variant if real demand appears. |
| Storage migrations infra | SQL `migrations/` + `run.js` | None | Reject unless storage strategy changes. |
| Marketing landing page | `LandingPage.jsx` | None (HomePage = dashboard) | Defer. Belongs on the public website, not the app shell. |

## Risk Score

`--compare` mode produces no code changes, so blast radius is zero. Risk score: **0 / 5**.

If any cherry-pick is later authorized, re-score per item; the highest-risk candidates would be (a) plugin architecture (XSS/sandboxing surface, +2) and (b) Manim (Python runtime in server image, +3).

## Recommendation

**Do not port.** The two projects share a UI primitive ancestor but solve different problems: parallax targets a SaaS product, NavSlides targets a privacy-first self-hosted tool. The features parallax has that NavSlides lacks (Clerk, Stripe, Postgres, R2, plan limits, marketing landing) all serve the SaaS direction and conflict with NavSlides' explicit single-user trust model (`README.md:117-130`).

Conversely, NavSlides has a substantially larger feature surface in the editor itself: live presentation, game mode, AI tools, PPTX import, rclone, version history, ribbon UI, multi-select/groups/rotation/smart-guides/rulers, comprehensive tests.

**Cherry-pick shortlist (low priority, only if user demand surfaces):**

1. `ThreeModal` -> a "3D" element type using existing element-renderer pattern in `shared/src/element-renderers.js`.
2. `AnimeModal` -> an "anime.js animation" element type, again via element-renderers.
3. `KineticTextModal` -> consider as a TipTap extension under `client/src/extensions/`.
4. VitePress public docs -> only if/when a public marketing surface is needed; place in a separate `website/` directory, not in `docs/`.

Reject outright: Clerk, Stripe, Postgres, R2, plugin loader, Manim, marketing LandingPage in the app shell, storage adapter abstraction, migrations infra.

## Unresolved Questions

1. Local README links to `Xuan2261/navslides-editor` (lowercase) but the badge points to `xuan2261/NavSlidesEditor`; the canonical repo URL was not verified during this pass.
2. Local `LICENSE` file was not opened -- if it's not AGPL-compatible and any cherry-pick is authorized, license compatibility must be verified before copying source code.
3. The exact contents of source's `AnimeModal`, `KineticTextModal`, `MathGridModal`, `ThreeModal` were not read; the recommendation to cherry-pick is based on filenames only and would need a deeper dive (`/ck:xia <repo> "ThreeModal" --port`) before any port.
4. Source's `client/src/plugins/` (loader) and `client/src/extensions/` (TipTap) were not opened; if a future port targets the plugin model the loader contract needs explicit reading.

---
**Status:** DONE
**Summary:** `--compare` complete. Source = SaaS sibling diverged from a common ancestor; recommend no port. Optional low-priority cherry-picks: 3D / anime / kinetic-text element types via existing element-renderer pattern.

---
phase: 2
title: "Develop Section EN"
status: completed
priority: P2
effort: "1d"
dependencies: [1]
---

# Phase 2: Develop Section EN

## Overview

Add a contributor-facing **Develop** section (English) with 4 concise pages that distill the internal `docs/` into a public onboarding path for new developers. Distill + link — do NOT copy `docs/` content (DRY); `docs/` stays internal source of truth.

## Requirements

- Functional: new `website/develop/` pages reachable via a new sidebar group + nav entry; covers architecture, monorepo layout, building from source, contributing.
- Non-functional: each page concise (favor links to `docs/` and code over duplication); files self-contained markdown; keep VitePress conventions.

## Architecture

New sidebar group keyed `/develop/` added to the **EN (root) locale** `themeConfig.sidebar` and a **Develop** nav item. (Config is currently single-locale; Phase 4 will move this into `locales.root` — write it so the move is mechanical.)

Content distilled from:
- `docs/system-architecture.md` → architecture page.
- `docs/codebase-summary.md` + project CLAUDE.md monorepo section → monorepo-structure page.
- `README.md` Installation §Option C + `package.json` scripts → building-from-source page.
- `docs/code-standards.md` + development rules (file-size, YAGNI/KISS/DRY, conventional commits, test/lint gates) → contributing page.

## Related Code Files

- Create:
  - `website/develop/architecture.md` — high-level: 4 workspaces (client/server/shared/electron), data flow (presentation JSON → htmlGenerator → reveal.js HTML), live (Socket.IO) overview. Link to `docs/system-architecture.md` in-repo.
  - `website/develop/monorepo-structure.md` — workspace map, where things live, `shared/` consumed by client+server via symlinks.
  - `website/develop/building-from-source.md` — Node 20+, `npm install`, `npm run dev` (5173+3002), `npm run build`/`start`, Electron + Docker build commands, test commands (vitest/playwright/k6).
  - `website/develop/contributing.md` — file-size <200 LOC, kebab-case, YAGNI/KISS/DRY, conventional commits (no AI refs), lint+test gates before commit/push, security model note (trusted author content).
  - `tests/unit/website-develop-section-pages-and-sidebar.test.js` — guard: 4 develop pages exist + each path present in `config.mjs` sidebar.
- Modify:
  - `website/.vitepress/config.mjs` — add `Develop` nav item + `/develop/` sidebar group. (SHARED FILE with Phase 4 — serialize.)

## Implementation Steps

1. Draft 4 develop pages by distilling the listed `docs/` sources. Keep each focused; link back to in-repo `docs/*.md` and key code paths rather than reproducing them.
2. Add nav entry `{ text: 'Develop', link: '/develop/architecture' }` and a `/develop/` sidebar group (Architecture, Monorepo Structure, Building from Source, Contributing) to EN config.
3. Add guard test `website-develop-section-pages-and-sidebar.test.js` (existence + sidebar path presence). Mirror the style of the existing port-coverage test.
4. `npm run docs:build` + `npx vitest run tests/unit/website-*.test.js` green.

## Success Criteria

- [ ] 4 Develop pages exist, accurate, concise, link to `docs/`/code instead of duplicating.
- [ ] Develop nav item + sidebar group render in EN locale.
- [ ] New guard test passes; existing 38 stay green.
- [ ] `npm run docs:build` succeeds.

## Risk Assessment

- **Duplicating `docs/` → drift + DRY violation** → distill + link; keep pages short. A develop page that just points to `docs/system-architecture.md` with a 3-paragraph summary is acceptable.
- **Shared `config.mjs` edit collides with Phase 4** → serialize; Phase 4 absorbs `/develop/` group into `locales.root.themeConfig.sidebar` unchanged.
- **Public exposure of internal detail** → only publish what's already in README/public docs; no secrets, no internal infra specifics.

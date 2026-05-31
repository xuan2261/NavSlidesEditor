---
title: "VitePress Docs Bilingual Refresh"
description: "Refresh the existing website/ VitePress site to match product v1.14.0, add a contributor Develop section, scripted Playwright screenshots, and an EN/VI bilingual locale — non-destructively."
status: completed
priority: P2
branch: "master"
tags: [docs, vitepress, i18n, screenshots, website]
blockedBy: []
blocks: []
created: "2026-05-31"
createdBy: "ck:plan"
source: skill
---

# VitePress Docs Bilingual Refresh

## Overview

The `website/` VitePress site already exists (v1.6.3, wired into monorepo workspaces, live GitHub Pages deploy). It was ported from parallax-presentations and its content has **drifted** from product v1.14.0. This plan refreshes content to be accurate, adds a contributor-facing Develop section, adds reproducible Playwright screenshots, and layers a Vietnamese locale — all non-destructively (no IA redesign, no theme rewrite, EN files stay in place).

Brainstorm source: `plans/reports/brainstorm-260531-0558-vitepress-docs-bilingual-refresh-report.md`.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|---|---|---|
| Builds on | `260520-0400-port-vitepress-docs-site-from-parallax` (created this site; its "Unresolved questions" explicitly list i18n VI, content-accuracy extraction, screenshots as future work) | completed (record only, no plan.md) |

No blocking relationships: prior plan is done; no in-flight plan touches `website/`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [EN Content Refresh and Drift Fix](./phase-01-en-content-refresh-and-drift-fix.md) | Complete |
| 2 | [Develop Section EN](./phase-02-develop-section-en.md) | Complete |
| 3 | [Scripted Screenshots](./phase-03-scripted-screenshots.md) | Complete |
| 4 | [VI i18n and Translation](./phase-04-vi-i18n-and-translation.md) | Complete |

## Execution Strategy

Sequential by default; each phase ships independently.

- **Phase 1** first — content accuracy is the highest-value, lowest-risk work; unblocks everything (VI must translate correct EN).
- **Phase 2** after 1 — adds Develop section + sidebar group. Independent of 3.
- **Phase 3** after 1 — screenshots embed into refreshed EN pages.
- **Phase 4** last — VI mirrors EN+Develop. Must come after 1+2 so it never translates stale content, and after 3 so VI pages reference the same `/img/` assets (locale-agnostic in `public/`).

Phases 2 and 3 may run in parallel after 1 (disjoint file ownership: Phase 2 owns `website/develop/**`; Phase 3 owns the capture script + `website/public/img/**`). The single shared file is `website/.vitepress/config.mjs` (Phase 2 adds the Develop sidebar group; Phase 4 adds `locales`) — serialize edits to it.

## Verified Drift Inventory (README v1.14.0 vs site)

| Page(s) | Current (wrong) | Correct | Source of truth |
|---|---|---|---|
| getting-started, overview | "6 design presets" | 39 presets / 7 categories | README §Themes; verify count in `client/src/components/ribbon/design-tab-content.jsx` |
| features/overview (element table) | 7 element types | 19 canonical types | `client/src/data/element-defaults.js` (top-level keys = 19, verified) |
| features/overview, charts | charts: bar/line/scatter | bar, line, pie, doughnut, radar, polar area | README §Element Types |
| tutorials/first-presentation | "press `F`" to present | `F5` | README §Keyboard Shortcuts |
| multiple | missing | first-class vertical slides, 8 FX backgrounds, ribbon UI, status bar, 35 layouts, game mode | README; FX list verified in `client/src/components/ribbon/design-tab-content.jsx` |

## Existing Test Guards (must stay green)

- `tests/unit/website-bootstrap-workspace-structure-and-config-presence.test.js` (6) — asserts config markers `NavSlides`, `VITEPRESS_BASE`, `/NavSlidesEditor/`, home hero/features, NOTICE. **Keep all markers when adding `locales`.**
- `tests/unit/website-content-port-pages-and-sidebar-coverage.test.js` (32) — asserts 23 ported + 5 stub EN pages exist + each path string present in `config.mjs` sidebar + brand substitution. **Additive changes keep these green** (EN paths unchanged). Adding VI/Develop must not remove EN sidebar entries.

Each phase adds its OWN guard test rather than editing these.

## Out Of Scope

- IA redesign, custom VitePress theme, landing-page redesign (user-rejected).
- Duplicating `docs/` internal content into website (DRY — Develop distills + links).
- Auto-drift-guard test wiring beyond a single optional count assertion (YAGNI; deferred unless requested).
- Translating screenshots' in-image text (images are locale-agnostic for v1).

## Success Criteria

- Zero drift items remaining vs v1.14.0 (table above all fixed).
- `npm run docs:build` green; GitHub Pages deploy succeeds.
- Develop section (architecture, monorepo-structure, building-from-source, contributing) present.
- VI locale browsable at `/vi/...`; EN stays at root `/...`; language switcher works.
- Existing 38 `website-*` guard tests stay green; each phase adds a focused guard test.
- Screenshots reproducible via a re-runnable Playwright script (no hand-capture).

## Cook Handoff

```bash
/ck:cook C:\Work\NavSlidesEditor\plans\260531-0558-vitepress-docs-bilingual-refresh\plan.md
```

## Red Team Review (deep mode)

### Session — 2026-05-31

Focused adversarial pass, proportional to scope (docs content + config; no security/data-integrity/auth surface). No swarm reviewers (token-efficient for low-risk docs work).

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | `locales` refactor could break 32 path-matching guard tests | High | Mitigated — **verified** EN path strings are substrings of `/vi/...` paths; `toContain('/guide/getting-started')` stays green. Phase 4 keeps all EN markers. |
| 2 | REST seed shape for screenshot script unconfirmed | Medium | Accept — Phase 3 step 1 verifies against `server/routes/presentations.js`; UI-seed fallback. |
| 3 | Live/speaker/game screenshots need a Socket.IO room | Medium | Scoped out of v1 (single-page-reachable states only); documented gap. |
| 4 | Committed retina PNGs may bloat repo | Low | Noted in Phase 3 risk; decision deferred to implementation (pngquant / 1.5x option). |
| 5 | Bilingual ×2 maintenance debt + VI staleness when EN changes | Medium | Accept — user-confirmed; EN canonical, VI mirrors; contributing note "update EN first". |
| 6 | Plan claims "each phase ships independently" yet Phase 4 depends on 1+2+3 | Low | Clarified — each phase yields a deployable increment; dependency order preserved. |
| 7 | Internal inconsistency: guard-count "3" vs actual 4 | Low | Fixed in Phase 4 step 7. |

No critical findings. Counts (19 element types, 8 FX) verified against code; preset "39/7" is README-sourced and flagged for edit-time re-verification in Phase 1.

## Validation (deep mode)

5 mandatory requirements locked at brainstorm (output, acceptance, scope, constraints, touchpoints) — see `plans/reports/brainstorm-260531-0558-vitepress-docs-bilingual-refresh-report.md`. Each phase has concrete acceptance criteria + its own guard test. No hand-wavy phases. No open validation questions.

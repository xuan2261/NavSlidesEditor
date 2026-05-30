---
title: "HTML-PPT Skill Native Integration (Token + Theme + Layout + FX + Design Ideas)"
description: "Native-adapt assets from lewislulu/html-ppt-skill (MIT) into NavSlides: design-token layer, theme gallery, layout library, background canvas FX, heuristic design-ideas engine."
status: completed
priority: P2
branch: "master"
tags: [design-system, theming, layouts, animations, fx]
blockedBy: []
blocks: []
created: "2026-05-30T15:41:17.276Z"
createdBy: "ck:plan"
source: skill
---

# HTML-PPT Skill Native Integration (Token + Theme + Layout + FX + Design Ideas)

## Overview

Bring four asset categories from `html-ppt-skill` (MIT, lewislulu) into NavSlides Editor via **native adapt** — translate the *data* (palettes, typography, layout coords, FX algorithms) into NavSlides' own model (element-JSON + reveal.js + Zustand). NOT HTML embedding.

Brainstorm report: `plans/reports/brainstorm-260530-2219-html-ppt-skill-integration-report.md`

**Critical architecture facts (from research + red-team):**
- Colors are baked as literal hex into inline styles in BOTH code paths: `shared/src/element-renderers.js` (present/export, string templates) AND `client/src/components/canvas/element-renderers/*` (editor, React). They do NOT share color-resolution logic.
- `safeCssColor()` is duplicated in **FOUR** places and **silently drops `var(--x)`**: `element-renderers.js:52`, `shapeUtils.js:20`, `shape-element-renderer.jsx:4`, `table-element-renderer.jsx:3`. ALL FOUR must learn `var(--ns-*)` or that element type silently fails to theme. This is the #1 blocker.
- No golden/snapshot test asserts exact hex output today — backward-compat regressions will NOT be auto-caught. TDD must add golden tests first; an `'auto'` table fixture is the canary for the easily-missed 4th copy.
- Live viewers render the **identical htmlGenerator output** in an iframe with `allow-scripts` (`LiveViewPage.jsx:111-113,336-341`). So background canvas FX embedded by htmlGenerator runs for live viewers FREE — no LiveViewPage changes. BUT reveal fires `ready` (not `slidechanged`) on load, so FX must start on `ready` too or slide 1 stays dead.

**Product decisions locked:**
- Token migration (planner-resolved after red-team): **built-in templates + element defaults flip hex → `'auto'`** (NavSlides' own code, regenerated per insert). `DEFAULT_TOKENS` mirrors current hex exactly → zero out-of-box visual change. **Saved USER decks: never auto-migrated** (frozen hex respected). This makes theme-switch actually recolor new content while keeping backward-compat. No bulk rewrite of user JSON (YAGNI; risk #1).
- Design Ideas: **heuristic-only** (no AI this round).
- FX: **runs in live broadcast** (via htmlGenerator iframe); start on `ready`+`slidechanged`; honor `prefers-reduced-motion` per-client + toggle.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Design Token Layer](./phase-01-design-token-layer.md) | ✅ Done |
| 2 | [Theme Gallery Expansion](./phase-02-theme-gallery-expansion.md) | ✅ Done |
| 3 | [Layout Library Expansion](./phase-03-layout-library-expansion.md) | ✅ Done |
| 4 | [Background Canvas FX](./phase-04-background-canvas-fx.md) | ✅ Done |
| 5 | [Design Ideas Engine](./phase-05-design-ideas-engine.md) | ✅ Done |

## Build Order & Dependencies

- **Phase 1 is a hard gate** for Phase 2 and Phase 5 (both rely on the token layer).
- **Phase 3** (layouts) is independent — can run in parallel with 1/2; uses `'auto'` colors that no-op gracefully until Phase 1 lands.
- **Phase 4** (FX) is independent of the token layer; depends only on background-model extension.
- **Phase 5** depends on Phase 2 (theme pairing) + Phase 3 (layout candidates).

```
P1 ──► P2 ──┐
            ├──► P5
P3 ─────────┘
P4 (independent)
```

## Key Constraints

- Code files < 200 LOC; split modules.
- Shared logic lives in `shared/src/`.
- YAGNI / KISS / DRY.
- Keep `lewislulu/html-ppt-skill` MIT attribution in a `NOTICE` file at repo root.
- Editor ≡ present ≡ export fidelity is non-negotiable — every phase that touches rendering needs a golden test.

## Cross-Plan Dependencies

Scanned `plans/` — pending/in-progress plans (QA Uplift, Upstream Parity, Smoke Test fixes, pptx-import) do NOT overlap design-token/theme/layout/FX surfaces. No cross-plan `blockedBy`/`blocks` wiring needed.

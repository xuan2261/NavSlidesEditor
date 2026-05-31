---
phase: 1
title: "EN Content Refresh and Drift Fix"
status: completed
priority: P1
effort: "1-1.5d"
dependencies: []
---

# Phase 1: EN Content Refresh and Drift Fix

## Overview

Correct all stale content in the existing ~28 English pages so the site matches product v1.14.0. Highest-value, lowest-risk phase. Unblocks Phase 4 (VI must translate accurate EN). No structure or theme changes.

## Requirements

- Functional: every drift item in the plan's Verified Drift Inventory is corrected; new v1.14.0 features mentioned where they belong.
- Non-functional: keep VitePress markdown conventions (`:::tip` containers, relative links); keep page front-matter; pages stay readable, no padding for its own sake (YAGNI).

## Architecture

Pure content edits to existing markdown. Source of truth = `README.md` (v1.14.0) + verified code:
- Element types (19): `client/src/data/element-defaults.js` top-level keys.
- Design presets (39 / 7 categories) + FX backgrounds (8): `client/src/components/ribbon/design-tab-content.jsx`.
- Shortcuts: README §Keyboard Shortcuts.

No new dependencies. No config change in this phase (sidebar unchanged — same EN pages).

## Related Code Files

- Modify:
  - `website/index.md` — home hero/features: align taglines with v1.14.0 (6 feature cards OK to keep; ensure wording accurate).
  - `website/guide/getting-started.md` — "6 design presets" → "39 presets across 7 categories"; add ribbon UI + status bar mention; `F` → `F5` if present.
  - `website/features/overview.md` — element table 7 → 19 canonical types; charts list → bar/line/pie/doughnut/radar/polar area; add vertical slides (first-class), 8 FX backgrounds, 35 layouts, game mode; presets 6 → 39/7.
  - `website/features/charts.md` — chart types accurate (bar, line, pie, doughnut, radar, polar area).
  - `website/features/text-formatting.md`, `shapes.md`, `latex.md`, `export.md` — spot-fix any stale counts/labels; verify ribbon-based Insert flow wording (right-click "Insert →" may now be ribbon tab).
  - `website/features/{live-presentations,game-mode,ai-authoring,pptx-import-export,cloud-sync}.md` — promote from stubs to accurate short pages using README sections (speaker view, remote, annotations, B/W overlays; 7 game types; AI copywriter/generator/translate; PPTX hybrid export + import; rclone providers).
  - `website/tutorials/first-presentation.md` — `F` → `F5`; theme/preset counts; Insert flow wording.
  - `website/tutorials/*.md` (remaining 13) — spot-fix stale shortcuts, counts, and Insert/menu wording to match ribbon UI.
- Read (source of truth, read-only): `README.md`, `client/src/data/element-defaults.js`, `client/src/components/ribbon/design-tab-content.jsx`, `docs/project-overview-pdr.md`.
- Create: `tests/unit/website-content-accuracy-v1-14-guards.test.js` — focused guard (see steps).

## Implementation Steps

1. Re-verify counts at edit time (do NOT trust memory): element top-level keys = 19; presets = 39 across 7 categories; FX = 8. Grep `design-tab-content.jsx` for preset/category arrays and FX names; confirm before writing numbers.
2. Fix `features/overview.md`: replace 7-row element table with the 19 canonical types (group sub-variants in prose, mirror README's framing that Insert shows ~27 actions but 19 canonical types). Fix charts list. Add a short subsection each for vertical slides, FX backgrounds, layouts (35), game mode.
3. Fix `guide/getting-started.md`: presets 6 → 39/7 categories; add ribbon UI + PowerPoint-style status bar to "Key capabilities"; correct any present-shortcut.
4. Promote 5 NavSlides-only feature pages from stub to accurate concise pages from README (do not over-write; keep each focused).
5. Fix `tutorials/first-presentation.md` present shortcut `F` → `F5`; reconcile theme/preset wording; verify Insert steps match current ribbon (right-click canvas still supported per README — keep if accurate).
6. Sweep remaining tutorials for stale shortcuts/counts/menu names; fix only what is wrong (no rewrites).
7. Add guard test `website-content-accuracy-v1-14-guards.test.js`:
   - assert `features/overview.md` does NOT contain `scatter` chart claim and DOES contain `doughnut`/`radar`/`polar`.
   - assert no page under `website/{guide,features}` contains the string "6 design presets".
   - assert `tutorials/first-presentation.md` references `F5` (not bare "press `F`").
   - assert `features/overview.md` mentions 19 element types (or lists them) — string check tolerant to phrasing.
8. Run `npm run docs:build` and `npx vitest run tests/unit/website-*.test.js` — both green. Fix dead internal links surfaced (note: `ignoreDeadLinks:true` masks them in build; grep links manually for the pages edited).

## Success Criteria

- [ ] All drift-inventory items corrected; counts re-verified against code at edit time.
- [ ] 5 NavSlides-only pages are accurate concise pages (not empty stubs).
- [ ] `npm run docs:build` succeeds.
- [ ] Existing 38 `website-*` tests stay green; new accuracy guard test passes.
- [ ] No remaining "6 design presets" / "scatter" / bare-`F`-to-present in edited pages.

## Risk Assessment

- **Count drifts again next release** → guard test pins the most error-prone facts (presets phrase, chart types, present shortcut). Cheap, bounded (YAGNI — not a full doc-vs-code generator).
- **Over-rewriting stub pages** → keep NavSlides-only pages concise; link to tutorials instead of duplicating.
- **`ignoreDeadLinks:true` hides broken links** → manually verify links on edited pages; consider flipping to `false` is deferred to Phase 4 (after VI added) to avoid premature churn.
- **Ribbon-vs-menu wording** → README is authoritative; if a tutorial step can't be verified against current UI, leave behavior-neutral wording rather than guess.

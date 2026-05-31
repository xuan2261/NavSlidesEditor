---
phase: 3
title: "Tag Retrofit (editor-core)"
status: completed
priority: P2
effort: "1.5d"
dependencies: [2]
---

# Phase 3: Tag Retrofit (editor-core)

## Overview

Make the matrix reflect reality. Many editor-core capabilities already have passing tests (chart, code, shape, clipboard, find-replace, smart-guides, plus keyboard-shortcut tests) but the matrix shows them GAP because no `[cap:*]` tag exists yet. This phase adds tags to EXISTING, already-asserting tests — across unit AND e2e (both scanned by default) — so the matrix turns honest-green where coverage genuinely exists, before writing any new tests in Phase 4/5.

**Includes the 44 `shortcut.*` capabilities** (red-team HIGH #4): retrofit-tag them against existing keyboard tests so the allowlist does not start with 44 entries.

**Critical discipline:** only tag a test that actually asserts the capability's behavior AND runs green (not skipped). Tagging a shallow/empty/skipped test is the "tag lies" failure mode that Phase 2's run-status join is designed to expose — but don't rely on the join to catch laziness; audit manually. When in doubt, leave GAP and let Phase 4/5 cover it.

## Requirements

- **Functional**
  - Audit existing tests against the matrix's GAP rows; for each, decide: real coverage (tag it) vs shallow/absent (leave GAP).
  - Add `[cap:<id>]` to the title of the most specific test that asserts that capability.
  - Add `tier:deep` marker to existing tests that already assert real behavior (not just render) for high-risk caps.
  - Re-run `npm run matrix`; GAP count drops to reflect true existing coverage.
- **Non-functional**
  - Tags use stable capability IDs only — NO phase/finding refs (per `review-audit-self-decision.md` rule 5).
  - Do not weaken or change any assertion. Title text edits + tag tokens only.
  - One test = primary owner of a capability tag; avoid scattering the same cap across many shallow tests.

## Architecture

**Known existing coverage to map (from scout, 2026-05-30):**

| Capability | Likely existing test | Tier |
|---|---|---|
| `element.chart` | `tests/e2e/elements/chart-types-smoke.spec.js` | smoke |
| `element.code` | `tests/e2e/elements/code-element-syntax-highlighting-and-language-switching.spec.js` | smoke |
| `element.shape` | `tests/e2e/elements/slide-element-shape-variants-render-and-gallery-insertion.spec.js` | smoke |
| `element.image` | `tests/e2e/elements/image-and-media-element-rendering-with-object-fit-and-filters.spec.js` | smoke |
| `element.drawing`,`element.svg` | `tests/e2e/elements/drawing-and-svg-element-rendering-with-paths-and-vector-graphics.spec.js` | smoke |
| `element.latex` | `tests/e2e/elements/math-latex-tikz-element-rendering-with-katex-iframe.spec.js` | smoke |
| `element.qrcode`,`element.icon`,`element.callout`,`element.line` | `tests/e2e/elements/qr-icon-callout-divider-element-rendering-and-property-persistence.spec.js` | smoke |
| `element.text` | `tests/e2e/elements/text-element-rich-formatting-and-prosemirror-editing-and-persistence.spec.js` | smoke |
| `element.markdown`,`element.html` | `tests/e2e/elements/markdown-rendering-and-html-embed-sanitization-and-persistence.spec.js` | smoke |
| `element.timeline` | `client/src/components/timeline-element.test.jsx` | smoke (check depth) |
| `flow.clipboard` | `client/src/hooks/use-clipboard.test.js`, `tests/e2e/canvas/clipboard.spec.js` | deep |
| `flow.undo-redo` | `client/src/stores/editor-store.test.js` (verify), `tests/e2e/editor-history-errors.spec.js` | deep (check) |
| `canvas.smart-guides` | `client/src/utils/smartGuides.test.js`, `tests/e2e/canvas/smart-guides.spec.js` | deep |
| `control.format.*` | `client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.test.jsx`, `ribbon-format-tab-*.test.jsx` | smoke |
| `control.format.position` | `ribbon-format-tab-element-position-size-rotation-controls.test.jsx` | smoke |
| `flow.find-replace` | `client/src/components/find-replace-helpers.test.js`, `tests/e2e/find-replace.spec.js` | deep |
| `element.table` | `client/src/components/canvas/element-renderers` table tests (verify exists) | check |
| `shortcut.*` (44) | `client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js`, `client/src/utils/shortcut-registry-unit-tests-for-lookup-override-merge.test.js`, `shortcut-storage-unit-tests-for-load-save-reset.test.js`, `tests/e2e/keyboard-shortcuts.spec.js`, `tests/e2e/games/keyboard-shortcuts.spec.js` | smoke (deep for clipboard/undo/group/zorder which double as `flow.*`/`canvas.*`) |

**Shortcut retrofit strategy (red-team HIGH #4):** the 44 `shortcut.*` ids map to existing keyboard/registry tests. Many shortcuts share behavior with a `flow.*`/`canvas.*` capability (e.g. `shortcut.group` ↔ `canvas.group`, `shortcut.copy` ↔ `flow.clipboard`); tag BOTH ids on the relevant test where it asserts the action. Pure-binding shortcuts (slide nav, screen overlays, game presenter keys) get tagged against `keyboard-shortcuts.spec.js` / `slideshow-...-handler.test.js` where the keypress→action wiring is asserted. Any shortcut with no asserting test after this sweep → Phase 4 smoke or dated allowlist (NOT silent pass).

**Process per GAP row:**
1. Locate candidate test (table above + grep).
2. Open it; confirm it asserts behavior (not just mounts).
3. If real → add `[cap:<id>]` to the most representative `it`/`describe` title; add `tier:deep` if it asserts logic for a high-risk cap.
4. If shallow/missing → leave GAP; note for Phase 4 (smoke) or Phase 5 (deep).

## Related Code Files

- **Modify (titles only, no assertion changes):** the test files listed above — BOTH unit `.test.{js,jsx}` AND e2e `.spec.js` (e2e scanned by default per Phase 2; element coverage lives there, so e2e tagging is in-scope, not a stretch).
- **Read:** `feature-coverage-matrix.md` (Phase 2 output) to enumerate GAP rows + their layer.
- **Create:** `scripts/feature-inventory/tag-retrofit-audit.md` — short ledger of decisions (tagged vs left-GAP + reason), under `reports/`.

## Implementation Steps (TDD)

1. **`red:`** Add a guard test `tag-retrofit-guard.test.mjs`: assert that for a curated "must-be-PASS-after-retrofit" subset (e.g. `element.chart`, `flow.clipboard`, `control.format.bold`), the rebuilt matrix JSON shows `PASS`. Run → fails (tags not yet added).
2. **`green:`** Add `[cap:*]` tags to the existing tests confirmed to assert those caps. Re-run matrix. Guard test → passes.
3. Sweep remaining GAP rows: tag where real coverage exists; record leave-GAP decisions in `tag-retrofit-audit.md`.
4. Add `tier:deep` to existing deep-asserting tests for high-risk caps (clipboard, undo-redo, smart-guides, find-replace) where they truly assert behavior.
5. **`refactor:`** Normalize tag placement convention (document in audit ledger: tag goes on the primary scenario `it`); ensure no duplicate cap ownership.
6. Re-run `npm run matrix`; record before/after GAP counts in the ledger.

## Success Criteria

- [ ] Curated must-PASS subset shows `PASS` in rebuilt matrix (guard test green)
- [ ] GAP count drops to reflect genuine existing coverage (documented before/after)
- [ ] Every added tag points to a test that actually asserts the capability (audited, no empty-assert tags)
- [ ] `tier:deep` added only to tests asserting real behavior for high-risk caps
- [ ] `tag-retrofit-audit.md` records each leave-GAP decision with reason (feeds Phase 4/5)
- [ ] No assertion logic changed — `git diff` shows title-string edits only
- [ ] Commit log: `red:`→`green:`→`refactor:`

## Risk Assessment

- **Tag-lies** (primary) → explicit audit step + ledger; bias toward leaving GAP when a test is shallow; Phase 2 run-status join exposes skipped tests as `SKIP` (never green). Phase 5 adds the real deep test.
- **e2e vs unit layering** → e2e scanned by default (Phase 2), so e2e-only coverage classifies correctly with `layer: e2e`. Prefer unit/integration tags where both exist (run faster every PR), but a cap with only an e2e test is genuinely covered — tag it, don't mark GAP.
- **Over-tagging one cap across many files** → enforce "one primary owner" convention in refactor step.
- **Shortcut↔flow/canvas double-tagging confusion** → document the shared-id convention in the audit ledger; a keyboard test asserting "Ctrl+G groups" legitimately owns both `shortcut.group` and `canvas.group`.
- **Existing test depth unknown until read** → table marks "verify"/"check" items; budget time to actually open them.

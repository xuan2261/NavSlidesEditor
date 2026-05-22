---
title: "Icon Consistency Pass TDD"
description: "Single-PR icon audit cleanup across EditorPage: 9 of 10 issues (issue #7 deferred), TDD per phase, no UX regressions."
status: in-progress
priority: P2
branch: "master"
tags: [frontend, ui-ux, refactor, testing, tdd, icons]
blockedBy: []
blocks: []
created: "2026-05-21T08:05:10.088Z"
createdBy: "ck:plan"
source: skill
---

# Icon Consistency Pass TDD

## Overview

Resolve 9 of 10 icon issues identified in the EditorPage icon investigation report in one bundled PR. Issue #7 (PropertiesPanel section icons) deferred — premise verification (Red Team 2026-05-21) found zero `<h3>/<h4>` section headings in any property panel; #7 is a UX redesign, not an icon swap.

Scope spans ribbon tabs, canvas right-click menu, QuickAccessToolbar, SlidePanel, and SelectionPane.

Strategy (post Red Team de-scope): 4 phases, TDD per phase, single regression-guard test in Phase 1 (no ESLint plugin, no Babel inventory script, no baseline snapshots, no axe smoke spec — replaced with grep-based invariants in Phase 4).

User-confirmed decisions:
- Approve all 10 items (issue #7 deferred per Red Team Critical Finding 1 — confirmed 2026-05-21).
- 1 PR aggregated (no per-issue split).
- Keep proposed icon mappings unchanged (no icon swaps requested).

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Predecessor (related) | [260517-2252 Editor Ribbon Layout Hardening TDD](../260517-2252-editor-ribbon-layout-hardening-tdd/plan.md) | complete |
| Predecessor (related) | [260518-0711 Insert Ribbon Media Embed Direct Actions TDD](../260518-0711-insert-ribbon-media-embed-direct-actions-tdd/plan.md) | complete |
| Source report | EditorPage icon investigation (this session) | n/a |
| Blocker | [260521-2330 GitHub Actions Visual Baseline Regeneration TDD](../260521-2330-github-actions-visual-baseline-regeneration-tdd/plan.md) | complete |

Phase 4 visual baseline blocker is resolved by manual workflow run `26262072930` in the canonical Linux Playwright container. Local Windows snapshot updates remain prohibited by project docs.

## Key Decisions

- TDD: every phase has a failing test first, then implementation, then green.
- Tests use Vitest for unit/component. Single regression-guard test (Phase 1) replaces former ESLint plugin + Babel inventory + axe smoke + per-component snapshots (Red Team 2026-05-21, F2/F3/F5/F8/F10 accepted).
- `Sparkles` reserved for AI feature only post-merge. `Wand2` = animation/effect/transition/Auto-Animate/Kinetic Text. `LayoutTemplate` = template insertion.
- Canvas right-click menu becomes Lucide. No more emoji.
- Issue #7 (PropertiesPanel section icons) DEFERRED — Red Team Critical Finding 1 verified zero `<h3>/<h4>` section headings exist in any property panel; the issue is a UX redesign, not an icon swap. Tracked separately.
- Bundled PR keeps revert simple (single revert reverses all 9 fixes if regression found).
- No accessibility regression: every icon-only button keeps `aria-label`. Component tests assert this.
- No CSS/sizing changes. Pure icon swap unless an icon size mismatch surfaces during review.
- Phase 3 Issue #6 (align unify) scoped to actions Format tab actually has (left/center-h/right) — Red Team F11 accepted; rejected implicit "add 5 buttons to Format tab" reading.

## Phases

| Phase | Name | Status | Priority | Issues addressed |
|-------|------|--------|----------|------------------|
| 1 | [Foundation & Regression Guard](./phase-01-foundation-baseline-tests.md) | Complete | P1 | infra (lean) |
| 2 | [Critical Fixes — Context Menu + Sparkles Separation](./phase-02-critical-fixes.md) | Complete | P1 | #1 Critical, #2 High |
| 3 | [Standardization Sweep](./phase-03-standardization-sweep.md) | Complete | P2 | #3 #4 #5 #6 #8 #9 #10 |
| 4 | [Verify and PR](./phase-04-verify-and-pr.md) | In Progress | P1 | regression + PR |

**Deferred:** Phase 7 (issue #7 PropertiesPanel section icons) — see Red Team Review.

## Issue → Phase Mapping

| # | Issue | Tier | Phase |
|---|---|---|---|
| 1 | Canvas context menu emoji → Lucide | Critical | 2 |
| 2 | Sparkles overload → Sparkles/Wand2/LayoutTemplate | High | 2 |
| 3 | Pencil adjacent in Insert/Embed (Add SVG vs Add drawing) → Add SVG = FileImage | High | 3 |
| 4 | Layout x3 in Design tab → Footer = PanelBottom | High | 3 |
| 5 | Slide-Size presets all MonitorSmartphone → Monitor / Square / MonitorPlay / MonitorSpeaker | Medium | 3 |
| 6 | Align icons inconsistent (Format vs Home/Arrange) → unify (3 shared actions) | Medium | 3 |
| 7 | PropertiesPanel sub-panels missing icons → section headers | Medium | DEFERRED |
| 8 | Undo/Redo inline SVG → Undo2/Redo2 | Medium | 3 |
| 9 | BarChart2 vs BarChart3 → BarChart3 | Low | 3 |
| 10 | Image vs ImageIcon alias → Image as ImageIcon everywhere | Low | 3 |

## Out of Scope

- Issue #7 (PropertiesPanel section icons) — deferred. Premise (existing section headings to icon-decorate) does not exist in the codebase; needs a UX redesign plan, not an icon swap.
- MiniToolbar text format icons duplicate Home/Font (intentional bubble pattern, kept).
- Play reuse across Transitions/Animations/Header/Timeline (acceptable, kept).
- Lock/Unlock reuse across 4 panels (semantically correct, kept).
- ArrowUp/ArrowDown z-order vs slide-order (different sections, kept).
- Per-field icons inside PropertiesPanel forms.
- Plugin manifest icons (different surface, separate plan if needed).
- Format tab align expansion to top/middle/bottom/distribute — Format tab only has L/C-h/R, expansion = scope creep.
- Layout same-panel non-adjacent dup (Loop + Presenter) — invariant scoped to *adjacent* dedup per Validation Session 2.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Visual regression in affected files | Phase 1 regression-guard test + Phase 4 manual visual smoke per panel |
| User muscle memory broken (Sparkles → Wand2) | Tooltip text unchanged; visual still magic-wand vibe |
| Bundle size growth from new Lucide icons | Lucide tree-shakes per import; expected ≤2KB gzipped — not gated (Red Team F7) |
| Accessibility regression | Component tests assert `aria-label` presence on every icon-only button |
| Merge conflict on 1 PR | Phase 4 rebases on master right before PR; phases stack cleanly |
| Hidden Sparkles/BarChart2/inline-svg/raw-Image regression in fixtures | Phase 1 invariant test scans whole `client/src/**`, catches stragglers |

## Effort Estimate

| Phase | Effort |
|---|---|
| 1 — Foundation & Regression Guard | 0.5-1h |
| 2 — Critical Fixes (ctx-menu + Sparkles separation) | 2-2.5h |
| 3 — Standardization Sweep | 2-3h |
| 4 — Verify + PR | 0.5-1h |
| **Total** | **5-7.5h** |

(Down from 11-15h in the original 8-phase plan — Red Team de-scope removed ESLint plugin, Babel inventory, baseline snapshots, axe smoke spec, bundle gating, and Phase 7.)

## Success Criteria (plan-level)

- [x] 9 of 10 reported issues fixed and verified by phase-level tests (#7 deferred)
- [x] `icon-policy-invariants.test.js` all 5 `it` blocks green
- [x] All existing unit tests green; Playwright E2E not rerun in this session
- [x] Single commit exists: `1798929c refactor(icons): consistency pass for editor page`
- [x] PR description notes #7 deferred + links to Red Team Review section
- [x] Visual smoke per panel (Phase 4 checklist) complete

## Completion Verification — 2026-05-21

- Targeted Vitest: `8 passed`, `47 tests passed`.
- Full Vitest: `145 test files passed`, `1274 passed`, `1 skipped`.
- Lint: pass with 36 existing warnings outside icon pass scope.
- Build: pass.
- Code commit present on current branch: `1798929c refactor(icons): consistency pass for editor page`.
- Non-visual Playwright: `377 passed`, `1 skipped`, `1 flaky` retried/pass via `npx playwright test --grep-invert "visual|Visual" --reporter=list`.
- Full Playwright E2E: not green. Visual-only run fails with `11 failed`, `1 flaky`, `6 passed` due screenshot baseline diffs. Existing helper says baselines must be regenerated in `mcr.microsoft.com/playwright:v1.59.1-jammy`; Windows-host snapshot update intentionally not performed.
- User decision 2026-05-21: regenerate visual baselines in Docker for this PR. Execution blocked on current machine because Docker/Podman/Nerdctl are unavailable and WSL has no installed distro.
- Incremental E2E/accessibility fixes after `1798929c`: dropdown menu roles + keyboard activation + Escape close, QuickAccessToolbar accessible toolbar label, context-menu selector update, table helper accessible keyboard activation.
- Not completed in this session: visual snapshot baseline regeneration, PR creation.
- Completed 2026-05-22: visual snapshot baseline regeneration via manual workflow run `26262072930`; Linux baselines committed in `c340ef0b`.
- PR opened 2026-05-22: https://github.com/xuan2261/NavSlidesEditor/pull/2

## Validation Log

### Phase renumbering — 2026-05-21 (post Red Team)
Pre-Red Team plan had 8 phases; Red Team F4 collapsed to 4. Historical Validation Log entries below reference the OLD numbering. Map:

| Old phase | Old name | New phase |
|---|---|---|
| 01 | Foundation & Baseline Tests | 01 (rewritten lean) |
| 02 | Context Menu Emoji to Lucide | 02 (merged with 03) |
| 03 | Sparkles Semantic Separation | 02 (merged) |
| 04 | Adjacent Duplicate Dedup | 03 (merged with 05+06) |
| 05 | Cross-Area Icon Standardization | 03 (merged) |
| 06 | Undo Redo Lucide Migration | 03 (merged) |
| 07 | PropertiesPanel Section Icons | DEFERRED (Red Team F1) |
| 08 | Final Verification and PR | 04 |

All factual corrections from Validation Sessions 1+2 remain applied — they targeted icon mappings and call-sites, both of which carried forward to the new merged phases.

### Verification Results — 2026-05-21
- Tier: Full (8 phases)
- Roles run: Fact Checker, Contract Verifier, Flow Tracer, Scope Auditor
- Claims checked: ~28
- Verified: 18 | Failed: 8 | Unverified: 2
- Failures (file:line evidence):
  1. `eslint.config.js` — file does not exist; actual config is `eslint.config.mjs` (flat config, ESM).
  2. Phase 2 canvas ctx-menu listed Lock/Group/Rotate/Align/BringForward/Delete; `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx` has only Copy/Cut/Paste/Duplicate emoji + Crop (image) + Reset crop ↺ + 9-cell SNAP_ICONS unicode-arrow grid.
  3. Phase 3 missed `client/src/components/ribbon/ribbon-tabs-config.js:16` (Transitions tab icon = Sparkles).
  4. Phase 3 missed `client/src/components/SlidePanel.jsx:572` (Auto-Animate ctx-menu item Sparkles, in addition to badge:249 + Insert Template:469).
  5. Phase 3 mislabel: "Insert tab Animation gallery Sparkles" → actual is `ribbon-insert-tab-element-galleries-panel.jsx:391` "Kinetic Text" item in Advanced dropdown.
  6. Phase 4 display-preset names "Standard/Wide/Square/Custom" do not exist; `design-tab-content.jsx` `SIZE_PRESETS` = `[16:9, 4:3, Wide, Ultra]`.
  7. Phase 4 cluster "Insert/Drawing vs Insert/Annotation" mislabeled — actual adjacent pair in `ribbon-insert-tab-element-galleries-panel.jsx` Embed section (lines 363/373) is **"Add SVG"** + **"Add drawing"**, both Pencil. There is no "Annotation" button.
  8. Phase 5 `Image` raw-import scope incomplete — also present in `client/src/components/MediaLibraryModal.jsx:2`.

### Validation Session 1 — 2026-05-21
- **Q1 → A**: Phase 2 scope restricted to `canvas-right-click-context-menu-for-slide-elements.jsx` only. Lock/Group/Rotate/Align/Z-order/Delete dropped from this phase (not present in that file).
- **Q2 → A**: Phase 3 expanded — Transitions ribbon tab → `Wand2`; SlidePanel:572 Auto-Animate ctx-menu item → `Wand2`; relabel "Animation gallery" → "Advanced dropdown 'Kinetic Text' item".
- **Q3 → A**: Phase 4 preset mapping uses actual preset labels: `16:9 → Monitor`, `4:3 → Square`, `Wide → MonitorPlay`, `Ultra → MonitorSpeaker` (or `Maximize2` as fallback). Kiosk-mode button keeps `MonitorSmartphone`.
- **Q4 → A**: Phase 5 modify list adds `MediaLibraryModal.jsx`. Test asserts zero bare `Image` lucide imports across `client/src/**`.

### Silent factual corrections (no user choice involved)
- Phase 1: `eslint.config.js` → `eslint.config.mjs` everywhere. Plan/script glue updates to ESM accordingly.
- Phase 7: 10 property files in modify list verified to exist (no path corrections needed).

### Unresolved Questions
_None — resolved in Validation Session 2 below._

### Validation Session 2 — 2026-05-21
- **U1 → A**: Phase 4 "Add SVG" icon = `FileImage`. Reason: button calls `handleSvgFileUpload()` (file upload, not drawing). `FileImage` conveys both "file" + "image asset", matches user mental model. Embed dedup result: `Globe` (HTML) / `FileImage` (SVG) / `Pencil` (drawing) / `Scissors` (divider) — 4 distinct icons, zero adjacent dup. Already wired in phase-04 mapping table.
- **U2 → A**: Accept Layout same-panel non-adjacent dup (Loop line 279 + Presenter slide menu line 306, separated by `Grid3X3` + `MonitorSmartphone`). Issue #4 scope is **adjacent** dedup; expanding to non-adjacent is scope creep beyond the 10 approved issues. Invariant codified as "no two **adjacent** buttons share an icon" in phase-04 test + Notes.

### Whole-Plan Consistency Sweep — 2026-05-21 (post Session 2)
- Files reread: plan.md, phase-01..phase-08
- Decision deltas applied: 2 (U1=A, U2=A)
- Reconciled stale references: 0 (Phase 4 already had FileImage as recommended mapping)
- Unresolved contradictions: 0

### Validation Session 3 — 2026-05-21 (test layout)
- **Q1 → "Rename to scenario-based"**: Drop plan-numbered test filenames. Per `review-audit-self-decision.md` rule "plan refs do not belong in code", and to remain durable across plan renumbering, test files use scenario-based names.
- **Q2 → "Hybrid: invariants central, scenarios co-located"**: Project convention is co-located tests next to the source file. Plan-1 invariants test stays central (`client/src/__tests__/`) because it scans the whole tree. Phase-2/Phase-3 scenarios co-locate next to the owning component, reusing existing component test files where one already exists.

**Resulting test file layout (replaces former phase-02 / phase-03 monolithic test files):**

| Where | Action | File | Phase | Covers |
|---|---|---|---|---|
| central | keep | `client/src/__tests__/icon-policy-invariants.test.js` | 1 | 5 source-scan invariants |
| central | new | `client/src/__tests__/sparkles-icon-semantic-separation.test.jsx` | 2 | All 6 Sparkles call-site separations + AI regression guard (cross-cutting, not co-locatable) |
| co-located | append `describe` | `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx` | 2 | Lucide ctx-menu render + SNAP grid + aria-label retention |
| co-located | new | `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx` | 3 | Issue #3 — Add SVG = `FileImage`, Embed adjacent dedup invariant |
| co-located | new | `client/src/components/ribbon/design-tab-content.test.jsx` | 3 | Issues #4 + #5 — Footer = `PanelBottom`, 4 SIZE_PRESETS distinct icons |
| co-located | append `describe` | `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx` | 3 | Issue #6 — Align L/C-h/R Lucide refs match `arrange-controls.jsx` for the 3 shared actions |
| co-located | new | `client/src/components/QuickAccessToolbar.test.jsx` | 3 | Issue #8 — Undo2/Redo2 render + zero inline `<svg>` |
| co-located | new | `client/src/components/SelectionPane.test.jsx` | 3 | Issue #9 — chart row uses `BarChart3`, image row uses `ImageIcon` alias |
| n/a | covered by invariants | `MediaLibraryModal.jsx` | 3 | Issue #10 — `Image as ImageIcon` invariant scanned by Phase 1 source-scan; no separate component test |

**File count delta:** old plan = 3 new test files (1 invariants + 2 monolithic phase tests). New plan = 6 new test files + 2 append-only edits to existing test files. Granularity matches project convention (co-located); scenario names are durable across plan renumbering. Net Vitest run-time impact negligible (each new file has 1–3 `it` blocks).

### Whole-Plan Consistency Sweep — 2026-05-21 (post Session 3)
- Files reread: plan.md, phase-01-foundation-baseline-tests.md, phase-02-critical-fixes.md, phase-03-standardization-sweep.md, phase-04-verify-and-pr.md
- Decision deltas applied: 2 (Q1=scenario rename, Q2=hybrid layout)
- Stale references reconciled:
  - Phase 2: `phase-02-critical-fixes.test.jsx` removed from Create list; replaced with appendix to existing ctx-menu test + new `sparkles-icon-semantic-separation.test.jsx`. Implementation Steps + Test Strategy + Success Criteria rewritten to reference the new files.
  - Phase 3: `phase-03-standardization-sweep.test.jsx` removed from Create list; replaced with the 4 new co-located test files + 1 appendix listed above. Implementation Steps + Test Strategy + Success Criteria rewritten.
  - Phase 4: PR description checklist + verification matrix references re-pointed at new file names ("phase-02-/phase-03- test files" → "scenario-named test files"). Visual smoke unchanged.
- Unresolved contradictions: 0

**Recommendation:** Plan is consistent and verified. Eligible for `/ck:cook` (Phase 1 source-scan invariants unchanged; per-phase tests now scenario-named and co-located per project convention).

## Red Team Review

### Session — 2026-05-21
**Reviewers spawned:** 4 (Scope & Complexity Critic, Failure Mode Analyst, Security Adversary, Assumption Destroyer)
**Reviewers delivering written reports:** 1 (Scope & Complexity Critic; Failure Mode Analyst + Security Adversary 429 rate-limited; Assumption Destroyer agent completed without writing report file)
**Direct verification by planner:** Covered Fact Checker + Scope Auditor territory via grep/read passes (file:line evidence below)
**Findings:** 11 (10 from Scope Critic + 1 from planner verification) — 8 accepted, 3 user-confirmed (F1, F4, F11), 0 rejected

**Severity breakdown:** 2 Critical, 4 High, 5 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Phase 7 builds on phantom `<h3>` headings (zero `<h3>/<h4>` in any property panel) | Critical | Accept (user pick a) | Phase 7 DROPPED, issue #7 deferred |
| 2 | Phase 1 ships custom ESLint plugin (2 rules + whitelist) for 5 emoji + 2 SVG | Critical | Accept | Phase 1 rewritten — single Vitest source-scan |
| 3 | Phase 1 Babel inventory script — grep is enough | High | Accept | Phase 1, Phase 4 — script removed |
| 4 | 8 phases for 10 mechanical swaps — over-phased | High | Accept (user pick a) | Phases collapsed 8 → 4 |
| 5 | 22 new test files — test bloat | High | Accept | Reduced via Validation Session 3 to: 2 central files (invariants + sparkles separation) + 4 new co-located component tests + 2 appended `describe` blocks |
| 6 | `PropertySectionHeader` premature abstraction | Medium | Accept (moot) | Component dropped with Phase 7 |
| 7 | Phase 8 bundle-delta ±5KB gating + double build | Medium | Accept | Phase 4 (verify) — bundle gate removed |
| 8 | Snapshot tests + assertion tests = re-baselined every phase | Medium | Accept | Phase 1 — 8 baseline snapshots dropped |
| 9 | "9 sub-panels" claim vs 10 modify-list vs 11 in dir | Medium | Accept (moot) | Resolved by Phase 7 drop |
| 10 | Phase 1 axe smoke spec — Vitest aria-label suffices | Medium | Accept | Phase 1 — axe spec dropped |
| 11 | Phase 5 align unify ignores Format tab having only 3/8 actions | High | Accept (user pick a) | Phase 3 — invariant scoped to 3 shared actions |

### Verification evidence (file:line)

- F1: `grep -rn "h3\|h4" client/src/components/properties --include="*.jsx" | grep -v test` returns empty; only `<label>` matches exist (e.g., `client/src/components/properties/common-element-controls.jsx:87`).
- F2: `client/src/components/QuickAccessToolbar.jsx:77,98` — exactly 2 inline `<svg>` blocks (verified). Single ctx-menu file is the only emoji source.
- F9: `ls client/src/components/properties/*.jsx | grep -v test` → 11 files (chart, code, common-element-controls, game-properties-question-editor, game-properties, image, media, misc, shape, table, timeline).
- F11: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx:295,303,311` — only 3 align buttons (left / center / right). `client/src/components/ribbon/controls/arrange-controls.jsx:20-27` has 8 actions (left, center-h, right, top, center-v, bottom, distribute-h, distribute-v). "Unify" cannot mean "match Home/Arrange's 8 buttons" without scope creep.
- All target Lucide names verified in `client/src/data/icon-paths.json` (1 hit each): CopyPlus, Crosshair, MonitorPlay, MonitorSpeaker, FileImage, Wand2, LayoutTemplate, BarChart3, Undo2, Redo2, PanelBottom, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter.

### Reviewer reports
- `reports/from-code-reviewer-to-planner-red-team-scope-complexity-critic-plan-review-report.md` (full 10 findings)
- Failure Mode Analyst + Security Adversary: 429-rate-limited; planner covered their fact-checking territory directly (above).

### Whole-Plan Consistency Sweep — 2026-05-21 (post Red Team)
- Files reread: plan.md, phase-01-foundation-baseline-tests.md, phase-02-critical-fixes.md, phase-03-standardization-sweep.md, phase-04-verify-and-pr.md
- Decision deltas applied: 11 (F1..F10 accepted + F11 accepted)
- Stale references reconciled:
  - Old phases 02..08 deleted from disk; references in plan.md Phases table + Issue→Phase Mapping rewritten.
  - Key Decisions: dropped "ESLint rule" line + "PropertiesPanel sub-panels get section icons" line; added Sparkles/Wand2 reservation note + Phase 7 deferral.
  - Out of Scope: added #7 deferral, Format tab align expansion, Layout non-adjacent dup.
  - Risks & Mitigations: removed ESLint rule false-positives row; rewrote bundle-size row to "not gated".
  - Effort Estimate: 11-15h → 5-7.5h.
  - Success Criteria: 10→9 issues, removed ESLint rule + bundle delta + axe items; added invariants + visual smoke.
- Unresolved contradictions: 0

**Recommendation:** Plan reduced from 8 phases / 11-15h / 22 test files to 4 phases / 5-7.5h / 6 new test files (2 central + 4 co-located) + 2 append-only edits. Issue #7 deferred to a separate UX plan. Eligible for `/ck:cook` (post Validation Session 3).

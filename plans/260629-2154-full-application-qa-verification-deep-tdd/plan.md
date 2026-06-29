---
title: "Full Application QA Verification Deep TDD"
status: completed-with-warnings
priority: P1
created: 2026-06-29
source: ck:plan --deep --tdd
scope: project
blockedBy: []
blocks:
  - 260522-1339-qa-confidence-uplift-5-phase-tdd
  - 260609-0830-element-control-functional-fixes-tdd
relatedPlans:
  - 260617-0739-element-control-audit-matrix-tdd
  - 260615-1641-long-term-automated-coverage-expansion-tdd
  - 260531-2013-test-system-governance-and-matrix-debt-tdd
  - 260523-0500-upstream-parity-verification-tdd
---

# Full Application QA Verification Deep TDD

## Overview
Create a complete, executable QA system for NavSlides Editor that verifies every major feature surface: editor logic, element lifecycle, properties/ribbon controls, slide workflows, live presentation, game mode, import/export, sharing, sync, AI boundaries, accessibility, visual regressions, and release gates. This plan is TDD-first: each phase starts by defining missing test contracts or matrix failures before implementation.

## Scope Challenge
- Do not attempt a single giant brittle browser test; build a layered test pyramid plus traceability gates.
- Do not depend on the unfinished upstream-parity oracle as a hard blocker; reuse it as an optional comparison lane only.
- Do not rewrite product code unless tests expose real defects; this is a QA verification plan, not a feature plan.
- Do not trust stale green matrices; regenerate inventory, matrix, coverage, and reports inside this plan.

## Current Baseline
- Test commands already exist: `npm run test`, `npm run test:coverage`, `npm run lint`, `npm run test:e2e`, `npm run matrix:gate`, `npm run test:corpus`, `npm run test:pptx:strict`, `npm run test:load:api:smoke`, `npm run test:load:ws:smoke`.
- Existing tests cover many surfaces but are scattered across Vitest, Playwright, k6, corpus, matrix, visual, and release-governance specs.
- Existing relevant plans mostly completed matrix/governance foundations; pending plans are superseded by this broader plan.

## Phase Roadmap

| Phase | Title | Status | Priority | Dependency | Deliverable |
|---:|---|---|---|---|---|
| 1 | Research Baseline | completed | P1 | none | Fresh inventory, risk map, stale-plan reconciliation |
| 2 | Traceability Matrix | completed | P1 | 1 | Canonical capability × surface × depth matrix gate |
| 3 | Test Harness Contracts | completed | P1 | 2 | Stable fixtures, selectors, page objects, data builders |
| 4 | Element Control Tests | completed | P1 | 3 | 19 element type control/render/persist/export coverage |
| 5 | Workflow E2E Tests | completed | P1 | 3 | End-to-end editor/dashboard/present/live/game/import/export coverage |
| 6 | Visual Accessibility QA | completed | P1/P2 | 3,4,5 | P1 keyboard/a11y gates plus P2 visual/responsive coverage |
| 7 | Backend Integration Gates | completed | P1 | 2,3 | API/socket/storage/security/load/corpus gates |
| 8 | CI Evidence Governance | completed | P1 | 1-7 | Fast/full/nightly lanes and release evidence gate |

## TDD Strategy
1. Red: add matrix rows and failing contract tests for every missing capability.
2. Green: implement only the minimum selectors, helpers, fixtures, or product fixes needed.
3. Refactor: deduplicate helpers into `tests/e2e/pages/`, existing feature-inventory scripts, and focused unit tests.
4. Gate: every phase ends with a command-level validator and evidence artifact.

## Capability Taxonomy
- Editor core: select, move, resize, rotate, crop, lock, hide, group, z-order, snapping, rulers, guides, grid, multi-select, undo/redo, history, autosave, clipboard, find/replace, command palette.
- Elements: text, image, shape, code, LaTeX/TikZ, HTML, Markdown, chart, video, audio, table, QR, icon, callout, drawing, line, SVG, timeline, game.
- Controls: every ribbon tab/action, contextual format tab, properties panel control, status bar control, modal control, quick access action, menu item, selection pane action, timeline/animation control, slide panel action, and keyboard shortcut. P1 controls get interaction+persistence; P2 controls get contract/focused coverage; P3 controls get source inventory plus smoke/manual evidence.
- Workflows: create/open/save/delete, templates, slide layouts, vertical slides, themes, transitions, animations/fragments, export HTML/offline/PDF/PPTX/project, import Markdown/PPTX/project, share, GitHub push, sync, AI generation/translate/rewrite, media search/upload.
- Presentation: present mode, speaker view, live viewer, remote control, annotations, timers, overlays, reconnect, room cleanup.
- Game: all 10 game variants, player join, scoring, leaderboard, presenter shortcuts, socket lifecycle.
- Variants: shape variants, chart types, slide layouts, reveal themes/transitions, design presets, animated FX backgrounds, ribbon insert sub-actions, game subtypes, media providers, export formats.
- Secondary app surfaces: plugin runtime, marketplace, explore page, analytics/view tracking, settings, Electron desktop shell and packaging.

## Success Criteria
- [ ] `npm run matrix:gate` fails on missing capability coverage and passes after all mapped gates are implemented.
- [ ] Every canonical element type and source-derived variant/subtype has insertion or source contract coverage, plus appropriate interaction/persistence/export depth by priority.
- [ ] Every control has a matrix row; P1 controls are release-blocking, P2/P3 controls have justified lower-depth gates.
- [ ] Every high-risk workflow has a deterministic E2E or integration gate.
- [ ] P1 keyboard/focus/axe-critical checks cover editor, home, present, share, live, speaker/remote, game, Electron shell, and responsive breakpoints; broader visual polish is separately waivable.
- [ ] Backend API/socket/storage/security/load/corpus gates run in documented fast/full/nightly lanes.
- [ ] CI produces machine-readable QA evidence and blocks releases on missing P1 coverage.

## Red-Team Findings
- Risk: “all functionality” can become unbounded. Mitigation: use a canonical capability matrix derived from source inventories and README feature claims, then enforce ownership per row.
- Risk: browser tests become slow/flaky. Mitigation: put pure logic in Vitest, contract surfaces in integration tests, and only end-user workflows in Playwright.
- Risk: visual snapshots produce noisy failures. Mitigation: deterministic freeze helpers, scoped baselines, and manual baseline refresh workflow.
- Risk: trusted author HTML may trigger false security failures. Mitigation: encode trust-boundary rules from README and only block cross-boundary exposure.
- Risk: desktop, plugin, marketplace, explore, analytics, and variant subtypes are easy to miss if only canonical elements are counted. Mitigation: Phase 1/2 source inventories must create first-class matrix rows for these surfaces.

## Validation Questions Resolved
- Should upstream parity be a blocker? No; optional comparison lane only.
- Should old pending QA plans be updated or replaced? Replaced by this umbrella plan; this plan blocks them.
- Should implementation start immediately? No; this artifact is planning only.

## Open Questions
None.

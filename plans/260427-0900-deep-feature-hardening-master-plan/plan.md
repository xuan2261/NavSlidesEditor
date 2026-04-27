---
title: "Deep Feature Hardening Master Plan"
description: "Execute command-layer unification, canvas decomposition, shortcut registry, PPTX import fidelity, and validated P2 features."
status: pending
priority: P1
effort: "8-13w gated"
branch: master
tags: [refactor, frontend, pptx, analytics, tech-debt]
blockedBy: []
blocks: []
created: "2026-04-27"
---

# Deep Feature Hardening Master Plan

## Overview

Hard-mode execution plan replacing the stalled `260427-0531-deep-feature-synthesis-hardening-roadmap`.
The critical path: Phase 1 (Phase 2 cleanup) -> Phase 2 (Phase 3 canvas decomposition, BLOCKER) -> Phase 3+ (unblocked).

Baseline state:
- `SlideCanvas.jsx`: **2759 LOC** (god component)
- `EditorPage.jsx`: **1662 LOC** (god component)
- Phase 2 (Command Unification): **~40%** — keyboard hook improved, but SlideCanvas STILL has inline keyboard listener (lines 508-649) and inline clipboard (lines 560-646)
- Phase 3-5, 7-10: **0%** — all blocked on Phase 2 + Phase 3
- Missing tests: `use-clipboard.test.js`, `shortcut-registry.test.js`, `shortcut-storage.test.js`
- `use-history.js`: DELETED in working copy (uncommitted)

## Scope

- P0: Command layer cleanup (Phase 1) + Canvas decomposition (Phase 2)
- P1: Shortcut registry (Phase 4) + PPTX import fidelity (Phase 5)
- P2: Slide Master validation (Phase 6), PDF spike (Phase 7), Analytics (Phase 8)
- Out of scope: realtime collab, SaaS, mobile, plugin marketplace, AI features, full TypeScript migration

## Phases

| Phase | Name | Status | Priority |
|-------|------|--------|----------|
| 0 | [Pre-flight & Baseline](./phase-00-preflight-baseline.md) | Completed | P0 |
| 1 | [Complete Command Layer Unification](./phase-01-complete-command-layer-unification.md) | Completed | P0 |
| 2 | [Phase 3: Canvas Render Decomposition](./phase-02-canvas-render-decomposition.md) | Pending | P0 |
| 3 | [Phase 4: Canvas Chrome & Interaction Extraction](./phase-03-canvas-chrome-interaction-extraction.md) | Pending | P0 |
| 4 | [Phase 5: Custom Shortcut Registry](./phase-04-custom-shortcut-registry.md) | Pending | P1 |
| 5 | [Phase 6: PPTX Import Fidelity](./phase-05-pptx-import-fidelity.md) | Pending | P1 |
| 6 | [Phase 7: Slide Master Validation](./phase-06-slide-master-validation.md) | Pending | P2 |
| 7 | [Phase 8: PDF Import Spike](./phase-07-pdf-import-spike.md) | Pending | P2 |
| 8 | [Phase 9: Privacy Bounded Analytics](./phase-08-privacy-bounded-analytics.md) | Pending | P2 |
| 9 | [Phase 10: Docs, Changelog & Release Gates](./phase-09-docs-changelog-release-gates.md) | Pending | P1 |

## Critical Dependency Chain

```
Phase 0 (baseline)
  -> Phase 1 (command cleanup) [BLOCKER: Phase 2+]
    -> Phase 2 (canvas decomposition) [BLOCKER: Phase 3, 4, 5]
      -> Phase 3 (chrome/interaction)
      -> Phase 4 (shortcuts) [also needs Phase 3]
      -> Phase 5 (PPTX import) [needs Phase 0 only, runs parallel]
    -> Phase 6 (slide master) [P2 gated, needs Phase 3]
    -> Phase 7 (PDF spike) [P2 gated]
    -> Phase 8 (analytics) [P2 gated]
      -> Phase 9 (docs/release)
```

## Global Gates

- After every code phase: `npm run lint` + `npm run build`
- After every code phase: targeted unit tests + Playwright suites
- Target: `SlideCanvas.jsx <= 1200 LOC` (Phase 2), `SlideCanvas.jsx <= ~900 LOC` after Phase 3 (~600 is stretch goal only)
- Keep new modules under 200 LOC
- TDD: tests first, then implementation

## Test File Inventory

| File | Phase | Status |
|------|-------|--------|
| `client/src/hooks/use-clipboard.test.js` | P1 | **CREATE** |
| `client/src/hooks/use-keyboard.test.js` | P1 | EXISTS |
| `tests/e2e/keyboard-shortcuts.spec.js` | P1 | EXISTS (update) |
| `client/src/utils/markdown-utils.test.js` | P2 | **CREATE** |
| `tests/e2e/elements.spec.js` | P2 | EXISTS (update selectors) |
| `tests/e2e/visual-regression.spec.js` | P2/P3 | EXISTS |
| `client/src/utils/shortcut-registry.test.js` | P4 | **CREATE** |
| `client/src/utils/shortcut-storage.test.js` | P4 | **CREATE** |
| `client/src/utils/shortcut-normalizer.test.js` | P4 | **CREATE** |
| `tests/e2e/settings.spec.js` | P4 | EXISTS (update) |
| `server/services/pptx-import/chart-metadata.test.js` | P5 | **CREATE** |
| `server/services/pptx-import/*.test.js` (existing) | P5 | EXISTS |
| `tests/e2e/pptx-import-fidelity.spec.js` | P5 | EXISTS |
| `client/src/components/AnalyticsModal.test.jsx` | P8 | **CREATE** |
| `server/routes/analytics.test.js` | P8 | **CREATE** |
| `tests/e2e/live.spec.js` | P8 | EXISTS |

## Reports

- Audit: `plans/reports/debugger-260427-0823-refactoring-plan-audit.md`
- Old plan: `plans/260427-0531-deep-feature-synthesis-hardening-roadmap/plan.md`

## Unresolved Questions

1. ~~Was Phase 2 intentionally stopped at ~40%?~~ **Yes — confirmed, ~40% done is acceptable baseline.**
2. ~~Is the PPTX export hardening (1781 lines) meant to satisfy Phase 6?~~ **No — export ≠ import. Phase 5 is import fidelity.**
3. ~~Should `use-history.js` deletion be formally committed?~~ **Yes — Phase 0 task.**
4. ~~Phase 3 first extraction candidate: shape/image or text/markdown?~~ **Callout/Icon first (zero deps). markdown-utils is BLOCKER for MarkdownRenderer.**
5. Shortcut physical (`e.code`) vs logical (`e.key`) default? **Recommendation: keep `e.key` (logical) unless product decision says otherwise.**
6. **Is the 50ms `setTimeout` in `performDuplicate` intentional?** **Must be resolved before Phase 1 implementation — affects user-visible behavior.**
7. **Does `pptxtojson` expose `oleType`/`oleClass` for embedded objects?** **Needs corpus testing with OLE-embedded deck.**
8. **Does `pptxtojson` expose `element.legend`/`element.legendPos`?** **Needs verbose corpus trace.**
9. **Who owns Python/Electron packaging decision for Phase 7?** **Default: Node.js path only (pdf-parse). Python = enterprise option.**
10. **Phase 5 runs parallel to Phase 1-3 — which team member handles it?**

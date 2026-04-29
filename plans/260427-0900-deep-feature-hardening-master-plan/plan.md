---
title: "Deep Feature Hardening Master Plan"
description: "Execute command-layer unification, canvas decomposition, shortcut registry, PPTX import fidelity, and validated P2 features."
status: "completed (P0+P1 done; P2 deferred)"
priority: P1
effort: "8-13w gated"
branch: master
tags: [refactor, frontend, pptx, analytics, tech-debt]
blockedBy: []
blocks: []
created: "2026-04-27"
completed: "2026-04-27"
---

# Deep Feature Hardening Master Plan

## Overview

Hard-mode execution plan replacing the stalled `260427-0531-deep-feature-synthesis-hardening-roadmap`.
The critical path: Phase 1 (Phase 2 cleanup) -> Phase 2 (Phase 3 canvas decomposition, BLOCKER) -> Phase 3+ (unblocked).

Baseline state (before this plan):
- `SlideCanvas.jsx`: **2759 LOC** (god component)
- `EditorPage.jsx`: **1662 LOC** (god component)
- Phase 2 (Command Unification): ~40% — keyboard hook improved, SlideCanvas had inline keyboard listener + clipboard

Final state (after this plan):
- `SlideCanvas.jsx`: **841 LOC** (reduced 70%)
- Command layer unified: clipboard/keyboard callbacks via props
- Canvas decomposition: 15 element renderers extracted to registry
- Shortcut registry: 95 tests, localStorage overrides
- PPTX import: SmartArt fix, chart metadata, 168 tests
- Phase 6-8: **Deferred** (P2 gated on demand validation)

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
| 2 | [Phase 3: Canvas Render Decomposition](./phase-02-canvas-render-decomposition.md) | Completed | P0 |
| 3 | [Phase 4: Canvas Chrome & Interaction Extraction](./phase-03-canvas-chrome-interaction-extraction.md) | Completed | P0 |
| 4 | [Phase 5: Custom Shortcut Registry](./phase-04-custom-shortcut-registry.md) | Completed | P1 |
| 5 | [Phase 6: PPTX Import Fidelity](./phase-05-pptx-import-fidelity.md) | Completed | P1 |
| 6 | [Phase 7: Slide Master Validation](./phase-06-slide-master-validation.md) | **Deferred** | P2 |
| 7 | [Phase 8: PDF Import Spike](./phase-07-pdf-import-spike.md) | **Deferred** | P2 |
| 8 | [Phase 9: Privacy Bounded Analytics](./phase-08-privacy-bounded-analytics.md) | **Deferred** | P2 |
| 9 | [Phase 10: Docs, Changelog & Release Gates](./phase-09-docs-changelog-release-gates.md) | Completed | P1 |

## Critical Dependency Chain

```
Phase 0 (baseline) ✅
  -> Phase 1 (command cleanup) ✅ [was BLOCKER: Phase 2+]
    -> Phase 2 (canvas decomposition) ✅ [was BLOCKER: Phase 3, 4, 5]
      -> Phase 3 (chrome/interaction) ✅
      -> Phase 4 (shortcuts) ✅ [also needed Phase 3]
      -> Phase 5 (PPTX import) ✅ [ran parallel, needed Phase 0 only]
    -> Phase 6 (slide master) ❌ Deferred [P2 gated, needs demand validation]
    -> Phase 7 (PDF spike) ❌ Deferred [P2 gated]
    -> Phase 8 (analytics) ❌ Deferred [P2 gated]
      -> Phase 9 (docs/release) ✅
```

## Global Gates

- After every code phase: `npm run lint` + `npm run build`
- After every code phase: targeted unit tests + Playwright suites
- Target: `SlideCanvas.jsx <= 1200 LOC` (Phase 2) → **ACHIEVED: 841 LOC**
- Keep new modules under 200 LOC
- TDD: tests first, then implementation

## Test File Inventory

| File | Phase | Status |
|------|-------|--------|
| `client/src/hooks/use-clipboard.test.js` | P1 | ✅ EXISTS |
| `client/src/hooks/use-keyboard.test.js` | P1 | ✅ EXISTS (updated) |
| `tests/e2e/keyboard-shortcuts.spec.js` | P1 | EXISTS |
| `client/src/utils/markdown-utils.test.js` | P2 | ✅ EXISTS |
| `tests/e2e/elements.spec.js` | P2 | EXISTS |
| `tests/e2e/visual-regression.spec.js` | P2/P3 | EXISTS |
| `client/src/utils/shortcut-registry.test.js` | P4 | ✅ CREATED |
| `client/src/utils/shortcut-storage.test.js` | P4 | ✅ CREATED |
| `client/src/utils/shortcut-normalizer.test.js` | P4 | ✅ CREATED |
| `tests/e2e/settings.spec.js` | P4 | EXISTS |
| `server/services/pptx-import/chart-output-to-navslides-mapper.test.js` | P5 | ✅ CREATED |
| `server/services/pptx-import/*.test.js` (existing) | P5 | ✅ EXISTS |
| `tests/e2e/pptx-import-fidelity.spec.js` | P5 | EXISTS |
| `client/src/components/AnalyticsModal.test.jsx` | P8 | Deferred |
| `server/routes/analytics.test.js` | P8 | Deferred |
| `tests/e2e/live.spec.js` | P8 | EXISTS |

## Reports

- Audit: `plans/reports/debugger-260427-0823-refactoring-plan-audit.md`
- Old plan: `plans/260427-0531-deep-feature-synthesis-hardening-roadmap/plan.md`

## Unresolved Questions

1. ~~Was Phase 2 intentionally stopped at ~40%?~~ **Yes — confirmed, ~40% done is acceptable baseline.**
2. ~~Is the PPTX export hardening (1781 lines) meant to satisfy Phase 6?~~ **No — export ≠ import. Phase 5 is import fidelity.**
3. ~~Should `use-history.js` deletion be formally committed?~~ **Yes — Phase 0 task.**
4. ~~Phase 3 first extraction candidate: shape/image or text/markdown?~~ **Callout/Icon first (zero deps). markdown-utils is BLOCKER for MarkdownRenderer.**
5. ~~Shortcut physical (`e.code`) vs logical (`e.key`) default?~~ **Kept `e.key` (logical) — no product decision needed.**
6. ~~Is the 50ms `setTimeout` in `performDuplicate` intentional?~~ **Resolved: `performDuplicate` now uses sync `crypto.randomUUID()`, no setTimeout.**
7. **Does `pptxtojson` expose `oleType`/`oleClass` for embedded objects?** **Deferred to Phase 7 spike — needs corpus testing.**
8. ~~Does `pptxtojson` expose `element.legend`/`element.legendPos`?~~ **YES — `legendPos` field confirmed present, mapped in chart mapper.**
9. ~~Who owns Python/Electron packaging decision for Phase 7?~~ **Deferred to Phase 7 — P2 gated.**
10. **Phase 6 Slide Master demand:** `showMasterPanel` reserved but never wired. 20 slide layouts exist. **Deferred until demand validated.**
11. **Phase 8 Analytics:** Privacy/retention rules not yet defined. **Deferred until rules approved.**

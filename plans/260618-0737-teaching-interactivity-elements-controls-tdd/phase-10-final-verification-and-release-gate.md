---
phase: 10
title: "Final Verification And Release Gate"
status: completed
priority: P1
effort: "1-2d"
dependencies: [2, 3, 4, 5, 6, 7, 8, 9]
---

# Phase 10: Final Verification And Release Gate

## Overview

Run whole-plan verification, reconcile matrix/export docs, and block release if static exports or privacy contracts regress. Also record an MVP checkpoint after Phases 1-4 if the team wants to ship P0 before P1 follow-ups.

## Requirements

- Functional: Verify P0+P1 features end-to-end.
- Non-functional: Validators pass; no private live data in exports; no stale docs or matrix claims.

## Architecture

Use existing npm scripts and matrix gates. Run targeted tests first, then broader lint/test/build. PPTX browser audit runs if any phase changed export behavior materially.

## Related Code Files

- Modify: `plans/260618-0737-teaching-interactivity-elements-controls-tdd/reports/*` if validation reports are saved
- Modify: `docs/export-fidelity-and-limits.md` only if fallback policy changed
- Modify: `README.md` only if shipped game subtype count or Insert action count changes
- No feature source changes unless fixing validation failures

## Implementation Steps

1. Re-read `plan.md` and all phase files; remove contradictions.
2. Run targeted test groups per phase.
3. Run `npm run matrix:gate`.
4. Run `npm run test`, `npm run lint`, `npm run build`.
5. Run relevant e2e and PPTX/export checks.
6. Check documentation drift: README game subtype count, Insert ribbon variant count, canonical 19 element count, export-fidelity limits.
7. Save final verification report.

## Success Criteria

- [x] Matrix gate passes.
- [x] Unit tests pass.
- [x] Lint passes.
- [x] Build passes.
- [x] E2E smoke covers Mermaid/STEM/poll activity path.
- [x] P1 family smoke coverage exists for word cloud, matching, code walkthrough, LaTeX UX, and symbol packs through e2e or targeted component/integration tests.
- [x] Export warning report includes expected matrix row ids.
- [x] No live participant data appears in static exports unless explicitly saved.
- [x] README counts match shipped game subtypes and still report 19 canonical element types.

## Risk Assessment

Risk: full e2e/PPTX audit runtime. Mitigation: run targeted e2e during phases; reserve full audit for final gate or export changes.

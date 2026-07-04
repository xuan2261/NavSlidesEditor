---
title: "Element Interaction and Control Bug Fixes Deep TDD Plan"
description: "Fix likely element, control, selection, group, lock, context menu, keyboard nudge, and export/render interaction defects found by the ck-debug audit."
status: completed
priority: P0
effort: "5-8 dev-days"
branch: master
tags: [tdd, frontend, editor, elements, controls, interaction, export]
blockedBy: []
blocks: []
created: 2026-07-03
createdBy: ck-plan-skill
mode: "--deep --tdd"
redTeamReviewed: 2026-07-03
validated: 2026-07-03
---

# Element Interaction and Control Bug Fixes Deep TDD Plan

## Overview

This plan turns the debug report into a regression-safe, test-first repair program for element interactions in NavSlides Editor. Scope is limited to the seven reported defect families: line selection, multi/group drag boundary behavior, keyboard nudge clamping, locked-element mutation paths, context-menu Cut semantics, group selection semantics, and line export clipping.

## Source Context

| Source | Use |
|---|---|
| Debug report from current session | Primary defect list and priorities |
| `client/src/components/canvas/canvas-element-wrapper.jsx` | Element wrapper, line pointer events, editor overflow behavior |
| `client/src/components/canvas/use-canvas-pointer-interaction.js` | Drag/move/resize/rotate math and batch move behavior |
| `client/src/pages/EditorPage.jsx` | Keyboard nudge, updateSelectedElements, z-order and selection callbacks |
| `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx` | Context menu Cut/Copy/Paste/Duplicate behavior |
| `client/src/components/canvas/use-canvas-rubber-band-drag-selection.js` | Marquee hit testing and selection application |
| `client/src/utils/active-slide-selection.js` | Group-aware pointer-down selection resolver |
| `shared/src/element-renderers.js` | Reveal/export renderer wrapper overflow and line SVG output |

## Scope

In scope:
- TDD reproduction tests for each defect before implementation.
- Source-level fixes using current project patterns, no EditorPage rewrite.
- Unit/component tests for helper-level behavior.
- Existing interaction characterization tests extended when appropriate.
- Final validators: targeted Vitest during phases, then `npm run test`, `npm run lint`, and `npm run build`.

Out of scope:
- New element types or new controls.
- Broad E2E suite expansion beyond one mandatory scoped Playwright smoke spec for browser-only interaction behavior.
- PPTX export parity beyond preventing shared HTML/reveal line clipping.
- Documentation updates unless implementation exposes a changed user-facing contract.

## Defect Backlog

| ID | Defect | Severity | Primary files |
|---|---|---:|---|
| D1 | Unselected line elements cannot be directly clicked because wrapper pointer events are disabled | P1 | `canvas-element-wrapper.jsx` |
| D2 | Multi-select/group drag clamps each member independently and can distort layout near slide edges | P0 | `use-canvas-pointer-interaction.js` |
| D3 | Arrow-key nudge can move elements outside slide bounds | P1 | `EditorPage.jsx` |
| D4 | Locked elements can still mutate through Properties/Ribbon/updateSelectedElements | P0 | `EditorPage.jsx`, `common-element-controls.jsx`, ribbon controls |
| D5 | Context-menu Cut can affect current selection plus delete right-clicked element, and can bypass locked expectations | P0 | `canvas-right-click-context-menu-for-slide-elements.jsx` |
| D6 | Marquee/shift selection can select partial group members, causing grouped elements to move independently | P1 | `use-canvas-rubber-band-drag-selection.js`, `active-slide-selection.js` |
| D7 | Lines can render in editor with visible overflow but clip arrowheads/strokes in exported reveal HTML | P1 | `canvas-element-wrapper.jsx`, `shared/src/element-renderers.js` |

## Phase Roadmap

| # | Phase | Defects | Priority | Status |
|---|---|---|---|---|
| 1 | [Interaction Repro Harness](phase-01-interaction-repro-harness.md) | D1-D7 | P0 | completed |
| 2 | [Movement Boundary Semantics](phase-02-movement-boundary-semantics.md) | D2, D3 | P0 | completed |
| 3 | [Lock Contract Enforcement](phase-03-lock-contract-enforcement.md) | D4, D5 partial | P0 | completed |
| 4 | [Context Menu Selection Semantics](phase-04-context-menu-selection-semantics.md) | D5 | P0 | completed |
| 5 | [Group Selection Semantics](phase-05-group-selection-semantics.md) | D6 | P1 | completed |
| 6 | [Line Hit Target and Export Fidelity](phase-06-line-hit-target-and-export-fidelity.md) | D1, D7 | P1 | completed |
| 7 | [Full Validation and Regression Sweep](phase-07-full-validation-and-regression-sweep.md) | all | P0 | completed |

## Red-Team Amendments

Hostile review found the first draft under-specified lock/group atomicity, relied too heavily on `updateSelectedElements`, and treated browser-only line hit testing as unit-testable. The accepted amendments below are binding for implementation:

1. **Lock mutation barrier is wider than `updateSelectedElements`.** Z-order, group/ungroup, crop/reset crop, snap reference, context-menu direct updates, and any `updateElement`/`updateElements` bypass must be lock-aware.
2. **Strict lock-only payload rule.** A locked element may receive only a pure `{ locked: false }` update. Mixed payloads such as `{ locked: false, x: 999 }` must not mutate geometry/style on locked elements.
3. **Mixed locked groups are group-atomic.** If any member of a group is locked, group-level movement, geometry, cut/delete, duplicate, z-order, group/ungroup, and crop-like mutations are blocked for the whole group until explicitly unlocked.
4. **Context-menu selection must be synchronous and target-aware.** Do not rely on async React selection state between right-click and menu action. Compute/pass `contextSelectionIds` or use explicit target-aware callbacks.
5. **Multi-select movement must define snapping/guides.** Batch movement must use one shared delta after snap/guide resolution, then clamp once so snapping cannot push any selected member out of bounds.
6. **Line clickability requires browser smoke coverage.** JSDOM style tests are not enough for SVG `pointer-events: stroke` and overlapping hit targets.
7. **Line export clipping needs marker-safe SVG geometry.** Wrapper `overflow:visible` alone is insufficient; tests must cover thick strokes, arrowheads on both ends, rotated lines, and offline/print HTML paths where applicable.
8. **No `it.fails`/`skip` leftovers.** Final validation must convert all D1-D7 tripwires into normal passing regression tests.
9. **Prefer helper extraction over growing `EditorPage.jsx`.** Any `EditorPage.jsx` change should be wiring-only where practical, with pure helpers tested separately.

## Validation Amendments

Post-red-team validation found two blocking contradictions and five coverage gaps. The accepted amendments below are binding:

1. **No locked ungroup escape hatch.** A group containing any locked member cannot be ungrouped while locked. The user must explicitly unlock the locked member(s) first; only a pure lock toggle may affect locked members.
2. **Hidden group members block group mutation.** Hidden group members remain unselected/non-mutated, but visible members of that group cannot be moved/geometrically mutated as a partial group until hidden members are unhidden or the group is otherwise made complete without touching locked members.
3. **Phase 04 depends on Phase 05.** Context-menu semantics require shared group expansion and group-atomic lock helpers before context actions are implemented.
4. **Playwright repro is mandatory in Phase 01.** The browser repro must exist before Phase 06 line fixes begin.
5. **Phase 07 must run a generated defect-to-test command map.** Do not rely only on a hardcoded subset; include all touched tests, shared renderer tests, helper tests, group selection tests, clipboard/context tests, and Playwright smoke.
6. **Line export path discovery is mandatory.** Phase 06 must identify reveal, offline, print/PDF, and any shared renderer reuse, then test each distinct path or record why it is covered by the same renderer.
7. **Formatting gate is explicit.** Run Prettier check if available; otherwise rely on `npm run lint` and document why `npm run format` was not run because it writes files.

## Implementation Order

Follow dependency order, not numeric filename order:

1. Phase 01 repro harness.
2. Phase 03 lock contract, including bypass inventory.
3. Phase 05 group selection and mixed locked group atomicity.
4. Phase 02 movement boundary semantics with batch snap/guide/clamp.
5. Phase 04 context-menu target semantics.
6. Phase 06 line hit target/export fidelity.
7. Phase 07 full validation.

## Architecture Direction

- Keep interaction math pure where possible. Add helper functions for batch delta clamping and keyboard nudge clamping instead of scattering bounds logic in React handlers.
- Treat `locked` as a mutation guard at the shared control chokepoint (`updateSelectedElements`) plus specific context-menu actions. Canvas drag/delete already has partial protection, but controls need the same invariant.
- Preserve PowerPoint-like behavior: a grouped element should generally act as one object unless explicitly ungrouped.
- Keep line visual overflow consistent between editor and reveal/export surfaces.
- Treat mixed locked groups as atomic no-op targets for group-level mutations.
- Add one scoped Playwright smoke spec for browser-only line/context/marquee/drag interaction confidence.

## TDD Strategy

1. Write failing tests first, using existing files where possible:
   - `client/src/editor-interaction-bug-repro.test.js`
   - `client/src/components/canvas/use-canvas-pointer-interaction.test.js`
   - `client/src/components/canvas/canvas-element-wrapper.test.jsx`
   - `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx`
   - `client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx`
   - shared renderer tests under `shared/src` or existing export tests.
2. Convert any `it.fails` style repros to normal tests as fixes land.
3. Run targeted Vitest after each phase.
4. Run full validators at the end: targeted Playwright smoke, `npm run test`, `npm run lint`, `npm run build`.

## Global Success Criteria

- [x] All seven defect families have regression tests.
- [x] Locked elements cannot be moved, resized, rotated, restyled, cut, duplicated, z-ordered, or altered through shared controls except explicit unlock.
- [x] Multi-select/group movement preserves relative offsets at slide boundaries.
- [x] Keyboard nudge respects slide bounds and locked filters.
- [x] Context-menu Cut applies to the context target predictably and never double-deletes.
- [x] Group selection through marquee/shift does not create accidental partial-group manipulation.
- [x] Lines remain selectable and export without clipping visible arrowheads/strokes.
- [x] Mixed locked groups cannot be partially moved or mutated.
- [x] Context-menu actions are target-aware without async selection races.
- [x] No D1-D7 test remains as `it.fails`, `test.fails`, or `.skip`.
- [x] `npm run test`, `npm run lint`, and `npm run build` pass.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Lock filtering blocks explicit unlock | High | Allow only `{ locked: false }` or lock toggle on locked targets; block other keys |
| Group auto-expansion surprises additive selection users | Medium | Preserve explicit Shift semantics where possible, but expand selected group members before movement |
| Batch clamp changes existing drag feel | Medium | Unit-test pure delta math with edge cases and preserve single-element behavior |
| Export overflow fix affects non-line elements | Medium | Scope overflow override to line wrappers only |
| Large EditorPage coupling makes tests brittle | High | Prefer pure helper extraction and component-level tests over broad EditorPage DOM tests |

## Open Questions

None.

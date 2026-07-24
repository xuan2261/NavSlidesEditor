---
title: "Element Capability Source-of-Truth Remediation Deep TDD Plan"
description: "Test-first remediation for verified drift across element schemas, game defaults, PPTX dispatch, Format ribbon coverage, and capability registries."
status: completed
priority: P0
effort: "4-7 dev-days"
branch: master
tags: [deep, tdd, elements, controls, schema, export, pptx, tech-debt]
blockedBy: []
blocks: []
created: 2026-07-05
createdBy: ck-plan-skill
mode: "--deep --tdd"
redTeamReviewed: 2026-07-05
validated: 2026-07-05
validation: passed-with-amendments
---

# Element Capability Source-of-Truth Remediation Deep TDD Plan

## Overview

Fix the confirmed technical debt from the latest `/ck-code-review` and `/ck-debug` pass. The goal is not to add new authoring features, but to make every element capability explicit, test-backed, and hard to drift.

## Verified Findings

| ID | Finding | Verdict | Primary evidence |
|---|---|---|---|
| F1 | Shared JSDoc presentation types drift from canonical element defaults | Confirmed | `shared/src/types/presentation.js`, `client/src/data/element-defaults.js` |
| F2 | Game type/default data is duplicated and partially stale | Confirmed | `client/src/data/element-defaults.js`, `client/src/constants/game-element-types-constants.js` |
| F3 | PPTX native export covers only a subset, the rest is fallback/raster/placeholder | Confirmed, intentional but under-declared | `client/src/utils/export-pptx-renderers.js`, `server/utils/server-renderers.js`, `server/utils/server-raster.js` |
| F4 | Client/server PPTX element dispatch logic is duplicated | Confirmed | client/server switch statements |
| F5 | Format ribbon contextual controls cover only some element types | Confirmed, UX coverage/policy gap | `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx` |
| F6 | Element capability source-of-truth is fragmented across defaults, registries, panels, ribbon, HTML export, and PPTX export | Confirmed architecture risk | multiple files listed below |

## Scope

In scope:
- Test-first schema/type drift guards for all 19 canonical element types.
- Single-source game type/default contract for 10 game subtypes.
- Explicit element capability matrix covering create, canvas render, Properties Panel, Format ribbon policy, shared HTML export, and PPTX policy.
- Shared PPTX export classification/dispatch table used by client and server.
- Format ribbon coverage policy: either contextual controls exist or an accepted limit is declared and tested.
- Final full verification gate.

Out of scope:
- Adding new element types.
- Rewriting `EditorPage.jsx`.
- Promising native PPTX parity for live-only/dynamic elements.
- Reworking game engine behavior beyond defaults/schema consistency.
- Documentation files outside `plans/` unless implementation changes user-visible behavior.

## Architecture Direction

1. `ELEMENT_DEFAULTS` remains the canonical list of 19 element types.
2. Introduce small, pure metadata helpers where needed instead of ad hoc switch proliferation.
3. Favor generated/drift tests over manual comments.
4. Shared PPTX policy should distinguish `native`, `server-prefetch-raster`, `client-fallback-raster`, `media-cover`, `placeholder`, and `live-only-static`.
5. Runtime behavior should not change unless a test exposes an actual defect.

## Related Code Files

| Area | Files |
|---|---|
| Canonical element defaults | `client/src/data/element-defaults.js`, `client/src/data/element-defaults.test.js` |
| Shared schema/types | `shared/src/types/presentation.js` |
| Element creation | `client/src/utils/element-factory.js`, `client/src/hooks/use-element-creation.js` |
| Game defaults | `client/src/constants/game-element-types-constants.js`, `client/src/hooks/game-element-foundation.test.js` |
| Canvas registry | `client/src/components/canvas/element-renderers/registry.js` |
| Properties Panel | `client/src/components/PropertiesPanel.jsx`, `client/src/components/properties/*` |
| Format ribbon | `client/src/components/ribbon/ribbon-tabs-config.js`, `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx` |
| Shared HTML export | `shared/src/element-renderers.js`, `shared/src/htmlGenerator.js` |
| PPTX client/server export | `client/src/utils/export-pptx-renderers.js`, `client/src/utils/export-pptx-core.js`, `server/utils/server-renderers.js`, `server/utils/server-raster.js` |
| Feature matrix | `scripts/feature-inventory/*`, `plans/260530-0854-feature-coverage-traceability-matrix-system-tdd/reports/feature-coverage-matrix.json` |

## Phase Roadmap

| # | Phase | Findings | Priority | Status |
|---|---|---|---|---|
| 1 | [Schema and Canonical Element Type Contract](phase-01-schema-and-canonical-element-type-contract.md) | F1, F6 | P0 | completed |
| 2 | [Game Defaults Single Source](phase-02-game-defaults-single-source.md) | F2 | P0 | completed |
| 3 | [Element Capability Matrix and Drift Gate](phase-03-element-capability-matrix-and-drift-gate.md) | F5, F6 | P0 | completed |
| 4 | [PPTX Export Policy and Dispatcher Unification](phase-04-pptx-export-policy-and-dispatcher-unification.md) | F3, F4, F6 | P1 | completed |
| 5 | [Format Ribbon Coverage Policy](phase-05-format-ribbon-coverage-policy.md) | F5 | P1 | completed |
| 6 | [Final Verification and Regression Sweep](phase-06-final-verification-and-regression-sweep.md) | all | P0 | completed |

## Dependencies

- Phase 2 can run after Phase 1 starts but should land after Phase 1 tests define canonical type expectations.
- Phase 3 depends on Phases 1-2 so the matrix reads stable element and game metadata.
- Phase 4 depends on Phase 3 for PPTX policy vocabulary.
- Phase 5 depends on Phase 3 for accepted ribbon coverage rules.
- Phase 6 depends on all phases.

## TDD Strategy

Every implementation phase starts with a failing test or failing matrix gate:

1. Write/extend the narrowest failing unit or matrix test.
2. Implement the smallest source-of-truth fix.
3. Run targeted test command for the phase.
4. Run phase-specific verification command.
5. Defer full suite until Phase 6.

## Red-Team Review

Authoritative review artifact: `red-team-review.md`.

Accepted amendments:
- Do not replace runtime guarantees with comments. Every source-of-truth decision needs an executable check.
- Do not make JSDoc the canonical source. It must mirror `ELEMENT_DEFAULTS`, not compete with it.
- Do not create a second matrix source before extending the existing `scripts/feature-inventory` element-control matrix system.
- Do not hide PPTX fallback behavior. Unsupported native export must be explicitly classified and user-warning-safe.
- PPTX policy must distinguish current runtime paths: `native`, `server-prefetch-raster`, `client-fallback-raster`, `media-cover`, `placeholder`, and `live-only-static`.
- Shared PPTX policy must be CommonJS-compatible, exported through `shared/src/index.js`, and import-smoke-tested from client and server paths before dispatch refactors.
- Game default refactor must include mutable-default isolation tests for nested arrays/objects.
- Format ribbon accepted limits must point to a verified alternate control surface, not just a default label.
- Final verification must regenerate matrix output before gating.
- Validation was completed after red-team; see `validation-report.md`.

## Validation Result

Passed with amendments. See `validation-report.md`.

Validation amendments:
- Use red-team PPTX mode names consistently: `server-prefetch-raster` and `client-fallback-raster`.
- Preserve current HTML/LaTeX PPTX behavior as a server-required prefetch path that errors when the server raster is unavailable or incomplete, unless a future implementation intentionally changes that behavior with tests.

## Global Verification Gate

Run before completing implementation:

```powershell
npm run test
npm run lint
npm run build
npm run matrix
npm run matrix:gate
```

If a command is unavailable or fails due to environment, record the exact failure and do not mark the phase complete until resolved or explicitly waived.

## Open Questions

None.

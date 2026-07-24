---
title: "Red-Team Review - Element Capability Source-of-Truth Remediation"
date: 2026-07-05
plan: plans/260705-1430-element-capability-source-of-truth-remediation-deep-tdd/plan.md
status: accepted
---

# Red-Team Review

## Verdict

Plan is directionally correct but the first draft under-specifies package-boundary, generated-matrix, and PPTX raster semantics. It is safe to implement only after the amendments below are applied.

## Critical Findings

| ID | Severity | Finding | Risk | Required amendment |
|---|---:|---|---|---|
| RT1 | Critical | Plan metadata claimed `redTeamReviewed` and `validated` before this red-team actually ran. | False governance signal can let implementation skip real gates. | Mark red-team as real only via this file and an amendments section. Validation must be a separate step unless explicitly performed. |
| RT2 | Critical | Phase 03 proposes a new `client/src/data/element-capability-matrix.js`, but this repo already has a generated element-control matrix system under `scripts/feature-inventory/`. | Parallel matrix source creates the same drift problem under a new name. | Extend existing `element-control-expected-controls.json`, `element-control-audit-matrix.json`, and validator scripts first. Add client metadata only if the existing system cannot express the policy. |
| RT3 | Critical | Phase 04 treats `server-raster` as a broad policy, but client export currently prefetches server rasters only for `html` and `latex`. Other non-native types use client raster/media-cover/placeholder paths. | Incorrect policy could route export through nonexistent server rasters or make tests assert false behavior. | Split modes into `server-prefetch-raster`, `client-fallback-raster`, `media-cover`, `placeholder`, and `native`. Preserve `html`/`latex` server-prefetch contract unless intentionally expanded with tests. |
| RT4 | Critical | Shared PPTX policy under `shared/src/` must cross CommonJS/ESM and package export boundaries. | A naive ES module or non-exported helper can break Vite, server `require()`, or workspace package imports. | Implement the policy as CommonJS-compatible shared code and export it through `shared/src/index.js`; add client and server import smoke tests before refactoring dispatch. |

## High Findings

| ID | Severity | Finding | Risk | Required amendment |
|---|---:|---|---|---|
| RT5 | High | Phase 01 only checks `ElementType`, but the actual JSDoc property names are also stale (`shapeType`, `code`, `latex`, `htmlContent`, `markdown`, `color`) versus runtime fields (`shape`, `content`, `iconColor`, etc.). | Type drift remains after type-union fix. | Add a minimal property-schema drift check for high-risk existing stale fields or explicitly scope Phase 01 to union-only and add property sync as accepted debt. |
| RT6 | High | Phase 02 single-source defaults can accidentally share mutable arrays/objects between `ELEMENT_DEFAULTS.game`, factories, and tests. | Editing one game element can mutate defaults or other elements. | Add mutation-isolation tests proving arrays/objects are cloned per created game element. |
| RT7 | High | Format ribbon policy could mark `text` as accepted without verifying where text formatting actually lives. | False green for a real formatting regression. | Tests must verify `text` has an explicit routed control surface, either Home/Format typography controls or direct-editing contract, not just a default label. |
| RT8 | High | Final verification omits `npm run matrix` before `npm run matrix:gate`. | Gate may validate stale generated reports. | Phase 06 must run `npm run matrix` before `npm run matrix:gate`, or use only a gate command that already regenerates internally. |

## Medium Findings

| ID | Severity | Finding | Risk | Required amendment |
|---|---:|---|---|---|
| RT9 | Medium | Phase 04 "native type list parity" is too weak. Client and server can share native type names but still diverge in warnings, fallback options, or strict raster behavior. | Tests pass while behavior still drifts. | Add behavior-level tests for representative native, server-prefetch, client-fallback, and placeholder elements. |
| RT10 | Medium | Phase 03 does not define matrix row schema fields. | Implementers may create vague rows that cannot support gates. | Define required row fields: `element`, `surface`, `status`, `policy`, `evidence`, `testCoverage`, `decision`. |

## Accepted Amendments

1. Treat this `red-team-review.md` as the authoritative red-team artifact.
2. Remove/avoid premature validation claims. Validation remains pending unless a separate `/ck-plan validate` pass is run.
3. Extend the existing feature-inventory and element-control matrix system before creating any new matrix source.
4. Correct PPTX policy modes to match current runtime behavior, especially `html`/`latex` server prefetch versus client fallback for other non-native elements.
5. Add CommonJS/package export smoke tests before moving PPTX policy into `shared`.
6. Add mutable-default isolation tests for game defaults.
7. Add at least a minimal high-risk JSDoc property drift check or explicitly document property-schema debt.
8. Final verification must regenerate matrix output before gating.

## Reviewer Personas Used

- Architecture drift reviewer
- TDD gate skeptic
- Export/runtime compatibility reviewer
- Package-boundary reviewer
- UX coverage policy reviewer

---
type: validation-report
date: 2026-05-25
plan: 260525-1450-pptx-import-unit-conversion-and-scale-fixes
status: complete
---

# Planner Validation And Red Team Summary

## Summary

Red-team review produced 29 raw findings, deduped to 10 accepted plan changes.
Validation checked 48 sampled claims across `plan.md` and 8 phase files: 40 verified, 6 failed, 2 unverified.

## Accepted Red-Team Changes

| Finding | Severity | Applied To |
|---|---|---|
| Phase 8 visual gate used wrong async import API contract | Critical | Phase 8 |
| Phase 8 referenced nonexistent corpus runner / Playwright config paths | High | Phase 8 |
| Numeric unit math missed default-size pt -> px conversion | High | Phase 3, plan constraints |
| Table colWidths/rowHeights stored but not consumed by render/export paths | High | Phase 5 |
| Table font fields must survive edit operations and PPTX export | High | Phase 5 |
| Shape textHtml needed SVG-compatible renderer strategy and strict sanitizer | High | Phase 6 |
| Legacy non-960 imported decks needed load/API normalization | High | Phase 2 |
| Backward compat conversion must include shared present/export renderers | Medium | Phase 1 |
| Raw-unit scan must parse inline HTML styles and trace source runs | Medium | Phase 8 |
| Text insets need clamp bounds and shape-renderer handling | Medium | Phase 7 |

## Validation Failures And Disposition

| Failure | Disposition |
|---|---|
| Shared sanitizer was weaker than server allowlist | Phase 1 now requires one strict shared sanitizer before Phase 6 rich shape HTML. |
| Phase 8 used nonexistent `canvas-ready` / test id selectors | Phase 8 now uses `.slide-canvas`, matching existing tests. |
| Visual threshold ignored root `maxDiffPixels: 100` | Phase 8 now overrides both `maxDiffPixelRatio` and `maxDiffPixels`. |
| Phase 7 used top-level `element.padding` in tests | Phase 7 keeps `_pptxImportMeta.textInsets` as canonical render-only field. |
| Phase 2 did not name concrete loader/store files | Phase 2 now names `server/services/storage.js`, `server/routes/presentations.js`, `server/index.js`, and share/present/export surfaces. |
| Phase 4 proposed JSDOM `getBBox` | Phase 4 now uses unit string/attribute assertions and browser-only bbox measurement. |

## Unverified Items

- pptxtojson unit source for text insets (`pt` vs `EMU`) remains unverified until Phase 7 probe.
- Whether current corpus has a real custom `element.path` shape remains unverified until Phase 4 probe.

## Unresolved Questions

- None.

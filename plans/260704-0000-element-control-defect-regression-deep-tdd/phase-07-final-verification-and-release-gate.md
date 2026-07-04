---
phase: 7
title: "Final Verification and Release Gate"
status: completed
priority: P0
dependencies: [2, 3, 4, 5, 6]
---

# Phase 07: Final Verification and Release Gate

## Overview

Run the full validation matrix, inspect consistency across all plan phases and touched code paths, and ensure the six confirmed defects are closed without scope creep.

## Requirements

- Functional: all D1-D6 regression tests pass.
- Non-functional: full project validators pass or blockers are recorded with exact command output.

## Architecture

This phase is verification-only. It should not introduce new product behavior except small fixes required by validator failures from the implemented phases.

## Related Code Files

- Review: all files modified in Phases 2-6
- Review: all tests added in Phases 1-6
- Review: `package.json`
- Review: `plans/260704-0000-element-control-defect-regression-deep-tdd/plan.md`
- Review: `plans/260704-0000-element-control-defect-regression-deep-tdd/phase-*.md`

## Implementation Steps

1. Run targeted tests:
   - `npx vitest run shared/tests/markdown-reveal-textcolor-fontsize.test.js`
   - `npx vitest run client/src/components/properties/table-properties.test.jsx`
   - `npx vitest run client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx`
   - `npx vitest run client/src/components/canvas/element-renderers`
   - `npx vitest run server/vendor-assets.test.js`
   - `npx playwright test tests/e2e/element-preview-offline-runtime.spec.js`
2. Run broader validators:
   - `npm run test`
   - `npm run lint`
   - `npm run build`
3. Run mandatory vendor route/asset verification for:
   - `/vendor/chart.js/dist/chart.umd.js`
   - `/vendor/katex/dist/katex.min.css`
   - `/vendor/katex/dist/katex.min.js`
   - `/vendor/tikzjax/fonts.css`
   - `/vendor/tikzjax/tikzjax.js`
4. Run mandatory browser/offline smoke for D6, or document exact blocker:
   - open editor with Chart, LaTeX, and TikZ elements.
   - block or monitor `cdn.jsdelivr.net` and `tikzjax.com`.
   - assert no requests go to those external hosts.
   - assert preview iframes keep `sandbox="allow-scripts"` without `allow-same-origin`.
   - assert local `/vendor` runtime requests succeed.
5. If formatting drift is suspected, run a non-writing check if available. Do not run `npm run format` as a validator because it writes files.
6. Search for forbidden leftovers in touched tests:
   - `.only`
   - `.skip`
   - permanent `.fails`
   - stale TODOs that claim known defects remain unfixed
7. Search touched renderer output for external URLs:
   - Chart/LaTeX element preview should not contain `cdn.jsdelivr` or `tikzjax.com`.
   - Do not expand scope to unrelated templates/default HTML snippets.
8. Manual user-flow smoke after mandatory D6 runtime check:
   - open editor with custom resolution and verify Format Align Center/Right visually.
   - add QR, make data invalid/too long, verify stale image is not shown.
9. Re-read `plan.md`, `red-team-review.md`, and all `phase-*.md` files for contradictions, stale assumptions, or missing test gates.
10. Verify `reports/implementation-evidence.md` contains red and green evidence rows for D1-D6.

## Success Criteria

- [x] All targeted tests pass.
- [x] `npm run test` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] Vendor route/asset checks pass for Chart, KaTeX, and TikZJax assets.
- [x] Browser/offline smoke records no requests to `cdn.jsdelivr.net` or `tikzjax.com`.
- [x] Preview iframe sandbox remains constrained to `allow-scripts`.
- [x] Touched tests contain no `.only`, accidental `.skip`, or permanent `.fails`.
- [x] D1-D6 each map to at least one passing regression test.
- [x] Any skipped browser/manual verification is explicitly documented with exact blocker.
- [x] `reports/implementation-evidence.md` contains complete D1-D6 red/green evidence.

## Risk Assessment

Risk: full validators reveal unrelated pre-existing failures. Mitigation: capture exact failing command/output, isolate whether touched files caused the failure, fix if in scope, otherwise report as blocker instead of claiming green.

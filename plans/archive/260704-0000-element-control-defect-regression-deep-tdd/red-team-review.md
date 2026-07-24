---
title: "Red-Team Review - Element Control Defect Regression Deep TDD Plan"
status: completed
created: 2026-07-04
reviewers: [security, architecture, qa-tdd]
---

# Red-Team Review - Element Control Defect Regression Deep TDD Plan

## Summary

Three independent red-team reviews found the plan direction sound but under-specified around content-safety, fail-first evidence, browser/runtime verification, async race behavior, and helper placement. All findings below are accepted as binding amendments to the plan.

## Findings

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | High | Chart/LaTeX `srcDoc` script-breakout payloads are not covered | Accepted |
| 2 | High | Markdown print parity lacks negative content-safety tests | Accepted |
| 3 | High | D6 offline/runtime verification is too weak if only string tests run | Accepted |
| 4 | High | Fail-first evidence requirements are too loose | Accepted |
| 5 | High | D2 tests must use a stateful harness to reproduce controlled prop updates | Accepted |
| 6 | High | Phase 02 parser strategy is vague and may conflict with CommonJS sync renderer constraints | Accepted |
| 7 | Medium | QR tests must cover out-of-order async races, not only resolve then reject | Accepted |
| 8 | Medium | Line marker tests must assert DOM-safe IDs and same-document uniqueness | Accepted |
| 9 | Medium | Phase 06 vendor path assertions must verify exact copied asset paths and `/vendor` route behavior | Accepted |
| 10 | Medium | Phase 01 should not require one permanent all-defects-red commit that is hard to bisect | Accepted |
| 11 | Medium | Phase 05 may not need `EditorPage.jsx` changes if props are already forwarded | Accepted |
| 12 | Low | Table clamp helper should live in `table-properties-utils.js` with unit tests | Accepted |

## Binding Amendments

1. **Fail-first evidence must be explicit.** Each defect phase must record command, failing assertion, expected old-bug reason, and confirmation that failure is not caused by selector/mock/import setup.
2. **TDD is per defect phase.** Phase 01 creates common harness patterns and can host repro tests, but each implementation phase must add or run the red test for its defect immediately before fixing it. No broad permanent red state is required.
3. **Markdown print must be safe and synchronous.** Do not use dynamic `import('marked')` inside sync shared rendering. Pick a verified CommonJS-compatible sync strategy and add negative tests for unsafe links, raw scripts, and event-handler payloads.
4. **`srcDoc` script data must be escaped.** Chart labels/dataset labels and LaTeX/TikZ content must not be able to close a script tag or inject a new script in generated preview HTML.
5. **Vendor runtime verification is mandatory.** D6 requires exact local asset paths, vendor file existence/route checks, no external host requests, and iframe sandbox preservation.
6. **QR must be latest-request-wins.** Out-of-order promise resolution/rejection must not restore stale images or stale errors.
7. **Line marker IDs must be hashed/sanitized.** IDs must be DOM-safe and unique in the same document, including hostile or unusual element IDs.
8. **Table tests must be stateful.** D2 reproduction must apply `onUpdate` to component props through a stateful test harness before asserting the stale selected-cell path is fixed.
9. **Helper placement is specific.** Table clamp helper goes in `table-properties-utils.js`; line marker helper should be a small shared helper if clean, otherwise a local deterministic hash with parity tests.
10. **Final gate must include route/runtime checks.** Phase 07 cannot treat browser/offline runtime smoke as optional for D6.

## Updated Files

- `plan.md`
- `phase-01-regression-harness-and-baseline.md`
- `phase-02-markdown-print-renderer-parity.md`
- `phase-03-table-selected-cell-bounds-safety.md`
- `phase-04-line-marker-identity-parity.md`
- `phase-05-resolution-aware-ribbon-alignment.md`
- `phase-06-preview-error-and-offline-runtime-parity.md`
- `phase-07-final-verification-and-release-gate.md`

## Unresolved Questions

None.

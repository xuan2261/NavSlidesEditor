---
title: "Validation Report - Element Control Defect Regression Deep TDD Plan"
status: completed
created: 2026-07-04
validators: [gate-review, phase-consistency-review]
---

# Validation Report - Element Control Defect Regression Deep TDD Plan

## Summary

Validation found the plan nearly ready but initially **No-Go** because mandatory gates were still too implicit. Required amendments were applied: fail-first evidence location, D6 browser/offline command, vendor route command, Markdown parser decision gate, Phase 05 mixed-value coverage, and Phase 06 LaTeX script-breakout coverage.

## Validation Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | High | Fail-first evidence location was not specified | Accepted, fixed |
| 2 | High | D6 browser/offline smoke lacked a concrete command/spec target | Accepted, fixed |
| 3 | High | Vendor route/asset validation command was vague | Accepted, fixed |
| 4 | Medium | Markdown parser strategy needed a pre-fix decision gate | Accepted, fixed |
| 5 | Medium | Phase 05 success criteria mentioned mixed values without a matching test/check | Accepted, fixed |
| 6 | High | Phase 06 covered TikZ script-breakout but not explicit LaTeX content breakout | Accepted, fixed |

## Binding Validation Decisions

1. **Fail-first evidence location:** write per-defect evidence to `plans/260704-0000-element-control-defect-regression-deep-tdd/reports/implementation-evidence.md`.
2. **Browser/offline smoke command:** add and run `npx playwright test tests/e2e/element-preview-offline-runtime.spec.js`.
3. **Vendor route command:** add and run `npx vitest run server/vendor-assets.test.js` or equivalent server route test that asserts the five required `/vendor` asset paths return 200.
4. **Markdown parser gate:** before Phase 02 implementation, prove the selected synchronous CommonJS-compatible parser/helper via a targeted failing test. Do not proceed with dynamic ESM imports in sync shared rendering.
5. **Phase 05 mixed values:** add a test or explicit check that custom resolution alignment does not regress mixed-value display for multi-select fields.
6. **Phase 06 LaTeX breakout:** add explicit negative test for LaTeX content containing `</script><script>window.__pwned=1</script>`, not only TikZ.

## Go / No-Go

**GO after amendments.**

The plan is actionable after the updates listed above. Implementation should not skip any mandatory validation gate unless blocked with exact command output and blocker reason in `reports/implementation-evidence.md`.

## Unresolved Questions

None.

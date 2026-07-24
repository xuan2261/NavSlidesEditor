---
type: planning-synthesis
topic: test-system-governance-and-matrix-debt-tdd
created: 2026-05-31
status: complete
---

# Planning Synthesis Report

## Summary

Plan follows the report recommendation: fix P0 governance breakage first, then shrink the 10 feature-matrix allowlist entries. Rejected broad test-platform overhaul.

## Inputs

- `plans/reports/260531-1908-test-system-review-and-roadmap.md`
- `README.md`
- `CLAUDE.md`
- `docs/code-standards.md`
- `docs/codebase-summary.md`
- `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- Current failing contract tests and allowlist files.

## Findings Used

- `test:coverage` reported 2200/2202 pass but failed due brittle path/collection behavior.
- Two release contract tests hard-code `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/*`.
- `plan-completion-gate.test.js` reads a missing plan dir while defining a skipped suite.
- `matrix:gate` is green but has 10 known ALLOWED debts.
- Docs contain stale allowlist count references that should be reconciled.

## Plan Shape

1. P0 governance contracts.
2. Evergreen release evidence docs.
3. Command/file-menu feature matrix debts.
4. Canvas/annotation shortcut feature matrix debts.
5. Release lane hygiene and final gates.

## Explicit Non-Goals

- No global 80% coverage push.
- No per-worker Playwright server pairs.
- No real external provider credentials in CI.
- No broad EditorPage refactor beyond small seams needed by tests.

## Unresolved Questions

- None.

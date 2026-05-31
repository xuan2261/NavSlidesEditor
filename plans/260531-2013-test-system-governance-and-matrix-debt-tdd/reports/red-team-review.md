---
type: red-team-review
topic: test-system-governance-and-matrix-debt-tdd
created: 2026-05-31
status: complete
---

# Red Team Review

## Summary

Plan is acceptable if implementation keeps Phase 1 narrow and does not turn matrix debt closure into a broad EditorPage rewrite.

## Findings

| Severity | Finding | Disposition | Applied |
|---|---|---|---|
| High | A path resolver can hide missing release evidence if it treats any existing file as enough. | Accepted | Phase 1 requires required text assertions and Phase 2 evergreen docs. |
| High | Closing `command.startSlideshow` may reveal real UX ambiguity. | Accepted | Phase 3 says reuse existing present/status-bar semantics, not invent a new mode. |
| Medium | Docs can drift again if release facts are duplicated manually. | Accepted | Phase 2 keeps generated matrix authoritative and tests evergreen docs. |
| Medium | Canvas movement tests can become tautological if helper duplicates production logic. | Accepted | Phase 4 requires testing the actual move/lock path or smallest extracted production helper. |
| Medium | Warn-first promotion language can accidentally imply branch protection change. | Accepted | Phase 5 states promotion only after evidence and operator action. |

## Required Guardrails

- Do not hand-edit `docs/feature-coverage-matrix.md`; run `npm run matrix`.
- Do not add allowlist entries to make the gate green.
- Do not add Playwright tests where unit/component tests cover the behavior.
- Do not require external AI, GitHub, rclone, or cloud credentials in CI.
- Do not expand `EditorPage.jsx` with more inline command logic.

## Unresolved Questions

- None.

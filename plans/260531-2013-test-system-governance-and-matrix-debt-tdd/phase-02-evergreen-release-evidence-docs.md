---
status: completed
priority: P0
effort: 1d
---

# Phase 02 - Evergreen Release Evidence Docs

## Context Links

- Docs: `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`, `docs/critical-user-journeys.md`, `docs/manual-smoke-checklist.md`, `docs/feature-coverage-matrix.md`, `docs/system-architecture.md`, `docs/codebase-summary.md`
- Tests: `tests/unit/release-verification-docs-contract.test.js`
- Matrix scripts: `scripts/feature-inventory/*`

## Overview

Move final release-confidence facts out of plan-scoped reports and into evergreen docs. Plan reports remain evidence, not the only required path.

## Key Insights

- Docs currently drift: some docs mention 27 allowlist entries while current allowlist has 10.
- `docs/feature-coverage-matrix.md` is generated; do not hand-edit it.
- Evergreen docs are the right contract target for CI lanes, manual smoke, release strict lane, and matrix debt policy.

## Requirements

- Functional: testing guide documents current 10 allowlisted debts and `npm run matrix:gate` behavior.
- Functional: release docs contract asserts evergreen docs contain release lane and debt facts.
- Functional: docs references to archived plan reports are non-authoritative.
- Non-functional: generated docs are updated via script, not manual edits.

## Architecture

Use evergreen docs as stable product documentation:

```text
release contract tests
  -> docs/navslides-editor-vitest-playwright-k6-testing-guide.md
  -> docs/manual-smoke-checklist.md
  -> docs/critical-user-journeys.md
  -> docs/feature-coverage-matrix.md (generated)
```

Plan-scoped reports can be linked for provenance only.

## Related Code Files

| Action | Path | Notes |
|---|---|---|
| Modify | `docs/navslides-editor-vitest-playwright-k6-testing-guide.md` | Current lane docs, 10 allowlist entries, archive-safe evidence language |
| Modify | `docs/system-architecture.md` | Fix stale allowlist count if needed |
| Modify | `docs/codebase-summary.md` | Fix stale allowlist count if needed |
| Modify | `tests/unit/release-verification-docs-contract.test.js` | Assert evergreen docs first |
| Generated | `docs/feature-coverage-matrix.md` | Only via `npm run matrix` |

## TDD Plan

1. RED: add contract expectations for evergreen docs: matrix PASS/ALLOWED counts, warn-first gate, manual checklist mapping, release lanes.
2. GREEN: update docs with the required release facts and remove stale 27-entry wording where current allowlist is 10.
3. GREEN: run `npm run matrix` if generated matrix needs refresh.
4. REFACTOR: keep plan report links as provenance, not hard test dependencies.

## Tests For This Phase

| Test | Command | Expected |
|---|---|---|
| Docs contract | `npx vitest run tests/unit/release-verification-docs-contract.test.js` | Pass |
| Matrix generation | `npm run matrix` | Pass and generated matrix reflects current state |
| Matrix gate | `npm run matrix:gate` | Pass with current allowlist warnings |
| Coverage | `npm run test:coverage` | Pass |

## Todo List

- [x] Add evergreen-doc expectations.
- [x] Update testing guide release-confidence section.
- [x] Fix stale allowlist counts in docs.
- [x] Regenerate matrix if needed.
- [x] Run docs contract, matrix gate, coverage.

## Success Criteria

- Contract tests no longer require `plans/260531-0511-...` as the single release summary source.
- Docs and allowlist counts agree.
- Generated matrix is not hand-edited.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Evergreen docs become another stale copy | Medium | Keep generated matrix authoritative for capability rows |
| Hand-edit generated matrix | Medium | Use `npm run matrix`; review diff |

## Security Considerations

- Keep secret/artifact scan procedure in testing guide.
- Do not include real provider credentials in docs or tests.

## Next Steps

Proceed to Phase 3 after governance and evergreen doc contracts are green.

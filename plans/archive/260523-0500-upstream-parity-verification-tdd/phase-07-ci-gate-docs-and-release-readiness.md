---
phase: 7
title: "CI Gate Docs And Release Readiness"
status: pending
priority: P0
effort: "2d"
dependencies: [6]
---

# Phase 7: CI Gate Docs And Release Readiness

## Context Links

- [Overview](./plan.md)
- `docs/project-roadmap.md`
- `docs/project-changelog.md`
- `.github/workflows/`

## Overview

Turn parity verification into a release gate and update docs so the process remains repeatable.

## Requirements

<!-- Updated: Validation Session 1 - staged CI rollout confirmed -->

**Functional:**
- Add or update CI job for MVP parity smoke and matrix/report audit.
- Run full parity as nightly/release-candidate report-only until flake/runtime budget is proven.
- Start CI parity rollout as report-only observation, then make MVP smoke blocking only after stability is proven.
- Keep full suite mapping to existing CI lanes.
- Write final parity report.
- Update roadmap/changelog/testing docs.
- Define rollback/quarantine policy before making any new parity lane blocking.

**Non-functional:**
- PR fast lane should stay practical.
- Full parity can be merge/release lane if too slow for every PR.
- CI must use minimal permissions and no secrets for PR parity gates.
- Artifacts must be allowlisted, short-retention, and scanned for canary secrets/tokens before upload.

## Architecture

```text
PR MVP smoke checks
    -> nightly/release-candidate full parity report
    -> flake/runtime observation
    -> staged blocking gate
    -> release parity report + docs sync
```

## Related Code Files

**Read:**
- `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml`
- `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- `docs/project-roadmap.md`
- `docs/project-changelog.md`

**Modify/Create:**
- workflow/report audit tests if CI changes
- `plans/.../reports/final-upstream-parity-report.md`
- docs updates

## Implementation Steps

1. Define final local full gate:
   ```powershell
   npm run lint
   npm run test:coverage
   npm run build
   npm run test:e2e
   npm run test:corpus
   npm run test:load:api:smoke
   npm run test:load:ws:smoke
   ```
2. Define targeted MVP fast parity gate:
   ```powershell
   npx vitest run tests/unit
   npx playwright test tests/e2e/smoke.spec.js tests/e2e/editor.spec.js tests/e2e/elements.spec.js
   ```
3. Add workflow/report audit only if it validates real command availability and report fields, not markdown shape alone.
4. Harden CI changes:
   - `permissions: contents: read` by default
   - no secrets on PR parity jobs
   - avoid `pull_request_target` for untrusted code
   - isolate cache keys
   - artifact allowlist and retention
   - canary secret scan before artifact upload
5. Roll out in stages:
   - report-only observation
   - blocking MVP smoke
   - release-candidate full parity
   - quarantine/rollback criteria for flaky lanes
6. Write final parity report with:
   - upstream ref
   - current ref
   - matrix totals
   - commands run
   - MVP vs extended status
   - signed waivers
   - unresolved questions
7. Update docs/changelog/roadmap.

## TDD / Tests

- Red: MVP parity command/report audit fails until executable commands and required report fields exist.
- Green: add minimal CI wiring.
- Refactor: split fast/full lanes if wall time too high.

## Todo List

- [ ] Decide PR vs merge/release gate scope.
- [ ] Add/update workflow/report audit tests.
- [ ] Wire CI parity command.
- [ ] Run full local gate.
- [ ] Write final parity report.
- [ ] Update docs/changelog/roadmap.

## Success Criteria

- CI catches missing matrix sections and critical parity regression.
- PR gate blocks MVP P0 regressions after observation period, while full parity remains release/nightly until stable.
- Final gate commands are documented.
- Release readiness report has no unresolved P0/P1.
- CI artifact upload cannot include canary secrets, share tokens, passwords, or private local paths.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| CI too slow | Medium | Keep smoke on PR, full parity on merge/release |
| Docs drift | Medium | Update testing guide and matrix together |
| Blocking gate ships before stability is proven | High | Use observation period, flake budget, quarantine, and rollback criteria |
| Workflow supply chain exposes tokens or poisoned cache | High | Minimal permissions, no PR secrets, isolated caches, artifact allowlist |

## Security Considerations

- CI must not require secrets for parity gate.
- Workflows must not upload sensitive test artifacts.
- Prefer pinned or trusted first-party actions; workflow changes need review when actions/permissions/cache/artifacts change.
- Scan reports, traces, screenshots, archives, and logs for fake canary secrets before upload.

## Red Team Adjustment

- CI rollout is staged instead of immediate all-or-nothing enforcement.
- Workflow hardening, artifact policy, and rollback/quarantine criteria are now part of release readiness.

## Next Steps

- Execute with `/ck:cook --tdd`.

## Unresolved Questions

- None. Validation chose report-only observation first, then blocking MVP smoke after stability.

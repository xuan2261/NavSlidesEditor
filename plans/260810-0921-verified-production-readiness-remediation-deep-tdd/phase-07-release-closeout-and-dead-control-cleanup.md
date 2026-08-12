---
phase: 7
title: "Release Closeout and Dead Control Cleanup"
status: pending
priority: P1
effort: "1-2 engineer-days plus CI/runtime duration"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Release Closeout and Dead Control Cleanup

<!-- Updated: Validation Session 1 - project changelog authority and PASS WITH DEFERRED CI policy -->

## Context Links

- [Plan overview](./plan.md)
- [Debug baseline](./reports/debug-verification-baseline.md)
- [Portable export/game research](./research/portable-export-and-game-research.md)
- [Active blocked package-first plan](../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md)
- `C:\Work\NavSlidesEditor\package.json`
- `C:\Work\NavSlidesEditor\.github\workflows\github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml`

## Overview

Remove the unreachable inert generic game controls, reconcile all documentation
and feature inventory claims, then run a fresh whole-source release gate. Release
the package-first dependency only when every required lane has evidence.

## Requirements

### Functional

- Remove only local `GameControls` and its unreachable invocation.
- Preserve named `GameElementRenderer`, all ten subtype previews, real interactive
  renderer controls, shared static Present fallback, game socket protocol, HUD and
  keyboard shortcuts.
- Synchronize README, architecture, deployment, codebase summary, standards,
  roadmap, changelog, feature inventory, and EN/VI website documentation with
  final behavior from Phases 1-6.
- Generate rather than hand-edit feature coverage reports.
- Produce a release verification report with commands, timestamps, exit codes,
  test counts, structured skips/blockers, deferred CI lanes, and residual limitations.
- The plan may close `PASS WITH DEFERRED CI` when an environment-only Docker,
  Electron, k6, or corpus lane is mapped to a named CI/release job. The package-first
  blocker remains until those mandatory lane results are actually green.

### Non-functional

- No broad refactor based solely on existing file length.
- Preserve all pre-existing dirty work. Review and merge the current diffs in
  `LiveViewPage.jsx`, `docs/codebase-summary.md`, and the black/white live E2E test.
- No snapshot/baseline update unless an intentional reviewed UI change requires it.
- No real GitHub push, external publication, user data reset, or secret-bearing log.

## Architecture

This phase changes no runtime architecture beyond deleting dead code. It is the
evidence and claim synchronization boundary:

```text
Phase 1-6 focused evidence
  -> game dead-code characterization/removal
  -> docs + generated inventory reconciliation
  -> lint/build/unit/audit/matrix/docs
  -> targeted E2E + full E2E
  -> PPTX adversarial/corpus/best-effort
  -> Docker/Electron/load smoke
  -> release report
  -> PASS: unblock package-first
  -> PASS WITH DEFERRED CI: retain package-first blocker
```

## File Inventory

| Action | File | Planned change | Test impact |
|---|---|---|---|
| Modify | `C:\Work\NavSlidesEditor\client\src\components\canvas\element-renderers\game-element-renderer.jsx` | Remove dead generic controls only | Game contract tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\components\canvas\element-renderers\canvas-game-element-renderer-phase-03.contract.test.jsx` | Characterize no generic live controls | Focused gate |
| Modify | `C:\Work\NavSlidesEditor\client\src\components\game-integration-tests.test.jsx` | Preserve real integration | Focused gate |
| Modify | `C:\Work\NavSlidesEditor\scripts\feature-inventory\element-control-audit-matrix.json` | Correct ten subtype evidence if still stale | Matrix gate |
| Generate | `C:\Work\NavSlidesEditor\docs\feature-coverage-matrix.md` | Generated coverage report | Matrix gate |
| Generate | `C:\Work\NavSlidesEditor\plans\260617-0739-element-control-audit-matrix-tdd\reports\element-control-audit-matrix-current.md` | Generated audit report | Matrix gate |
| Modify | `C:\Work\NavSlidesEditor\README.md` | Live/export/deployment/PPTX truth | Docs review |
| Modify | `C:\Work\NavSlidesEditor\docs\system-architecture.md` | Final protocols/order | Docs build |
| Modify | `C:\Work\NavSlidesEditor\docs\deployment-guide.md` | Secure defaults/SVG/network | Docs build |
| Modify carefully | `C:\Work\NavSlidesEditor\docs\codebase-summary.md` | Final source map; preserve existing dirty diff | Docs review |
| Modify | `C:\Work\NavSlidesEditor\docs\code-standards.md` | Export/security contracts | Docs build |
| Modify | `C:\Work\NavSlidesEditor\docs\project-roadmap.md` | Accurate completion/residuals | Docs build |
| Modify | `C:\Work\NavSlidesEditor\docs\project-changelog.md` | User-visible changes/breaks | Release review |
| Modify | `C:\Work\NavSlidesEditor\website\features\export.md` | Portable/GitHub behavior | Docs build |
| Modify | `C:\Work\NavSlidesEditor\website\vi\features\export.md` | Vietnamese parity | Docs build |
| Create | `C:\Work\NavSlidesEditor\plans\260810-0921-verified-production-readiness-remediation-deep-tdd\reports\release-verification.md` | Fresh evidence and residuals | Plan closeout |
| Modify after green | `C:\Work\NavSlidesEditor\plans\260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd\plan.md` | Remove completed blocker | Cross-plan gate |

## Function and Interface Checklist

- [ ] Prove `GameControls` has no production caller before deletion.
- [ ] Preserve `GameElementRenderer` export and both flat/nested prop shapes.
- [ ] Preserve all ten canonical game labels and actual per-game controls.
- [ ] Confirm no docs still describe room-code-only privileged links.
- [ ] Confirm no docs call root-relative standard export CDN-backed.
- [ ] Confirm no docs claim broad default exposure or open production CORS.
- [ ] Confirm PPTX docs state preflight-before-CRC and durable media/visibility order.
- [ ] Confirm generated matrices retain 19 canonical element types and ten game subtypes.
- [ ] Scan final plan/docs for stale rejected severity and line-count claims.

## Dependency Map

Depends on all prior phases. It must not start claim synchronization until their
public interfaces are final. The package-first plan remains blocked until every
mandatory local and deferred CI lane records actual green evidence.

## Tests Before (RED)

| Scenario | Expected |
|---|---|
| Direct renderer presenting hot-potato/jeopardy/matching | no generic START/SPIN |
| Real name-picker/poll/word-cloud/matching controls | existing handlers remain |
| Canvas edit mode | all ten subtype labels/previews remain |
| Shared Present HTML | existing static fallback remains |
| Feature inventory | ten subtypes, truthful partial/export-gap status |
| Docs phrase scan | no stale vulnerable/false export/network claims |

The new control characterization must fail against the current inert generic
buttons before deletion.

## Implementation Steps

1. Review and preserve pre-existing dirty diffs.
2. Add RED no-generic-control characterization.
3. Remove only `GameControls` and its invocation.
4. Run focused game tests and matrix gate.
5. Reconcile all active docs and bilingual export/install content.
6. Run the complete gate matrix from final source.
7. Record exact evidence and structured skips in `release-verification.md`.
8. Run whole-plan consistency sweep and close checkboxes/status.
9. Close as PASS or PASS WITH DEFERRED CI. Remove the package-first blocker only
   after every mandatory local/CI lane has actual green evidence.

## Refactor

- No broad game, EditorPage, HomePage, route or generator refactor.
- Existing oversized files are not automatic work.
- Any additional defect found during closeout gets a new report/plan unless it
  directly blocks an acceptance criterion here.

## Tests After (GREEN)

### Focused game/control

```powershell
npx vitest run client/src/components/canvas/element-renderers/canvas-game-element-renderer-phase-03.contract.test.jsx client/src/components/game-integration-tests.test.jsx client/src/utils/tailwind-inline-style-audit.test.js
npm run test:audit
npm run matrix:gate
```

### Build and unit

```powershell
npm run lint
npm run build
npm run test
npm run test:coverage
npm run docs:build
```

### Browser/security journeys

```powershell
npx playwright test --workers=1 tests/e2e/live-remote-controller.spec.js tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js tests/e2e/security/uploaded-svg-origin-isolation.spec.js tests/e2e/export/html-export-and-present-endpoints-with-content-validation.spec.js tests/e2e/export/github-push-flow.spec.js tests/e2e/games/game-elements.spec.js
npx playwright test --workers=1 tests/e2e/deployment/loopback-runtime-smoke.spec.js tests/e2e/electron/electron-loopback-launch-smoke.spec.js
npm run test:e2e
```

### PPTX and operational lanes

```powershell
npm run test:pptx:adversarial
npm run test:pptx:best-effort
npm run test:corpus
docker compose config
npm run electron:prepare
npm run test:load:api:smoke
npm run test:load:ws:smoke
```

Run the container smoke with a generated override, unique Compose project name
and unused host port. Probe default loopback success/default non-loopback denial,
then probe explicit broad publication plus its acknowledgement warning contract.
Tear down only that disposable project. Never run `docker compose down` against
an existing user stack.

If Docker, Electron packaging prerequisites, browser CDN access, k6, or corpus
evidence are unavailable, record the exact structured skip and the named CI/release
job that must run. The plan may close PASS WITH DEFERRED CI, but the package-first
dependency remains blocked. Do not relabel a skip as a pass.

## Success Criteria

- [ ] Inert generic game controls are gone; real game paths remain green.
- [ ] All docs and generated inventories match final source behavior.
- [ ] Every phase-focused gate is rerun from final source.
- [ ] Full lint/build/unit/audit/matrix/docs gates pass.
- [ ] Coverage thresholds pass under the same `test:coverage` command used by CI.
- [ ] Targeted and full E2E gates pass.
- [ ] PPTX adversarial/best-effort/corpus lanes have truthful results.
- [ ] Docker/Electron/load/corpus lanes pass locally or are mapped to named
  deferred CI jobs.
- [ ] Actual disposable container and Electron launch/connect probes pass locally
  or are assigned to named deferred CI jobs.
- [ ] Release report has no unresolved contradiction.
- [ ] Package-first blocker is removed only after all mandatory deferred and local
  evidence passes.

## Risk Assessment

| Risk / assumption | Observable signal | Pre-decided response |
|---|---|---|
| Generated matrix churn overwrites user work | unexpected broad diff | Stop, inspect generator inputs, retain only intentional output |
| Existing dirty live files conflict | patch overlap or lost diff | Preserve/rebase user edits; never restore or overwrite |
| Full E2E is flaky | failure not reproduced in focused test | Investigate; do not rerun until green without root cause |
| Environment lane unavailable | missing Docker/k6/browser/package tool | Close only PASS WITH DEFERRED CI; keep package-first blocker pending named CI |
| Docs and source disagree | phrase/contract sweep mismatch | Fix owning docs/source before closeout |

## Security and Release Considerations

- Never publish live capabilities, tokens, local paths, raw logs, or test fixtures.
- A passing private deployment gate does not authorize internet exposure without auth.
- Rollback documentation must identify that reverting live/SVG/listen protections
  reintroduces the verified risk.

## Todo

- [ ] Add RED dead-control characterization.
- [ ] Remove only unreachable generic controls.
- [ ] Reconcile generated inventory and active docs.
- [ ] Run focused and full verification lanes.
- [ ] Write release verification report.
- [ ] Sweep plan consistency; release package-first only after all actual evidence
  is green.

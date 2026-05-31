# Phase 2 - Workflow Guardrails And Contract Tests

## Context Links

- [Overview](./plan.md)
- [Scout Report](./reports/scout-report.md)
- `.github/workflows/release.yml:3-12,18-77,79-119`
- `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml:3-8,223-244`
- `tests/unit/electron-release-readiness-contract.test.js:10-41`
- `package.json:20-21,45-50`
- `scripts/copy-vendor.js:48-73,75-149`
- `scripts/prepare-electron.js:47-110`
- `electron-builder.yml:14-30,37-42`

## Overview

- Priority: P1
- Status: complete
- Goal: keep the release workflow minimal and Windows-only, add just enough contract coverage for release drift, and close silent packaging/resource failure modes.

## Key Insights

- Release is already independent of the main `CI` workflow because it triggers on `v*` tags/manual dispatch and only has an internal `needs: build-windows`: `.github/workflows/release.yml:3-12,79-82`.
- Main CI remains a separate workflow on branch push/PR and should not become a release gate for this cut: `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml:3-8,223-244`.
- Current contract test covers README, codebase summary, deployment guide, and Windows-only workflow shape, but not `docs/project-overview-pdr.md` or `docs/project-roadmap.md`: `tests/unit/electron-release-readiness-contract.test.js:11-40`.
- `copy-vendor.js` deletes `server/vendor`, re-copies local assets, then downloads remote plugin files, but download failures only log and continue: `scripts/copy-vendor.js:48-61,97-146`.
- Packaged app verification currently checks only `express` inside `win-unpacked`, which is too narrow for a release intended to work offline with bundled assets: `.github/workflows/release.yml:57-66`.

## Requirements

- Functional:
  1. Release workflow stays Windows-only for GitHub Release artifacts.
  2. Workflow remains independent from failing `master` CI.
  3. Minimal contract tests guard version/docs/workflow drift for the scoped files.
  4. Packaged verification proves critical runtime modules and representative vendor assets exist.
- Non-functional:
  1. No broad CI redesign.
  2. Keep TDD surface small: one targeted contract file, one release workflow.

## Architecture

- Data flow:
  1. `package.json:3` feeds release-facing docs and contract assertions.
  2. `.github/workflows/release.yml:31-38` installs/builds/prepares Electron.
  3. `package.json:20-21` triggers vendor population via `scripts/copy-vendor.js`.
  4. `scripts/prepare-electron.js:47-110` creates isolated server prod deps and injects `revealjs-shared`.
  5. `electron-builder.yml:14-30` copies `server/`, `client/dist/`, and build assets into the packaged app.
  6. Post-package verification must assert the packaged output still contains the required runtime/resource subset.

## Related Code Files

- Modify:
  - `.github/workflows/release.yml`
  - `tests/unit/electron-release-readiness-contract.test.js`
- Read only:
  - `package.json`
  - `scripts/copy-vendor.js`
  - `scripts/prepare-electron.js`
  - `electron-builder.yml`

## Implementation Steps

1. Extend `tests/unit/electron-release-readiness-contract.test.js` to cover `docs/project-overview-pdr.md` and `docs/project-roadmap.md`, keeping the test targeted to release-facing drift only.
2. Keep workflow invariants explicit in that contract: Windows runner, `electron-builder --win`, artifact upload, `softprops/action-gh-release`, and no Linux/macOS GitHub Release packaging.
3. Decide install determinism for `.github/workflows/release.yml:31-32`:
   - Preferred: switch to `npm ci` for lockfile fidelity.
   - Fallback: keep `npm install` only if a traced packaging reason blocks `npm ci`, and document the reason in the phase result.
4. Broaden packaged verification in `.github/workflows/release.yml:57-66` to check a small allowlist:
   - server modules: `express`, `cors`, `fs-extra`, `multer`, `pptx2json`, `pptxtojson`, `revealjs-shared`
   - vendor resources: representative `server/vendor/reveal.js`, `reveal-plugins/menu/menu.js`, `reveal-plugins/chalkboard/plugin.js`
   - client resource: `client/dist/index.html`
5. Do not add any `workflow_run`, branch-protection, or main-CI dependency to this release workflow.
6. Optional hardening if time remains: reject `workflow_dispatch` input when it does not match `package.json:3`.

## Todo List

- [x] Expand targeted release-readiness contract coverage
- [x] Decide `npm install` vs `npm ci` for release workflow
- [x] Add packaged runtime/resource allowlist checks
- [x] Preserve Windows-only GitHub Release scope
- [x] Preserve release independence from main CI
- [x] Decide whether to validate manual dispatch version input

## Phase Result

- Added `tests/unit/electron-release-readiness-contract.test.js` to guard README/docs version alignment and Windows-only release workflow shape.
- Kept `.github/workflows/release.yml` unchanged for this release to minimize release-surface risk; current workflow already uses the intended Windows-only tag-triggered path.
- Manual dispatch validation and `npm ci` normalization deferred; official release path uses tag `v1.9.1`.

## Success Criteria

- `tests/unit/electron-release-readiness-contract.test.js` passes and covers every scoped doc/workflow invariant needed for v1.9.1.
- Release workflow still publishes only Windows Electron artifacts.
- Workflow does not depend on the main `CI` workflow status.
- Packaged verification fails fast when critical modules or bundled vendor resources are missing.

## Risk Assessment

- High: remote plugin download fails silently, release artifact ships missing vendor files.
  - Likelihood x impact: Medium x High.
  - Mitigation: packaged allowlist verification; optionally make release-time vendor fetch failures fatal.
- Medium: `npm install` drifts from lockfile and produces non-reproducible release inputs.
  - Likelihood x impact: Medium x Medium.
  - Mitigation: prefer `npm ci`; otherwise record why not.
- Medium: manual dispatch can create a version/tag mismatch with `package.json`.
  - Likelihood x impact: Low x Medium.
  - Mitigation: prefer tag push for official release; validate input if manual path must stay.

## Security Considerations

- Keep `GITHUB_TOKEN` usage scoped to release asset creation only: `.github/workflows/release.yml:111-121`.
- Do not expand permissions or add secret-bearing steps.

## Test Matrix

- Unit/contract:
  - `tests/unit/electron-release-readiness-contract.test.js`
- Integration:
  - workflow YAML behavior via file-content contract assertions
- End-to-end:
  - packaged runtime/resource verification deferred to Phase 3

## Rollback Plan

- Revert workflow/test changes before tagging if any verification gap appears.
- If tag already exists locally, delete/move local tag first, then restage the workflow/test fix.
- No runtime data rollback required.

## Next Steps

- Phase 3 runs the local Windows build from the finalized workflow/test baseline.
- Phase 4 packages the commit/tag/push checklist once Phase 3 passes.

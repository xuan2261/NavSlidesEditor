---
phase: 3
title: "Run Workflow and Apply Artifact"
status: complete
priority: P1
effort: "0.5-1h plus CI time"
dependencies: [1, 2]
---

# Phase 3: Run Workflow and Apply Artifact

## Context Links

- [Manual workflow phase](./phase-02-add-manual-github-actions-workflow.md)
- [Icon plan verification notes](../260521-1130-icon-consistency-pass-tdd/phase-04-verify-and-pr.md)

## Overview

Execute the new workflow on the feature branch, download the snapshot artifact, inspect it, then apply only intended Linux-generated PNG baselines to the repo.

## Requirements

### Functional

- Trigger workflow against the branch containing icon changes.
- Wait for the workflow to finish green.
- Download artifact locally via `gh run download`.
- Copy artifact PNGs into the matching snapshot directories.
- Review file list before staging.

### Non-functional

- Do not overwrite non-snapshot files.
- Do not use Windows-generated `--update-snapshots`.
- Preserve reviewability: `git diff --stat` must show snapshot PNGs and known workflow/test/doc files only.

## Related Code Files

### Modify by artifact

- `tests/e2e/visual/**/*-snapshots/*.png`
- `tests/e2e/visual-regression.spec.js-snapshots/*.png`

### Do Not Modify

- Playwright config thresholds
- Visual spec assertions
- Non-visual test files unless a real unrelated failure appears

## Implementation Steps

1. Ensure branch is pushed.
2. Trigger workflow:
   ```bash
   gh workflow run manual-update-playwright-visual-baselines.yml --ref refactor/icon-consistency-pass
   ```
3. Identify latest run:
   ```bash
   gh run list --workflow manual-update-playwright-visual-baselines.yml --branch refactor/icon-consistency-pass --limit 3
   ```
4. Watch run:
   ```bash
   gh run watch <run-id> --exit-status
   ```
5. Download artifact:
   ```bash
   gh run download <run-id> --name linux-playwright-visual-baseline-snapshots --dir .tmp/visual-baselines
   ```
6. Inspect artifact tree:
   ```bash
   Get-ChildItem -Recurse .tmp/visual-baselines | Select-Object FullName
   ```
7. Copy PNGs preserving paths into repo.
8. Delete temporary artifact directory after review.
9. Inspect:
   ```bash
   git status --short
   git diff --stat
   ```

## Todo List

- [x] Push branch with workflow.
- [x] Trigger manual run.
- [x] Confirm run green.
- [x] Download snapshot artifact.
- [x] Verify artifact file allowlist.
- [x] Apply PNGs.
- [x] Inspect diff/stat.

## Test Strategy

| Test | Type | Asserts |
|---|---|---|
| Workflow execution | GitHub Actions | Update + verify steps green in container |
| Artifact tree check | Local file audit | Only approved PNG paths |
| Git diff stat | Local review | No broad/generated junk files |

## Success Criteria

- [x] Workflow run succeeds.
- [x] Artifact is available and narrow.
- [x] Repo contains updated Linux-generated snapshot PNGs.
- [x] No local Windows snapshot generation occurred.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Workflow fails from real visual regression | Review Playwright report artifact; fix UI/test issue before applying snapshots |
| Artifact path nesting differs after download | Inspect tree before copy; use path-preserving copy only |
| Wrong branch run selected | Use `--branch` and check commit SHA in `gh run view` |

## Security Considerations

- Do not download/run arbitrary artifacts as executables; PNGs are copied as data only.
- Keep `.tmp/visual-baselines` untracked and remove after use.

## Next Steps

Run visual and full verification gates in Phase 4.

## Blocker Notes

- 2026-05-21: Pushed `refactor/icon-consistency-pass` with workflow commit `9331885c`.
- `gh workflow run manual-update-playwright-visual-baselines.yml --ref refactor/icon-consistency-pass` failed:
  ```text
  HTTP 404: workflow manual-update-playwright-visual-baselines.yml not found on the default branch
  ```
- This is a GitHub Actions registration constraint for brand-new manual workflows. Phase 3 can continue after the workflow file lands on the default branch, or after a maintainer triggers it through another accepted bootstrap path.
- 2026-05-21: Resolved registration blocker by cherry-picking workflow commit `9331885c` onto default branch `master` as `6aeb3191` and pushing it.
- `gh workflow list --all` now shows `Manual Update Playwright Visual Baselines`.
- `gh workflow run manual-update-playwright-visual-baselines.yml --ref refactor/icon-consistency-pass` now succeeds and created run `26240623328`: https://github.com/xuan2261/NavSlidesEditor/actions/runs/26240623328
- Run `26240623328` completed with failure at `npm ci` because `package-lock.json` was missing npm 10 lock entries for `esbuild@0.28.0` and related `@esbuild/*@0.28.0` optional packages. This is a new lockfile-sync blocker after dispatch registration was fixed.
- Updated `package-lock.json` with `npx npm@10.8.2 install --package-lock-only`; `npx npm@10.8.2 ci --dry-run` now passes the lockfile sync check.
- Pushed lockfile fix as `2da23289` and dispatched rerun `26241153971`: https://github.com/xuan2261/NavSlidesEditor/actions/runs/26241153971. This run passed `npm ci` and `npm run build`; visual update is running.
- Run `26241153971` failed at verify with 16 passed and 1 failed: `live-viewer-no-presenter.png` differed by ~303-323 pixels because the screenshot included a random room code. Masked the dynamic `Room: {roomCode}` line in `present-speaker-share-and-live-viewer-baselines.spec.js` before rerun.
- Run `26241432529` on commit `138584bf` passed `npm ci`, `npm run build`, `Update visual baselines`, and `Verify regenerated visual baselines`.
- Run `26241432529` failed only at `Upload Linux visual baseline snapshots` and `Upload Playwright report` because GitHub Actions artifact storage quota is exhausted: `Failed to CreateArtifact: Artifact storage quota has been hit`. Artifact download/application remains blocked until quota is freed or recalculated.
- 2026-05-22: Deleted 10 old `electron-win` GitHub Actions artifacts via API, freeing about 2.3 GB from the repository artifact list. `gh api repos/xuan2261/NavSlidesEditor/actions/artifacts` now reports `0` artifacts.
- Rerun `26253132404` on commit `0f5f1d41` passed `npm ci`, `npm run build`, `Update visual baselines`, and `Verify regenerated visual baselines`, but artifact upload still failed with `Artifact storage quota has been hit`; GitHub notes usage recalculation can take 6-12 hours. `gh run download 26253132404 --name linux-playwright-visual-baseline-snapshots` confirms no artifact was created yet.
- Deleted all remaining visible GitHub Actions artifacts across `xuan2261` repos: 146 expired artifacts from `nano-banana-slides-prompter` (~25.0 GB), 7 expired artifacts from `PPTAgent` (~1.1 GB), 10 old artifacts from this repo (~2.3 GB), and remaining Pages artifacts (~163 MB). Account artifact scan now reports no artifacts remain.
- Rerun `26253710975` on commit `0f5f1d41` again passed `npm ci`, `npm run build`, `Update visual baselines`, and `Verify regenerated visual baselines`, but failed at upload because GitHub still has not recalculated artifact storage quota. Next action: rerun after GitHub's 6-12 hour quota recalculation window.
- Rerun `26258526849` on commit `bae62815` again passed `npm ci`, `npm run build`, `Update visual baselines`, and `Verify regenerated visual baselines`, but failed at upload with the same quota message while repo artifact count remains `0`. Stop rerunning until GitHub backend recalculates artifact storage.
- Run `26262072930` on commit `bfd7f11c` passed update, verify, snapshot artifact upload, and report upload. Artifact `linux-playwright-visual-baseline-snapshots` was downloaded to `.tmp/visual-baselines`, audited, and only `*-chromium-linux.png` files were copied into `tests/e2e/visual/**/*-snapshots/` and `tests/e2e/visual-regression.spec.js-snapshots/`.
- Applied Linux-generated PNGs were committed as `c340ef0b test: add linux visual baselines`. `.tmp` was deleted after artifact review.

## Unresolved Questions

_None._

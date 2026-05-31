# Validation Report

## Phase 01 Baseline - 2026-05-14

- Branch: `master`
- HEAD: `6ac3b60b73691b0be2accb75a88854b47dd3e003`
- Upstream main: `6c3ef0063f5b7e8730e4d1e80ef1b88165ef25d7`
- Backup ref: `backup/pre-upstream-selective-port-20260514` -> `6ac3b60b73691b0be2accb75a88854b47dd3e003`
- `git merge-base HEAD upstream/main`: no merge base, expected for unrelated histories.
- Main worktree status before port:
  - `master...origin/master [ahead 4]`
  - Modified plan: `plans/260514-0749-upstream-main-merge-sync/plan.md`
  - Untracked current selective-port plan and research reports.

## Baseline Gates

| Command | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Pass | ESLint completed. |
| `npm run build` | Pass | Vite build completed; existing chunk-size warnings only. |
| `npm run test` | Fail | 3 failures out of 914 tests. |

## Baseline Test Failures

- `server/routes/share.test.js`: share creation returned 500 because `server/data/presentations.json` was read during an incomplete JSON write.
- `server/routes/presentations.test.js`: duplicate route returned 500 in same storage/data race area.
- `server/routes/api-surface.test.js`: analytics authorized request returned 403, likely cross-test mutation of shared `share-tokens.json`.

These failures existed before selective port implementation. They block a clean final test gate unless fixed or isolated later.

## Unresolved Questions

- Should route tests be isolated with per-test temp `SLIDES_DATA_DIR`, or should storage writes become atomic to remove partial-read race?

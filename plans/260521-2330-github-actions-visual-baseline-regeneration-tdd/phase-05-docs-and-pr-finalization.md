---
phase: 5
title: "Docs and PR Finalization"
status: complete
priority: P2
effort: "0.5-1h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Docs and PR Finalization

## Context Links

- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [Project changelog](../../docs/project-changelog.md)
- [Icon plan](../260521-1130-icon-consistency-pass-tdd/plan.md)

## Overview

Document the new manual baseline path and finish the existing icon PR with a clear test plan. This phase should also update the original icon plan from blocked to complete once PR-ready gates pass.

## Requirements

### Functional

- Update testing guide with GitHub Actions fallback for maintainers without local Docker.
- Update changelog only if the workflow and snapshots are committed as a significant testing infra change.
- Update icon plan Phase 4 success criteria after visual gate passes.
- Prepare PR body with exact verification commands and CI run links.

### Non-functional

- Keep docs concise.
- Do not overstate local visual parity; Linux CI remains source of truth.
- Preserve existing Docker command as the preferred local path when Docker exists.

## Related Code Files

### Modify

- `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- `docs/project-changelog.md` if appropriate
- `plans/260521-1130-icon-consistency-pass-tdd/phase-04-verify-and-pr.md`
- `plans/260521-1130-icon-consistency-pass-tdd/plan.md`

## Implementation Steps

1. Add a short "GitHub Actions fallback" section near visual baseline regeneration docs.
2. Include:
   - workflow name
   - `gh workflow run`
   - `gh run download`
   - artifact allowlist
   - warning against Windows/macOS snapshot updates
3. Update icon plan Phase 4 verification notes with the successful run ID/date.
4. If committing, stage only relevant files:
   - workflow
   - contract test
   - docs/plan updates
   - Linux snapshot PNGs
5. Commit with conventional message:
   ```text
   test: regenerate visual baselines via manual ci workflow
   ```
6. PR body includes:
   - summary of icon fixes
   - visual baseline regeneration method
   - test plan commands
   - CI/manual workflow links
   - deferred issue #7 note

## Todo List

- [x] Update testing guide.
- [x] Update changelog if scope warrants.
- [x] Update icon plan verification notes.
- [x] Prepare PR body.
- [x] Commit focused changes.
- [x] Create/update PR.

## Test Strategy

| Check | Type | Asserts |
|---|---|---|
| Docs command sanity | Manual review | Commands match workflow name/artifact name |
| Git staged diff | Git review | No unrelated dirty work included |
| PR body checklist | Manual review | Verifications and deferred item documented |

## Success Criteria

- [x] Maintainers can regenerate baselines without local Docker by following docs.
- [x] Original icon plan no longer blocked on visual baselines.
- [x] PR is ready for review with concrete verification evidence.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Docs become stale if workflow renamed | Contract test and docs mention exact workflow path; update together |
| Commit accidentally includes unrelated dirty files | Use explicit path staging and `git status --short` before commit |
| Changelog noise | Only update changelog if workflow/snapshots are part of final committed PR |

## Security Considerations

- PR should state workflow has `contents: read` and no secret use.
- Do not include artifact temp directory in commit.

## Next Steps

Return to the icon plan Phase 4 and complete PR creation.

## Phase Notes

- Added GitHub Actions fallback instructions to `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`.
- Added 2026-05-21 changelog entry for the manual baseline workflow and default-branch dispatch blocker.
- Added 2026-05-22 changelog/testing-guide updates for the successful fallback run.
- Run `26262072930` generated and verified Linux baselines, uploaded artifacts, and unblocked the original icon consistency plan. Focused commits pushed: `bfd7f11c test: stabilize editor canvas visual baseline` and `c340ef0b test: add linux visual baselines`.
- Created PR: https://github.com/xuan2261/NavSlidesEditor/pull/2

## Unresolved Questions

_None._

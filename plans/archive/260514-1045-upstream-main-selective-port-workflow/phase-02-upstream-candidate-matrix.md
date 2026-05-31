# Phase 02 - Upstream Candidate Matrix

## Context Links

- [Plan](./plan.md)
- [Research Synthesis](./research/research-synthesis.md)
- [Impact Report](../reports/researcher-260514-upstream-selective-port-impact.md)

## Overview

- Priority: P1
- Status: Complete
- Goal: select the smallest valuable upstream subset before any code changes.

## Key Insights

- Upstream has about 122 unique commits relative to local HEAD.
- Not all upstream commits fit local NavSlidesEditor. Some are feature expansion, generated docs, or unrelated SaaS/landing work.
- Current recommended candidates:
  - Keep: `93816b88` Copy URL context menu.
  - Investigate/conditional: `315eee97`, `6d971eb0`, typography/export-related commits.
  - Verify first: `cde1b2e9`, `347d6ad8`, HTML embed present-mode commits.
  - Defer: timeline series and image citation/crop series.

## Requirements

- Functional:
  - Create a candidate matrix report.
  - Classify each relevant upstream commit as Keep, Manual Port, Verify First, Defer, or Reject.
  - Record reason and expected files for each candidate.
- Non-functional:
  - No code edits.
  - No broad commit ranges.
  - Keep matrix concise but complete enough for implementation.

## Architecture

```text
upstream/main log -> candidate matrix -> phase-specific port queues
```

## Related Code Files

- Modify: none.
- Create:
  - `plans/260514-1045-upstream-main-selective-port-workflow/reports/candidate-matrix.md`
- Delete: none.

## Implementation Steps

1. Generate upstream commit list:
   ```powershell
   git log --oneline --reverse HEAD..upstream/main
   ```
2. Inspect high-fit commits:
   ```powershell
   git show --name-status --stat 93816b88
   git show --name-status --stat 315eee97
   git show --name-status --stat cde1b2e9
   git show --name-status --stat 347d6ad8
   ```
3. Search local landing zones:
   ```powershell
   rg -n "context menu|right-click|clipboard|copy" client/src
   rg -n "FontSize|FontFamily|font-size|fontFamily" client/src shared server
   rg -n "html|iframe|srcdoc|blob|data-pdf-iframe" shared client/src server
   rg -n "citation|timeline" client/src shared server
   ```
4. Create matrix columns:
   - Commit
   - Upstream title
   - Local fit
   - Expected local files
   - Strategy: cherry-pick/manual/verify/defer/reject
   - Test gate
   - Reason
5. Require explicit approval before Phase 04/05 implementation if any candidate beyond recommended scope is added.

## TDD / Verification

- No runtime tests needed because no code changes.
- Verification commands:
  ```powershell
  Test-Path plans/260514-1045-upstream-main-selective-port-workflow/reports/candidate-matrix.md
  git status --short --branch
  ```

## Todo List

- [x] Generate upstream commit list.
- [x] Inspect high-fit commits with `git show`.
- [x] Search local landing zones.
- [x] Create candidate matrix report.
- [x] Mark timeline/citation decisions explicitly.
- [x] Confirm no code changed.

## Success Criteria

- Candidate matrix exists.
- Every selected commit has rationale and test gate.
- Deferred domains are explicit.

## Risk Assessment

- Risk: selecting too much.
  - Mitigation: require per-commit reason and phase mapping.
- Risk: missing hidden dependency commit.
  - Mitigation: inspect `git show` and dependency chain before porting.

## Security Considerations

- Pay attention to commits touching HTML embeds, URLs, clipboard, file uploads, share/export paths.

## Next Steps

- Proceed to Phase 03 worktree setup.

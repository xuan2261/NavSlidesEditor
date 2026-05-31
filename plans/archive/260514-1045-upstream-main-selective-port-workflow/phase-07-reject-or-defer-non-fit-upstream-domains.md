# Phase 07 - Reject Or Defer Non-Fit Upstream Domains

## Context Links

- [Plan](./plan.md)
- [Impact Report](../reports/researcher-260514-upstream-selective-port-impact.md)
- [Candidate Matrix](./reports/candidate-matrix.md)

## Overview

- Priority: P2
- Status: Complete
- Goal: explicitly reject/defer upstream areas that do not fit local product architecture this round.

## Key Insights

- Timeline upstream series appears to implement a content timeline element.
- Local `AnimationTimeline.jsx` is fragment sequencing UI, not the same model.
- Image citation/crop commits depend on citation metadata absent from local `shared/src/types/presentation.js`.
- Porting these now would become feature expansion, not sync hygiene.

## Requirements

- Functional:
  - Record skip/defer decision for timeline commits.
  - Record skip/defer decision for image citation/crop commits.
  - Create future-plan notes if product wants these features later.
- Non-functional:
  - No schema changes.
  - No UI feature expansion in current sync plan.
  - No tests added for features not implemented.

## Architecture

```text
upstream candidate -> local fit check -> defer/reject record -> future roadmap note
```

## Related Code Files

- Modify:
  - `plans/260514-1045-upstream-main-selective-port-workflow/reports/candidate-matrix.md`
  - `docs/project-roadmap.md` only if user wants future feature tracked.
  - `docs/project-changelog.md` only if deferred decisions should be recorded.
- Create: optional future plan only after user approval.
- Delete: none.

## Implementation Steps

1. Inspect timeline commits enough to justify defer:
   ```powershell
   git show --name-status --stat 9d3288ea
   git show --name-status --stat 778a7646
   git show --name-status --stat fe5deaae
   git show --name-status --stat 56067fde
   git show --name-status --stat 2e280692
   ```
2. Inspect citation/crop commits:
   ```powershell
   git show --name-status --stat 0e7196b6
   git show --name-status --stat 856d206b
   git show --name-status --stat 515b607c
   git show --name-status --stat b69202d8
   ```
3. Confirm local absence:
   ```powershell
   rg -n "timeline|citation|caption|crop" client/src shared server
   ```
4. Update candidate matrix with final decisions:
   - Defer timeline: no matching local element model.
   - Defer image citation/crop: no citation schema.
   - Reject generated docs/assets unless separately requested.
5. If user wants future work, create separate plan later. Do not implement here.

## TDD / Verification

- No runtime tests required if only documentation/matrix changes.
- Verification:
  ```powershell
  git diff -- plans/260514-1045-upstream-main-selective-port-workflow/reports/candidate-matrix.md
  git status --short --branch
  ```
- If docs changed:
  ```powershell
  npm run build
  ```

## Todo List

- [x] Inspect timeline commit series.
- [x] Inspect citation/crop commit series.
- [x] Confirm local schema/UI mismatch.
- [x] Update candidate matrix decisions.
- [x] Update docs/roadmap only if warranted.

## Success Criteria

- Non-fit domains are explicitly deferred or rejected.
- Current sync scope remains small.
- Future feature work is not mixed into port workflow.

## Risk Assessment

- Risk: user expects all upstream visible features.
  - Mitigation: document product impact and propose separate feature plans.
- Risk: missing a small bugfix hidden in deferred commit.
  - Mitigation: inspect file list; extract only isolated fix if it maps cleanly.

## Security Considerations

- Citation/image schema changes may affect export/share rendering; avoid unplanned schema expansion.

## Next Steps

- Proceed to Phase 08 full validation.

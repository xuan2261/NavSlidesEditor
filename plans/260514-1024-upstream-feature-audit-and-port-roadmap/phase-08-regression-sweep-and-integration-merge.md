# Phase 08 - Regression Sweep And Integration Merge

## Context Links

- [Plan](./plan.md)
- [Red team validation](./reports/red-team-validation.md)

## Overview

- Priority: P0
- Status: Ready for Merge
- Estimate: 4h
- Goal: validate accepted batches and merge back only after gates pass.

## Key Insights

- Per-batch tests reduce noise.
- Final full suite is still needed before merging into `master`.
- Do not ignore failing tests.

## Requirements

- Run full local validation on sync branch.
- Fix failures by root cause, not by deleting tests.
- Review diff for unrelated churn.
- Merge via non-destructive Git flow.
- Keep rollback path.

## Architecture

```text
topic branches
  -> sync/upstream-feature-audit-port-260514
     -> final gates
        -> master merge
```

## Related Code Files

- Modify: none planned, except fixes for validation failures.
- Read:
  - all changed files.
- Delete:
  - only generated temp artifacts if accidentally created.

## Implementation Steps

1. Inspect diff:
   ```powershell
   git diff --stat master...HEAD
   git diff --name-status master...HEAD
   ```
2. Run required gates:
   ```powershell
   npm run lint
   npm run build
   npm run test
   ```
3. Run targeted E2E from touched phases.
4. Run full E2E:
   ```powershell
   npm run test:e2e
   ```
5. If export/PPTX touched:
   ```powershell
   npm run test:corpus
   ```
6. Run security check before commit:
   ```powershell
   git diff --cached | Select-String -Pattern "(api[_-]?key|token|password|secret|credential)" -CaseSensitive:$false
   ```
7. Merge after gates:
   ```powershell
   git switch master
   git merge --no-ff sync/upstream-feature-audit-port-260514
   ```

## Todo List

- [x] Review diff stat.
- [x] Run lint.
- [x] Run build.
- [x] Run unit tests.
- [x] Run targeted E2E.
- [x] Run full E2E.
- [x] Run corpus if needed.
- [x] Security scan unstaged diff.
- [ ] Merge only after pass.

## Success Criteria

- All required gates pass.
- No unrelated upstream churn.
- No generated build artifacts committed.
- Merge commit is focused and reversible.

## Verification

Required final:
```powershell
npm run lint
npm run build
npm run test
npm run test:e2e
```

Conditional:
```powershell
npm run test:corpus
npm run test:load:api
npm run test:load:ws
```

## Risk Assessment

- Risk: long E2E suite surfaces unrelated flakes.
- Mitigation: document exact failure, rerun once, debug root cause if persistent.

## Security Considerations

- Secret scan required before commit.
- Do not commit `server/data` credentials, uploads, or local configs.

## Next Steps

- Proceed to docs release audit.

## Unresolved Questions

- Merge not performed yet.

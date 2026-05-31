# Phase 02 - Configure Upstream And Inspect Diff

## Context Links

- [Plan](./plan.md)
- [Research 01](./research/researcher-01-git-upstream-merge-safety.md)
- [Research 02](./research/researcher-02-project-validation-and-risk.md)

## Overview

- Priority: P1
- Status: Pending
- Goal: configure upstream and inspect incoming changes before merging.

## Key Insights

- Upstream target is `https://github.com/jbirky/parallax-presentations`.
- Use `main`, not `dev`.
- Inspect history relationship before merge to catch unrelated-history problems.

## Requirements

- Functional:
  - Add or update `upstream` remote.
  - Fetch upstream refs.
  - Compare local `HEAD` with `upstream/main`.
- Non-functional:
  - Do not merge yet.
  - Keep inspection output concise.

## Architecture

```text
origin/master  -> user's repo
upstream/main  -> jbirky/parallax-presentations
master         -> local customized branch
```

## Related Code Files

- Modify: none expected.
- Create: none expected.
- Delete: none.

## Implementation Steps

1. Configure upstream:
   ```powershell
   git remote get-url upstream
   ```
   If missing:
   ```powershell
   git remote add upstream https://github.com/jbirky/parallax-presentations.git
   ```
   If wrong:
   ```powershell
   git remote set-url upstream https://github.com/jbirky/parallax-presentations.git
   ```
2. Fetch:
   ```powershell
   git fetch upstream
   ```
3. Confirm upstream branch:
   ```powershell
   git branch -r | Select-String "upstream/main"
   git rev-parse upstream/main
   ```
4. Inspect relationship:
   ```powershell
   git merge-base HEAD upstream/main
   git log --oneline --left-right --graph HEAD...upstream/main --max-count=80
   git diff --name-status HEAD..upstream/main
   ```
5. If `git merge-base` fails, stop and decide whether `--allow-unrelated-histories` is acceptable. Do not proceed automatically.

## Verification And Tests

- `git remote -v` includes `upstream`.
- `git rev-parse upstream/main` succeeds.
- `git merge-base HEAD upstream/main` succeeds or blocker is documented.
- `git diff --name-status HEAD..upstream/main` reviewed.

## Todo List

- [ ] Configure upstream remote.
- [ ] Fetch upstream.
- [ ] Confirm `upstream/main`.
- [ ] Inspect merge-base.
- [ ] Inspect incoming changed files.
- [ ] Stop if unrelated-history risk appears.

## Success Criteria

- Upstream ready.
- Incoming diff understood enough to start merge.

## Risk Assessment

- Risk: wrong upstream URL.
  - Mitigation: verify `git remote -v`.
- Risk: accidentally using `upstream/dev`.
  - Mitigation: all commands target `upstream/main`.

## Security Considerations

- Fetching public upstream is safe; do not expose local credentials in logs.

## Next Steps

- Proceed to Phase 03.

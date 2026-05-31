# Phase 4 - Commit Tag Push Readiness

## Context Links

- [Overview](./plan.md)
- [Scout Report](./reports/scout-report.md)
- `.github/workflows/release.yml:3-12,68-77,79-119`
- `README.md:7,76`
- `docs/deployment-guide.md:130,271-272`
- `tests/unit/electron-release-readiness-contract.test.js:10-41`

## Overview

- Priority: P1
- Status: in progress
- Goal: cut a clean `v1.9.1` release commit/tag from current HEAD after local Windows verification passes, while excluding unrelated files and keeping rollback simple.

## Key Insights

- Current repo state is not clean: tracked release-prep changes already exist in `README.md`, `docs/codebase-summary.md`, `docs/deployment-guide.md`, `docs/project-changelog.md`, plus an untracked release contract test; `vandecangiaiquyet.md` is unrelated and must stay untouched.
- Latest published GitHub Release is still `v1.7.1` (2026-05-14), while latest local tag is `v1.8.0` and `HEAD` is 32 commits ahead; the next official tag should be `v1.9.1`, not `v1.8.0`.
- Tag push is the safest official path because `.github/workflows/release.yml:3-6,97-118` already derives the release tag/name from the git tag.

## Requirements

- Functional:
  1. Release commit contains only intended release files.
  2. Tag `v1.9.1` points at the verified release commit.
  3. Push strategy triggers the Windows release workflow without depending on main CI.
- Non-functional:
  1. Keep commit history focused and auditable.
  2. Keep rollback cheap before public release.

## Architecture

- Data flow:
  1. Verified file set from Phases 1-3 becomes one release-prep commit.
  2. Git tag `v1.9.1` becomes the workflow trigger: `.github/workflows/release.yml:3-6`.
  3. Release job publishes the uploaded Windows artifacts through `softprops/action-gh-release`: `.github/workflows/release.yml:68-77,88-119`.
- Backwards compatibility:
  1. No tag reuse of `v1.8.0`.
  2. No branch or workflow restructuring required.

## Related Code Files

- Commit allowlist:
  - `README.md`
  - `docs/deployment-guide.md`
  - `docs/project-overview-pdr.md`
  - `docs/project-roadmap.md`
  - `docs/codebase-summary.md`
  - `.github/workflows/release.yml`
  - `tests/unit/electron-release-readiness-contract.test.js`
  - optional `docs/project-changelog.md`
- Explicitly exclude:
  - `vandecangiaiquyet.md`
  - unrelated generated artifacts

## Implementation Steps

1. Re-run `git status` and confirm only release-intent files are staged.
2. Review `git diff --cached` for the allowlist above; remove anything unrelated.
3. Create one focused release-prep commit, e.g. `chore(release): prepare v1.9.1 windows electron`.
4. Create tag `v1.9.1` on that verified commit.
5. Push commit and tag; prefer tag push over manual dispatch for the official release.
6. After push, verify the GitHub workflow uploads Windows artifacts and creates a GitHub Release from them.

## Todo List

- [ ] Confirm clean staging allowlist
- [ ] Exclude `vandecangiaiquyet.md`
- [ ] Create focused release-prep commit
- [ ] Tag `v1.9.1`
- [ ] Push commit and tag
- [ ] Verify GitHub Release asset creation

## Success Criteria

- Release commit contains only intended files.
- Tag `v1.9.1` exists on the verified commit.
- GitHub Release publishes Windows Electron artifacts from the tag-triggered workflow.

## Risk Assessment

- High: accidental inclusion of unrelated files from the dirty worktree.
  - Likelihood x impact: High x High.
  - Mitigation: stage by allowlist only; inspect cached diff before commit.
- Medium: tag/version drift if manual dispatch is used instead of tag push.
  - Likelihood x impact: Low x Medium.
  - Mitigation: use tag push as the official path; reserve manual dispatch for emergency reruns only.
- Medium: release notes/changelog duplication if `docs/project-changelog.md` is included without intent.
  - Likelihood x impact: Medium x Low.
  - Mitigation: decide inclusion explicitly in Phase 1 and keep the commit scoped.

## Security Considerations

- Verify no local secrets, credentials, or data files are included before commit/push.
- Keep release automation limited to repository contents and GitHub-provided token usage.

## Test Matrix

- Unit/contract:
  - release-readiness contract already passed in Phase 3
- Integration:
  - local Windows build/package verification already passed in Phase 3
- End-to-end:
  - GitHub Release workflow run on tag push

## Rollback Plan

- Before push: delete/move the local tag and amend/recreate the release-prep commit.
- After push but before public consumption: delete the bad GitHub Release and remote tag, fix commit scope, retag, repush.
- Do not reuse `v1.8.0`; always issue or repair `v1.9.1`.

## Next Steps

- Once the release is published, close the plan and archive it with the final release run ID and artifact names.

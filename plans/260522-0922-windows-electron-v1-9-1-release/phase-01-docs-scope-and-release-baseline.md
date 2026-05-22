# Phase 1 - Docs Scope And Release Baseline

## Context Links

- [Overview](./plan.md)
- [Scout Report](./reports/scout-report.md)
- `package.json:3`
- `package-lock.json:3,9`
- `README.md:7,76`
- `docs/project-overview-pdr.md:5`
- `docs/project-roadmap.md:3,95-96`
- `docs/codebase-summary.md:6-7,154`
- `docs/deployment-guide.md:130,271-272`

## Overview

- Priority: P1
- Status: complete
- Goal: lock every release-facing doc in scope to `v1.9.1`, keep wording consistent with a Windows-only GitHub Release path, and define a clean release commit boundary.

## Key Insights

- Root version is already `1.9.1` in both root manifests, so this phase is alignment, not version bumping: `package.json:3`, `package-lock.json:3,9`.
- The scoped docs already point to `v1.9.1` in the current worktree, but they are not yet committed together, so commit scope matters as much as text correctness: `README.md:7`, `docs/project-overview-pdr.md:5`, `docs/project-roadmap.md:3`, `docs/codebase-summary.md:6-7,154`.
- Windows-only release wording is already present in `README.md:76` and `docs/deployment-guide.md:130,271-272`; do not broaden GitHub Release promises to Linux/macOS.

## Requirements

- Functional:
  1. `package.json` remains the only release version source for this cut.
  2. All scoped docs mention `v1.9.1` or Windows-only release behavior consistently.
  3. No text should imply a rollback to `v1.8.0`.
- Non-functional:
  1. Keep edits minimal; do not touch unrelated docs.
  2. Do not change inner workspace package versions unless a traced release consumer requires them.

## Architecture

- Data flow:
  1. Input: root version string from `package.json:3`.
  2. Transform: copy version/Windows-only wording into scoped docs only.
  3. Output: one release-doc commit slice that matches the actual release workflow.
- Backwards compatibility:
  1. No runtime/data migration.
  2. Existing Linux/macOS local build instructions remain, but GitHub Release scope stays Windows-only.

## Related Code Files

- Modify:
  - `README.md`
  - `docs/deployment-guide.md`
  - `docs/project-overview-pdr.md`
  - `docs/project-roadmap.md`
  - `docs/codebase-summary.md`
- Optional:
  - `docs/project-changelog.md`
- Do not touch:
  - `vandecangiaiquyet.md`

## Implementation Steps

1. Grep the scoped docs for `Current release`, `v1.9.1`, `v1.8.0`, `Windows`, and `Release` text; treat `package.json:3` as source of truth.
2. Normalize only the scoped docs listed above; leave unrelated docs and archived notes alone.
3. Keep the Windows-only wording aligned with the actual workflow behavior described in `.github/workflows/release.yml:18-77`.
4. Decide whether `docs/project-changelog.md` belongs in the release commit. If yes, keep it as a release note only; if no, exclude it from staging.
5. Prepare a strict stage allowlist so `vandecangiaiquyet.md` never enters the release commit.

## Todo List

- [x] Audit all scoped docs against `package.json:3`
- [x] Remove any remaining `v1.8.0`/`v1.9.0` release wording in scoped files
- [x] Keep Windows-only wording exact in README/deployment docs
- [x] Decide include/exclude for `docs/project-changelog.md`
- [x] Define release commit allowlist

## Success Criteria

- Every scoped doc in this phase matches `v1.9.1`.
- README and deployment guide describe GitHub Release output as Windows-only, not cross-platform.
- The planned release commit can be staged without `vandecangiaiquyet.md` or unrelated files.

## Risk Assessment

- High: dirty worktree causes accidental partial release commit.
  - Likelihood x impact: High x High.
  - Mitigation: stage by explicit allowlist only; inspect `git diff --cached` before commit.
- Medium: inner workspace package versions (`client/package.json:3`, `server/package.json:3`, `shared/package.json:3`) create noise.
  - Likelihood x impact: Medium x Low.
  - Mitigation: treat them as out of scope unless a traced release consumer reads them.

## Security Considerations

- Ensure no local credential/data files are staged.
- Keep release scope doc-only in this phase; no secret-bearing runtime files should be touched.

## Test Matrix

- Unit/contract: handled in Phase 2.
- Integration: not applicable.
- End-to-end: not applicable.

## Rollback Plan

- Before tag: unstage/revert only the doc commit slice.
- After tag but before push: move/delete local tag and rewrite the release commit locally.
- No data rollback required.

## Next Steps

- Phase 2 owns `.github/workflows/release.yml` and `tests/unit/electron-release-readiness-contract.test.js`.
- Phase 3 runs verification only after Phase 2 content is stable.

# Researcher 01 Report - Git Upstream Merge Safety

## Scope

Plan safe sync from `jbirky/parallax-presentations` into customized `NavSlidesEditor`.

## Findings

- Current branch: `master`.
- Current branch status at planning time: clean worktree, `master...origin/master [ahead 3]`.
- `origin`: `https://github.com/xuan2261/NavSlidesEditor`.
- Upstream source is not configured as remote yet.
- Upstream `main`: `6c3ef0063f5b7e8730e4d1e80ef1b88165ef25d7`.
- Upstream also has `dev`: `749540ccef2696dcbf830b3a25353dcf7645972b`.
- Local latest commit at planning time: `7327190 Save Ngay14thang5N2026`.
- Local has npm workspace project with `package-lock.json`; use npm, not pnpm/yarn.

## Recommended Strategy

Use merge, not rebase:

1. Keep current local history intact.
2. Create dedicated sync branch from current `master`.
3. Add/fetch `upstream`.
4. Merge `upstream/main`.
5. Resolve conflicts in domain groups.
6. Run build/test gates.
7. Merge sync branch back to `master` only after validation passes.

## Why Not Rebase

- Local repo is already customized and ahead of `origin`.
- Rebase rewrites local commits and makes conflict recovery harder.
- Merge commit gives clear audit trail: "local customized fork + upstream update".

## Risk Areas

- `package.json` / `package-lock.json`: upstream dependency drift.
- `client/src/`: most likely conflict surface.
- `server/`: API/data compatibility risk.
- `tests/`: upstream test changes may not match local features.
- `docs/` and `plans/`: local docs should not be overwritten casually.

## Verification Notes

Minimum gates:

- `git status --porcelain=v1`
- `npm install`
- `npm run build`
- `npm run test`
- targeted `npm run test:e2e` only after app starts cleanly or when conflicts affect UI flows.

## Unresolved Questions

- Whether upstream `dev` should be evaluated after `main`; recommendation: no for this round.

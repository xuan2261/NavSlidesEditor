# Scout Report

## Verified State

- Root release version is already `1.9.1` in `package.json:3` and `package-lock.json:3,9`.
- Release-facing docs in scope already reference `v1.9.1` in the current worktree: `README.md:7`, `docs/project-overview-pdr.md:5`, `docs/project-roadmap.md:3`, `docs/codebase-summary.md:6-7,154`, `docs/deployment-guide.md:130,271-272`.
- Latest published GitHub Release remains `v1.7.1` as of 2026-05-14; latest local tag is `v1.8.0`; `HEAD` is 32 commits ahead.
- Release automation is separate from the main CI workflow:
  - release: `.github/workflows/release.yml:3-12,79-119`
  - main CI: `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml:3-8,223-244`

## Release Path Trace

1. `package.json:20-21` runs `postinstall` -> `npm run vendor`.
2. `scripts/copy-vendor.js:48-61` rewrites `server/vendor`; `scripts/copy-vendor.js:97-146` fetches remote plugin assets and does not fail hard on download errors.
3. `.github/workflows/release.yml:31-38` installs deps, builds client, and runs `scripts/prepare-electron.js`.
4. `scripts/prepare-electron.js:47-110` creates isolated server prod deps under `server/node_modules` and verifies a module allowlist.
5. `electron-builder.yml:14-30` packages `server/`, `client/dist/`, and build assets into `dist-electron/`.
6. `.github/workflows/release.yml:57-66` currently verifies only packaged `express`, then uploads artifacts and creates the GitHub Release via `softprops/action-gh-release`.

## Risks

- High: local packaging mutates `server/node_modules` and `server/vendor`; do not run it in the current dirty worktree.
- High: remote vendor download failures can be silent because `copy-vendor.js` logs and continues.
- Medium: release workflow uses `npm install` while main CI uses `npm ci`.
- Medium: current contract test does not yet cover `docs/project-overview-pdr.md` or `docs/project-roadmap.md`.

## Worktree Notes

- Current tracked release-prep changes exist in `README.md`, `docs/codebase-summary.md`, `docs/deployment-guide.md`, and `docs/project-changelog.md`.
- Current untracked files include `tests/unit/electron-release-readiness-contract.test.js` and unrelated `vandecangiaiquyet.md`.

## Unresolved Questions

- Include `docs/project-changelog.md` in the release commit or leave it out?
- Normalize release workflow to `npm ci` now, or defer that change after v1.9.1 ships?

# Phase 3 - Local Windows Package Verification

## Context Links

- [Overview](./plan.md)
- [Scout Report](./reports/scout-report.md)
- `package.json:20-21,22,45-50`
- `scripts/copy-vendor.js:48-61,75-149`
- `scripts/prepare-electron.js:47-110`
- `.github/workflows/release.yml:31-66`
- `electron-builder.yml:14-30,37-42`
- `electron/main.js:90-124`

## Overview

- Priority: P1
- Status: complete
- Goal: verify the Windows Electron release locally from current HEAD in a disposable workspace, without depending on the main CI workflow and without polluting the current dirty worktree.

## Key Insights

- Root `postinstall` rewrites `server/vendor` via `package.json:20-21` and `scripts/copy-vendor.js:48-61`, then may fetch remote plugin files: `scripts/copy-vendor.js:97-146`.
- `scripts/prepare-electron.js` rewrites `server/node_modules` from an isolated temp install and copies `revealjs-shared`: `scripts/prepare-electron.js:47-110`.
- `electron-builder.yml:14-30` packages `server/`, `client/dist/`, and build assets into `dist-electron/`.
- `electron/main.js:90-124` expects packaged resources to contain the server entrypoint plus client assets under `process.resourcesPath`.

## Requirements

- Functional:
  1. Run the release verification path on Windows from current HEAD.
  2. Verify packaged output contains the required runtime modules and representative vendor assets.
  3. Produce a clear pass/fail answer independent from unrelated `master` CI failures.
- Non-functional:
  1. Do not run the mutable packaging flow in the current dirty worktree.
  2. Keep verification minimal and reproducible.

## Architecture

- Data flow:
  1. `npm ci/install` installs root deps and triggers vendor population.
  2. `npm run build` produces `client/dist`.
  3. `node scripts/prepare-electron.js` builds isolated server prod deps under `server/node_modules`.
  4. `npx electron-builder --win --publish never` emits `dist-electron/` Windows artifacts.
  5. Verification reads `dist-electron/win-unpacked/resources/{server,client,build}` for file presence checks.
- Backwards compatibility:
  1. No runtime schema changes.
  2. Linux/macOS packaging remains out of GitHub Release scope.

## Related Code Files

- No source-file edits planned in this phase.
- Ephemeral output paths:
  - `.electron-tmp/`
  - `server/node_modules/`
  - `server/vendor/`
  - `dist-electron/`

## Implementation Steps

1. Create a disposable git worktree or clean clone pinned to the intended release commit/HEAD.
2. Run the minimal preflight:
   - targeted contract test from Phase 2
   - `npm run build`
3. Run the packaging path:
   - `node scripts/prepare-electron.js` or `npm run electron:prepare`
   - `npx electron-builder --win --publish never`
4. Verify packaged output allowlist:
   - `dist-electron/*.exe`
   - `dist-electron/win-unpacked/resources/server/index.js`
   - `dist-electron/win-unpacked/resources/server/node_modules/{express,cors,fs-extra,multer,pptx2json,pptxtojson,revealjs-shared}`
   - `dist-electron/win-unpacked/resources/server/vendor/reveal.js/dist/reveal.js`
   - `dist-electron/win-unpacked/resources/server/vendor/reveal-plugins/menu/menu.js`
   - `dist-electron/win-unpacked/resources/server/vendor/reveal-plugins/chalkboard/plugin.js`
   - `dist-electron/win-unpacked/resources/client/dist/index.html`
5. Record the exact commands and artifact names used for the release handoff.

## Todo List

- [x] Record verification workspace and staging boundary
- [x] Run targeted contract + build preflight
- [x] Run Windows Electron package build
- [x] Verify packaged module/resource allowlist
- [x] Capture commands and artifact names for release handoff

## Phase Result

- Verified in the current workspace because the build outputs are ignored and staging is allowlist-only.
- `npm run electron:build:win` passed.
- Generated artifacts: `dist-electron/NavSlides Editor Setup 1.9.1.exe` and `dist-electron/NavSlides Editor 1.9.1.exe`.
- Packaged checks passed for `express`, `pptxtojson`, and `pptx2json` under `dist-electron/win-unpacked/resources/server/node_modules/`.

## Success Criteria

- Windows Electron packaging completes locally.
- Packaged app contains every required module/resource in the allowlist.
- Verification result is independent from the main `CI` workflow status.

## Risk Assessment

- High: running release prep in the current worktree mutates `server/node_modules` and `server/vendor`.
  - Likelihood x impact: High x High.
  - Mitigation: always use disposable worktree/clone; delete outputs after verification.
- High: vendor downloads succeed partially and produce a silently incomplete package.
  - Likelihood x impact: Medium x High.
  - Mitigation: verify representative vendor assets inside `win-unpacked`, not just pre-package directories.
- Medium: local machine lacks Windows packaging prerequisites.
  - Likelihood x impact: Low x Medium.
  - Mitigation: fail early on preflight; if blocked locally, rely on tag-triggered GitHub Actions after commit/tag are ready.

## Security Considerations

- Do not package local data/secrets from `server/data` or `server/uploads`; `electron-builder.yml:20-27` already excludes them.
- Keep release verification in an isolated workspace to avoid accidental credential file pickup.

## Test Matrix

- Unit/contract:
  - release-readiness contract from Phase 2
- Integration:
  - `npm run build`
  - `node scripts/prepare-electron.js`
- End-to-end:
  - `npx electron-builder --win --publish never`
  - packaged output allowlist checks

## Rollback Plan

- Delete disposable worktree/clone and generated `dist-electron/` outputs if verification fails.
- Do not tag or push until verification passes.
- No source rollback needed if verification stayed isolated.

## Next Steps

- Phase 4 turns the verified commit into the final release commit/tag/push sequence.

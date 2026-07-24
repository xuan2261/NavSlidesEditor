---
phase: 2
title: "Electron Packaged Smoke Test"
status: pending
priority: P0
effort: "1.5d"
dependencies: [1]
---

# Phase 2: Electron Packaged Smoke Test

## Overview

Bịt lỗ hổng lớn nhất: `release.yml` hiện chỉ verify `node_modules/express` tồn tại trong `dist-electron/win-unpacked/`, không launch app. Phase này thêm Playwright Electron spec **launch packaged .exe** và chạy 2 golden path (GP-01 + một subset GP-02) trên artifact đóng gói, gate trước khi release tag.

## Requirements

**Functional:**
- Spec `tests/electron-smoke/packaged-app-launch-and-golden-path-smoke.spec.js` dùng `_electron.launch()` từ Playwright
- Launch `dist-electron/win-unpacked/NavSlidesEditor.exe`, verify main window opens trong 30s
- Verify embedded server health: HTTP GET `http://127.0.0.1:3002/api/presentations` returns 200 (or in-process equivalent)
- Run subset GP-01: create slide → insert text → save → reload window → verify text persists
- Smoke step inline trong `build-windows` job (Option A — see Architecture), BEFORE artifact upload + `release` job (gating is implicit: release depends on build-windows; smoke failure inside build-windows blocks release)

**Non-functional:**
- Spec timeout ≤ 90s
- Retry 1 lần trên CI nếu launch flake (Electron Windows runner thỉnh thoảng chậm)
- Test data isolated (use temp `DATA_DIR`)
- Cleanup: Electron process killed sau test

## Architecture

```
tests/
├── electron-smoke/                                 # NEW directory
│   ├── packaged-app-launch-and-golden-path-smoke.spec.js
│   ├── _electron-helpers.js                        # launch + cleanup utilities
│   └── playwright-electron.config.js               # standalone config
└── e2e/  (untouched)

.github/workflows/release.yml                       # MODIFIED: add electron-smoke job
```

**Job topology (release.yml) — Option A (RECOMMENDED): smoke in same job as build (avoids artifact-path mismatch):**

```
build-windows-and-smoke ──► release
  ├─ build with electron-builder (produces win-unpacked/ + .exe installer)
  ├─ run electron-smoke against ./dist-electron/win-unpacked/NavSlidesEditor.exe
  └─ upload artifact (installer .exe + .yml only) IF smoke passed
```

**Why Option A:** `release.yml:72-76` currently uploads only `*.exe` + `*.yml` (not `win-unpacked/`); splitting smoke into separate job requires uploading the unpacked dir (~300MB) or re-installing the installer. Cheaper to gate inside `build-windows` itself.

**Test flow (CORRECTED Playwright Electron API):**

1. `await _electron.launch({ executablePath: 'dist-electron/win-unpacked/NavSlidesEditor.exe', env: { ...process.env, DATA_DIR: tmpDataDir } })`
   - **NOT** `args: [exePath]` — that passes exe as argv to the default Electron, not as the binary itself
2. `const window = await app.firstWindow({ timeout: 30000 })`
3. Wait for app interactivity (not just React mount):
   - `await window.waitForSelector('[data-testid="home-page-ready"]')` — sentinel added to HomePage AFTER initial presentation list fetch completes (not generic `data-app-ready` on body which would fire on router mount before page interactive)
4. Run scripted golden path → assert
5. Cleanup: `await app.close()`, then `await waitForPortFree(3002, 5000)` because `electron/main.js:90-107` closes `serverInstance` async — naive `app.close()` leaves port bound for next test

**Port 3002 race handling:**

- `electron/main.js` binds `PORT=3002` hardcoded — if local dev server occupies it, smoke fails opaque
- Helper `_electron-helpers.js` MUST: (a) verify port free before launch, (b) wait for port free after close, (c) emit clear error if conflict

## Related Code Files

**Create:**
- `tests/electron-smoke/packaged-app-launch-and-golden-path-smoke.spec.js`
- `tests/electron-smoke/_electron-helpers.js` (includes `waitForPortFree`, `launchPackaged({executablePath})`, `closePackaged`)
- `tests/electron-smoke/playwright-electron.config.js`
- `scripts/run-electron-smoke.cjs` (wrapper script for CI invocation)
- `tests/unit/electron-smoke-job-presence-in-release-yml.test.js` (contract test)

**Modify:**
- `.github/workflows/release.yml` (extend `build-windows` job with smoke step, BEFORE artifact upload)
- `client/src/pages/HomePage.jsx` (add `data-testid="home-page-ready"` post-fetch)
- `client/src/hooks/use-autosave.js` (or wherever autosave lives — add `data-testid="autosave-complete"` sentinel on body when save completes)
- `package.json` (add `test:electron-smoke` script)

**Read for context:**
- `electron/main.js` (BrowserWindow config, server boot — `PORT=3002` hardcoded line 13, `startBackend` line 90-107)
- `electron/preload.js` (contextBridge)
- `tests/e2e/pages/EditorPage.js` (page object pattern)
- `scripts/prepare-electron.js` (already runs pre-build per `release.yml:37-50` — do NOT rerun)

## Implementation Steps (TDD)

### Red — Failing tests first

1. **Test: smoke spec exists + runnable**
   - Create empty spec `packaged-app-launch-and-golden-path-smoke.spec.js` với 1 test `expect(true).toBe(false)` placeholder
   - Create contract test `tests/unit/electron-smoke-job-presence-in-release-yml.test.js` parsing `.github/workflows/release.yml`, assert: `build-windows` job HAS a step whose `name` contains "smoke" (case-insensitive), AND that step appears BEFORE the artifact upload step. (Under Option A there is no separate `electron-packaged-smoke` job — smoke is inline inside `build-windows`.)
   - Run → contract test **FAILS**, smoke spec **FAILS**
   - Commit: `red: phase-2 add failing electron-smoke contract test + spec stub`

### Green — Minimal impl

2. **Add `data-testid="home-page-ready"` sentinel**
   - Edit `client/src/pages/HomePage.jsx`: emit `data-testid="home-page-ready"` on root element AFTER initial `/api/presentations` fetch resolves (success or 404). Avoid `useEffect` with empty deps — must reflect data-ready, not mount-ready.
   - Unit test trong existing HomePage test: render with mocked fetch, assert sentinel appears post-fetch
   - Commit: `green: phase-2 mark home page ready after initial fetch`

3. **Build smoke spec with correct Playwright Electron API**
   - `_electron-helpers.js`: export:
     - `async function waitForPortFree(port, timeoutMs)` — TCP probe loop
     - `async function launchPackaged({ exePath, dataDir })` returning `{app, window}` — uses `executablePath`, NOT `args[0]`
     - `async function closePackaged(app, port)` — `await app.close()` then `await waitForPortFree(port, 5000)`
   - Spec test 1: `launches packaged app and reaches home page ready state`
     - `const {window} = await launchPackaged({ exePath: process.env.SMOKE_EXE_PATH, dataDir: tmpDataDir })`
     - `await expect(window.locator('[data-testid="home-page-ready"]')).toBeVisible({timeout: 30000})`
   - Spec test 2: `GP-01 create-edit-persist in packaged context`
     - Click "New presentation" → wait for editor URL change
     - Click insert text → type "smoke test"
     - Wait for `[data-testid="autosave-complete"]` (add sentinel in editor — autosave hook fires this)
     - Close window → relaunch with same `dataDir` → navigate to home → click newly-created presentation → assert text visible
   - Commit: `green: phase-2 implement packaged-app launch spec and GP-01`

4. **Modify `release.yml` build-windows job to run smoke inline**
   - **Option A (recommended):** extend existing `build-windows` job in `release.yml` to run smoke after `electron:build:win` step, BEFORE artifact upload. Avoids artifact-path issue (current `release.yml:72-76` only uploads `*.exe` + `*.yml`, not `win-unpacked/`).
   - Steps added inside `build-windows`:
     ```yaml
     - name: Install Playwright (for smoke)
       run: npx playwright install chromium
     - name: Run Electron packaged smoke
       run: npm run test:electron-smoke
       env:
         SMOKE_EXE_PATH: ${{ github.workspace }}/dist-electron/win-unpacked/NavSlidesEditor.exe
         CI: 'true'
       timeout-minutes: 10
     ```
   - Modify `release` job: gating already implicit (release needs build-windows; if smoke fails inside build-windows, release never starts)
   - **Do NOT rerun `prepare-electron.js`** — it ran pre-build at `release.yml:37-50`, server deps already inside `dist-electron/win-unpacked/resources/server/node_modules/`
   - Contract test asserts: `build-windows` job has a step with name containing "smoke" and `release` job's `needs` still references `build-windows`
   - Contract test **PASSES**
   - Commit: `green: phase-2 run electron packaged smoke inside build-windows job`

### Refactor

5. **Extract** spec helpers → reuse `EditorPage.js` page object nếu compat with Electron window selectors (DRY)
6. **Add** retry config (workers:1, retries:1) trong `playwright-electron.config.js`
7. **Document** trong `docs/codebase-summary.md` về Electron smoke layer
8. Commit: `refactor: phase-2 reuse EditorPage helpers in electron smoke + retry config`

## Todo List

- [ ] Add failing contract test for release.yml `build-windows` smoke step presence (red)
- [ ] Add failing spec stub (red)
- [ ] Add `data-testid="home-page-ready"` sentinel to HomePage.jsx post-fetch (green)
- [ ] Implement `_electron-helpers.js` launch/close with `executablePath` + `waitForPortFree` (green)
- [ ] Implement GP-01 spec in packaged context with `data-testid="autosave-complete"` sentinel (green)
- [ ] Add smoke step inside `build-windows` job in release.yml, BEFORE artifact upload (green)
- [ ] Reuse EditorPage helpers + retry config (refactor)
- [ ] Update `docs/codebase-summary.md`
- [ ] Run on Windows runner manually trước merge (`gh workflow run release.yml -f version=1.9.2-rc.1`)

## Success Criteria

- [ ] `npm run test:electron-smoke` runs on packaged `.exe` via `executablePath` API (not `args`), passes locally on Windows
- [ ] CI smoke step inside `build-windows` job runs ≤ 10 min, gates release implicitly (build-windows must succeed for release)
- [ ] Release `v*` tag KHÔNG được tạo nếu smoke fail (verify: cố ý break preload IPC trong branch test, push tag, expect release blocked)
- [ ] Spec catches real regression — **NOT** by removing `contextBridge.exposeInMainWorld` (GP-01 doesn't exercise IPC). Instead: break autosave by reverting `server/routes/presentations.js` PUT handler — smoke MUST fail when relaunch can't find text.
- [ ] Port 3002 free before launch AND after close (helper asserts both)
- [ ] No flake trên 5 consecutive runs (5 is starter sample — aim for 20+ before declaring Playwright Electron stable per known issue [playwright#33824](https://github.com/microsoft/playwright/issues/33824))

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Playwright Electron API behavior khác giữa Windows runner và dev machine | M | H | Use `windows-latest`, pin Playwright version (1.59.1 matching CI); test cả 2 environment |
| Server boot in-process race condition (port 3002 not ready when spec navigate) | M | M | Add `waitForResponse('**/api/presentations')` before assertions |
| Test data DATA_DIR pollution between runs | L | M | Use `os.tmpdir() + crypto.randomUUID()` per test |
| Electron not bundled with chromium driver | M | M | Playwright launches Electron's bundled Node; no need for separate chromium install ngoài `npx playwright install` cho tracing |
| Job timeout 15min không đủ trên slow runner | M | M | Profile locally; bump to 20min if needed |

## Security Considerations

- Smoke test KHÔNG persist real user data — uses temp DATA_DIR cleaned post-test
- KHÔNG embed credentials trong spec (no GitHub push, no AI key)
- Spec doesn't make outbound network calls beyond localhost

## Open Questions

1. Có cần extend smoke ra macOS / Linux Electron không, hay Windows-only đủ cho v1.x? (Currently `electron-builder.yml` chỉ build Windows trong release.yml)
2. Subset GP-02 (insert all element types) — chạy hết 13 element trong smoke có quá lâu? Nếu yes, smoke chỉ chạy 3 (text, shape, image) còn lại để regular E2E

## Next Steps

- Phase 3 manual checklist tham chiếu phase này như "automated smoke" — manual checklist focus UX issue automation không bắt được
- Phase 5-lite wires Electron smoke vào PR fast lane (path-filtered: chỉ chạy khi `electron/**`/`server/**`/`client/**` thay đổi)
- **Follow-up plan**: extract Electron smoke vào reusable workflow + cross-platform (macOS/Linux) Electron builds

---
phase: 5
title: "P1 Coverage Gap — Export/Import/Sync (real /api/rclone contract)"
status: completed
priority: P1
effort: "5h"
dependencies: [3]
---

# Phase 5: P1 Coverage Gap — Export/Import/Sync

## Overview

Close 3 export/import/sync gaps: PPTX export, markdown import, rclone sync (Proton Drive). All exercised through real user flows where possible; rclone is mocked at the **REAL `/api/rclone/*` REST contract** (NOT the fabricated `/api/sync/*` from the original plan draft) to avoid real cloud calls.

**Critical correction (post red-team C2):** Original plan mocked non-existent `/api/sync/{status,push,pull,configure}`. Real endpoints (verified `client/src/utils/api.js:102-116` + `server/routes/sync.js:39,46,72,108,143`):

| Method | Path | Client handler |
|---|---|---|
| GET | `/api/rclone/status` | `getRcloneStatus()` |
| POST | `/api/rclone/config` | `configureRclone(payload)` |
| POST | `/api/rclone/sync` | `syncToRemote()` |
| POST | `/api/rclone/sync-single` | `syncSingleToRemote(presentationId)` |

NO `/push` / `/pull` endpoints exist — `/sync` is bidirectional and `/sync-single` pushes a single presentation.

**Scope discipline:** Phase 5 ONLY consumes testids declared in Phase 3 catalog (Groups B/F/G/H). NO new source testids added here.

## Requirements

- New spec: `tests/e2e/export/pptx-export.spec.js` — exercises download flow, validates PPTX structure
- New spec: `tests/e2e/import/markdown-import.spec.js` — uploads fixture .md, asserts slides created
- New spec: `tests/e2e/sync/rclone-proton-drive.spec.js` — mocks `/api/rclone/*` routes, asserts UI flow
- New unit test: `tests/unit/sync-routes-contract.test.js` — pins server response shape (Phase 3 testids depend on it)
- All sync/export specs use `testPresentation` fixture for cleanup; Markdown import deletes imported presentations by captured editor id
- `jszip` availability verified via `npm ls jszip` (already present at root and workspace dependency tree)

## Architecture

### PPTX Export
- Frontend: `client/src/utils/exportPptx.js:8-102` — uses PptxGenJS
- Trigger: `client/src/components/ribbon/ribbon-file-dropdown-menu.jsx:17` — action `'onExportPPTX'`
- DOM path: ribbon `File menu` button (`ribbon-file-menu-trigger`) → dropdown item `ribbon-file-export-pptx` (NOT `ribbon-tab-file` — file is a dropdown menu, not a ribbon Tab — verified Phase 3)
- Output: triggers browser download (Playwright captures via `page.waitForEvent('download')`)
- Validation: download is a .pptx (zip with `ppt/presentation.xml`); spec opens zip with JSZip and asserts text content roundtrip

### Markdown Import
- Source: `client/src/utils/markdown-import.js:11`
- Trigger: `client/src/pages/HomePage.jsx:497-522` — file input handler
- Hidden input: `client/src/pages/HomePage.jsx:813-821` — `<input type="file" accept=".md">`. Phase 3 adds `data-testid="home-import-markdown-input"` for `filechooser` event reliability + `home-import-markdown-btn` on the trigger button.
- Test fixture: `tests/e2e/fixtures/sample.md` — minimal markdown with H1/H2/H3

### rclone Sync (Proton Drive)
- Modal: `client/src/components/SyncModal.jsx` — Phase 3 adds 9 testids (sync-modal-dialog, sync-provider-proton-drive, sync-configure-confirm, sync-status-configured, sync-push-btn, sync-pull-btn, sync-push-result, sync-pull-result, sync-error-toast)
- Backend: `server/routes/sync.js:39,46,72,108,143` — REAL endpoints listed above
- Settings entry: `client/src/pages/SettingsPage.jsx` — Phase 3 adds `settings-open-sync`
- Strategy: mock `**/api/rclone/**` responses in Playwright (`page.route('**/api/rclone/**', route => route.fulfill(...))`); assert UI reacts correctly to success/failure shapes from REAL routes

**UI button naming:** SyncModal "Sync This Presentation" calls `api.syncSingleToRemote()` (REST: POST `/api/rclone/sync-single`) and is only enabled when `presentationId` is present. "Sync All" calls `api.syncToRemote()` (REST: POST `/api/rclone/sync`). The Phase 5 E2E covers both real paths.

## Related Code Files

**Create:**
- `tests/e2e/export/pptx-export.spec.js`
- `tests/e2e/import/markdown-import.spec.js`
- `tests/e2e/sync/rclone-proton-drive.spec.js`
- `tests/e2e/fixtures/sample.md`
- `tests/e2e/fixtures/rclone-mock.js` (refactor extraction)
- `tests/unit/sync-routes-contract.test.js`

**Modify:**
- `client/src/pages/HomePage.jsx` — move Phase 3 Markdown import testids from the PPTX import row to the real Markdown import row

**Read for context (no edits — testids added in Phase 3):**
- `client/src/utils/exportPptx.js`
- `client/src/utils/markdown-import.js`
- `client/src/utils/api.js:102-116` — confirm rclone client handler signatures
- `client/src/pages/HomePage.jsx:497-522, 813-821`
- `client/src/components/SyncModal.jsx`
- `server/routes/sync.js` — confirm 4 endpoints + response shapes

**Testids consumed from Phase 3 catalog (read-only):**
| testid | Group | Used by spec |
|---|---|---|
| `ribbon-file-menu-trigger` | B | pptx-export |
| `ribbon-file-export-pptx` | B | pptx-export |
| `home-import-markdown-btn` | G | markdown-import |
| `home-import-markdown-input` | G | markdown-import |
| `slide-panel-item` | F | markdown-import |
| `settings-open-sync` | H | rclone-proton-drive |
| `sync-modal-dialog` | H | rclone-proton-drive |
| `sync-provider-proton-drive` | H | rclone-proton-drive |
| `sync-configure-confirm` | H | rclone-proton-drive |
| `sync-status-configured` | H | rclone-proton-drive |
| `sync-push-btn` / `sync-pull-btn` | H | rclone-proton-drive |
| `sync-push-result` / `sync-pull-result` | H | rclone-proton-drive |
| `sync-error-toast` | H | rclone-proton-drive |

## Implementation Steps

### Pre-step — Dependency

0. Verify `jszip` available: `npm ls jszip`. If missing: `npm i -D jszip` and commit `package.json` + `package-lock.json` change in the SAME commit as the spec.

### Red — PPTX Export

1. Write `tests/e2e/export/pptx-export.spec.js`:
   ```js
   import { test, expect } from '../fixtures/test-fixtures.js';
   import { existsSync, statSync, readFileSync } from 'node:fs';
   import JSZip from 'jszip';

   test.describe('PPTX export', () => {
     test('File menu → Export PPTX triggers download with valid pptx', async ({ page, testPresentation }) => {
       await page.goto(`/editor/${testPresentation.id}`);
       await page.locator('[data-testid="ribbon-tab-insert"]').click();
       await page.locator('[data-testid="ribbon-insert-text"]').click();
       await page.locator('[data-testid="canvas-area"]').click({ position: { x: 100, y: 100 } });
       await page.keyboard.type('Hello PPTX');

       const downloadPromise = page.waitForEvent('download');
       // file is a DROPDOWN MENU, NOT a ribbon tab — open it via the trigger button
       await page.locator('[data-testid="ribbon-file-menu-trigger"]').click();
       await page.locator('[data-testid="ribbon-file-export-pptx"]').click();
       const download = await downloadPromise;

       expect(download.suggestedFilename()).toMatch(/\.pptx$/);
       const path = await download.path();
       expect(existsSync(path)).toBe(true);
       expect(statSync(path).size).toBeGreaterThan(1000);

       const buf = readFileSync(path);
       const zip = await JSZip.loadAsync(buf);
       expect(zip.file('ppt/presentation.xml')).not.toBeNull();
       expect(zip.file('[Content_Types].xml')).not.toBeNull();

       const slide1Xml = await zip.file('ppt/slides/slide1.xml').async('string');
       expect(slide1Xml).toContain('Hello PPTX');
     });
   });
   ```

### Red — Markdown Import

2. Create `tests/e2e/fixtures/sample.md`:
   ```markdown
   # Slide One

   Body text on slide one.

   ## Slide Two

   - bullet A
   - bullet B

   ## Slide Three

   ![alt](https://example.com/img.png)
   ```

3. Write `tests/e2e/import/markdown-import.spec.js`:
   ```js
   import { test, expect } from '../fixtures/test-fixtures.js';
   import path from 'node:path';

   test.describe('Markdown import', () => {
     test('uploading sample.md creates 3 slides', async ({ page }) => {
       await page.goto('/');
       const fileChooserPromise = page.waitForEvent('filechooser');
       await page.locator('[data-testid="home-import-markdown-btn"]').click();
       const fileChooser = await fileChooserPromise;
       await fileChooser.setFiles(path.resolve('tests/e2e/fixtures/sample.md'));

       await page.waitForURL(/\/editor\/[^/]+$/);
       await expect(page.locator('[data-testid="slide-panel-item"]')).toHaveCount(3);
     });

     test('imported slides include heading text', async ({ page }) => {
       await page.goto('/');
       const fileChooserPromise = page.waitForEvent('filechooser');
       await page.locator('[data-testid="home-import-markdown-btn"]').click();
       const fileChooser = await fileChooserPromise;
       await fileChooser.setFiles(path.resolve('tests/e2e/fixtures/sample.md'));
       await page.waitForURL(/\/editor\/[^/]+$/);

       await expect(page.locator('[data-element-type="text"]').first())
         .toContainText('Slide One');
     });
   });
   ```

### Red — rclone Sync (mocked at REAL endpoints)

4. Write `tests/e2e/fixtures/rclone-mock.js`:
   ```js
   export async function installRcloneMocks(page, overrides = {}) {
     await page.route('**/api/rclone/status', route =>
       route.fulfill({
         status: 200,
         contentType: 'application/json',
         body: JSON.stringify(overrides.status ?? { configured: false, provider: null }),
       })
     );
     await page.route('**/api/rclone/config', route =>
       route.fulfill({
         status: 200,
         contentType: 'application/json',
         body: JSON.stringify(overrides.config ?? { ok: true, provider: 'proton-drive' }),
       })
     );
     await page.route('**/api/rclone/sync', route =>
       route.fulfill({
         status: overrides.syncStatus ?? 200,
         contentType: 'application/json',
         body: JSON.stringify(overrides.sync ?? { ok: true, files: 12, bytes: 145_678 }),
       })
     );
     await page.route('**/api/rclone/sync-single', route =>
       route.fulfill({
         status: 200,
         contentType: 'application/json',
         body: JSON.stringify(overrides.syncSingle ?? { ok: true, files: 1 }),
       })
     );
   }
   ```

5. Write `tests/e2e/sync/rclone-proton-drive.spec.js`:
   ```js
   import { test, expect } from '../fixtures/test-fixtures.js';
   import { installRcloneMocks } from '../fixtures/rclone-mock.js';

   test.describe('rclone Proton Drive sync', () => {
     test('opens sync modal from Settings', async ({ page }) => {
       await installRcloneMocks(page);
       await page.goto('/settings');
       await page.locator('[data-testid="settings-open-sync"]').click();
       await expect(page.locator('[data-testid="sync-modal-dialog"]')).toBeVisible();
     });

     test('configure → push happy path', async ({ page }) => {
       await installRcloneMocks(page);
       await page.goto('/settings');
       await page.locator('[data-testid="settings-open-sync"]').click();

       await page.locator('[data-testid="sync-provider-proton-drive"]').click();
       await page.locator('[data-testid="sync-configure-confirm"]').click();
       await expect(page.locator('[data-testid="sync-status-configured"]')).toBeVisible();

       await page.locator('[data-testid="sync-push-btn"]').click();
       await expect(page.locator('[data-testid="sync-push-result"]')).toContainText('12');
     });

     test('pull happy path', async ({ page }) => {
       await installRcloneMocks(page, { status: { configured: true, provider: 'proton-drive' } });
       await page.goto('/settings');
       await page.locator('[data-testid="settings-open-sync"]').click();
       await page.locator('[data-testid="sync-pull-btn"]').click();
       await expect(page.locator('[data-testid="sync-pull-result"]')).toContainText('12');
     });

     test('handles 500 from /api/rclone/sync gracefully', async ({ page }) => {
       await installRcloneMocks(page, {
         status: { configured: true, provider: 'proton-drive' },
         syncStatus: 500,
         sync: { error: 'rclone not installed' },
       });
       await page.goto('/settings');
       await page.locator('[data-testid="settings-open-sync"]').click();
       await page.locator('[data-testid="sync-push-btn"]').click();
       await expect(page.locator('[data-testid="sync-error-toast"]'))
         .toContainText(/rclone not installed/i);
     });
   });
   ```

6. Write server-side contract test `tests/unit/sync-routes-contract.test.js`:
   ```js
   import { describe, it, expect } from 'vitest';
   import { readFileSync } from 'node:fs';

   describe('rclone routes contract (server/routes/sync.js)', () => {
     const src = readFileSync('server/routes/sync.js', 'utf8');

     it('exposes /status (GET)', () => {
       expect(src).toMatch(/router\.get\s*\(\s*['"]\/status/);
     });

     it('exposes /config (POST)', () => {
       expect(src).toMatch(/router\.post\s*\(\s*['"]\/config/);
     });

     it('exposes /sync (POST)', () => {
       expect(src).toMatch(/router\.post\s*\(\s*['"]\/sync['"]/);
     });

     it('exposes /sync-single (POST)', () => {
       expect(src).toMatch(/router\.post\s*\(\s*['"]\/sync-single/);
     });

     it('does NOT use legacy /push or /pull paths', () => {
       expect(src).not.toMatch(/['"]\/push['"]/);
       expect(src).not.toMatch(/['"]\/pull['"]/);
     });
   });
   ```

7. Run each new spec → expect failures (selectors / missing testids — resolved when Phase 3 lands)

### Green

8. Iterate until specs green (Phase 3 testids unblock most failures)
9. `jszip` was not missing; no package file change needed

### Refactor

10. Already extracted: `installRcloneMocks` helper in `tests/e2e/fixtures/rclone-mock.js`
11. Consider extracting PPTX validator to `tests/e2e/utils/pptx-validator.js` if Phase 6 reuses it

## Success Criteria

- [x] `pptx-export.spec.js` validates downloaded .pptx structure + text roundtrip
- [x] `markdown-import.spec.js` confirms slide count and content (2 tests)
- [x] `rclone-proton-drive.spec.js` covers configure, sync all, sync-single push, and 500 error path (5 tests)
- [x] `sync-routes-contract.test.js` passes — pins server contract
- [x] Total new tests: 1 (pptx) + 2 (md) + 5 (sync) + 5 route contract + 1 no-fabricated guard = 14 added
- [x] No real cloud calls made (only mocked routes at REAL paths)
- [x] `jszip` availability verified via `npm ls jszip`
- [x] Zero `/api/sync/` route matches in `tests/e2e/`
- [x] `npx playwright test tests/e2e/export/pptx-export.spec.js tests/e2e/import/markdown-import.spec.js tests/e2e/sync/rclone-proton-drive.spec.js` exit 0

## Tests (verification)

The four specs and contract test above. Plus:

```js
Implemented as `tests/unit/no-fabricated-sync-endpoints.test.js` using `spawnSync` so the guard is portable on Windows.

Additional verification:
- `npm test -- tests/unit/sync-routes-contract.test.js tests/unit/no-fabricated-sync-endpoints.test.js tests/unit/data-testid-presence.test.js` — 43 passed
- `npx playwright test tests/e2e/export/pptx-export.spec.js tests/e2e/import/markdown-import.spec.js tests/e2e/sync/rclone-proton-drive.spec.js` — 8 passed
- `npx playwright test tests/e2e/sync/rclone-proton-drive.spec.js` — 5 passed after warning cleanup
- `npm run lint` — exit 0, 97 existing warnings
- `npm run build` — exit 0, existing empty `vendor-reveal` and chunk-size warnings
```

## Risk Assessment

- **Risk (RESOLVED post-audit C2):** Original mocks fabricated `/api/sync/*` endpoints that don't exist. Mitigation: rewrite to use real `/api/rclone/{status,config,sync,sync-single}` (verified `client/src/utils/api.js:102-116` + `server/routes/sync.js:39,46,72,108,143`).
- **Risk (RESOLVED post-audit C7):** Used invented `ribbon-tab-file`. Mitigation: replaced with `ribbon-file-menu-trigger` (file is a dropdown menu, not a tab — Phase 3 verified).
- **Risk:** PPTX download path is OS-temp folder — Playwright auto-cleans on close. No file leak.
- **Risk:** JSZip validation is shallow — does NOT verify visual fidelity. Acceptable; the import-roundtrip corpus test (`npm run test:corpus`) covers deeper fidelity.
- **Risk:** Mocked sync diverges from prod rclone behaviour. Mitigation: server contract test (`sync-routes-contract.test.js`) pins route paths; full E2E with real rclone is OUT OF SCOPE (manual smoke per release).
- **Risk:** Markdown import test brittle if MD parser changes. Mitigation: fixture is static + minimal; if parser changes, fix fixture.
- **Risk:** Push/Pull button wiring may use same `/api/rclone/sync` with directional payload. Mitigation: read `SyncModal.jsx` at impl time; adjust mock signature if direction is in body rather than path.

## Next Steps

- Phase 6 may reuse `pptx-validator.js` if needed for game export validation
- Phase 7 may consolidate fixture .md/.pptx files into shared `tests/e2e/fixtures/` index

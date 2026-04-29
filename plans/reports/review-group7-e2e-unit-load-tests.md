# Code Review: Group 7 - E2E Tests + Unit Tests

## Scope
- E2E Playwright specs: 22 files (tests/e2e/)
- Page Objects: 4 files (tests/e2e/pages/)
- Fixtures: 1 file (tests/e2e/fixtures/)
- Load tests: 2 files (tests/load/)
- Unit tests: ~40 files across client/src, server/, shared/

## Overall Assessment
Test suite is extensive with good POM coverage and API-level unit tests. Significant issues in: tautological assertions, missing cleanup, flaky selectors, load test misconfig, and coverage gaps on critical flows.

---

## Critical Issues

### E2E Tests

1. **MEDIUM-HIGH** - Tautological assertion — explore.spec.js:25
   `expect(hasEmpty || cardCount >= 0).toBeTruthy()` — `cardCount >= 0` is always true (non-negative integer). Test always passes regardless of UI state.

2. **MEDIUM-HIGH** - Wrong assertion logic — find-replace.spec.js:99
   `expect(countSensitive).toBeLessThanOrEqual(countLower)` after setting case-sensitive OFF. This passes trivially (0 <= any positive). The actual case-sensitivity toggle result is never verified — it only confirms 0 <= something.

3. **MEDIUM-HIGH** - Non-existent URL in share test — sharing.spec.js:60
   `getBaseUrl()` may return `http://127.0.0.1:4173` but the share token URL resolves to `/share/${token}`. If the server runs on port 3002, the URL becomes `http://127.0.0.1:4173/share/${token}` which 404s. The share route lives on Express (3002), not Vite preview (4173).

4. **MEDIUM** - Input value checked against URL regex — live.spec.js:106
   `expect(readonlyInputs.nth(0)).toHaveValue(/\/live\//)` — `inputValue()` returns the displayed text, not a URL. Room code input likely shows just the code (e.g., "ROOM12"), not the full path. This assertion likely fails in practice.

5. **MEDIUM** - Dialog handler leak — HomePage.js:72
   `deletePresentation()` adds `page.on('dialog', ...)` without removing it. Every subsequent test in the same worker inherits this handler. Causes dialog popups in unrelated tests.

6. **MEDIUM** - Unbounded `await` in openPresenter — live.spec.js:37
   `openPresenter()` awaits page creation but never awaits `page.goto()`. If the page fails to load, the test proceeds with a broken page object silently.

7. **MEDIUM** - HTTP route handlers leak across test phases — editor.spec.js:78-128
   Multiple `page.route()` handlers defined in `beforeEach`-equivalent scope without cleanup. If a test fails mid-way, subsequent tests in the same worker inherit stale route handlers.

### Load Tests

8. **HIGH** - Wrong base URL — api-load.js:13
   `BASE_URL = 'http://localhost:3000/api'` — Express server runs on port 3002. All requests hit the wrong server. Should read from `process.env.API_BASE_URL` or match the actual port.

9. **HIGH** - Wrong WebSocket port — websocket-load.js:11
   `ws://localhost:3000/socket.io/...` — should be port 3002.

10. **MEDIUM** - Non-deterministic Socket.IO protocol — websocket-load.js
    Hardcoded `socket.send('40')` and `socket.send('42["join-presentation", ...]')` strings. Socket.IO protocol versions differ in message format. No version negotiation. Test may pass spuriously on some versions.

---

## High Priority

### E2E Tests

11. **MEDIUM** - Fragmentary undo/redo test — undo-redo.spec.js:56-63
    `undo/redo keyboard shortcuts work` only checks `page.locator('.slide-canvas').toBeVisible()` — does not verify actual state change. A broken undo/redo would still pass.

12. **MEDIUM** - Fragile Tailwind-class selectors — dashboard.spec.js:25
    `button.text-primary` — `.text-primary` is a Tailwind utility class. If theme or design changes, this breaks silently. Use semantic attributes instead.

13. **MEDIUM** - Race condition on `insertItem` — coverage-gaps.spec.js:48-52
    `await getInsertItem(page, label).click()` then `toHaveCount(prevCount + 1)` with 10s timeout. If the click triggers a slow network request (SVG upload, audio), the count check races against rendering.

14. **MEDIUM** - No error assertion in `can use AI Copywriter` — ai.spec.js:43-46
    After `Generate` click, the test waits for content but never asserts that the AI feature **failed gracefully** if the mock is not hit. If the real API is called (route not matching), the test silently passes on a different outcome.

15. **MEDIUM** - `openPresenter` swallows goto errors — live.spec.js:37
    `await page.goto(...)` is awaited but the result is not checked. If the URL is invalid, the test proceeds with a broken state.

### Unit Tests

16. **MEDIUM** - Shared `let presId` across tests — live.spec.js:66, sharing.spec.js:11
    `let presId` defined at `test.describe` scope, mutated in `beforeEach`. If `beforeEach` fails, `presId` is undefined and `afterEach` deletes nothing, leaking test data across workers.

17. **MEDIUM** - API surface test mutates global storage — api-surface.test.js
    `storage.writeSettings()`, `storage.writeGithubConfig()`, `storage.writePresentations()` are called without `afterEach` cleanup. Tests can pollute each other if run in different orders.

18. **MEDIUM** - PPTX harness test hits real file — harness-integration.test.js:8
    `path.resolve(process.cwd(), 'PPTX', 'Bai_2_1.pptx')` — if the file is missing, the test silently passes with an empty corpus. No guard for file existence.

19. **MEDIUM** - No 404/error response validation in API helpers — test-fixtures.js
    `apiGetPresentation` returns `res.json()` without checking `res.ok()`. If the API returns 404, the test gets a parse error rather than a clear failure.

---

## Medium Priority

### E2E Tests

20. **LOW** - `smoke.spec.js` has no actual assertion — just visibility check. Should verify some content renders.

21. **LOW** - `settings.spec.js:64` existence-only test for "Test Connection". Should actually test the connection flow with a mocked response.

22. **LOW** - `addSlideFromTemplate` in slide-management.spec.js:55 has `eslint-disable` for unused var. The test is skipped but not removed.

23. **LOW** - `addTable` in elements.spec.js:37 has `eslint-disable` for unused var. Comment says "Table doesn't use prompt anymore, uses grid picker" but the ESLint disable stays.

24. **LOW** - `ExplorePage.js:9` — `this.backBtn = page.locator('button').first()` is too generic. Could click the wrong button. Use a semantic selector.

25. **LOW** - `EditorPage.js:102` — `closeOverlayModal` clicks `.fixed.inset-0.last()` which could be any overlay, not necessarily the active modal. Potential cross-test interference.

26. **LOW** - `coverage-gaps.spec.js:266` — guide removal by double-click is an implementation detail test. If the removal mechanism changes (e.g., right-click menu), this test breaks.

27. **LOW** - `coverage-gaps.spec.js:310-311` — Screenshot size `toBeGreaterThan(10_000)` is fragile. Size varies by font rendering, OS, and device pixel ratio.

### Unit Tests

28. **LOW** - `live-rooms.test.js` relies on `_resetRooms()` internal method. If the method is removed/renamed, tests break silently. Prefer a public reset or fresh module instance.

29. **LOW** - `editor-store.test.js` — `toMatchObject` partial match on final state means intermediate mutations aren't validated. For example, `toggleSmartGuides()` may not properly toggle if the final state coincidentally matches.

30. **LOW** - `test-fixtures.js` — `apiDeletePresentation` swallows ALL errors silently with empty catch. A 500 error during cleanup masks a real problem. Should at least log.

---

## Coverage Gaps (Critical Flows Missing Tests)

### Critical (must-add)

1. **Trash & restore E2E flow** — `dashboard.spec.js` tests trash/restore via API but not via UI. The "Delete to Trash" button on cards and "Restore" from Trash are not tested in-browser.

2. **Permanent delete** — No E2E test for permanently deleting from trash (only via API in `api-surface.test.js`).

3. **Presentation duplication via UI** — `HomePage.js` has `duplicatePresentation()` POM method but no spec test uses it.

4. **Restore from Trash via UI** — `HomePage.js` has `restoreFromTrash()` but no spec test.

5. **Template marketplace** — `templates.spec.js` opens the Marketplace section but doesn't verify template cards load, filter, or fork.

6. **GitHub push E2E** — `coverage-gaps.spec.js` opens the dialog but never triggers an actual push with mocked credentials.

7. **Cloud sync E2E** — `coverage-gaps.spec.js` opens the modal but doesn't test the actual sync flow with mocked rclone.

8. **PPTX import E2E** — No browser-level test for uploading a PPTX file through the import UI.

9. **PPT export (download)** — `export.spec.js` tests the API endpoint but not the browser download flow (clicking export button, checking file downloads).

10. **Print / PDF export** — No E2E test for the print/export-as-PDF flow.

11. **View count / analytics** — `api-surface.test.js` tests analytics recording but no E2E test simulates a viewer visiting a share link and verifies the view count increments.

12. **Share link revocation** — Tests create share links but don't test revoking/deleting a share token.

13. **AI slide generator E2E** — `ai.spec.js` opens the modal but doesn't test the full generate-and-insert flow with a mock.

14. **AI translate presentation E2E** — Same as above — modal open/close only.

15. **Undo/redo via toolbar buttons** — Only keyboard shortcuts tested, not the toolbar undo/redo buttons.

16. **Animation timeline UI** — `animation-preview.spec.js` only tests the preview dialog. No tests for the animation timeline panel (adding animations, setting timing, etc.).

17. **Element alignment via toolbar** — `coverage-gaps.spec.js` tests align/distribute programmatically but not through the actual toolbar button UI.

18. **Responsive/mobile editor layout** — `coverage-gaps.spec.js` sets viewport to 390x844 but only checks `.slide-canvas` is visible. No tests for element editing, insertion, or property changes on mobile.

19. **Error state: network failure during save** — No E2E test for what happens when auto-save fails (network offline mid-edit).

20. **Clipboard copy/paste across slides** — `keyboard-shortcuts.spec.js` copies within a slide but doesn't test cross-slide paste behavior.

---

## Positive Observations

- POM model is well-structured for `EditorPage`, `HomePage`, `ExplorePage`, `SettingsPage`
- API-level unit tests (`api-surface.test.js`, `presentations.test.js`, `live-rooms.test.js`) cover server logic thoroughly
- Socket.IO integration tests (`socket-handler.test.js`) use a solid FakeIO/FakeSocket pattern
- `editor.spec.js` HTTP interception tests are comprehensive for error recovery flows
- `offlineExport.test.js` uses proper `vi.stubGlobal` for environment isolation
- `use-keyboard.test.js` tests both positive and negative cases (editing guard)
- `live.spec.js` tests vertical slides and speaker view — complex real-world scenarios
- Test data cleanup (`apiDeletePresentation`) runs in `afterEach` consistently
- `waitForAutoSave()` helper prevents flaky timing issues

---

## Metrics

| Category | Count |
|----------|-------|
| E2E spec files | 22 |
| Page Object files | 4 |
| Load test files | 2 |
| Unit test files | ~40 |
| **Critical issues** | 10 |
| **High priority** | 9 |
| **Medium priority** | 20 |
| **Coverage gaps (critical flows)** | 20 |

---

## Must-Fix Before Merge

1. Fix `api-load.js` and `websocket-load.js` base URL/port to match actual server (3002)
2. Fix tautological assertion in `explore.spec.js:25`
3. Fix `share.spec.js` share URL resolution (use correct origin)
4. Fix `live.spec.js` input value assertion — verify the actual value format
5. Remove dialog handler leak in `HomePage.deletePresentation()` or document the pattern
6. Add `res.ok()` check to `apiGetPresentation` fixture helper
7. Add `afterEach` cleanup to `api-surface.test.js` storage mutations

---

## Unresolved Questions

1. Does `getBaseUrl()` in fixtures resolve correctly for both Vite dev (5173) and production server (3002)? The sharing test may be running against the wrong origin.
2. Is the PPTX harness integration test expected to run in CI without the `PPTX/Bai_2_1.pptx` file present? It has no guard.
3. What is the expected format of the live room code input value — full URL path or just the 6-char code?

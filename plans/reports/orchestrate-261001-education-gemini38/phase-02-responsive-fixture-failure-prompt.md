# Kongming mandatory failed verification checkpoint — responsive fixture API404

Cook full16-phase plan --auto --advice --tdd. Explicit same-model independent-context local52186/gpt-6.1-sol, user temporarily excludes Gemini. READ ONLY read/glob/grep only; no edits, commands, tests, browser, eval, delegation or model switch. Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Parent stops source edits and further diagnosis until counsel. No Phase02 approval requested.

Change just made: added3 semantic Playwright cases to tests/e2e/education/narrow-controls.spec.js lines49-116. No product code changed. They use existing testPresentation fixture + API helpers, seed4 shapes, select3 by real Selection Pane keyboard, reach Shape Format, touch left/Enter center/Space right, assert exact whole persisted elements and one undo/redo selection retention, numericX0 delta, mixed-opacity keyboard apply, reload unchanged sentinel at320/768/1365. Source is available; tests were current-behavior characterization before any additional mixed/source product fix.

Exact command:
PLAYWRIGHT_SERVER_PORT=34102 PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:55173 PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:55173 node node_modules/@playwright/test/cli.js test tests/e2e/education/narrow-controls.spec.js --grep "Format alignment" --config=.playwright/phase02-manual.config.cjs --project=chromium --workers=1 --retries=0 --reporter=line --global-timeout=180000

Verbatim failure output (repeated attachments retained under test-results):
Running 3 tests using 1 worker
(node:9816) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[1/3] [chromium] › tests\e2e\education\narrow-controls.spec.js:50:7 › Format alignment and mixed writes retain selection history at 320px
API Error: 404
1) [chromium] › tests\e2e\education\narrow-controls.spec.js:50:7 › Format alignment and mixed writes retain selection history at 320px
Error: expect(received).toBeTruthy()
Received: false
at fixtures\test-fixtures.js:53
51 | console.error('API Error:', res.status(), await res.text())
52 | }
>53 | expect(res.ok()).toBeTruthy()
54 | return res.json()
55 | }
at apiCreatePresentation (C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\tests\e2e\fixtures\test-fixtures.js:53:20)
at Object.testPresentation (C:\Work\worktrees\NavSlidesEditor-education-gemini38-cook-261001\tests\e2e\fixtures\test-fixtures.js:149:18)
(node:4636) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[2/3] [chromium] › tests\e2e\education\narrow-controls.spec.js:50:7 › Format alignment and mixed writes retain selection history at 768px
API Error: 404
Same expect(false).toBeTruthy failure at apiCreatePresentation:53 -> testPresentation:149, before test body.
(node:16892) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[3/3] [chromium] › tests\e2e\education\narrow-controls.spec.js:50:7 › Format alignment and mixed writes retain selection history at 1365px
API Error: 404
Same expect(false).toBeTruthy failure at apiCreatePresentation:53 -> testPresentation:149, before test body.
3 failed
[chromium] › tests\e2e\education\narrow-controls.spec.js:50:7 › Format alignment and mixed writes retain selection history at 320px
[chromium] › tests\e2e\education\narrow-controls.spec.js:50:7 › Format alignment and mixed writes retain selection history at 768px
[chromium] › tests\e2e\education\narrow-controls.spec.js:50:7 › Format alignment and mixed writes retain selection history at 1365px
Wall time:5.90 seconds; exit1.

Known unchanged prior environment: app editor at55173 and isolated API34102; fresh normal UI downloaded all19 proof passed. Earlier7 layout/media/code Chromium cases passed on those services; no assertion weakening or API/create source patch proposed. Launcher cwd had been corrected to client for Tailwind content discovery. No further diagnosis after404. The API helper may have a different base-URL contract than the above command; inspect actual fixtures/config before any action, don't assume the environmental variable interpretation.

Request: exact cause-supported GO/no-go and smallest bounded harness correction/inspection. Distinguish before-body admission404 from product/control failures, preserve isolated fixture authority and real API save/reload assertions. No retries/fallbacks/error suppression. New final safety review otherwise credits repaired core operations and requests mixed lock/source, responsive Format, protected-group/connector browser receipts and labeling one earlier child snapshot; do not waive those.

# Phase 03 - Critical User Journey E2E Coverage

## Context Links

- [Plan](./plan.md)
- [E2E cleanup plan](../260524-0959-e2e-cleanup-and-coverage-tdd/plan.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)

## Overview

Priority: P1. Status: Complete. Add release-grade Playwright coverage for user journeys that prove controls, elements, logic, and flow work together.

## Key Insights

- Capability tests prove pieces. User journeys prove integration.
- Use existing POM helpers and `testPresentation` fixture.
- Avoid one huge test; split by journey and keep files small.

## Requirements

- Cover five critical journeys.
- Each journey asserts persisted data or visible final state.
- Use stable selectors and POM methods.
- No screenshots unless layout/visual is the assertion.
- MVP journey set is bounded: create/edit/persist and share password/revoke are release-blocking; export, live, PPTX, and AI are included only with explicit runtime budget and stable fixture support.
- Artifact journeys must inspect the exported/imported artifact, not just success toasts.

<!-- Updated: Validation Session 1 - only create/edit/persist and share password/revoke are release-blocking journeys. -->

## Architecture

Journeys:

```text
release-blocking MVP: create/edit/persist
release-blocking MVP: share password revoke
bounded: insert/format/arrange/export-smoke
bounded: live presentation reconnect
bounded: pptx import roundtrip with edit smoke
```

AI failure journey may be API-contract/unit if external key dependence makes E2E brittle. It must be reported as contract coverage, not full external integration coverage.

Artifact validation contract:

- exported HTML opens and contains expected slide text/assets
- offline HTML has no unexpected external runtime dependency
- PPTX export parses and contains expected slide/element count where tooling supports it
- PPTX import roundtrip preserves at least one editable element after save/reload

Live reconnect contract:

- use separate presenter and viewer browser contexts
- force viewer socket disconnect/reconnect
- advance slide during outage
- assert viewer catches current slide once with no duplicate event effects
- clean up room/token data

## Related Code Files

- Modify: `tests/e2e/pages/editor-page.js`
- Modify: `tests/e2e/pages/ribbon-insert-helper.js`
- Modify: `tests/e2e/pages/canvas-helper.js`
- Modify: `tests/e2e/*critical*.spec.js` or focused existing specs
- Modify: `tests/e2e/fixtures/test-fixtures.js` only if fixture gap exists
- Modify: `docs/critical-user-journeys.md` if present or create if absent

## Implementation Steps

1. Red: write journey spec with final-state assertions.
2. Green: add missing POM helper methods, not brittle inline selectors.
3. Refactor: split helper methods by page object responsibility.
4. Tag journey tests with relevant `[cap:*]` where they verify capability behavior.
5. For export/import journeys, parse/open the downloaded artifact before counting the journey as verified.
6. For live/share journeys, include direct bypass checks where cheap: revoked token denied outside the UI path, viewer cannot perform presenter-only socket actions.
7. Run targeted Playwright specs.
8. Update journey doc mapping journey -> spec -> risk covered and mark contract-only coverage separately.

## Todo List

- [x] Create/edit/persist MVP journey.
- [x] Share password/revoke MVP journey.
- [x] Insert/format/arrange/export-smoke bounded journey.
- [x] Live reconnect bounded journey.
- [x] PPTX import/edit/export bounded smoke journey.
- [x] AI failure handling coverage by best layer.

## Implementation Evidence

- Added `tests/e2e/critical-user-journeys.spec.js` for the two release-blocking MVP journeys.
- Added `docs/critical-user-journeys.md` mapping journey to spec and verification layer.
- Create/edit/persist journey uses the dashboard modal, editor Insert text flow, persisted JSON assertion, and editor reload visible-state assertion.
- Share password/revoke journey uses real protected share link creation, missing/wrong password 401 checks, pre-auth no-marker assertion, visible reveal slide assertion, token revoke, and revoked 404 assertion.
- Insert/format/arrange/export journey inserts text and shape through the editor UI, formats shape fill/size, aligns shape through Shape Format controls, verifies persisted JSON, downloads Export HTML, and inspects the HTML artifact for marker/section/shape fill.
- Live reconnect journey uses separate presenter/viewer/auditor browser contexts with real Socket.IO live room joins, disconnects the viewer, advances the presenter while the viewer is offline, verifies server-applied state before reconnect, verifies reconnect catches slide 2 once without duplicate navigate effects, verifies viewer `navigate` cannot mutate room state, and cleans room/token state through a presenter-token-protected endpoint.
- Targeted Playwright passed after export journey addition: `npx playwright test tests/e2e/critical-user-journeys.spec.js --project=chromium` -> 3/3 tests passed.
- Targeted live reconnect Playwright passed: `npx playwright test tests/e2e/critical-live-reconnect.spec.js --project=chromium` -> 1/1 test passed.
- Live cleanup contract covered by `npx vitest run server/services/live-rooms.test.js server/routes/api-surface.test.js` -> 18/18 tests passed.
- Added `tests/e2e/critical-pptx-journey.spec.js` for bounded PPTX import/edit/export smoke.
- PPTX journey imports real `PPTX/Bai_2_2.pptx` through `/api/pptx/import`, updates the test presentation, edits an imported text element through the editor UI, verifies persisted JSON, exports PPTX through the File menu, and inspects the downloaded ZIP for package parts plus edited slide XML text.
- Added AI failure contract assertions in `server/routes/ai.test.js` for malformed translate JSON and missing AI configuration without provider calls, complementing existing malformed outline and provider-failure assertions.
- Targeted AI contract passed: `npx vitest run server/routes/ai.test.js` -> 5/5 tests passed.
- Targeted PPTX journey passed clean on rerun: `npx playwright test tests/e2e/critical-pptx-journey.spec.js --project=chromium` -> 1/1 test passed. First run passed only on retry after a fixture create 500, so it was rerun and passed without retry before counting as evidence.
- Reviewer concern about manual sleep polling was fixed by switching PPTX import status polling to Playwright `expect.poll` intervals. Guard passed: `npx vitest run tests/unit/no-wait-for-timeout.test.js server/routes/ai.test.js` -> 7/7 tests passed.
- Targeted PPTX journey passed after polling fix: `npx playwright test tests/e2e/critical-pptx-journey.spec.js --project=chromium` -> 1/1 test passed.
- Combined Phase 3 contract lane passed: `npx vitest run server/routes/ai.test.js server/services/live-rooms.test.js server/routes/api-surface.test.js` -> 23/23 tests passed.
- Combined Phase 3 Playwright lane passed: `npx playwright test tests/e2e/critical-user-journeys.spec.js tests/e2e/critical-live-reconnect.spec.js tests/e2e/critical-pptx-journey.spec.js --project=chromium` -> 5/5 tests passed.

## Success Criteria

- Critical journeys pass in Playwright.
- Specs remain under 200 LOC.
- POM selectors follow `docs/code-standards.md`.
- No new `waitForTimeout`.

## Risk Assessment

- Risk: journeys too slow for PR. Mitigation: split PR fast lane vs merge full lane in Phase 5.
- Risk: external services. Mitigation: use local API contracts or controlled route mocks only for failure states.

## Security Considerations

- Share tests must clean tokens and use local server.
- AI tests must not require real API keys.

## Next Steps

Phase 4 extends capability matrix to non-editor-core domains.

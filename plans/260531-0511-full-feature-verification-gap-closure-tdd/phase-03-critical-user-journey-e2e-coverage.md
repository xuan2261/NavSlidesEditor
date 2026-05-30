# Phase 03 - Critical User Journey E2E Coverage

## Context Links

- [Plan](./plan.md)
- [E2E cleanup plan](../260524-0959-e2e-cleanup-and-coverage-tdd/plan.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)

## Overview

Priority: P1. Status: Pending. Add release-grade Playwright coverage for user journeys that prove controls, elements, logic, and flow work together.

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
- <!-- Updated: Validation Session 1 - only create/edit/persist and share password/revoke are release-blocking journeys. -->

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

- [ ] Create/edit/persist MVP journey.
- [ ] Share password/revoke MVP journey.
- [ ] Insert/format/arrange/export-smoke bounded journey.
- [ ] Live reconnect bounded journey.
- [ ] PPTX import/edit/export bounded smoke journey.
- [ ] AI failure handling coverage by best layer.

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

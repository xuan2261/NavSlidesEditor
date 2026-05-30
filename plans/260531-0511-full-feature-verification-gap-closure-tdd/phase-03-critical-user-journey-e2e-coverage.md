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

## Architecture

Journeys:

```text
create/edit/persist
insert/format/arrange/export-smoke
live presentation reconnect
pptx import roundtrip with edit smoke
share password revoke
```

AI failure journey may be API-contract/unit if external key dependence makes E2E brittle.

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
5. Run targeted Playwright specs.
6. Update journey doc mapping journey -> spec -> risk covered.

## Todo List

- [ ] Create/edit/persist journey.
- [ ] Insert/format/arrange/export-smoke journey.
- [ ] Live reconnect journey.
- [ ] PPTX import/edit/export smoke journey.
- [ ] Share password/revoke journey.
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

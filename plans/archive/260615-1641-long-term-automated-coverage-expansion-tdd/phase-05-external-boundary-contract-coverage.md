# Phase 05 - External Boundary Contract Coverage

## Context Links

- [Plan](./plan.md)
- [Testing Guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- `server/routes/ai.test.js`
- `tests/e2e/sync/rclone-proton-drive.spec.js`
- `tests/e2e/export/github-push-flow.spec.js`
- `server/routes/`
- `server/services/`

## Overview

Priority: P1  
Status: completed-with-concerns  
Description: Increase confidence around AI, GitHub, rclone, media providers, and upload/import safety without putting real secrets in CI.

## Key Insights

- External-provider E2E with real credentials is not suitable for standard CI.
- Hermetic adapters and contract tests give repeatable confidence.
- Error-path behavior matters more than happy-path provider availability.

## Requirements

- No real API keys, PATs, rclone credentials, or provider secrets.
- Mock external process/network boundaries at the route/service seam.
- Cover malformed responses, timeouts, provider failures, and redaction.
- Keep trusted-author-content security policy intact.
- Add production injection seams only when a route/service cannot be tested through an existing public boundary.

## Architecture

```text
route/service -> injected adapter/mock process -> normalized response/error -> UI or API assertion
```

## Related Code Files

Modify:
- `server/routes/ai.test.js`
- Existing route/service tests under `server/`
- Existing E2E specs for GitHub/sync/media if they already use mocks.

Create:
- Contract tests for missing external boundary routes.
- Shared mock fixtures only when reused.

Delete:
- None.

## Implementation Steps

1. Inventory external boundaries: AI, GitHub push, rclone sync, Unsplash/Giphy, uploads, PPTX import subprocesses if any.
2. Write failing contract tests for missing failure modes.
3. Try existing route/service boundaries first; add injectable seams only if current code forces brittle monkey-patching.
4. Assert errors are generic and secrets are not echoed.
5. Add UI-level mocked E2E only for flows where user recovery matters.
6. For each new seam, document why public-boundary testing was insufficient.
7. Run route tests and relevant E2E specs.

## Todo List

- [x] AI provider contract coverage expansion.
- [x] GitHub push failure/redaction coverage.
- [x] rclone status/config contract coverage.
- [x] Media provider failure coverage.
- [x] Upload/import safety negative coverage.

## Completion Notes

- AI provider failures now assert generic API responses and redacted token-like log output in `server/routes/ai.test.js`.
- GitHub push failure coverage asserts token-like failure details are redacted from API responses in `server/routes/api-surface.test.js`.
- rclone remains covered through public status/config/sync validation paths without real credentials or a test-only process seam.
- Unsplash and GIPHY service contract tests assert provider/network failures normalize to `Failed to load media`; the existing modal catch path displays that through `role="alert"`.
- Upload safety now rejects a non-SVG payload uploaded with an `.svg` extension under `[cap:import.upload-safety tier:deep]`.
- No production abstraction was added only for tests.

## Success Criteria

- External provider failure does not corrupt presentations.
- Secrets are not exposed in responses, logs, or artifacts.
- CI can run all new tests without credentials.
- Any new production seam has a documented consumer beyond the test itself or a recorded exception.

## Risk Assessment

- Risk: mocks diverge from providers. Mitigation: test only app contract, not provider internals.
- Risk: over-abstracting services. Mitigation: minimal adapter seam per boundary.
- Risk: test-driven abstractions make production code harder to read. Mitigation: prefer public route/service contract tests and document exceptions.

## Security Considerations

- Add artifact/response redaction assertions.
- Preserve single-user trusted author content model.
- Negative tests must cover credential leakage, traversal, SSRF/custom endpoint guard, and privilege crossing, not trusted author HTML execution by itself.

## Red Team Notes

- Accepted finding: external-boundary tests can lead to production abstractions that exist only for tests. Phase 5 now requires public-boundary-first testing and documented exceptions.

## Next Steps

- Phase 6 adds visual, accessibility, and performance confidence.

## Verification

- `npx vitest run client/src/services/media-provider-contract.test.js server/routes/ai.test.js server/routes/api-surface.test.js` - passed, 18 tests.
- `npx playwright test tests/e2e/media.spec.js --project=chromium` - passed, 3 tests.
- `npm run matrix:gate` - passed, 0 warnings, 0 failures.
- `npm run test` - passed on 2026-06-16 with 300 test files passed, 1 skipped; 2511 tests passed, 1 skipped.
- `npm run test:e2e` - passed on 2026-06-16 with 475 passed, 22 skipped, and 0 retry-passed flakes.

## Concerns

- Full `npm run test:e2e` passed after stabilizing common element-control fanout, PPTX import contention, markdown export rehydration, live presenter-disconnect cleanup, plugin runtime API polling, and PPTX browser-audit import setup. No retry-passed flakes remain in the latest run.

## Unresolved Questions

- None.

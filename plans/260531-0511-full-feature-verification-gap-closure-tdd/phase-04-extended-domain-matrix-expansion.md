# Phase 04 - Extended Domain Matrix Expansion

## Context Links

- [Plan](./plan.md)
- [System architecture](../../docs/system-architecture.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)

## Overview

Priority: P2. Status: Complete. Extend capability tracking beyond editor-core without trying to fully test every edge in one pass. This phase is bounded: inventory and retag first; add new smoke/security coverage only for explicitly selected high-risk domains.

## Key Insights

- Domains outside editor-core have different test layers: export/import, live sockets, games, AI, sync, version history.
- First pass should inventory capabilities and define smoke/deep policy.

## Requirements

- Add domain capability namespaces.
- Keep matrix meaningful; avoid dumping hundreds of low-value rows.
- Mark each capability with risk and recommended test layer.
- Add smoke coverage for highest-value flows.
- Do not add broad namespaces unless each new ID has risk/layer classification and a debt/verification policy.
- Distinguish executable integration coverage from contract-only coverage.

<!-- Updated: Validation Session 1 - AI/sync/GitHub/rclone are contract-only unless backed by hermetic local adapters. -->

## Architecture

Proposed namespaces:

```text
export.html, export.offline-html, export.pdf, export.pptx
import.markdown, import.navslides, import.pptx
presentation.navigation, presentation.speaker, presentation.overlays
live.presenter-viewer, live.remote, live.reconnect
game.join, game.score, game.leaderboard
ai.generate, ai.rewrite, ai.translate, ai.failure
sync.rclone-status, sync.single, sync.all
history.snapshot, history.restore
share.password, share.revoke
```

MVP namespace rule:

- Add only IDs backed by existing tests, near-term smoke tests, or explicit high-risk debt.
- Prioritize share, live authorization, PPTX/import contracts, upload/import safety, and AI endpoint guard.
- Defer low-risk taxonomy expansion to a follow-up plan.

Mandatory negative/security matrix:

- revoked share tokens cannot read shared content or rejoin live/share paths
- share passwords handle wrong-password and reuse paths without granting access
- viewer/remote socket clients cannot emit presenter-only commands
- invalid/replayed presenter tokens are rejected
- game score submissions validate participant/session scope
- import/upload rejects traversal, malformed archive/XML/JSON, MIME mismatch, oversize payloads, and unsafe archive expansion
- AI endpoint guard blocks localhost/private/link-local/metadata IPs, unsupported protocols, and redirects to blocked ranges
- sync/GitHub/rclone tests use fake/local failure paths and never real credentials

Validation scope: share/live/import-upload/AI guard negative tests are mandatory before completion. Other mandatory negative/security matrix entries may be completed as dated debt with owner, reason, and target phase if they are not practical in this plan.

## Related Code Files

- Modify: `scripts/feature-inventory/feature-manifest.json`
- Modify: `scripts/feature-inventory/coverage-gate-allowlist.json`
- Modify: `tests/e2e/export/*` or existing export specs
- Modify: `tests/e2e/live/*` and `tests/e2e/games/*`
- Modify: `tests/load/*` only if adding capability tags is supported
- Modify: `server/**/*.test.*` for API contract coverage

## Implementation Steps

1. Red: add manifest completeness test for new namespaces.
2. Inventory domains in small batches.
3. Tag existing tests before adding new ones.
4. Add smoke tests only for high-value unverified capabilities listed in the MVP namespace rule.
5. Add deep/negative tests for high-risk domains: share security, live/socket authz, import/upload safety, AI endpoint guard, PPTX import/export contracts.
6. Label AI/sync/GitHub/rclone checks as contract-only unless they execute a hermetic local adapter or fake binary.
7. Regenerate matrix and review allowlist.

## Todo List

- [x] Add extended namespace policy.
- [x] Tag existing export/import tests.
- [x] Tag live/game/share/sync tests.
- [x] Add missing high-value smoke tests.
- [x] Add mandatory negative/security matrix entries or dated debt.
- [x] Add allowlist entries for intentionally deferred domains.

## Implementation Evidence

- Added extended-domain capability IDs to `scripts/feature-inventory/feature-manifest.json` for export, import, live, share, AI, game, sync, history, plus the existing `element.game` non-editor-core scope.
- Extended IDs carry `scope`, `targetLayer`, and `coverageMode` so contract-only AI/sync checks cannot be confused with full external E2E coverage.
- Added `scripts/feature-inventory/extended-domain-report.mjs` and `npm run matrix:extended-report`, writing `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/extended-domain-coverage-matrix.{json,md}` separately from the editor-core matrix.
- Updated `scripts/feature-inventory/build-matrix.mjs` so editor-core matrix generation suppresses known cross-scope tags from orphan failures while still failing truly unknown tags.
- Tagged existing coverage for `export.html`, `export.pptx`, `import.markdown`, `import.pptx`, `live.reconnect`, `live.presenter-authz`, `share.password`, `share.revoke`, `ai.generate`, `ai.rewrite`, `ai.translate`, `game.score`, `element.game`, `sync.rclone-status`, and `history.snapshot`.
- Added `server/services/ai-endpoint-guard.test.js` for AI custom endpoint guard negative coverage: unsupported protocols, localhost, private/link-local/metadata IPs, DNS resolving to private ranges, public host allow, and explicit hostname allowlist.
- Tagged existing PPTX route/package guard tests for `import.upload-safety` covering missing file, MIME/name mismatch, non-ZIP, missing required entries, decompression budget, invalid job IDs, and upload limiter.
- Tagged existing live token security tests for deep `live.presenter-authz` coverage including invalid token and cross-room token reuse rejection.
- No intentionally deferred extended domain remains invisible after this slice; extended report shows `GAP:0`, `TAGGED:18`, `orphans:0`. PASS promotion is intentionally left to future run-result capture because current run-result JSON is stale.

## Verification Evidence

- `npx vitest run scripts/feature-inventory/build-inventory.test.mjs scripts/feature-inventory/build-matrix.test.mjs scripts/feature-inventory/extended-domain-report.test.mjs scripts/feature-inventory/check-coverage-gate.test.mjs server/routes/ai.test.js tests/unit/no-wait-for-timeout.test.js` -> 46/46 passed.
- `npx vitest run server/services/ai-endpoint-guard.test.js server/services/pptx-import/pptx-guards.test.js server/routes/pptx-import.test.js server/routes/api-surface.test.js scripts/feature-inventory/build-inventory.test.mjs scripts/feature-inventory/build-matrix.test.mjs scripts/feature-inventory/extended-domain-report.test.mjs` -> 53/53 passed.
- `npm run matrix:gate` -> editor-core matrix remains 90/100 verified, 0 failures, 0 orphans; gate passed with 10 existing allowlist warnings.
- `npm run matrix:extended-report` -> 118 inventory capabilities, extended report `0/18 verified`, `GAP:0`, `TAGGED:18`, `orphans:0` with stale run-result warning.
- `npx playwright test tests/e2e/critical-user-journeys.spec.js tests/e2e/critical-live-reconnect.spec.js tests/e2e/critical-pptx-journey.spec.js tests/e2e/import/markdown-import.spec.js tests/e2e/games/game-scoring-and-leaderboard.spec.js --project=chromium` -> 8/8 passed.
- `npx playwright test tests/e2e/ai.spec.js --project=chromium` -> 3/3 passed.
- `npx playwright test tests/e2e/games/game-elements.spec.js --project=chromium -g "\[cap:element\.game\]"` -> 1/1 passed.
- `npx playwright test tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js --project=chromium` -> 6/6 passed.
- A parallel Playwright attempt combining `ai.spec.js` and full `game-elements.spec.js` failed after one invocation shut down the shared webServer port. It was rerun sequentially with clean passes above and is not counted as product evidence.
- Reviewer-blocking AI redirect SSRF concern fixed in `server/services/ai-provider.js` by setting custom-provider `fetch` to `redirect: 'manual'`; regression covered by `server/services/ai-provider.test.js`.
- Reviewer-blocking extended stale PASS concern fixed by using an empty run index for stale extended-domain reports; regression covered by `scripts/feature-inventory/extended-domain-report.test.mjs`.
- Reviewer-blocking live room cleanup concern fixed by preferring `Authorization: Bearer` for `DELETE /api/live/room/:code` and leaving connected Socket.IO clients via `io.in(code).socketsLeave(code)` after `room-ended`; route contract covered by `server/routes/api-surface.test.js`, and live journey cleanup updated to Bearer token.
- Post-review fix verification: `npx vitest run server/services/ai-provider.test.js server/services/ai-endpoint-guard.test.js server/routes/api-surface.test.js scripts/feature-inventory/extended-domain-report.test.mjs scripts/feature-inventory/build-matrix.test.mjs` -> 30/30 passed.
- Post-review live verification: `npx playwright test tests/e2e/critical-live-reconnect.spec.js --project=chromium` -> 1/1 passed.

## Success Criteria

- Extended matrix shows domain coverage and debt clearly.
- No new domain capability is invisible.
- Existing tests are reused before new tests are written.
- Contract-only domains are not reported as full end-to-end verified.

## Risk Assessment

- Risk: matrix becomes noisy. Mitigation: capability IDs represent user-visible behavior, not every internal function.
- Risk: load tests do not fit run-status join. Mitigation: mark k6 as separate gate until matrix supports it cleanly.

## Security Considerations

- Share, upload, import, sync, and AI failure paths need security-focused assertions.
- Do not test with real cloud credentials.

## Next Steps

Phase 5 wires gates so the plan becomes operational.

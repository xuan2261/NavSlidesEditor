# Phase 04 - Extended Domain Matrix Expansion

## Context Links

- [Plan](./plan.md)
- [System architecture](../../docs/system-architecture.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)

## Overview

Priority: P2. Status: Pending. Extend capability tracking beyond editor-core without trying to fully test every edge in one pass. This phase is bounded: inventory and retag first; add new smoke/security coverage only for explicitly selected high-risk domains.

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
- <!-- Updated: Validation Session 1 - AI/sync/GitHub/rclone are contract-only unless backed by hermetic local adapters. -->

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

- [ ] Add extended namespace policy.
- [ ] Tag existing export/import tests.
- [ ] Tag live/game/share/sync tests.
- [ ] Add missing high-value smoke tests.
- [ ] Add mandatory negative/security matrix entries or dated debt.
- [ ] Add allowlist entries for intentionally deferred domains.

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

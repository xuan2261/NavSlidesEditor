# Phase 04 - Extended Domain Matrix Expansion

## Context Links

- [Plan](./plan.md)
- [System architecture](../../docs/system-architecture.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)

## Overview

Priority: P2. Status: Pending. Extend capability tracking beyond editor-core without trying to fully test every edge in one pass.

## Key Insights

- Domains outside editor-core have different test layers: export/import, live sockets, games, AI, sync, version history.
- First pass should inventory capabilities and define smoke/deep policy.

## Requirements

- Add domain capability namespaces.
- Keep matrix meaningful; avoid dumping hundreds of low-value rows.
- Mark each capability with risk and recommended test layer.
- Add smoke coverage for highest-value flows.

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
4. Add smoke tests only for high-value unverified capabilities.
5. Add deep tests for high-risk domains: share security, live reconnect, PPTX import/export contracts.
6. Regenerate matrix and review allowlist.

## Todo List

- [ ] Add extended namespace policy.
- [ ] Tag existing export/import tests.
- [ ] Tag live/game/share/sync tests.
- [ ] Add missing high-value smoke tests.
- [ ] Add allowlist entries for intentionally deferred domains.

## Success Criteria

- Extended matrix shows domain coverage and debt clearly.
- No new domain capability is invisible.
- Existing tests are reused before new tests are written.

## Risk Assessment

- Risk: matrix becomes noisy. Mitigation: capability IDs represent user-visible behavior, not every internal function.
- Risk: load tests do not fit run-status join. Mitigation: mark k6 as separate gate until matrix supports it cleanly.

## Security Considerations

- Share, upload, import, sync, and AI failure paths need security-focused assertions.
- Do not test with real cloud credentials.

## Next Steps

Phase 5 wires gates so the plan becomes operational.

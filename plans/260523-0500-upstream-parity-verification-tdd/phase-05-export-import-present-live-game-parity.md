---
phase: 5
title: "Export Import Present Live Game Parity"
status: pending
priority: P0
effort: "4-5d"
dependencies: [3, 4]
---

# Phase 5: Export Import Present Live Game Parity

## Context Links

- [Phase 3 fixtures](./phase-03-golden-fixtures-and-state-assertions.md)
- `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`

## Overview

Verify non-editor flows: export/import, present mode, live broadcast, sharing, game player/presenter flows, and Electron smoke if MVP QA plan has not completed it.

## Requirements

<!-- Updated: Validation Session 1 - external provider parity scope confirmed -->

**Functional:**
- MVP gate: export HTML/PDF, import `.navslides`, present navigation, share password/revoke, and basic viewer access.
- Extended gate: offline HTML, PPTX export/import corpus, Markdown import, live reconnect/annotations/timer, game scoring/leaderboard, Electron overlap if still needed.
- AI, cloud sync, GitHub, and rclone parity checks use mock/local canary flows only in the default gate. Do not require real provider credentials in CI or release parity.
- Export artifacts validate slide count, dimensions, content markers, media references, and extractable object metadata. Add screenshot diff where artifact layout is the behavior.
- Import tests include malicious fixture rejection: zip slip, absolute paths, malformed manifest, oversized media, duplicate IDs, decompression pressure, and unsafe external URLs.
- Share password/revoke/token leakage checks include unauthorized mutation denial and revoked/replayed token denial.
- Live/game tests include presenter-token bypass checks and forged viewer event denial.

**Non-functional:**
- Live specs run workers:1 when needed.
- k6 smoke uses local server only.
- Export tests do not chase pixel perfection for all cases, but MVP export layout must have artifact-level fidelity assertions.
- Realtime tests must disconnect clients, clear timers/rooms, reset in-memory registries, and assert no active rooms/listeners after each spec.

## Architecture

```text
golden fixture
    -> isolated temp data/export/upload root
    -> flow action
    -> output artifact/socket state/security denial
    -> assertion
    -> teardown + orphan/socket cleanup
```

## Related Code Files

**Read:**
- `tests/e2e/export/`
- `tests/e2e/live/`
- `tests/e2e/games/`
- `tests/e2e/share/`
- `server/services/*.test.js`
- `server/routes/*.test.js`

**Modify/Create:**
- Missing parity specs from matrix.
- Phase report under plan reports.

## Implementation Steps

1. Run targeted suites:
   ```powershell
   npx playwright test tests/e2e/export tests/e2e/pptx-import-fidelity.spec.js
   npx playwright test tests/e2e/live --project=chromium
   npx playwright test tests/e2e/games
   npx playwright test tests/e2e/share
   npm run test:corpus
   npm run test:load:api:smoke
   npm run test:load:ws:smoke
   ```
2. Run MVP gate first and mark extended suites separately.
3. Compare output behavior with upstream baseline.
4. Add missing assertions from matrix:
   - artifact fidelity for MVP exports
   - malicious import rejection
   - share/live/game unauthorized action denial
   - reconnect/concurrency replay checks where MVP or high risk
5. Mark intentional divergences with waiver if P0.
6. Record pass/fail in report.

## TDD / Tests

- Red: add failing export/live/game parity assertion for known missing matrix row.
- Green: implement minimal test/helper or fix behavior if current diverges unintentionally.
- Refactor: consolidate repeated artifact/socket waits.

## Todo List

- [ ] Run export/import suites.
- [ ] Run present/live/share/game suites.
- [ ] Run corpus and k6 smoke.
- [ ] Add missing parity assertions.
- [ ] Update matrix.

## Success Criteria

- P0 export/import/live/game rows are no longer `Unknown`.
- MVP P0 rows are `Pass` or covered by a signed waiver with owner, expiry, and rollback decision.
- `Fail with ticket` and `Unknown` are not release-ready for MVP P0.
- Corpus result meets existing gate.
- k6 smoke passes or blocker documented.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Live socket specs flake | High | workers:1, unique room IDs, tolerant waits |
| PPTX corpus absent locally | Medium | Mark skipped with reason, require CI/corpus runner |
| Electron overlap with MVP plan | Medium | Reuse existing pending plan if completed first |
| Malicious import bypasses happy-path corpus | High | Add adversarial import fixtures and assert clean rejection/no partial writes |
| Viewer emits presenter-only socket events | Critical | Add forged event denial tests and unchanged-state assertions |
| Socket timers/rooms leak between specs | High | Add deterministic teardown and zero-active-room/listener assertions |
| Export markers pass while layout is broken | High | Add artifact metadata and screenshot assertions for MVP exports |

## Security Considerations

- Share/auth tests must verify tokens/passwords do not leak.
- Do not use real AI/GitHub/rclone credentials.
- Use mock/local canary secrets for AI/cloud/GitHub/rclone parity and scan artifacts for those canaries.
- Use fake canary secrets and scan exports, traces, reports, archives, logs, and CI artifacts for leakage.
- Security failures override upstream parity status.

## Red Team Adjustment

- Phase 5 is split into MVP and extended gates to avoid one giant unstable phase blocking all value.
- Import, share, live, and game flows now include hostile negative tests across trust boundaries.
- Export validation is strengthened beyond headers/size markers for MVP artifacts.

## Next Steps

- Visual/manual QA gate.

## Unresolved Questions

- Whether Electron packaged smoke is handled here or only by `260522-1339` MVP plan.

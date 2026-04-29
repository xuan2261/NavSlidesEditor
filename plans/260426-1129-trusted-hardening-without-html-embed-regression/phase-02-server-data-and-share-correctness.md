---
phase: 2
title: "Server Data And Share Correctness"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: Server Data And Share Correctness

## Context Links
- [Plan](./plan.md)
- [Debug validation report](../reports/debug-260426-code-review-master-validation.md)
- `server/services/storage.js`
- `server/routes/presentations.js`
- `server/routes/analytics.js`
- `server/routes/explore.js`
- `server/routes/media.js`
- `server/index.js`

## Overview
Fix file-backed data races and privacy/correctness bugs without changing authoring or embed behavior.

## Key Insights
- Storage already has lock queue in `storage.js`; reuse it.
- Share token format can be legacy string or object. Permanent delete only handles old string.
- Analytics endpoint is currently public by presentation id.

## Requirements
- Functional: permanent delete removes object share tokens.
- Functional: concurrent view increments and analytics/media writes do not corrupt or lose data.
- Functional: Explore excludes trashed decks.
- Functional: analytics access requires validated share context or controlled access rule.
- Non-functional: keep file-based persistence, no DB/auth migration.

## Architecture
Use storage-layer helpers:
- `withShareTokens(callback)` or equivalent wrapper around `SHARE_FILE`.
- `withAnalytics(callback)` wrapper for `analytics.json`.
- `withMediaDb(callback)` or reuse storage lock for `media.json`.

Share flow:
`/share/:token -> locked token read/update -> render`
Analytics flow:
`recordView -> locked analytics mutation`
Explore flow:
`read shares + presentations -> active public shares -> !deletedAt`

## Related Code Files
- Modify: `server/services/storage.js`
- Modify: `server/routes/presentations.js`
- Modify: `server/routes/analytics.js`
- Modify: `server/routes/explore.js`
- Modify: `server/routes/media.js`
- Modify: `server/index.js`
- Modify/Create tests:
  - `server/routes/presentations.test.js`
  - `server/routes/share.test.js`
  - `server/routes/api-surface.test.js`
  - `server/routes/analytics.test.js` if needed
  - `server/routes/media.test.js` if needed

## Implementation Steps
1. Add storage helpers:
   - `withShareTokens(mutator)`
   - `withAnalytics(mutator)`
   - optional `withMediaDb(mutator)`.
2. Update permanent delete cascade:
   - normalize token data with helper.
   - delete token when `presentationId === presId`.
3. Update `/share/:token` GET/POST view increment:
   - read and write token object inside one lock.
   - preserve legacy string normalization.
4. Update `recordView()` to mutate inside analytics lock.
5. Update media DB write path to use lock/atomic write helper.
6. Add analytics access rule:
   - minimal option: require `?token=...` and validate token maps to `:id`.
   - keep route unauthenticated but not id-only public.
7. Update `Explore` query to filter `!p.deletedAt`.

## Todo List
- [x] Add locked helper(s).
- [x] Fix share token cascade for object tokens.
- [x] Lock token view increments.
- [x] Lock analytics writes.
- [x] Lock media DB writes.
- [x] Protect analytics read.
- [x] Filter trashed decks in Explore.

## Tests / Verification
- Unit/integration:
  - permanent delete removes object-format and legacy string tokens.
  - share GET concurrent increments preserve count.
  - `recordView()` concurrent calls preserve total and events.
  - `GET /api/analytics/:id` rejects missing/invalid token.
  - `GET /api/analytics/:id?token=valid` returns stats.
  - Explore excludes `deletedAt` presentation with active public share.
  - media upload/list keeps valid JSON after parallel saves.
- Commands:
  - `npm run test -- server/routes/presentations.test.js`
  - `npm run test -- server/routes/share.test.js server/routes/api-surface.test.js`
  - `npm run test -- server/routes`
  - `npm run build`

## Success Criteria
- [x] No orphan share tokens after permanent delete.
- [x] No lost view increments in tested concurrency.
- [x] Analytics not readable by presentation id alone.
- [x] Explore hides trashed decks.
- [x] Server tests pass.

## Risk Assessment
- Risk: analytics modal client still calls old URL.
- Mitigation: update client in same phase or Phase 5 if needed.
- Risk: lock helper causes nested lock deadlock.
- Mitigation: avoid calling write helper from inside same-file locked callback.

## Security Considerations
- Improves privacy without adding auth.
- Does not affect HTML embed or export scripts.

## Next Steps
- Phase 3 live hardening can run after storage patterns are stable.

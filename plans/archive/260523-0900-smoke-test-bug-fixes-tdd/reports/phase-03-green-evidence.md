# Phase 03 — GREEN Evidence (I-005 Atomic Storage Writes)

Date: 2026-05-23

## Summary

I-005 fix applied in `server/services/storage.js` — added `writeJsonAtomic` (write-temp + atomic-rename with Windows retry) and replaced all 11 non-sync `fs.writeJson` call sites. Tests for both atomic write cases pass; full server suite (318 tests) is green.

## Changes Applied

### `server/services/storage.js`

1. **New helpers** after `withFileLock` block:
   - `renameWithRetry(src, dest, attempts=5)` — bounded backoff (25/50/75/100ms) on `EPERM|EBUSY|EACCES|EEXIST` for Windows reliability.
   - `writeJsonAtomic(filePath, data, options)` — writes to `${filePath}.tmp.${pid}.${++counter}` then `renameWithRetry`. On error: removes orphan tmp.
2. **11 non-sync call sites replaced** with `writeJsonAtomic`:
   - `writePresentations`, inner `withPresentations`, `writeTemplates`, `writeShareTokens`, inner `withShareTokens`, `writeGithubConfig`, `writeSettings`, `writeAnalytics`, inner `withAnalytics`, `writeMediaDb`, inner `withMediaDb`.
3. **Init writes unchanged**: `fs.writeJsonSync` in `initDataFiles` only runs when the file is absent — atomicity is not relevant there.
4. **Startup cleanup of stale `.tmp` files** via `setImmediate` (non-blocking). Critical safety: cleanup matches `\.tmp\.(\d+)\.\d+$` but **skips files belonging to the current PID** to avoid deleting in-flight writes from the same process.

### Race fix during implementation

Initial draft removed all `.tmp` files unconditionally and broke `socket-handler.test.js` (2 ENOENT failures: rename target deleted mid-write). Cause: when multiple test files all called `initDataFiles()`, the `setImmediate` cleanup wiped any concurrent in-flight `.tmp` from the same process. Fix: filter cleanup to `pid !== process.pid` only. Verified by re-running affected tests.

## RED → GREEN — `server/services/storage.test.js`

```
$ npx vitest run server/services/storage.test.js

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  1.76s
```

Both tests pass:
- `concurrent reads never observe truncated JSON during many writes` — 100 reads × 25 writes interleaved. Previously: 18 partial reads observed. Now: 0.
- `SIGKILL mid-write leaves valid JSON on disk` — already green pre-fix; remains green (regression guard).

## Full Server Regression — `npx vitest run server/`

```
 Test Files  35 passed (35)
      Tests  318 passed | 1 skipped (319)
   Duration  127.77s
```

Zero failures. Affected suites verified:
- `server/services/socket-handler.test.js` — all 21 tests pass after the PID-skip cleanup fix.
- `server/routes/presentations.test.js` — all 6 tests pass (4 existing + 2 I-002 legacy).
- `server/services/storage.test.js` — 2 atomic tests pass.

## Files Modified

| Path | Change |
|---|---|
| `server/services/storage.js` | +44 LOC: `renameWithRetry`, `writeJsonAtomic`, async `.tmp` cleanup; 11 call-site replacements |

## Risk Coverage

| Risk (from plan) | Status |
|---|---|
| Windows EPERM/EBUSY on rename | `renameWithRetry` with 5 attempts × bounded backoff |
| In-flight tmp orphan from crash | Async `setImmediate` cleanup at startup |
| Cleanup deleting our own in-flight tmp | **Resolved during implementation**: cleanup skips current PID |
| `tmpCounter` collision across workers | `pid + counter` is unique per-host per-worker |
| Two writes interleave | `withFileLock` serialization preserved |

## Manual Smoke (Step 3.4)

Deferred to Phase 7 regression sweep — does not gate Phase 3 acceptance, which is satisfied by the automated suite. The unit test `concurrent reads never observe truncated JSON` exercises the exact race condition the manual procedure was designed to surface.

## Next

Proceed to Phase 4: Fix I-001 sticky Trash sidebar (`client/src/pages/HomePage.jsx`).

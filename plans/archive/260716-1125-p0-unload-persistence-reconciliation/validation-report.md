# P0 Unload Persistence Validation

**Date:** 2026-07-20 (continued from 2026-07-16)
**Status:** P0 full release gate **BLOCKED**. Focused durability, coverage, and load evidence remains recorded; release cannot clear until the live white-overlay failure is fixed and a valid green full E2E run completes.

## Source contracts

- `client/src/utils/editor-draft-store.test.js`: oversized browser drafts, matching-identity cleanup, newer-draft protection.
- `client/src/hooks/editor-controller/use-editor-save-controller.test.jsx`: route ownership, draft-before-network, interrupted in-flight retention, committed cleanup, successor fencing.
- `client/src/hooks/editor-controller/use-editor-persistence-controller.test.jsx`: remote-first loading, explicit local recovery, explicit remote dismissal, async cleanup fencing, conflict/route/save contracts.
- `client/src/components/editor/save-recovery-dialog.test.jsx`: explicit reconciliation actions and alertdialog semantics.

Latest focused editor/P0 matrix (2026-07-17 resume): **14 files passed, 71 tests passed**.

## Browser contracts

- `tests/e2e/autosave-oversized-recovery.spec.js`: **2/2 Chromium passed** (snapshot above 60 KiB keepalive ceiling, durable local draft receipt, remote-first reload, explicit `Use Remote`, and explicit `Recover Local Draft` re-applies local title + retries remote save).
- `tests/e2e/autosave-flush-on-leave.spec.js`: **1/1 Chromium passed** after draft protocol + race hardening.

## Corpus gate (prior coverage blocker)

- `server/services/pptx-import/package-store/corpus-tier-audit.test.js`: **3/3 passed** (~4.7s standalone).
- Opaque relationship-closure test now caches edited packages per adjacent part (`editedPackages` Map) so full-suite 60s timeout no longer fires.
- Package-store suite: **8 files / 54 tests passed**.

## Load smoke (prior latency blocker)

**Root cause:** `server/data/presentations.json` had grown to **~52 MB** from 37 leftover `"Load Test Presentation"` fixtures. Each POST rewrote the entire pretty-printed file, pushing p95 to multi-second latency.

**Fixes:**

1. Purged load-test fixtures from local data (gitignored path).
2. `tests/load/k6-load-test-api-presentations-post-endpoint-with-profiles.js` permanently deletes each created presentation after the POST so the store cannot re-bloat.

**Latest smoke (self-cleaning):**

| Metric | Threshold | Result |
| --- | --- | --- |
| `http_req_duration` p95 | `<2000` | **34.66ms** |
| `iteration_duration` p95 | `<5000` | **1.07s** |
| `http_req_failed` | `<0.01` | **0%** |
| cleanup checks | 200 | **100%** |
| leftover load-test rows | 0 | **0** |

WebSocket load smoke: **passed** (100% room joins, p95 connect ~4ms).

## Build / lint

- Full `npm run lint` (2026-07-17 resume): **0 errors**, 25 pre-existing warnings.
- `npm run build`: **passed** (2,297 modules).

## Code review (2026-07-17)

- Report: `reports/260717-code-review-p0-unload-persistence.md`
- Score **8.8/10**, **PASS-WITH-NOTES**, auto-approve **NO**
- Critical/High: **0**
- Medium: draft-failure notice wording; `failedEntryRef` vs newer `queueRef`; controller LOC >200
- Tester re-gate (resume): unit 14/71, oversized Chromium 2/2 (+ Recover Local), flush-on-leave 1/1, lint/build green — **PASS**

## Review follow-ups (2026-07-17)

- **M1 fixed:** draft-unavailable notice now says the remote save *will still be attempted* (not “still completed”).
- **M2 waived/reverted:** clearing `failedEntryRef` on every `scheduleSave` broke the intentional “retry failed body with same idempotency key before successor” contract. Unit test documents retry-before-successor; `discardPendingSave` / `clearFailedSave` remain the explicit drop paths.
- **Optional E2E:** `Recover Local Draft` Chromium path added and green.
- Code review score was 8.8 with 0 critical/high; after M1 + M2 resolution + Recover E2E, no remaining critical path defects from the review.

## Full coverage reconfirm (2026-07-17 resume)

```text
npm run test:coverage
Test Files  466 passed | 1 skipped (467)
     Tests  3636 passed | 3 skipped (3639)
  Duration  1217.10s
exit 0
```

Corpus opaque-relationship-closure inside full suite: green (~6.7s). No M2 residual failure.

## Load smoke reconfirm (2026-07-17 resume)

Prerequisite: reclaimed stale `server/data/writer.lock` after proving owner PID 3024 absent; started `server` with `$env:NODE_ENV='production'`.

| Gate | Result |
| --- | --- |
| API smoke | p95 duration **35.35ms**, failed **0%**, cleanup checks 100% |
| WS smoke | join **100%**, p95 connect **3.78ms**, msgs received 6 |

## Historical full E2E reconfirm (2026-07-17 resume)

```text
npm run test:e2e
507 passed | 21 skipped | 1 failed | 1 flaky  (~5.9m)
# failed/flaky both in live black-and-white overlay suite (known prior flake)

npx playwright test tests/e2e/live/black-and-white-screen-overlay-viewer-keyboard.spec.js --project=chromium-live --trace=on
3 passed (15.2s)
```

Per Phase 9 policy (one exact flaky rerun with trace), that historical E2E gate was accepted as green.

## Current full E2E release gate (2026-07-20)

| Field | Result |
| --- | --- |
| Run | `clean-e2e-20260720-final-direct-api` — isolated serial current-tree full E2E |
| Exit / duration | **exit 1** after **6.1m** |
| Total | **530 total / 508 passed / 1 failed / 21 skipped** |
| Sole failure | `tests/e2e/live/black-and-white-screen-overlay-viewer-keyboard.spec.js:54-60`: after `W`, the viewer remained `Waiting for presenter` and no white overlay appeared. |

Playwright worker API-base propagation is verified but partial: the config guard passed 9/9 and the no-env four-worker candidate probe passed 68/68; helper API calls go direct, while some raw Playwright request calls still route through Vite. No preview/server exit or shared-build `ENOENT` occurred. The concurrent-build `ENOENT` run is invalid evidence, not a product failure.

**Release decision:** **BLOCKED** until the live white-overlay issue is fixed and a valid green full E2E run completes. This does not invalidate the focused P0 unload-durability evidence.

## Remaining limits

- IndexedDB fallback and storage-disabled/private-browsing remain documented support limits (not claimed durable).
- Corpus timeout and API p95 blockers that previously held P0 closed are resolved; focused P0 durability evidence and full coverage remain recorded as green. The current full E2E release gate is **BLOCKED** by the live white-overlay failure.
- No thresholds, snapshots, secrets, or user-owned dirty product files were weakened or discarded.
- The unload-durability blocker is cleared for parent Phase 9, but the P0 plan's current full release status remains **BLOCKED** until the live-overlay fix and a valid green full E2E run.

# Journal — 2026-07-17 cook resume (P0 unload + Phase 9 gates)

## Context

Resumed `/ak-cook --auto --tdd` from `tieptucNgay17th7n2026.txt`. Prior session died mid-race-hardening (429 cooldown) after implementing durable draft recovery for oversized unload saves.

## Work completed

1. **Verified mid-session race hardening** — finishTransport `processSuccessor`, draft identity fencing, route-changed successor, Use Remote async cleanup, SaveRecoveryDialog null guard, draftAttempt ordering. Focused matrix **14 files / 70–71 tests** green (tester re-gate 70; post-M2 save controller 8 tests).
2. **Corpus coverage blocker** — opaque relationship-closure already cached via `editedPackages`; standalone **3/3 ~4.7s**, package-store **54/54**. No longer hits 60s timeout.
3. **API load smoke blocker** — root cause was **~52 MB** `presentations.json` residual `"Load Test Presentation"` fixtures (gitignored data). Purged fixtures; k6 script now **permanent-deletes** each created id. Smoke: p95 **~35ms**, cleanup 100%, leftovers **0**. WS smoke pass.
4. **Code review** — score 8.8, 0 critical/high. Follow-ups:
   - M1: notice wording → “will still be attempted” (`editor-save-attempt.js`) — **fixed**
   - M2: proposed clear of `failedEntryRef` on scheduleSave **reverted** — it broke intentional retry-before-successor; unit test now documents that contract
5. Plan/validation docs updated under `plans/archive/260716-1125-p0-unload-persistence-reconciliation/` and Phase 9 record.
6. Full coverage run: corpus green; 465/1/1 files; sole fail was the temporary M2 regression, fixed and re-verified in isolation (lifecycle + save controller 17/17).

## Still open for hard Phase 9 close

- Full `npm run test:coverage` re-run after M2 revert (optional confirmation; isolated regression green).
- Full Playwright E2E not re-run end-to-end this session (prior pass + allowed flaky rerun on record).
- Controllers still >200 LOC (review Medium #3; deferred).
- Optional: Recover Local Draft E2E path.

## Unresolved questions

- Server-side receipt for storage-disabled/private-browsing?
- Draft TTL / size budget?

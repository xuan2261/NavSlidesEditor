---
phase: 1
title: "Critical Autosave & History Lifecycle"
status: pending
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Critical Autosave & History Lifecycle

## Overview
Stop silent data loss when leaving the editor within the autosave debounce
window, fix save-failure recovery, and correct history-snapshot accounting at
load. Highest-priority phase — C1 is a Critical data-loss defect.

## Bugs Addressed
- **C1 (Critical)** — pending debounced save dropped on unmount/navigation. `EditorPage.jsx:507-527`. No flush of `queuedSaveRef`, no `beforeunload`, no router-leave flush.
- **M11 (Medium)** — duplicate initial history snapshot at load (Undo enabled with zero edits; `hasChanges` true immediately). `EditorPage.jsx:484-545` interacting with load `389-395`.
- **M12 (Medium)** — save failure not retried; failed snapshot discarded. `EditorPage.jsx:335-348, 319-327`.
- **L4 (Low)** — history cap keeps 51 not 50 (off-by-one). `EditorPage.jsx:537-540`.

## Requirements
- Functional: edits made within 1.5s before unmount/navigation/tab-close MUST persist (flush on cleanup + `beforeunload`). Save failure MUST re-enqueue or surface a retriable dirty state. Opening a presentation with no edits MUST leave Undo disabled and `hasChanges` false.
- Non-functional: no added save spam; flush must be idempotent (no double-write of the same snapshot); `beforeunload` handler must not block the close on slow network beyond a best-effort `navigator.sendBeacon`/sync flush.

## Architecture
EditorPage owns local `presentation` state + a manual save queue
(`queuedSaveRef`, `saveInFlightRef`, `processSaveQueue`) and history refs
(`historyRef`, `redoStackRef`). `presentation-store.js`/`use-autosave.js` are
**dead code** relative to the editor — confirm before touching; do not wire them
in. Fix lives entirely in EditorPage lifecycle effects.

**RED-TEAM CORRECTIONS (must follow):**

- **Transport (BLOCKER):** `navigator.sendBeacon` is **POST-only**; the save
  route is `router.put('/:id')` (`server/routes/presentations.js:261`,
  `api.updatePresentation` PUT at `client/src/utils/api.js:18-23`). A beacon would
  404 → silent loss. Use `fetch(url, { method:'PUT', keepalive:true, headers, body })`
  which supports PUT. Before sending, check `JSON.stringify(snapshot).length`: if
  > ~60KB (data-URL/base64 media risk — VERIFY whether media is URL-referenced via
  SHA256 dedup or inlined), `keepalive` may silently drop it; fall back to a
  synchronous best-effort + a "save in progress" guard.
- **Flush placement (BLOCKER):** the autosave effect (`~507-519`, deps
  `[presentation, …]`) cleanup runs on **every edit** — DO NOT put the flush
  there (defeats debounce, save spam). Put the unmount flush in the SEPARATE
  unmount-only effect (`~521-527`).
- **A→B navigation (Medium):** `/editor/:id` param change reuses the same
  component instance → load effect (`379-401`) re-runs, NO unmount. Drain the
  queue at the TOP of the load effect (before overwriting `historyRef`/state) so
  switching presentations doesn't drop A's pending save. (`persistPresentation`
  keys off `snapshot.id` at 307/311, so a late flush writes the correct doc — the
  defect is the dropped flush, not a wrong-doc write.)
- **M11 (BLOCKER):** the autosave effect consumes `isFirstLoad` (sets false at
  ~510) BEFORE the history effect (530) runs — two effects can't share one
  one-shot flag. Use a DEDICATED `seededRef` (set true when load seeds
  `historyRef`, read+consumed only by the history effect). Do NOT guard on
  `historyRef.length === 1` — the first real edit happens while length is still 1
  and would be skipped (first Undo dead).
- **M12 (Medium):** immediate re-enqueue on failure + `processSaveQueue`
  re-fire (`:346`) = hot-loop on a deterministic 4xx (Zod validation reject).
  PRIMARY strategy: keep-dirty, retry on next edit + backoff/failure-ceiling.
  Re-enqueue only with backoff.
- **L4 (Low):** push `slice(-50)` → 51 (`:538`), redo `slice(-49)` → 50 (`:804`),
  undo redo-stack `slice(-19)` → 20 (`:787`). Align the push to `slice(-49)` so
  the cap is exactly 50; note the asymmetry so all three agree on intent.
- **StrictMode:** flush in unmount-only effect is benign (queue empty at mount);
  ensure beacon/listener add+remove balanced.

## Related Code Files
- Modify: `client/src/pages/EditorPage.jsx` (save queue 305-376, autosave effect 507-527, history effect 530-545, load effect 379-401)
- Create: `client/src/pages/editor-autosave-lifecycle.test.jsx` (or co-located unit test extracting the save-queue/flush logic if it can be pulled into a testable helper)
- Consider extract: `client/src/hooks/use-editor-save-queue.js` — only if needed to make C1 unit-testable without mounting the 62k-LOC page (KISS: prefer a thin extraction over a full page render).

## Implementation Steps (TDD)
1. **Verify media inlining first:** confirm whether presentations embed base64
   data-URLs or reference uploads by URL (SHA256 dedup per CLAUDE.md). Sizes the
   <64KB keepalive risk. Document the finding.
2. **Test first (C1):** drive the save-queue flush with a spy persist fn, schedule
   a save, trigger unmount + `beforeunload` → assert persist called once with the
   queued snapshot (PUT). Extract minimal queue into `use-editor-save-queue.js`
   (injectable persist) if needed to avoid mounting the 62k-LOC page. **Also test
   the EditorPage CALL SITE** consumes the extracted module (not just the module
   in isolation).
3. Implement flush via `fetch(...,{method:'PUT',keepalive:true})` in the
   **unmount-only effect** (`~521-527`) + a `beforeunload` listener. Idempotent
   drain (null `queuedSaveRef` before send). Size-guard with sync fallback.
4. **Test first (A→B nav):** schedule save for A, change `presentationId` to B →
   assert A's queued save drained before B loads.
5. Drain queue at top of load effect (`379-401`) before overwriting state. Also
   reset `saveInFlightRef`/`queuedSaveRef`/bump `saveAttemptRef` (covers S5).
6. **Test first (M11):** fresh load (null→loaded) → history length 1, Undo
   disabled, `hasChanges` false. THEN: first real edit → history length 2, Undo
   enabled (guards against the `length===1` trap).
7. Fix M11 with a dedicated `seededRef` consumed only by the history effect.
8. **Test first (M12):** failed persist (deterministic 4xx) → assert NO hot-loop
   (persist not called >1× without a new edit); dirty flag retained; next edit
   resends.
9. Fix M12: keep-dirty primary + backoff; no bare immediate re-enqueue.
10. **Test first + fix L4:** assert history length never exceeds 50; align push to
    `slice(-49)`.
11. `npm run test` for the new files; `npm run lint`.

## Success Criteria
- [ ] Media-inlining question answered (sizes the keepalive risk)
- [ ] C1 test: queued edit flushes on unmount AND `beforeunload` via PUT; call site verified; no loss
- [ ] A→B nav test: pending save drained before switching presentations
- [ ] M11 test: fresh load → history 1, Undo disabled; first edit → history 2 (no skipped undo)
- [ ] M12 test: failed save does NOT hot-loop; retries on next edit
- [ ] L4 test: history length never exceeds 50
- [ ] lint clean, existing EditorPage tests still pass

## Risk Assessment
- **Risk:** `keepalive` PUT may silently drop payloads >64KB (data-URL media). **Mitigation:** measure size; sync best-effort fallback + warn; verify media is URL-referenced not inlined (step 1).
- **Risk:** flush in the wrong effect spams saves. **Mitigation:** unmount-only effect (`521-527`), never the per-edit autosave cleanup.
- **Risk:** M11 `seededRef` mis-scoped re-introduces the duplicate or eats first-edit undo. **Mitigation:** test BOTH fresh-load AND first-edit cases (step 6).
- **Risk:** M12 re-enqueue hot-loops the API. **Mitigation:** keep-dirty primary, backoff on re-enqueue, failure ceiling.
- **Risk:** double-write if cleanup + `beforeunload` both fire. **Mitigation:** idempotent drain (null ref atomically before send).

---
title: 'P0 Oversized Unload Persistence And Reconciliation'
description: 'Mandatory follow-up for the unproven oversized beforeunload save receipt; design an offline draft and reconciliation path before claiming unload durability.'
status: blocked
progress: 100
priority: P0
branch: 'master'
tags: [persistence, unload, data-integrity, offline-draft, reconciliation]
created: '2026-07-16T11:25:00+07:00'
createdBy: 'ak-cook'
blockedBy: []
blocks: []
---

# P0 Oversized Unload Persistence And Reconciliation

## Decision

This follow-up is a mandatory release blocker for `260711-1038-editorpage-ui-ux-remediation-deep-tdd`. At creation, the editor had no proven real-browser receipt for an oversized pending save during tab close or unload. The client now has a durable draft and explicit reconciliation path with focused durability evidence, but the P0 full release gate and Phase 9 are currently **BLOCKED** until the live white-overlay failure is fixed and a valid green full E2E run completes. The current block is not an unload-durability regression.

## Evidence

- `client/src/hooks/use-editor-save-queue.js` selects synchronous XHR when its JSON string body length exceeds the local `60 * 1024` keepalive ceiling.
- Before this follow-up, `client/src/hooks/editor-controller/use-editor-save-controller.js` dispatched that XHR during teardown and swallowed transport errors with no recovery channel; the current implementation retains a browser draft before dispatch.
- `tests/e2e/autosave-flush-on-leave.spec.js` proves a small pending edit survives route navigation; it is not an oversized tab-close receipt test.
- Phase 1 and Phase 9 explicitly require either a real-browser oversized receipt or a separate blocking P0 persistence plan.
- The save controller still clears `queueRef` before awaiting `persist`, so teardown during an unresolved PUT can leave no entry for `flush` to resend; the durable draft now preserves the latest snapshot when that happens and a later rejection arrives after unmount.

## Scope

Design and implement a durable offline draft / reconciliation protocol for pending oversized editor saves, including browser lifecycle transport, generation and idempotency continuity, recovery after a failed or interrupted unload, user-visible reconciliation, cleanup, and real-browser evidence. Preserve existing presentation JSON semantics and the current normal autosave/save-conflict contracts.

## Out of scope

No unrelated EditorPage UI redesign, PPTX fidelity work, backend schema redesign outside the persistence contract, threshold weakening, snapshot updates used to hide behavior drift, or deletion/reset/stash of dirty working-tree files.

## Implemented protocol

- Every queued editor save records the normalized snapshot, route identity, aggregate-generation authority, idempotency key (when supported), and save attempt in a durable browser draft before the network mutation begins.
- `localStorage` is written synchronously first so the supported Chromium/Electron path has a receipt before teardown; IndexedDB is used when the synchronous store is unavailable or exceeds quota. Storage failures remain visible through a non-payload warning and the normal transport still runs.
- A successful response clears only the matching draft identity. Older in-flight completions cannot delete a newer queued draft. Failed, rejected, and teardown-interrupted requests retain the draft for the next route load.
- The existing PUT keepalive/synchronous transport remains unchanged and still carries the same generation and idempotency fields. The durable draft is the recovery channel when an unresolved request is removed from the in-memory queue during teardown.
- On reload, the remote presentation is loaded first and a matching local draft is presented in an explicit alert dialog. `Recover Local Draft` reapplies the draft and retries with the preserved generation/idempotency identity; `Use Remote` discards only that draft. No local content is applied automatically.
- Draft cleanup is explicit and route-scoped. Unreconciled records remain until a matching committed response or an explicit remote choice; no presentation payload is logged.

## Acceptance criteria

1. A deterministic real-browser test creates a pending snapshot larger than the keepalive ceiling, closes/reloads the page, and observes a durable receipt or a documented durable draft—not an unobserved fire-and-forget request.
2. Interrupted, rejected, duplicated, and out-of-order recovery cases—including teardown during an unresolved in-flight PUT—preserve the latest local snapshot, aggregate-generation authority, and idempotency-key semantics without duplicate logical saves or silent loss.
3. Reconciliation clearly distinguishes remote, local, and unresolved states and requires explicit user action before replacing local content.
4. Normal small-payload route-flush, autosave debounce, transient retry, stale-generation conflict, and teardown behavior remain green.
5. Browser support limits and failure telemetry are documented without logging presentation payloads or credentials.
6. Focused unit, integration, real-browser lifecycle, full E2E, lint, build, and relevant load gates pass with unchanged repository thresholds.

## Required phases

1. Capture a RED real-browser oversized-close receipt and failure matrix using deterministic fixtures; do not claim current sync XHR as durable evidence.
2. Choose and document the offline draft storage/reconciliation boundary and threat/data-retention model.
3. Implement the smallest compatible transport and recovery protocol test-first.
4. Add explicit conflict/reconciliation UI and lifecycle cleanup.
5. Run focused and full release gates; retain traces and receipt evidence.

## Current verification

- Focused draft/editor matrix (2026-07-17 resume): **14 files passed, 71 tests passed** (includes async Use Remote cleanup fencing, retry-before-successor documentation, recovery dialog Escape/focus trap).
- Real-browser oversized recovery: **2/2 Chromium tests passed** — durable draft + explicit `Use Remote`, and explicit `Recover Local Draft` re-applies local title then retries remote PUT.
- Existing small-payload route-flush browser contract: **1/1 Chromium test passed**.
- Corpus opaque-relationship-closure (prior full-coverage timeout): **3/3 corpus-tier-audit tests pass** (~4.7s) after per-part edited package caching.
- API load smoke: **passed** after purging ~52 MB leftover load fixtures and adding permanent per-iteration cleanup in the k6 script (p95 `http_req_duration` ~35ms, leftover load rows 0). WS smoke: **passed**.
- Full `npm run lint` + `npm run build` (2026-07-17 resume): **0 errors** / **passed** (2,297 modules).
- Full coverage reconfirm (2026-07-17 resume): **466 passed / 1 skipped** files, **3636 passed / 3 skipped** tests, exit 0 (~20.3 min). Corpus opaque relationship-closure green (~6.7s inside full suite). Prior M2 residual failure gone.
- API load smoke reconfirm: p95 `http_req_duration` **35.35ms**, `http_req_failed` **0%**, cleanup 100%. WS smoke: room join **100%**, p95 connect **3.78ms**.
- Consistency scan (touched P0/editor scope): no `it.skip`/`todo`/`fails`; no `useEditorStore` zoom or editor axe baseline residue; `editor-small-screen-guard` is intentional mobile UX; canvas pointer transport remains pointer-event based (remaining `onMouseDown` only in table/name-picker element chrome).

Full Playwright E2E reconfirm (2026-07-17 resume): **507 passed**, 21 intentional skips, **1 failed + 1 flaky** on known live black/white overlay suite; exact file re-run with `--trace=on` → **3/3 passed**. Matches prior Phase 9 one-rerun release policy. The localStorage receipt path is proven for Chromium; IndexedDB fallback and storage-unavailable remain documented support limits.

Historical stable-source release rerun (2026-07-18): **3/3 P0 lifecycle E2E tests passed** (oversized `Use Remote`, oversized `Recover Local Draft`, and small-payload route flush); full coverage **470/471 files and 3686/3689 tests passed** with configured thresholds green; strict PPTX **11/11 corpus + 3/3 smoke**, full PPTX browser audit **6/6**, API p95 **178.32ms**, and WS p95 connect **3.99ms**. This preserves the supported Chromium localStorage-first durability evidence, but does not supersede the current full release decision.

Current full E2E release gate (2026-07-20): **BLOCKED**. The valid isolated serial current-tree run `clean-e2e-20260720-final-direct-api` exited 1 after 6.1m with **530 total / 508 passed / 1 failed / 21 skipped**. Its only failure was `tests/e2e/live/black-and-white-screen-overlay-viewer-keyboard.spec.js:54-60`: after `W`, the viewer remained `Waiting for presenter` and no white overlay appeared. Playwright worker API-base propagation is verified but partial: the config guard passed 9/9 and the no-env four-worker candidate probe passed 68/68; helper API calls go direct, while some raw Playwright request calls still route through Vite. No preview/server exit or shared-build `ENOENT` occurred; the concurrent-build `ENOENT` run is invalid evidence, not a product failure. The P0 full release status remains **BLOCKED** until that live-overlay issue is fixed and a valid full E2E run is green.

## Code review (2026-07-17)

- Report: `plans/260716-1125-p0-unload-persistence-reconciliation/reports/260717-code-review-p0-unload-persistence.md`
- Score: **8.8/10** — Verdict: **PASS-WITH-NOTES**
- Auto-approve for `cook --auto`: **NO** (requires ≥9.5)
- Critical / High: **0**
- At the 2026-07-17 review, acceptance criteria 1–6 were recorded **MET** (full coverage 466/3636; full E2E 507 passed + exact black/white overlay trace rerun 3/3 under Phase 9 one-rerun policy). The current full release status is separately **BLOCKED** by the 2026-07-20 live white-overlay E2E failure.
- Medium follow-ups resolved:
  1. **Fixed:** draft-unavailable notice now says remote save *will still be attempted*.
  2. **Waived:** clearing `failedEntryRef` on every `scheduleSave` broke intentional retry-before-successor (same idempotency key); unit test documents the contract; callers drop failed bodies via `discardPendingSave` / `clearFailedSave`.
  3. Controllers still exceed 200 LOC (hygiene only; not a durability defect).

## Next steps

1. ~~Fix Medium #1–#2~~ done (M1 fixed, M2 waived with unit coverage).
2. ~~Optional E2E for `Recover Local Draft`~~ done (Chromium 2/2 oversized suite).
3. ~~Full coverage reconfirm~~ done (466/3636 green).
4. ~~Full Playwright E2E reconfirm~~ done (507 + exact overlay 3/3 under one-rerun policy).
5. Keep IDB/private-browsing/hard-kill-before-async-IDB as documented non-guarantees (no product claim beyond Chromium/Electron localStorage-first path).
6. Fix the live white-overlay failure and rerun a valid isolated serial current-tree full E2E gate; keep the P0 full release status **BLOCKED** unless that run is green.

## Browser support and retention limits

The receipt uses browser storage available to the active origin. Chromium and Electron normally provide the synchronous localStorage path; IndexedDB is the fallback when localStorage quota or availability prevents that write. Private browsing, disabled storage, quota exhaustion in both stores, or a hard process kill before an asynchronous IndexedDB transaction commits cannot provide a receipt and remain an explicit unsupported durability case. The UI does not claim successful recovery in that case.

Records are keyed by `presentation:<id>` or `template:<id>`, contain only the editor snapshot and save metadata, and are removed after a matching committed response or explicit `Use Remote`. An unresolved record is retained across reloads until the user reconciles it. No payload, credential, or idempotency value is written to logs.

## Unresolved questions

- Should a future release add a server-side receipt endpoint for storage-disabled/private-browsing deployments, or keep those browser modes unsupported?
- Should retention gain an expiry/size budget after product defines the maximum acceptable offline draft lifetime?

## Release rule

Unload-durability AC for this P0 plan remain met on the supported Chromium receipt path. Parent Phase 9 may regard the unload-durability blocker as cleared, but the current P0 and Phase 9 full release status is **BLOCKED** by the live white-overlay E2E failure until a valid green full E2E run completes. This is not a persistence-protocol regression.


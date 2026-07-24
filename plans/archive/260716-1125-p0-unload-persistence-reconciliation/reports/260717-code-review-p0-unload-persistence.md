## Code Review Summary

**Plan:** `plans/260716-1125-p0-unload-persistence-reconciliation`  
**Parent:** Phase 9 / `260711-1038-editorpage-ui-ux-remediation-deep-tdd`  
**Reviewer role:** Staff engineer code review (P0 unload persistence + Phase 9 release-gate fixes)  
**Date:** 2026-07-17  
**Score:** **8.8 / 10**  
**Verdict:** **PASS-WITH-NOTES**  
**Auto-approve for `cook --auto`:** **NO** (needs ≥9.5 and 0 critical; score 8.8)

### Scope
- Files reviewed:
  - `client/src/utils/editor-draft-store.js` (+ test)
  - `client/src/hooks/editor-controller/use-editor-save-controller.js` (+ test)
  - `client/src/hooks/editor-controller/use-editor-persistence-controller.js` (+ test)
  - `client/src/hooks/editor-controller/use-editor-recovery-controller.js`
  - `client/src/hooks/editor-controller/editor-save-attempt.js`
  - `client/src/components/editor/save-recovery-dialog.jsx` (+ test)
  - `client/src/components/editor/editor-page-chrome.jsx` (wiring)
  - `tests/e2e/autosave-oversized-recovery.spec.js`
  - `server/services/pptx-import/package-store/corpus-tier-audit.test.js`
  - `tests/load/k6-load-test-api-presentations-post-endpoint-with-profiles.js`
- Lines of code analyzed: ~2.5k (impl + focused tests)
- Review focus: P0 durable draft / reconciliation + release-gate side fixes
- Updated plans: `plan.md`, this report

### Overall Assessment
Protocol is sound: sync localStorage-first draft before network, identity-fenced clear, remote-first load, explicit alertdialog, generation/idempotency continuity, route-epoch fencing on conflict resolution. Unit matrix + oversized Chromium E2E cover the durability claim. Load cleanup is loopback-guarded + permanent-delete for created IDs only. Corpus opaque-path timeout fix is a pure test perf cache.

No critical security/data-loss regressions found in reviewed paths. Remaining issues are correctness polish, messaging, and hygiene — not release blockers for the P0 durability claim if gates already green as reported.

---

### Acceptance criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Durable oversized draft receipt + remote-first reconciliation UI | **MET** | Draft written sync in `scheduleSave` via `writeLocal`; E2E asserts localStorage receipt >60KiB, reload shows remote title + alertdialog |
| 2 | Interrupted/rejected/OOO recovery preserves latest snapshot/gen/idempotency | **MET** | Draft identity fencing in `canClear`/`matchesIdentity`; save-controller tests for teardown, route ownership, idempotency rotate; failed transport does not clear draft |
| 3 | Explicit user action before replacing local content | **MET** | Remote loaded first; `SaveRecoveryDialog` requires Recover / Use Remote / Defer; unit + E2E |
| 4 | Normal small-payload flush/autosave/conflict/teardown green | **MET** | Persistence/conflict unit matrix; `autosave-flush-on-leave` reported green |
| 5 | No payload/credential logging | **MET** | Only non-payload `console.warn` / save-fail `console.error(error)`; no draft/body dump |
| 6 | Focused unit/browser, lint, build, load smoke; no threshold weaken | **MET** (claimed) | Review trusts provided gate results; k6 thresholds unchanged; permanent cleanup is additive |

---

### Checklist

| Item | Result |
|------|--------|
| (a) every AC met | Yes |
| (b) no business-logic regression in touchpoints | Yes, with notes on failedEntry vs queue priority |
| (c) no breaking public contracts | Yes — draft is client-only; PUT contract unchanged |
| (d) follows existing patterns | Yes — controller split, alertdialog, store fencing |
| (e) no new lint/type/build errors | Yes (claimed; ESLint/build reported clean) |
| (f) race/fencing correctness | Strong overall; see Medium notes |
| (g) load-test cleanup correct/safe | Yes — loopback assert + permanent delete of just-created id |

---

### Critical Issues
None.

### High Priority Findings
None.

### Medium Priority Improvements

1. **Misleading draft-failure notice (pre-save)**  
   File: `client/src/hooks/editor-controller/editor-save-attempt.js:31-35`  
   When `draftStored` is false, UI says *"the remote save still completed"* **before** `api.updatePresentation` runs. If save then fails, user gets a false completion claim.  
   **Fix:** e.g. *"Local recovery copy unavailable; remote save will still be attempted."* or notify only after success with draft miss.

2. **New `scheduleSave` does not supersede `failedEntryRef`**  
   File: `client/src/hooks/editor-controller/use-editor-save-controller.js:66-68, 93-128`  
   `processQueue` prefers `failedEntryRef` over `queueRef`. After a failed save, a newer edit only fills `queueRef`; next process may replay stale body first, then successor. Eventual draft retention limits loss, but remote can briefly receive stale snapshot and extra write.  
   **Fix:** on `scheduleSave`, clear `failedEntryRef` (or always prefer higher `attemptId` / queue over failed).

3. **Successful sync unload clear may not finish → false-positive recovery**  
   File: `use-editor-save-controller.js:184-186`  
   Sync XHR success schedules async `clearCommittedDraft()`; page may die first. Next load shows recovery despite remote already updated. Not silent loss (user can Use Remote), but noisy. Acceptable residual; document or best-effort `localStorage.removeItem` sync path for clear.

4. **Controller files exceed 200 LOC project cap**  
   - `use-editor-persistence-controller.js` ~281 LOC  
   - `use-editor-save-controller.js` ~268 LOC  
   Recovery already extracted; further split (conflict actions vs load effect) would match repo rule.

### Low Priority Suggestions

1. **E2E covers Use Remote only** — add Chromium path for `Recover Local Draft` + preserved idempotency/title (unit already covers).
2. **Plan/validation docs stale** — still say progress 70% / full gates open; sync after this review + gate evidence.
3. **`canClear` older-or-equal via `updatedAt`** — intentional stale clear; keep tests if identity shape evolves.
4. **Corpus `editedPackages` cache** — correct perf fix; no product risk.
5. **Defer via Escape** — good a11y; ensure product wants Escape = keep draft (not discard). Matches copy.

---

### Fencing notes (item f)

| Mechanism | Assessment |
|-----------|------------|
| `finishTransport` + `processSuccessor: false` on sync XHR | Correct — no async successor during unload |
| `routeEpoch` / `loadEpoch` on load + conflict | Correct — stale Use Remote/Keep Local fenced (tests) |
| Draft identity clear (`draftId` / idempotency / attempt / `updatedAt`) | Correct — older completion cannot drop newer draft (unit) |
| Use Remote async cleanup fence | Correct — `discardPendingSave` + epoch checks; functional `setSaveRecovery` identity compare on dismiss |
| `flushTransportRef` / `inFlightEntryRef` mutual exclusion | Correct |
| `writeEditorDraft` local-first then IDB chain | Correct for Chromium receipt; IDB/private modes documented unsupported |

### Side-effect risks
- Orphan drafts until user revisits route / Use Remote (by design).
- localStorage size pressure for huge decks (quota → IDB/async → weaker unload guarantee).
- Load-test permanent delete is destructive only for IDs created in-iteration; `setup()` enforces loopback — do not point `API_BASE_URL` at shared non-loopback hosts (guard throws).
- False recovery dialog after successful unload when clear races teardown (UX only).

### Positive Observations
- Clear separation: draft store / save attempt / save controller / recovery / persistence.
- Remote-first load + explicit alertdialog with focus trap + Escape defer.
- Identity-aware clear is the right antidote to out-of-order completions.
- `preserveIdempotencyKey` on recover + rotation on next edit is correct.
- E2E proves receipt **before** relying on unobserved sync XHR.
- k6 permanent cleanup addresses p95 residue without weakening thresholds.
- Corpus test caches edited zip per adjacent part — fixes timeout without relaxing assertions.

### Recommended Actions
1. Fix draft-unavailable notice wording (Medium #1) — small, high clarity.
2. Supersede `failedEntryRef` on newer `scheduleSave` (Medium #2) + one unit test.
3. Optionally E2E Recover Local path (Low).
4. Refresh plan progress/status + validation-report gate table.
5. No threshold changes; keep IDB/private-browsing as documented non-guarantees.

### Metrics
- Type Coverage: N/A (JS)
- Test Coverage: focused 14 files / ~70 tests claimed green; browser 2/2 claimed
- Linting Issues: 0 on P0 files (claimed)
- File size: 2 controllers over 200 LOC guideline

### Unresolved questions
- Product: server-side receipt for storage-disabled browsers (plan open question)?
- Product: draft retention TTL / size budget?
- Parent Phase 9: close only after this P0 plan status → completed + parent gate checklist updated?

---

**Auto-approve decision:** **Reject auto-approve.** Score 8.8 < 9.5. Zero critical, but Medium #1–#2 should be fixed (or explicitly waived) before treating cook auto-path as clean.

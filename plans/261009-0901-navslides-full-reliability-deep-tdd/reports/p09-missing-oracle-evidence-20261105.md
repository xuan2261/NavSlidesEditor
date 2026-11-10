# P09 missing-oracle evidence — 2026-11-05

Scope: lane confirmed by user ("thực hiện tiếp đi", 2026-11-05) — supplement evidence for P09-09/10/12/13, the four oracles the 06–10 joint reconciliation (2026-11-04) listed as missing from the crash matrix, plus record the full P09-01–15 mapping from the two fresh focused receipts. No commit, no publish, no gate promotion, no phase 10 lane in this step.

## Receipts (fresh, current worktree)

- `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p09-existing-protection-20261105-run1.json` — vitest JSON, success true, 10 suites passed, 87 tests passed, 0 failed, wall 28.06s.
  Command: 5 files — restart-recovery, package-store, pptx-import-crash-points, project-import-media-session, project-import. Binary `C:/nvm4w/nodejs/node.exe` v22.22.0.
- `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p09-recovery-startup-20261105-run1.json` — vitest JSON, success true, 6 suites passed, 45 tests passed, 0 failed, wall 113.24s (background job bg_22).
  Command: 3 files — index-project-recovery, index-health, media.
- Combined: 132/132 passed, 0 failed.

Note: `index-project-recovery.test.js` is the Create file in phase-09 Tests After (actual startServer kill/restart cross-store proof); `media.test.js` / `index-health.test.js` likewise. The two commands above are exactly the two `Tests After` commands in phase-09-pptx-recovery.md.

## Oracle mapping

- P09-01 (C, kill after blob commit before root): CONCEPT-MAPPED, not ID-named — restart-recovery.test.js "retains immutable bytes and validates root/WAL after death at blob" — PASS. The orphan-audit / original-not-GC aspect is the same test's byte/hash validation, not a separately named orphan-audit assertion.
- P09-02/03/04 (C, kill after root / JSON apply / visibility): ID-named, grouped — index-project-recovery.test.js "P09-02/03/04/14 recovers pptx-root / pptx-json / pptx-visible through startup with exact HTTP Original/media" x3 — actual startup, exact HTTP Original/media — PASS.
- P09-05 (H, kill after media placement before checkpoint): ID-named, grouped — "P09-05/14/15 retains uncertain project-placement / project-checkpoint / pptx-media intent and blocks admission after restart" x3 — PASS.
- P09-06 (H, kill after row insert before media owner commit): ID-named, grouped — "P09-06/08/15 recovers project-committing / project-row / project-committed once before readiness and preserves winner media" x3 — PASS.
- P09-07 (H, rollback write fails and restart): ID-named — "P09-07/11 preserves failed rollback authority and winner bytes after real death" — PASS.
- P09-08 (H, repeated restart/reconcile): ID-named, grouped — inside the P09-06/08/15 group ("recovers ... once before readiness"); no dedicated multi-restart-loop test — the once-only recovery plus the P09-15 bounded-timeout test are the evidence; repeated-restart no-regression is not a standalone named run.
- P09-09 (H, corrupt newest root/predecessor): ID-named — restart-recovery.test.js "P09-09 validates every retained root; all corrupt = false / true" x2 — PASS.
- P09-10 (H, stale writer epoch after reopen): EMBEDDED, not ID-named — fencing check inside the 4 parameterised tests "retains immutable bytes and validates root/WAL after death at blob / prepared / root / completed" (restart-recovery.test.js:72-75, stale epoch → mutate rejects /fencing/i, state hash unchanged), all 4 pass. Explicit final mapping for P09-10 remains open per the evidence ledger — do not infer a named P09-10 pass from this.
- P09-11 (H, cleanup attempt contains winner / other session): ID-named — same "P09-07/11 preserves failed rollback authority and winner bytes after real death" test — PASS.
- P09-12 (M, disk full / permission denied): ID-named — "P09-12 keeps the previous authority on ENOSPC / EACCES before root rename" x2 — PASS, with caveat: injected error codes, not real disk-full or Linux permissions; do not infer power-loss / Linux-permission durability from process kill / injected EACCES.
- P09-13 (C, truncated/corrupt/unreadable session ledger then create new session): ID-named — index-project-recovery.test.js x4: "P09-13 corrupt ledger survives actual startup and readiness rejects admission"; "P09-13 malformed ledger schema blocks all HTTP mutations and keeps read visibility: []"; same with a foreign-schema variant; "P09-13 unreadable ledger starts live but remains degraded without replacing its intent" — PASS. Supporting: project-import-media-session.test.js ran inside batch 1 (87/87, 0 failed), so its P09-13 ledger-preservation variants ("preserves invalid durable ledger instead of admitting over it", "preserves unreadable ledger and its intent instead of resetting it") also passed there.
- P09-14 (C, kill PPTX route after shared-media publication before commit/checkpoint): ID-named, grouped — inside the P09-02/03/04/14 and P09-05/14/15 groups — PASS.
- P09-15 (H, startup still committing / session uncertainty / recovery timeout): ID-named — "P09-15 bounded recovery timeout stays degraded and retains the durable intent" (standalone) plus grouped in P09-06/08/15 and P09-05/14/15 — PASS. Plus index-health.test.js "separates liveness from startup, recovery degradation, and shutdown readiness" — PASS.

## Existing-protection GREEN

Recorded: 132/132 above, on current worktree, no code change in this lane. This is the phase-09 focused subset (the two Tests After commands), not a full suite run. The index-project-recovery tests are actual startServer / process-death HTTP proof, per the phase's actual kill/restart requirement; no power-loss / fsync claim is made from process kill.

## Still NOT closed, NOT VERIFIED

- Gate 09 remains OPEN pending exit reconciliation: this report supplements evidence but does not promote any gate.
- P09-10 has no ID-named test; exit reconciliation must judge whether the embedded fencing check in the 4 parameterised tests satisfies the exit gate, or an explicit P09-10 named test is required.
- P09-01 has no ID-named test (concept-mapped via the blob-death parameterised test); the same judgment applies.
- P09-08 repeated-restart evidence is grouped once-only recovery, not a dedicated multi-restart loop.
- P09-12 is injected-error evidence only; real disk-full / Linux-permission / power-loss durability remain NOT VERIFIED.
- Backup/restore runbook proof (phase doc: restore a backup at a temp root before recommending production) remains open per the phase execution note.
- The joint receipt (04/11) still declares only P09-01–08/11/14/15; the 4 missing oracles above are evidenced by focused test receipts, not by a new joint runtime smoke.

## Next step (not run here)

Run phase 09 exit reconciliation against this mapping + the two receipts above, and decide: close gate 09, or require explicit P09-10 (and/or P09-01) ID-named tests first. Do not run phase 10 until that decision is made.

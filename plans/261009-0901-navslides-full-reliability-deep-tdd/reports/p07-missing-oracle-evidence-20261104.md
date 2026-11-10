# P07 missing-oracle evidence — 2026-11-04

Scope: lane confirmed by user (supplement evidence for P07-02/03/04/05/06/08/09/13/14 + record existing-protection GREEN). No commit, no publish, no gate promotion, no phase 08-10 lane in this step.

## Receipts (fresh, current worktree)

- `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p07-existing-protection-20261104-run1.json` — vitest JSON, success true, 14 suites passed, 107 tests passed, 0 failed, wall 30.40s.
  Command: 7 phase-07 files — pptx-import-crash-points, pptx-import-durable-job, pptx-import, package-store/lifecycle, compatibility-outbox, package-backed-presentation-read, package-store-runtime-lock-order.
- `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p07-acceptance-20261104-run1.json` — vitest JSON, success true, 2 suites passed, 8 tests passed, 0 failed, wall 4.78s.
  File: server/services/pptx-import/package-store/publication-acceptance.test.js.
- Combined: 115/115 passed, 0 failed.

Note: publication-acceptance.test.js is NOT in the 7-file list in phase-07-pptx-publication.md Tests After, but it is the only file holding P07-04/05/06. The phase doc list alone does not cover all 9 oracles.

## Oracle mapping

- P07-02 (C, projection row right ID wrong generation/hash): pptx-import-crash-points.test.js — "P07-02: live and durable GET withhold done after raw publication identity diverges" — Express app + live/durable GET — PASS.
- P07-03 (C, outbox apply ok, ack fails): compatibility-outbox.test.js — "P07-03: a mismatched captured payload cannot acknowledge the queued publication" plus "keeps an unacknowledged write durable when applying it fails" and "ignores compatibility writes older than the stored package generation" — store-level — PASS with caveat: no single test named retry; retry-no-duplicate/no-regress is the combination of ack-guard + older-write ignore, not one end-to-end retry run.
- P07-04 (H, malformed outbox): publication-acceptance.test.js — "P07-04 rejects malformed outbox" x4 variants (schema, generation, operation, destination) — real package store reopened, state and Original preserved — PASS.
- P07-05 (H, pending projection then duplicate/template): publication-acceptance.test.js — "P07-05 refuses pending retained-template instantiation without a partial destination" — PASS.
- P07-06 (H, template source changes before commit): publication-acceptance.test.js — "P07-06 rejects a template head changed at admission with no partial destination or stale replay" — PASS.
- P07-08 (H, cancel before/after publication): CONCEPT-MAPPED, not ID-named — pptx-import-crash-points.test.js CP5 (cancel during mapping, pre-publish: no head, cancelled, no list row), CP6 (cancel after publish pre-drain: rollback, non-openable, no ghost openable done), CP7 (cancel after listable drain: complete as done, post-visibility no-op delete policy); plus pptx-import.test.js cancel lifecycle tests — PASS.
- P07-09 (H, durable completed job, in-memory map lost): CONCEPT-MAPPED, not ID-named — pptx-import-crash-points.test.js CP4 (completeJob never called, Map miss: durable openable done + reportSummary) and CP8 (restart clear Map then GET: visibility-safe durable payload); pptx-import-durable-job.test.js (durable completed receipt after in-memory TTL; persisted receipt after in-memory job unavailable; late package-backed completion reconciled by durable job identity; R4/Clear Map durable GET) — PASS.
- P07-13 (C, production drain dead-letters every write, resolves 0): pptx-import-crash-points.test.js — "P07-13: a production drain that dead-letters every write never publishes openable live or SSE done" — live GET + SSE + durable pending-visibility — PASS.
- P07-14 (C, raw row wrong head, resolver returns new head): package-backed-presentation-read.test.js — "P07-14: rejects a persisted" x3 variants (missing-head, wrong-generation, same-generation-wrong-hash) — list + direct real readers, quarantine, raw row untouched, Original preserved — PASS.

## Existing-protection GREEN

Recorded: 115/115 above, on current worktree, no code change in this lane. This is the phase-07 focused subset plus publication-acceptance, not a full suite run.

## Still NOT closed, NOT VERIFIED

- Gate 07 remains OPEN pending exit reconciliation: this report supplements evidence but does not promote any gate.
- Runtime joint receipt still declares only 5 scenario IDs (P07-01/07/10/11/12); the 9 oracles above are evidenced by focused test receipts, not by a new joint runtime smoke.
- P07-08/09 have no ID-named test; exit reconciliation must judge whether concept-mapped CP/durable tests satisfy the exit gate, or explicit P07-08/09 tests are required.
- P07-03 retry is combination evidence, not a single named retry test.
- bg_1 PUBLICATION_BARRIER_DEADLINE stall cause remains NOT VERIFIED (exit gate section itself has no root-cause requirement, and no oracle failed in this run).

## Next step (not run here)

Run phase 07 exit reconciliation against this mapping + the two receipts above, and decide: close gate 07, or require explicit P07-08/09 ID-named tests (and/or a P07-03 named retry test) first. Do not run phases 08-10 until that decision is made.

# Journal — PPTX Import Reliability Cook (2026-07-26)

## Session

`/ak:cook` of `plans/260726-0616-pptx-import-reliability-ux-evidence-hardening-deep-tdd` with `--auto --tdd`.

Branch: `feature/pptx-import-reliability-ux-evidence-hardening`

## Delivered

- Phase 1 baseline inventory + green characterization
- Phase 2 client wait: absolute budget reserve, SSE final GET, typed cancelled/pending-visibility, no destructive reconcile
- Phase 3 partial: monotonic progress, durable DELETE Contract B, bulk missing-head isolation + headers, explore/sync policies
- Phase 4 partial: preserve `output-empty` type; EMF narrow env
- Phase 5 partial: external DTO report summary-only
- Phases 8–10 handoff status record; Phase 11 release matrix with residual honesty

## Verification

- Focused unit: 79/79 pass
- Route suite `pptx-import.test.js`: 19/19 pass after reverting Map-path listable re-check (durable path keeps Contract B)
- Code review: 7.5/10 delivered slices; no critical on stated ACs

## Residual cook (same day, second pass)

- Per-job control capability (202 handoff, header + SSE query-only, durable controlCapabilityHash)
- failJob type/code/stage on Map DTO
- Home typed pending-visibility / unknown / reconcile-required
- Review fixes: query capability SSE-scoped; negative auth tests; structured failJob unit tests
- Tester residual suite: **115/115 PASS**

## Closeout pass

- Multipart idle/total timeouts + abort cleanup
- Poisoned outbox per-record dead-letter isolation
- EMF absolute binary default + narrow env
- Background data URL aggregate mediaBudget reserve
- Retention dry-run module (default-off, non-destructive)
- PptxImportReportPanel + tests (no jobId/path leak)
- Plan status completed; release matrix terminal ACCEPT best-effort

## Deferred beyond best-effort claim

- Physical StateStore/WAL compaction enablement (policy gate)
- Full multi-state repair saga expansion
- Package-first G0–G5 / PowerPoint oracle (sibling/external)
- Full corpus/oracle re-run ops

## Dirty worktree note

Did not overwrite pre-existing dirty sibling plans or `.tmp`/`xuatN26th7`.

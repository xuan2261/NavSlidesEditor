# PM Report — PPTX Import P0 Readiness Cook

**Date:** 2026-07-24  
**Plan:** `plans/260722-1630-pptx-import-p0-readiness-remediation-deep-tdd`  
**Mode:** `/ak:cook plan.md --auto --tdd`

## Brainstorm contract (reused)

| Field | Value |
| --- | --- |
| Outcome | Best-effort import usable; P0 transport/evidence contracts truthful, hash-bound, fail-closed |
| Constraints | Package authority/idempotency preserved; public best-effort preserved; TDD; no unrelated dirty overwrite |
| Non-goals | Full AbortController lifecycle, durable outbox, EMF/native parity, editable charts, OfficeCLI, multi-tenant auth, P2/P3 perf |
| Acceptance | Unit/integrity green; truth gates pass or structured-blocked; never relabel unavailable as qualification |

## Progress

| Phase | Status | Notes |
| --- | --- | --- |
| 1 Rate limit + Retry-After | Completed | Software + tests |
| 2 Evidence + strict contract | Completed | Qualification fail-closed on native gaps |
| 3 Package-backed journey | Completed | reasonCode + rollback identity repairs evidenced |
| 4 PowerPoint visual oracle | **Blocked** | Software contracts complete; physical evidence missing |

**Plan YAML status:** `blocked` (unchanged — intentional)

## Software completion %

- Checklist software items: complete  
- Physical evidence items: open (2 todos + 3 success criteria)  
- Overall plan: software ~100%, claim-capable Phase 4 evidence 0%

## Verification this cook

| Gate | Result |
| --- | --- |
| Phases 1–3 focused Vitest | 12 files / 140 pass |
| Phase 4 oracle Vitest | 13 files / 104 pass |
| Tester independent re-run | 22 files / 224 pass; lint 0 errors |
| Importer qualification | exit 1 structured native blockers (correct) |
| Oracle integrity (no manifest) | exit 1 `missing-evidence-manifest` (correct) |
| Code review | 8.5/10, 0 critical → auto-approve software |

## Change this cook

- Fixed `docs/pptx-visual-evidence-runbook.md`: remove forbidden `--actual-manifest-out`; document published `run-*/actual-manifest.json`
- Plan/phase validation logs updated

## Docs impact

- Runbook operator fix only (authority surface for Phase 4 capture ops)
- No claim promotion in fidelity/limits docs
- Docs-manager full refresh: not required

## Next actions (human / environment)

1. Produce controlled Microsoft PowerPoint goldens for exact 11-deck corpus (hashes + contiguous all-slide PNGs)
2. Build local evidence envelope + three role receipts per runbook
3. Run package-backed capture against isolated loopback
4. Run `test:pptx:oracle:integrity` then `test:pptx:oracle:qualify`
5. Record numeric verdicts; keep claim wording fail-closed until thresholds pass

## Unresolved questions

None design-wise. Physical PowerPoint evidence supply is the only open execution dependency.

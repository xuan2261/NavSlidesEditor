# Best-Effort PPTX Import Release Matrix — 2026-07-26

## Product claim ceiling

| Claim | Status | Evidence |
|---|---|---|
| Best-effort PPTX import usable | **In progress / partial** | Phases 1–5 software hardening this cook |
| Native 1:1 / PowerPoint visual fidelity | **Out of scope** | Not claimed |
| Package-first G0–G5 | **Sibling-owned** | Not required for best-effort release |
| Media crash-safe consistency | **Not claimed** (best-effort cleanup only) | No durable media manifest in this cook |
| Multi-tenant auth | **Not claimed** | Single-user self-hosted |

## Software gates delivered this cook

| Area | Gate | Result |
|---|---|---|
| Baseline inventory | Phase 1 report + green characterization | Pass |
| Client wait | Absolute budget, final GET, typed cancel/pending-visibility | Pass (unit) |
| List isolation | Missing-head quarantine; healthy rows remain | Pass (unit) |
| Contract B DELETE/GET | Non-listable withholds presentationId | Pass (unit) |
| Progress | Monotonic job-manager percent | Pass (unit) |
| output-empty type | classifyError preserves type | Pass (unit) |
| Converter env | Narrow env, no full process.env spread | Pass (unit) |
| External report DTO | Export path summary-only (no full diagnostics/jobId) | Pass (unit) |
| Per-job control capability | POST handoff + GET/SSE/DELETE/reconcile enforcement | Pass (unit + crash) |
| Home typed wait outcomes | pending-visibility / unknown / reconcile-required | Pass (code path) |
| Async fail DTO fields | failJob type/code/stage on Map serialize | Pass (unit wiring) |

## Explicit residuals (do not claim closed)

| Residual | Owner phase | Notes |
|---|---|---|
| Full durable repair saga + provenance RMW | Phase 3 remainder | Not fully implemented this cook |
| Multipart admission idle/total deadlines | Phase 3 remainder | Not implemented this cook |
| Durable StateStore/WAL physical compaction | Phase 6 | Policy dry-run only; default-off |
| Fresh corpus/strict/browser/oracle provenance refresh | Phase 7 | Baseline labels stale inherited numbers as unverified |
| Package-first G0–G5 | Sibling | Handoff only |
| PowerPoint oracle G5 | External | Blocked without trusted bundle |

## Rollback

- Revert branch `feature/pptx-import-reliability-ux-evidence-hardening` or selective commits.
- List isolation is additive (headers); removing isolation reverts to fail-closed bulk throws — avoid partial reverts of reader without presentations/explore/sync together.
- Client wait changes are isolated to `pptx-job-wait.js` + tests.

## Terminal decision (best-effort)

**Software lane improved; full plan acceptance criteria not all met.**  
Recommend: continue Phase 3 saga/capability/multipart before marketing any “release complete” statement. Ship interim reliability fixes only with residual matrix above.

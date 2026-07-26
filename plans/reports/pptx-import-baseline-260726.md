# PPTX Import Baseline Inventory — 2026-07-26

**Plan:** `plans/260726-0616-pptx-import-reliability-ux-evidence-hardening-deep-tdd`  
**Phase:** 1 — Baseline Contracts And Evidence Inventory  
**Branch:** `feature/pptx-import-reliability-ux-evidence-hardening`  
**Claim ceiling:** self-hosted **best-effort** import (not native 1:1, not PowerPoint visual fidelity)  
**Dirty-worktree policy:** do not overwrite user-owned `.tmp/`, `xuatN26th7`, or pre-existing dirty plan/test edits outside this plan’s owned surfaces.

## Policy defaults applied for cook (`--auto`)

| Gate | Default |
|---|---|
| Job authority | Prefer existing package-first hashed per-job capability; UUID secrecy is not auth |
| Missing-head bulk | Read-only classification + isolation; no automatic writer repair |
| Media crash-consistency | Best-effort unless durable job-owned media manifest/replay is implemented |
| Retention | Dry-run / default-off until policy + physical compaction evidence |
| External imported URLs | Block by default |
| G5 trust | Sibling package-first local authority remains owner |

## Evidence lanes (do not cross-promote)

| Lane | Status label | Notes |
|---|---|---|
| Parser-relative corpus | Historical / regression | Audit 2026-07-22: 11/11 decks, avg semantic 100%, reconstructed round-trip stability 63% — not PowerPoint visual |
| Strict importer qualification | **Unverified — do not cite** | Inherited “5/11 pass / 6 blocked / 378 unmapped” **removed from release claims** until a fresh manifest-bound run exists (Phase 7). Source-backed residual example remains `STTre_Duc` unmapped leaves only when re-measured |
| Adversarial / security | Runnable suite | `npm run test:pptx:adversarial` |
| Browser heuristic audit | Historical local | Not a PowerPoint release gate |
| Performance | Runnable + may structured-skip | `test:pptx:perf` / `perf:full` |
| Package-first G0–G5 | Sibling-owned | 0/6 gates closed at plan write; this plan is handoff-only for Phases 8–10 |
| PowerPoint oracle | Externally blocked | No trusted evidence bundle; do not fabricate |

## Characterization inventory (current behavior)

| ID | Finding | Current behavior (source) | Green characterization | Desired owner |
|---|---|---|---|---|
| H2-SSE-NO-GET | SSE deadline skips final GET | `pptx-job-wait.js` `rejectBudgetUnknown` cancels, no poll | `pptx-job-wait.test.js` SSE maxWaitMs + `pollPptxJob` not called | 2 |
| H2-SSE-BUDGET-REUSE | SSE→poll reuses full maxWaitMs | `waitForPptxJob` onerror passes same `maxWaitMs` | characterization: SSE onerror reuses budget | 2 |
| H2-POLL-FINAL-GET | Poll path cancel + final GET | `reconcileAfterDeadline` | existing poll deadline tests | 2 |
| H2-DESTRUCTIVE-RECONCILE | POST reconcile rolls back + deletes | `pptx-import.js` `reconcileDurableImportJob` | durable-job + crash CP10 | 2 (never auto) |
| CB-GET | Contract B withholds id when not listable | `serializeDurableImportJob` + listable false | durable-job + crash CP1/CP6 | 3 |
| CB-DELETE-BYPASS | DELETE finished serializes without listable | `DELETE /jobs/:id` → `serializeDurableImportJob(durable)` | durable-job DELETE non-listable characterization | 3 |
| GHOST-LIST-422 | One missing head fails bulk read 422 | `readAuthoritativePresentations` map throws; list uses `err.status` | package-backed bulk characterization | 3 |
| LISTABLE-PRED | `listable` = row existence, not openability | `isPresentationListable` | crash-points suite | 3 |
| OUTBOX-ACK | Apply then ack; fail keeps outbox | `compatibility-outbox.js` | existing outbox tests | 3 |
| IMPORT-COMMIT | Single owner | `import-commit.js` | crash + package-store | **3 only** |
| TYPE-LOSS-EMPTY | `output-empty` → `parse-failed` via classifyError | `output-usability.js` + `diagnostics.js` + parse-worker wire | diagnostics-output-empty-characterization | 4 |
| EMF-ENV | Full env + bare PATH binary | `emf-wmf-sandbox.js` spawnSync env | emf-wmf-sandbox characterization | 4 |
| BG-DATA-URL | Per-URL allow; no aggregate reservation | map-media / resource-budgets / allowlist | background-allowlist suite | 4 |
| PROGRESS-REGRESS | 80→70 accepted | `normalizePercent` no floor | job-manager characterization | 5 |
| REPORT-EXPORT | Full `_pptxImportReport` may ride presentation into external DTOs | create-imported / compatibility-view keys | partial job reportSummary only; export char deferred | 5 |
| RETENTION-UNBOUNDED | StateStore/WAL history not compacted by job array | state-store lifecycle | deferred physical char (Phase 6) | 6 |
| EVIDENCE-PROV | Perf/oracle provenance gaps | reports + oracle runs | Phase 7 refresh | 7 |

## Ownership ledger (exclusive)

| Phase | Exclusive production areas | Notes |
|---|---|---|
| 1 | Plan/report fixtures only | No production behavior change |
| 2 | `pptx-job-wait.js`, wait/retry in `api.js`, Home import wait slice | Client wait/cancel/deadline |
| 3 | `pptx-import.js`, presentations/explore/sync readers, job manager DTO seams, package-store lifecycle/schemas/index/state-store persistence, outbox/view/reader/import-commit | **`import-commit.js` only here** |
| 4 | Worker/importer/media/mapper/snapshot/guards/diagnostics/report producer/converter/URL | No import-commit edits |
| 5 | Client summary/report panel/editor attachment + export DTO consumer tests | UX/report |
| 6 | New retention module; state-store/index retention-only seams; legacy original helper | Consumes Phase 3 lifecycle |
| 7 | plans/reports + qualification/browser/perf/oracle scripts/manifests | Evidence only |
| 8–10 | Read/link-only handoff records | Sibling owns G0–G5 implementation |
| 11 | README/docs/release matrix/rollback runbook | Terminal best-effort gate |

## Shared readers enumerated

| Caller | Path | Policy note |
|---|---|---|
| Presentations list/detail | `server/routes/presentations.js` | List-wide failure on any authority throw (current) |
| Explore | `server/routes/explore.js` | Uses `readAuthoritativePresentations` |
| Sync bulk + single | `server/routes/sync.js` | Same reader |

## Signal responsibilities (current vs desired)

| Signal | Current | Desired owner phase |
|---|---|---|
| Absolute admission deadline | Home may start wait after POST; SSE/poll budgets independent | 2 — one `deadlineAt` from admission |
| Outer ownership (unmount) | Home AbortController + cancel | 2 keep, tighten |
| Child transport SSE/poll | Shared signal in wait helper | 2 separate child controllers |
| Control-plane DELETE cancel | Same signal path; poll cancel ignores aborted signal | 2 bounded control-plane controller |
| Final GET | Poll path only; SSE budget skips | 2 always remaining-time budget |
| Destructive repair POST | Manual route only | 2 never auto on timeout |

## Async vs sync errors

| Class | Current | Desired |
|---|---|---|
| Sync admission (POST) | HTTP 4xx/413/422/429 as implemented | Preserve |
| Post-202 async failure | `failJob` string message; limited type on worker IPC | Phase 3/4/5 bounded DTO (`failureStatus`, `code`, `type`, `reasonCode`, `stage`) |

## Command results (Phase 1 gate)

Recorded at cook Phase 1:

```text
Pre-char gate: 4 files / 30 tests passed
Post-char focused: 6 files / 40 tests passed
  (job-wait, durable-job, package-backed reader, job-manager,
   diagnostics-output-empty, emf-wmf-sandbox)
Full phase-01 suite (incl. Home + crash + outbox): green except intentional
  none — no red CI tests.
```

## Deferred desired tests

See plan-local `deferred-tests-manifest.md`. No intentional red CI tests.

## Security / redaction

This baseline omits credentials, job capabilities, environment values, raw logs, imported content, and private filesystem paths beyond repo-relative sources.

## Labels glossary

- **characterization** — freezes current behavior; green today  
- **desired** — future invariant; activated only by owner phase  
- **historical** — past artifact, not re-run as release gate without refresh  
- **stale / unverified** — inherited wording without current manifest  
- **externally blocked** — needs operator/evidence outside repo

# Research: Package Store + Job Durability (P1 Lifecycle)

**Date:** 2026-07-24  
**Mode:** read-only  
**Scope:** audit P1 items 4–7 (import report, single compatibility writer, durable job reconcile, crash-point tests) + F-08 / F-10 / F-11  
**Source audit:** `plans/reports/2026-07-22-pptx-import-readiness-audit.md`  
**P0 plan:** `plans/260722-1630-pptx-import-p0-readiness-remediation-deep-tdd/` (phase-03 complete software; durable/outbox work explicitly non-goal)

---

## 1. Verdict

| Area | Status | Severity |
| --- | --- | --- |
| Dual compatibility writers (F-08) | **Still open** | P1 doc/invariant contradiction; no proven row corruption |
| Durable terminal job GET after restart/TTL (F-11 partial) | **Partially fixed** | GET falls back to package-store job; payload incomplete |
| Full warnings persistence / bounding (F-10) | **Still open** | Terminal in-memory only; no ceiling |
| Crash-point coverage around publish/visibility/media/complete | **Still open** | Package WAL faults exist; route lifecycle crash matrix missing |
| P0 phase-03 package-backed E2E + rollback authority | **Done** | Does **not** close dual-writer / warning durability / crash matrix |

**Ranked P1 lifecycle work order:**

1. **Single compatibility writer (outbox-only)** — fixes doc/invariant lie; simplifies crash recovery.  
2. **Bounded durable import report on presentation** — survives TTL/restart; UX needs it.  
3. **Enrich durable job receipt** — presentationId + report summary + outcome coords; keep in-memory for live progress only.  
4. **Crash-point route suite** — prove publish → visibility → media → complete ordering and recovery.

---

## 2. Current architecture (text)

```text
POST /api/pptx/import
  ├─ reserveImportJob → in-memory Map (status=running)     [pptx-import-job-manager.js]
  ├─ Multer temp upload
  └─ runImport (async fire-and-forget)
        │
        ├─ importer(file)  [parse/map/media stage writes files + hash rows under mediaTransaction]
        │     └─ returns { presentation, stats, warnings, sourceMap }
        │
        ├─ [production packageCommit path]
        │     presentationId = new UUID
        │     packageCommit = prepareImport + publishImport
        │       ├─ stage/commit blob R0
        │       ├─ head gen=1 + mutationResults PACKAGE_IMPORT
        │       ├─ queueCompatibilityUpsert(outbox)          ← WRITER A (durable pending)
        │       └─ durable jobs[] receipt status=completed
        │            outcomeRevisionId/Generation/HeadHash
        │
        │     createImportedPresentation(...)                ← WRITER B (direct presentations.push)
        │       stamps id, timestamps, pptxAggregateHead
        │       does NOT drain outbox
        │
        │     mediaTransaction.commit()                      ← no-op close (files already on disk)
        │     jobManager.completeJob({ presentationId, stats, warnings })  ← in-memory only
        │
        └─ [test/legacy path without packageCommit]
              persistOriginal + createImportedPresentation(originalArtifact)

GET /api/pptx/jobs/:id
  1) in-memory Map
  2) else package-store getJob(kind=import) → serializeDurableImportJob
     (presentationId only; no stats/warnings)

GET /api/pptx/jobs/:id/stream  → in-memory only (404 if Map miss)

POST /api/pptx/jobs/:id/reconcile
  → packageRollback + drainCompatibility + deletePresentation
  (cleanup of completed package-backed identity; not full client terminal replay)

Package store init / presentation lifecycle routes
  → drainPackageCompatibilityOutbox()
     snapshot outbox → applyCompatibilityWrites(presentations) → ack
```

### Authority layers

| Layer | Durable? | Owns |
| --- | --- | --- |
| Package store head/blob/revision/sourceMap/mutationResults | Yes (WAL + root replace) | Package authority |
| Package `jobs[]` import receipt | Yes | Terminal import identity + outcome fencing |
| `compatibilityOutbox[]` | Yes until ack | Pending projection upsert/remove |
| `presentations.json` via storage | Yes | Compatibility/editor JSON visibility |
| In-memory job manager Map | No (TTL 10 min) | Live progress, SSE, full terminal result (stats/warnings) |
| Media files + upload hash index | Yes (written during map; commit clears tx records only) | Imported media |

---

## 3. Confirmed defects remaining

### F-08 — Dual compatibility writers — **OPEN**

**Evidence:**

- Outbox queue on package publish: `server/services/pptx-import/package-store/import-commit.js:194-205`
- Route still calls `createImportedPresentation` after package publish: `server/routes/pptx-import.js:254-266`
- Direct `presentations.push`: `server/services/pptx-import/create-imported-presentation.js:46-49`
- Docs claim sole outbox writer: `docs/export-fidelity-and-limits.md:119-125`
- Import path **never** drains outbox before job complete (`pptx-import.js` uses drain only on reconcile DI default, not in `runImport`)

**Observed behavior (audit + composition):** no duplicate-row corruption when both fire — merge on later drain keeps one row (`compatibility-view.js:91-98`). Still:

1. Docs/invariant false.  
2. Outbox row stays pending until startup drain or another route drains.  
3. Visibility depends on Writer B for read-after-write; Writer A is recovery-only today.  
4. Crash between A and B leaves head+durable-job without listable presentation (until drain).  
5. Crash after B before drain leaves dual-written state with pending outbox replay (usually idempotent merge).

### F-10 — Full warnings transient / unbounded — **OPEN**

**Evidence:**

- Mapper returns full `warnings` array; `_pptxMeta` only keeps selected meta/unsupportedFeatures: `mapper/map-presentation.js:453-484`
- Terminal job result carries full warnings: `pptx-import.js:317-321`
- Job Map TTL 10 min: `pptx-import-job-manager.js:3-5`
- Durable serialize drops stats/warnings: `pptx-import.js:71-88` (`result: { presentationId }` only)
- No global warning count/byte ceiling in import path
- Client one-shot summary from terminal result: `HomePage.jsx:697-700` via `summarizePptxImportWarnings`

**Impact:** reload/restart loses report; pathological warning volume can inflate memory/HTTP payload.

### F-11 — HTTP job authority lost on restart — **PARTIALLY FIXED**

**Audit (2026-07-22) claimed GET only reads Map.** Current code:

```text
pptx-import.js:436-445  getJob → else readDurableJob → serializeDurableImportJob
pptx-import-durable-job.test.js  covers TTL/restart receipt + reconcile
```

**Still open:**

| Gap | Evidence |
| --- | --- |
| Durable result lacks stats/warnings/report | `serializeDurableImportJob` lines 71-88 |
| SSE no durable fallback | `pptx-import.js:448-460` 404 if Map miss |
| No durable **running** receipt on live import | durable job written only at `publishImport` as `completed` (`import-commit.js:206-220`) |
| Pre-publish crash → job fully unknown | no package job until publish |
| Client may open editor without warning notice after poll recovers durable-only receipt | HomePage uses `imported` terminal payload for warnings |
| Reconcile is cleanup, not “resume success UX” | `reconcileDurableImportJob` rolls **back** package + deletes presentation |

### Crash-point coverage — **OPEN**

Package store has WAL fault injection (`state-store.js:124-166`, tests in `package-store.test.js`). Route-level ordered crash points (publish → compatibility visibility → media → completeJob) are **not** covered end-to-end.

---

## 4. Existing durable artifacts and recovery hooks

### Durable artifacts (keep)

| Artifact | Owner | Written when | Recovery use |
| --- | --- | --- | --- |
| R0 blob + revision | package-store | `prepareImport`/`publishImport` | Original download, identity |
| Head gen=1 + fencing/matrix epochs | package-store | publishImport | Authority reads, generation fence |
| Source map rebound to R0 | package-store | prepareImport | Edit/export fidelity |
| Mutation result `PACKAGE_IMPORT` | package-store | publishImport | Rollback match |
| Import job receipt + outcome* | package-store jobs[] | publishImport | GET after TTL/restart; rollback fencing |
| Compatibility outbox upsert | package-store | publishImport | Replay visibility after crash |
| presentations.json row | storage | createImportedPresentation **or** outbox drain | Editor list/open |
| Media files + hash index | uploads + storage | during map (before commit) | Image/video URLs |
| Temp upload file | TEMP_UPLOAD_DIR | Multer | Unlinked in runImport finally |

\*Outcome fields: `outcomeRevisionId`, `outcomeGeneration`, `outcomeHeadHash` — required for safe rollback (`import-commit.js:20-39`, `264-273`). Legacy receipts fail closed (`LEGACY_IMPORT_RECEIPT_UNSUPPORTED`).

### Recovery hooks already present

| Hook | Location | Role |
| --- | --- | --- |
| `getDurableImportJob` | `pptx-import.js:60-69` | Read package job kind=import |
| GET job durable fallback | `pptx-import.js:436-445` | Client poll after TTL/restart |
| DELETE job durable 409 | `pptx-import.js:462-478` | Avoid “unknown” on finished durable |
| `POST .../reconcile` | `pptx-import.js:483-508` | Rollback package + drain + delete presentation |
| `rollbackImport` authority checks | `import-commit.js:236-291` | Head/outcome/idempotency match; no-op if already rolled back |
| `initializePackageStore` drain | `package-store-runtime.js:39-43` | Startup outbox replay |
| `drainPackageCompatibilityOutbox` | `package-store-runtime.js:107-125` | Snapshot → apply → ack under lock order |
| WAL recovery fault suite | `package-store.test.js` prepared/root/completion faults | Store durability, not HTTP job lifecycle |
| Cancel/deadline + late cleanup | `runImport` withAbort + cleanupPromises | Prevents orphan after late stage resolve |

### What recovery does **not** do today

- Auto-heal “package published, no presentation row” on next GET (client only sees durable `done` + presentationId; list/open may 404 until drain).
- Replay full terminal payload (stats/warnings).
- Mark intermediate stages durable.
- Drain outbox inside `runImport` after publish.

---

## 5. P0 phase 3: fixed vs remaining

### Fixed by P0 (esp. phase-03 + authority repairs)

From `phase-03-package-backed-critical-journey.md` + plan status 2026-07-24:

- Real package-backed E2E: import → edit → G2>G1 → reload → R0 hash → validated export typed outcome.
- No copy-to-legacy fixture for covered critical/fidelity journeys.
- Rollback receipt authority: outcome coordinates, identity-bound no-op, legacy fail-closed, generation/matrix fencing.
- Durable-job HTTP suite (GET/DELETE/reconcile reasonCode).
- Focused authority suites claimed 71/71 (package-store + oracle actuals + HTTP boundary + durable-job).

### Explicitly **not** in P0

Plan non-goals (`plan.md:34`):

> durable job recovery/outbox work; full P1 AbortController lifecycle; …

So F-08 single-writer, F-10 import report, crash-point route matrix, and complete F-11 payload parity remain **P1+**.

---

## 6. Single-writer design options

### Option comparison

| Dimension | A. Outbox sole writer (recommended) | B. createImportedPresentation sole writer | C. Keep dual + document merge |
| --- | --- | --- | --- |
| Matches docs (`export-fidelity-and-limits.md`) | Yes | No | No (docs stay wrong) |
| Matches save/lifecycle/export paths | Yes (all use outbox) | Splits import from rest | Status quo |
| Read-after-write | Drain before completeJob | Immediate push | Immediate push |
| Crash after publish, before visibility | Outbox pending → startup/reconcile drain | Orphan head unless separate recovery | Same as A if B not run |
| Crash after visibility, before complete | Presentation exists; durable job already completed | Same | Same |
| Complexity | Medium one-time: remove direct push; await drain | Low code delete of outbox on import only — **breaks** recovery model | Low code, high long-term confusion |
| Adoption risk | Low — outbox + drain already production paths | High — invents second authority model | Medium — latent dual-write bugs |
| YAGNI/KISS/DRY | Best | Violates DRY vs other package writers | Worst |

### Recommended: **Option A — package outbox sole compatibility writer**

**Design:**

```text
packageCommit(prepare+publish)
  → queues outbox upsert (only writer)
  → durable job completed receipt
await drainPackageCompatibilityOutbox()   // read-after-write barrier
  // optional: assert presentation exists in storage by id
mediaTransaction.commit()
jobManager.completeJob({ presentationId, stats, warnings | reportRef })
```

**Changes:**

1. Stop calling `createImportedPresentation` on packageCommit path (or reduce it to pure ID/timestamp helper that does **not** `push`).
2. Pass full compatibility presentation (already done) into `publishImport` outbox payload; ensure media URLs/stats metadata needed by editor are inside projection.
3. `runImport` awaits `drainCompatibility` after successful package publish (injectable, same as reconcile).
4. Keep `createImportedPresentation` for **legacy/test** non-packageCommit path only until that path dies.
5. Update docs to state: import visibility = outbox drain; no second writer.

**Read-after-write SLA:** drain is already serialized (`compatibilityDrainTail` + `withPackageStore` + `withPresentations`). Same process as save/duplicate paths.

**Rollback path:** on abort/failure after publish, keep existing `packageRollback` + presentation delete; drain after rollback clears pending outbox (`import-commit.js:278-280` strips outbox for presentation; reconcile also drains).

**Trade-offs:** slightly longer “creating-presentation” stage; drain failure must fail the job and rollback package (fail closed), not completeJob with missing visibility.

### Rejected for import path

- **B:** would make import the only package mutation that bypasses outbox; recovery and generation merge rules diverge.  
- **C:** audit already showed “works by accident”; not a plan target.

---

## 7. Durable import report design (F-10)

### Recommended shape (presentation-owned, bounded)

Persist under presentation (compatibility projection), server-owned key e.g. `_pptxImportReport`:

```text
{
  schemaVersion: 1,
  jobId,
  createdAt,
  summary: { warningCount, byType: {...}, unsupportedFeatureCount, omittedCount },
  diagnostics: [ /* capped array of {type, message, slideIndex?} */ ],
  statsDigest: { slideCount, parser, native* counts... } // optional small subset
}
```

**Bounds (proposed defaults for plan):**

| Cap | Suggested |
| --- | --- |
| max diagnostic entries | 50–100 |
| max serialized JSON bytes | 32–64 KiB |
| omittedCount | fullCount − stored |
| byType counts | always complete for all types (cheap) |

Also store **same summary** (or hash ref) on durable package job if schema allows extension — **or** keep job thin and always load report from presentation. Prefer presentation ownership so editor reload works without job id.

**Do not** put unbounded full warnings on durable job or SSE forever.

Mapper already has `_pptxMeta.unsupportedFeatures` — report should complement, not duplicate entire meta.

---

## 8. Job durability model (F-11 completion)

### Keep two-tier (do not make Map durable for progress)

| Tier | Purpose |
| --- | --- |
| In-memory Map | Live stage/percent/SSE; concurrency slot; cancel handler |
| Package jobs[] | Terminal receipt after package authority publish |

### Required P1 upgrades

1. **After Option A drain:** durable GET implies presentation exists (or client shows “recovering” + drain on demand).  
2. **serializeDurableImportJob:** include `result.presentationId` + optional `result.reportSummary` / `importReportPresent`.  
3. **SSE:** either document poll-only recovery after restart, or on stream 404 try durable terminal once (optional UX). Prefer poll contract already used by client fallback.  
4. **Do not** write durable `running` for every stage unless product requires multi-instance resume — YAGNI for single-slot self-host.  
5. **Reconcile semantics stay destructive cleanup** — rename/docs so operators do not treat as “finish import”.

---

## 9. Test inventory and missing crash-point scenarios

### Existing coverage (relevant)

| Suite | What it proves |
| --- | --- |
| `package-store.test.js` | R0+head+job atomic publish; outbox queue; source-map reject; WAL faults; rollback fencing; legacy receipts |
| `compatibility-outbox.test.js` | Unacked durable outbox; ack only after apply; generation stale ignore; server-owned metadata merge |
| `pptx-import.test.js` | Package before complete; package fail → no create; cancel/deadline; legacy original path; SSE; concurrency |
| `pptx-import-durable-job.test.js` | Durable GET after Map miss; DELETE 409; reconcile success/fail reasonCode; non-terminal refuse |
| `pptx-import-job-manager.test.js` | TTL, SSE, cancel slot hold |
| Phase-03 E2E | Happy package-backed edit/save lifecycle (not crash injection) |

### Missing crash-point scenarios (plan these)

| # | Inject after | Expect |
| --- | --- | --- |
| CP1 | `publishImport` success, before drain/create | Durable job `completed` + head exist; no presentation (or only after drain); GET durable returns presentationId; list/open fails until drain; reconcile can rollback |
| CP2 | drain success / presentation visible, before `mediaTransaction.commit` | Presentation listable; media files already present (commit is close); job still non-terminal in-memory; restart → durable done, media ok |
| CP3 | media commit, before `completeJob` | Same as CP2; client still polling running in-memory until fail/restart; durable already done |
| CP4 | `completeJob`, process kill before TTL | Map gone; GET durable works; **warnings missing today** → after F-10 report must still load from presentation |
| CP5 | publish success, create/drain throws | packageRollback runs; no head; job failed/rolled-back; no presentation |
| CP6 | dual-writer residual: row exists + outbox pending, restart | single row after drain; no duplicate |
| CP7 | Option A only: drain fails after publish | fail closed + rollback; no completeJob success |
| CP8 | SSE attach after restart | 404 today; poll recovers — assert client contract |
| CP9 | Warning flood (synthetic 10k warnings) | bounds enforced; omittedCount; response size under cap |
| CP10 | Reconcile after G2 successor | refuse (already package-store); route surfaces reasonCode |

**Implementation tip:** inject via DI seams already on router: `packageCommit`, `createPresentation`, `drainCompatibility`, media commit wrapper, `jobManager.completeJob` spy/throw. Prefer not only store `faultAfter*` (those prove WAL, not HTTP lifecycle).

---

## 10. File inventory for plan phases

### Phase A — Single compatibility writer (F-08)

| Action | File |
| --- | --- |
| Modify | `server/routes/pptx-import.js` (`runImport` package path: drain; drop direct create push) |
| Modify | `server/services/pptx-import/create-imported-presentation.js` (legacy-only or non-mutating helper) |
| Verify | `server/services/pptx-import/package-store/import-commit.js` (keep outbox queue) |
| Verify | `server/services/pptx-import/package-store-runtime.js` (drain lock order) |
| Verify | `server/services/pptx-import/compatibility-view.js` |
| Docs | `docs/export-fidelity-and-limits.md` (sole writer claim becomes true for import) |
| Tests | `server/routes/pptx-import.test.js`, new dual-writer/crash composition tests, `compatibility-outbox.test.js` |

### Phase B — Bounded import report (F-10)

| Action | File |
| --- | --- |
| Add | small helper e.g. `server/services/pptx-import/import-report.js` (&lt;200 LOC) |
| Modify | `runImport` / package projection assembly to attach report |
| Modify | `mapper/map-presentation.js` only if bounds applied at source (prefer boundary at persist) |
| Modify | client summary optional read from presentation if job lacks warnings |
| Tests | unit bounds + route terminal + durable GET + HomePage notice regression |

### Phase C — Durable job payload / restart UX (F-11 remainder)

| Action | File |
| --- | --- |
| Modify | `serializeDurableImportJob` / job schema if needed (`package-store/schemas.js` only if new fields validated) |
| Modify | `pptx-import.js` GET/SSE policy |
| Tests | `pptx-import-durable-job.test.js` expand payload; restart composition |

### Phase D — Crash-point suite

| Action | File |
| --- | --- |
| Add | `server/routes/pptx-import-crash-points.test.js` (or extend durable-job + import tests) |
| Reuse | DI in `createPptxImportRouter` / `runImport` |
| Verify | package-store rollback + reconcile reasonCode paths |

### Phase E — Docs / audit closeout

| Action | File |
| --- | --- |
| Update | `docs/export-fidelity-and-limits.md` |
| Optional | `docs/codebase-summary.md` / changelog if user-visible report UI |
| Close | map F-08/F-10/F-11 dispositions in next audit note |

**Do not** reopen P0 phase-03 E2E unless dual-writer change breaks package-backed journey (should strengthen it).

---

## 11. Trade-off matrix (P1 lifecycle options)

| Option | Correctness | Complexity | Maint. | Crash recovery | UX after restart | Fit |
| --- | --- | --- | --- | --- | --- | --- |
| **A outbox-only + drain + report** | High | Med | High long-term | Strong | Good if report on presentation | **Best** |
| Dual-write + enrich durable job only | Med | Low | Poor | Partial | Warnings still weak | Weak |
| Full durable progress journal | High | High | High | Strong multi-instance | Best | Overkill (YAGNI) |
| Status quo | Low (docs lie) | Low | Poor | Partial | Poor | Reject |

---

## 12. Adoption risk

| Risk | Note |
| --- | --- |
| Outbox sole writer | Low — drain already used in prod init/presentation routes |
| Dropping createImportedPresentation on package path | Medium test churn — many route tests inject `createPresentation` |
| Report schema on presentation | Low — server-owned `_pptx*` keys already reserved in compatibility merge |
| Extending validateJob | Medium — keep new fields optional or put report only on presentation |
| Crash suite flakiness | Control with DI throws, not real process kill first; add optional process-restart later |

**Maturity:** package-store WAL + outbox are production-grade relative to in-memory jobs. Gap is composition at `runImport`, not missing store primitives.

---

## 13. Architectural fit

- Monorepo Express + file JSON storage + package-store authority: **outbox-only matches existing save/lifecycle**.  
- Single concurrent import slot: no need for multi-worker job queue product.  
- Self-hosted model: durable terminal receipt + presentation report enough; multi-tenant job auth still out of scope.  
- Client already prefers `presentationId` from job and one-shot warning toast — attach durable report for reload later without blocking P1 toast path.

---

## 14. Limitations of this research

- Did not re-run production composition probe (relied on audit probe + current source).  
- Did not measure warning payload sizes on corpus decks (Bai_2_5 203 warnings noted in audit only).  
- Did not design UI for post-reload import report viewer (backend contract only).  
- Did not evaluate Electron multi-window job visibility.  
- Line numbers for audit F-08/F-11 are **stale** relative to current `pptx-import.js` (logic confirmed at current lines above).

---

## 15. Unresolved questions

1. Should bounded import report be user-visible in editor UI in same P1 plan, or API-only first?  
2. Is legacy non-`packageCommit` path still required outside tests (`NODE_ENV==='test'` defaults packageCommit null)?  
3. Should `POST /reconcile` remain destructive-only, or add a separate `POST /recover-visibility` that only drains outbox?  
4. Warning caps: product preference 50 vs 100 entries / 32 vs 64 KiB?  
5. Any external operator scripts depend on dual-write timing (presentation exists before outbox drain)?

---

## 16. Concrete recommendation for planner

**Ship P1 lifecycle as 4 sequential phases:**

1. **Single writer (A)** + drain barrier + tests CP1/CP5/CP6/CP7  
2. **Bounded `_pptxImportReport`** on published projection + client tolerate missing job.warnings  
3. **Durable job serialize enrichment** (presentationId + report summary flags)  
4. **Full crash-point matrix CP1–CP10** as release gate for this epic  

Do **not** block on full durable progress/SSE history. Do **not** reopen P0 visual oracle work here.

---

Status: DONE  
Summary: Dual compatibility writers and unbounded/transient warnings remain open; durable GET after restart is partially fixed but incomplete without report payload; recommend outbox-only writer + drain barrier + presentation-owned bounded import report + crash-point DI suite.  
Concerns/Blockers: none for planning — product choices on report UI and warning caps only.

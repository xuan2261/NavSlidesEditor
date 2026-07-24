# PPTX Import P1+ Scout Inventory

**Date:** 2026-07-24  
**Mode:** read-only inventory for P1+ planning  
**P0 plan context:** `plans/260722-1630-pptx-import-p0-readiness-remediation-deep-tdd/` — phases 1–3 done; phase 4 (PowerPoint oracle goldens) blocked. P1 non-goals from that plan include full job-lifecycle AbortController and durable job recovery.

---

## Pipeline (current)

```text
HomePage.handleImportPptx
  → api.importPptxAsync (POST /api/pptx/import, 429 retry + AbortSignal)
  → waitForPptxJob (SSE + poll fallback)
  → job result.presentationId (server atomic create)
  → open editor

Server: reserve job → multer temp → runImport
  → importer (fork parse-worker / pptxtojson)
  → guards reopen package → scene graph → mapper → media persist
  → createImportedPresentation + package-store commit
  → job complete { presentationId, stats, warnings }
```

---

## 1. Client import lifecycle

| Path | ~LOC | Key exports / behavior | Tests | Notes |
| --- | ---: | --- | --- | --- |
| `client/src/pages/HomePage.jsx` | ~1.3k+ | `handleImportPptx`, `pptxImportRef`, busy-retry UI, warning summary, open editor | `HomePage.pptx-import-lifecycle.test.jsx`, `HomePage.import-accessibility.test.jsx` | Large page; import only ~80 LOC slice. Admission abort on unmount; no full job cancel AbortController (P1). |
| `client/src/utils/api.js` | ~286 | `importPptxAsync`, `pollPptxJob`, `cancelPptxJob`, `downloadPptxOriginal`, `getPptxFidelity`, `downloadValidatedEditedPptx` | `api.test.js` (heavy import coverage) | 429 `import-in-progress` + `Retry-After` clamp (P0 phase 1). |
| `client/src/utils/pptx-job-wait.js` | ~158 | `PptxJobOutcomeError`, `pollPptxJobUntilTerminal`, `waitForPptxJob` | `pptx-job-wait.test.js` | SSE first; onerror → poll; deadline → cancel + `PPTX_JOB_OUTCOME_UNKNOWN`. |
| `client/src/utils/pptx-import-summary.js` | ~60 | `summarizePptxImportWarnings` | `pptx-import-summary.test.js` | Groups approximated / placeholder / failed. |
| `client/src/utils/pptx-import-meta.js` | small | fit/wrap meta invalidation for text edits | `pptx-import-meta.test.js` | Used by editor controllers. |
| `client/src/utils/pptx-fidelity.js` | ~30 | `PptxRevisionConflict`, `toPptxApiError`, `createSuccessorQueue` | (via panel / hooks) | Client export conflict helpers. |
| `client/src/hooks/use-pptx-fidelity.js` | ~39 | `usePptxFidelity` | `use-pptx-fidelity.test.js` | Loads `/pptx-fidelity` when package-backed. |
| `client/src/components/PptxFidelityPanel.jsx` | ~100+ | `FidelityStatus`, `PptxExportChoices`, panel UI | `PptxFidelityPanel.test.jsx` | Three export choices: original / validated-edited / reconstructed. |
| `client/src/components/properties/chart-properties.jsx` | ~150+ | preserve-only gate on `_pptxChartMeta` | `chart-properties.test.jsx` | All chart controls `disabled` unless editable qualification full. |

**Related client export (not import path but claim-adjacent):** `exportPptx.js`, `export-pptx-*.js` + tests.

---

## 2. Server job manager, routes, package-store, create

| Path | ~LOC | Key exports / routes | Tests | Notes |
| --- | ---: | --- | --- | --- |
| `server/services/pptx-import-job-manager.js` | ~206 | `createJob`, `getJob`, `serializeJob`, SSE attach/detach, `emitProgress`, `completeJob`/`failJob`/`cancelJob`, `holdOperation`/`settleOperation`, `MAX_CONCURRENT_RUNNING=1`, `JOB_TTL_MS=10m` | `pptx-import-job-manager.test.js` | In-memory only; process restart loses jobs. Single concurrency. |
| `server/routes/pptx-import.js` | ~520 | `POST /import`, `GET /jobs/:id`, `GET /jobs/:id/stream`, `DELETE /jobs/:id`, `POST /jobs/:id/reconcile`; exports `createPptxImportRouter`, `runImport`, durable job helpers | `pptx-import.test.js`, `pptx-import-durable-job.test.js` | Job IDs unguessable UUID; comment: no per-tenant auth. `runImport` owns deadline, cancel, package commit/rollback. |
| `server/index-pptx-rate-limit.test.js` | ~41 | production upload limiter scoped to POST import | self | P0 rate-limit regression. |
| `server/services/pptx-import/create-imported-presentation.js` | ~78 | `createImportedPresentation`, `deleteImportedPresentation`, `stripClientPptxOriginalPaths` | via route/importer tests | Atomic server create; strips client path fields on `pptxOriginal`. |
| `server/services/pptx-import/package-store/` | large | `PackageStore`, `openPackageStore`, `commitImport`/`prepareImport`/`publishImport`/`rollbackImport`, `commitOriginal`, lifecycle admit/duplicate/quarantine/restore, portable import/export, OPC inventory, blob/state stores | `package-store.test.js`, `lifecycle.test.js`, `blob-store.test.js`, `portable.test.js`, `opc-*`, `authority-dto.test.js`, … | Authority core for package-first. Dirty: complex lock/outbox/lifecycle edge cases called out in fidelity report. |
| `server/services/pptx-import/package-store-runtime.js` | ~155 | `initializePackageStore`, `withPackageStore`, `getPackageStore`, `drainPackageCompatibilityOutbox`, `shutdownPackageStore` | `package-store-runtime-lock-order.test.js` | Process singleton store. |
| `server/routes/pptx-edited-export.js` | ~99 | `createEditedExportHandler` | `pptx-edited-export.test.js` | Validated edited export; fail-closed. |
| `server/routes/pptx-fidelity.test.js` | — | GET fidelity contract | self | Generation from package head. |
| `server/routes/pptx-original.test.js` | — | GET original package | self | Recovery path. |
| `server/routes/pptx-package-snapshot.test.js` | — | package snapshot API | self | |
| `server/services/generation-safe-save.js` | — | projection save fencing | related tests | Not under pptx-import dir; import/export contract owner. |
| `server/services/validated-edited-export.js` | — | export materialization | `validated-edited-export*.test.js` | |

---

## 3. Parser worker, env, guards, media, warnings

| Path | ~LOC | Key exports | Tests | Notes |
| --- | ---: | --- | --- | --- |
| `server/services/pptx-import/parse-worker.js` | ~75 | `parseFile`; IPC `ready` + result | via worker-runner | Child process entry; `pptxtojson` only. |
| `server/services/pptx-import/worker-runner.js` | ~208 | `runParserWorker`, `buildParserWorkerEnv`, `buildParserExecArgv` | `worker-runner.test.js` | NODE_PATH for monorepo/Electron; `--max-old-space-size`; 60s timeout; kill grace. |
| `server/services/pptx-import/worker-ipc.js` | small | ack/ready/progress message helpers | via worker-runner | |
| `server/services/pptx-import/importer.js` | ~175 | `importPptxFile`, `buildImportStats` | `importer.test.js`, `pptx-import-e2e-flow.test.js` | Worker parse → reopen zip → scene graph → map → source map → optional strict acceptance. |
| `server/services/pptx-import/pptx-guards.js` | ~150 | `validatePptxPackage`, `loadPptxArchive`, `assertPptxExtension`, `readBoundedZipEntry` | `pptx-guards.test.js`, `zip-bomb-guard.test.js` | Extension + zip bomb + entry budget. |
| `server/services/pptx-import/constants.js` | ~80+ | size/timeout budgets, `FAILURE_TYPES`, `CANVAS_SIZE`, media allowlist | many | 100MB file, 5000 entries, 500MB decompress, 256MB parsed JSON, 500MB aggregate media, import deadline 2m. |
| `server/services/pptx-import/resource-budgets.js` | ~35 | `assertParsedOutputBudget`, `createMediaBudget` | `resource-budgets.test.js` | |
| `server/services/pptx-import/request-limits.js` | ~10 | `isValidIdempotencyKey` | `request-limits.test.js` | Export idempotency. |
| `server/services/pptx-import/media.js` | ~200 | `createMediaIndex`, `persistImage*`, `persistMediaBlob` | `media.test.js` | Magic sniff, size cap, uploads dir. |
| `server/services/pptx-import/mapper/media-warning.js` | ~30 | `mediaWarningMessage`, `pushMediaWarning` | via mapper media tests | Codes: missing ref, too large, magic mismatch, external URL, etc. |
| `server/services/pptx-import/nested-package-guard.js` | — | nested OPC rejection | `nested-package-guard.test.js` | |
| `server/services/pptx-import/xml-safety.js` | — | hostile XML | `package-store/opc-xml-safety.test.js` | |
| `server/services/pptx-import/emf-wmf-sandbox.js` | — | EMF/WMF convert gate | `emf-wmf-sandbox.test.js` | Strict decks fail when convert disabled. |
| `server/services/pptx-import/mapper/` | large | `mapPptxOutput` and element mappers | many `map-*.test.js` | Geometry/theme/text/table/chart/diagram/group. |
| `server/services/pptx-import/ooxml-scene-graph/` | medium | scene inventory + strict policy | scene-graph tests | Unmapped native nodes block strict qualification. |
| `server/services/pptx-import/temp-upload-sweep.js` | — | stale temp cleanup | `temp-upload-sweep.test.js` | |

**Risk:** worker isolation solid; host still reopens package after worker. Strict importer ≠ corpus metrics lane. In-memory job manager + single concurrent import.

---

## 4. Fidelity contract, charts, corpus CLI, oracle

| Path | ~LOC | Key exports | Tests | Notes |
| --- | ---: | --- | --- | --- |
| `server/services/pptx-import/fidelity-contract.js` | ~273 | `buildFidelityDto`, `createConflict`, `createSuccessorQueue` | `fidelity-contract.test.js` | Safe reason strings; original / validatedEdited / reconstructed availability. |
| `server/services/pptx-import/canonical-feature-matrix.js` | large | matrix rows, hash, tiers | `canonical-feature-matrix.test.js` | Claim ceiling authority. |
| `server/services/pptx-import/chart-support-matrix.js` | ~130 | `supportRow`, `assertStrictChartSupport`, `NATIVE_EDITABLE=['bar']` | `chart-support-matrix.test.js` | No level-4 promotion; bar conditional but not fully editable. |
| `server/services/pptx-import/chart-output-to-navslides-mapper.js` | — | display mapping from pptxtojson charts | `chart-output-to-navslides-mapper.test.js`, `chart-roundtrip.test.js` | Display ≠ edit qualification. |
| `server/services/pptx-import/chart-native-metadata.js` | — | `_pptxChartMeta` | chart tests | |
| `server/services/pptx-import/pptx-import-corpus-cli.js` | ~170 | `runFromCli`, strict metrics / importer-strict modes | `pptx-import-corpus-cli.test.js` | npm: `test:pptx:corpus-metrics`, `test:pptx:importer-qualification`, `test:pptx:best-effort`. |
| `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` | large | corpus runner | via CLI + baseline tests | |
| `server/services/pptx-import/pptx-import-qualification.js` (+ `-source.js`) | — | two-pass qualification | matching tests | Manifest-bound; can exit non-zero with structured blockers. |
| `server/services/pptx-import/pptx-sla-1to1-cli.js` | — | 1:1 SLA CLI | `pptx-sla-1to1-cli.test.js` | |
| `server/services/pptx-import/oracle/*` | large | `pptx-oracle-cli`, SSIM, goldens, package-backed actuals, gate | many `oracle/*.test.js` | Modes: integrity, qualification, capture-present. Phase 4 blocked: no trusted PowerPoint goldens / role receipts. |
| `server/data/test-corpus/` | 11 decks + manifest | fixtures | used by CLI/oracle/E2E | Bai_*, charts, diagram, math, STTre_Duc, etc. |
| `client/.../chart-properties.jsx` | — | preserve-only UI | `chart-properties.test.jsx` | |

**npm scripts (root `package.json`):** `test:pptx:corpus-metrics`, `test:corpus` (alias), `test:pptx:best-effort`, `test:pptx:browser-audit{,:full,:headed}`, `test:pptx:importer-qualification`, `test:pptx:strict` (deprecated alias), `test:pptx:oracle{,:integrity,:qualify,:capture}`, `test:pptx:sla-1to1`, `test:pptx:package:no-officecli`, `test:pptx:phase13`.

---

## 5. Existing E2E / browser audit

| Path | Role | Notes |
| --- | --- | --- |
| `tests/e2e/critical-pptx-journey.spec.js` | ~200 | Package-backed import → edit text → gen advance → original hash → validated export → reconstructed File menu export inspect ZIP. P0 phase 3. |
| `tests/e2e/pptx-import-async.spec.js` | ~25 | UI upload Bai_2_2 → progress → editor URL. |
| `tests/e2e/pptx-import-fidelity.spec.js` | ~80+ | API import + canvas element bounds audit. |
| `tests/e2e/pptx-import-real-browser-audit.spec.js` | large | Serial multi-deck structural audit; reports under `plans/reports/pptx-import-real-browser-audit-runs/`. |
| `tests/e2e/pptx-import-editor-visual-regression.spec.js` | — | Editor canvas baselines; skipped unless `PPTX_EDITOR_BASELINES_REVIEWED=1`. |
| `tests/e2e/pptx-fidelity-ux.spec.js` | — | Fidelity panel UX with mocked contract; no secret path leak. |
| `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js` | — | API multi-fixture roundtrip. |
| `tests/e2e/export/pptx-export.spec.js` | — | Export journey (export-side). |
| `tests/e2e/helpers/pptx-import-api-helper.js` | — | `importPptxWhenAvailable`, 429 retry, original hash, fidelity GET. |
| `tests/e2e/pages/pptx-import-audit-helper.js` + `pptx-import-audit-report-helper.js` | — | Audit classify + report write. |
| `tests/unit/pptx-import-*.test.js` | — | Helper/docs/scripts contracts. |
| `scripts/run-pptx-browser-audit.js` | — | Strict smoke/full driver. |

**Fixtures dirs:** root `PPTX/` (E2E live decks) and `server/data/test-corpus/` (canonical 11).

---

## 6. Docs claiming import/export behavior

| Path | Claim focus | Drift risk |
| --- | --- | --- |
| `docs/export-fidelity-and-limits.md` | Product policy: original recovery vs validated-edited vs reconstructed; chart preserve-only; fail-closed export | **Primary evergreen policy** |
| `docs/pptx-import-fidelity-report.md` | Engineering stateful record; package authority, open lifecycle gaps | Explicitly not release proof; long open-risk list |
| `docs/pptx-visual-evidence-runbook.md` | Oracle capture/qualify commands | Requires local PowerPoint evidence |
| `docs/system-architecture.md` | Routes, scene graph, pptxtojson-only, corpus lanes, canvas 960×540 | Large; keep aligned with package-store |
| `docs/codebase-summary.md` | High-level import tree | Mentions parser |
| `docs/code-standards.md` | Audit/qualification npm scripts | Good script map |
| `docs/critical-user-journeys.md` | Links critical-pptx-journey | |
| `docs/manual-smoke-checklist.md` | Import/edit/export smoke | |
| `docs/deployment-guide.md` | `tmp-pptx-imports`, corpus job | |
| `docs/project-overview-pdr.md` | Export via pptxgenjs hybrid | Import lightly |
| `docs/journals/*pptx*` | Cook/phase journals | Historical; do not supersede policy |
| `website/features/pptx-import-export.md` (+ `vi/`) | User-facing three export choices + limits | Aligns with fidelity panel |
| `website/features/export.md` (+ vi) | PPTX export marketing | |
| `README.md` | test:pptx:* commands, parser claim | |
| `plans/reports/2026-07-22-pptx-import-readiness-audit.md` | Full readiness verdict (usable limited; oracle blocked) | Baseline for P0/P1 |
| `plans/260722-1630-.../plan.md` | P0 scope; P1 called out as non-goal | |

---

## Test counts (`*pptx*` filename under server / client)

**Filename match `*pptx*` that are tests** (`.test.*`):

| Tree | Count | Files |
| --- | ---: | --- |
| **server** | **16** | `index-pptx-rate-limit.test.js`; routes: `pptx-import.test.js`, `pptx-import-durable-job.test.js`, `pptx-fidelity.test.js`, `pptx-original.test.js`, `pptx-package-snapshot.test.js`, `pptx-export.test.js`, `pptx-edited-export.test.js`; services: `pptx-import-job-manager.test.js`; under pptx-import: `pptx-guards`, `pptx-import-corpus-cli`, `pptx-import-e2e-flow`, `pptx-import-qualification`, `pptx-import-qualification-source`, `pptx-sla-1to1-cli`, `oracle/pptx-oracle-cli` |
| **client** | **11** | `HomePage.pptx-import-lifecycle.test.jsx`, `use-pptx-fidelity.test.js`, `pptx-job-wait.test.js`, `pptx-import-meta.test.js`, `pptx-import-summary.test.js`, `PptxFidelityPanel.test.jsx`, `exportPptx.test.js`, `export-pptx-core|image-opacity|raster|text-runs.test.js` |

**Broader (not `*pptx*` name but import suite):** `server/services/pptx-import/**/*.test.js` is **≥100** files (mapper, package-store, officecli, oracle, evidence, ooxml, reconciliation, …). Client also has `api.test.js` import cases and `chart-properties.test.jsx` / `import-fidelity-properties.test.jsx` without `pptx` in the name.

**E2E specs with pptx in name:** ≥7 under `tests/e2e/` (+ helpers/unit contracts).

---

## Dirty / risky hotspots (P1+ relevant)

1. **In-memory job manager** — no durable recovery across restart; reconcile path exists but limited.
2. **MAX_CONCURRENT_RUNNING=1** — client busy-retry only; multi-user UX still queue-wait.
3. **No job-lifecycle AbortController end-to-end** — admission abort yes; mid-job cancel from client unmount partially (cancel API + SSE close) but not full P1 lifecycle design.
4. **Job IDOR model** — documented trusted-proxy assumption; no per-job secret.
5. **Package-store complexity** — lifecycle/outbox/portable/sync gaps listed in fidelity report; high change risk.
6. **Strict vs metrics lanes** — easy to mis-claim green corpus as 1:1.
7. **Charts** — preserve-only UI; matrix has no level-4 promotion; native edit is P1+ scope if planned.
8. **Oracle goldens** — software gate ready; physical PowerPoint evidence still blocks visual claims (P0 phase 4).
9. **HomePage size** — import logic embedded in oversized page file.
10. **Uploads growth** — `server/uploads/` huge from import media; ops concern.

---

## Suggested P1+ planning anchors (inventory only)

- Extend client job lifecycle (cancel on unmount after admission; clearer outcome UX for `PPTX_JOB_OUTCOME_UNKNOWN`).
- Durable job state / recovery if multi-tenant or restart safety required.
- Chart editability only after matrix level-4 + tests (currently intentional preserve-only).
- Close package-store lifecycle/outbox items from fidelity report before packaging claims.
- Keep policy docs (`export-fidelity-and-limits.md`) as claim authority; treat journals/audit as stateful.

---

## Unresolved questions

- Is P1+ scoped to **job lifecycle + durability** only, or does it include **native chart/EMF/scene-graph** work from the larger package-first plan (`260710-1757-...`)?
- Will Phase 4 PowerPoint goldens remain environment-local, or is a CI-compatible oracle path planned?
- Multi-tenant job auth: still out of product model?

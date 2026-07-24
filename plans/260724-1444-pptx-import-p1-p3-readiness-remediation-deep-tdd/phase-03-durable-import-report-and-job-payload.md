---
phase: 3
title: "Durable Import Report And Job Payload"
status: completed
priority: P1
effort: "2-3d"
dependencies: [2]
---

# Phase 3: Durable Import Report And Job Payload

## Overview

Persist a **bounded** import report on the presentation; enrich durable job GET so restart/TTL recovery returns presentationId + summary (not full unbounded warnings). Closes audit P1.4, P1.6 residual, F-10, F-11 payload gaps.

## Context Links

- Research package durability §7–8
- Mapper `_pptxMeta` selected only: `mapper/map-presentation.js`
- Job TTL 10m: `pptx-import-job-manager.js`
- Durable serialize presentationId-only: `pptx-import.js` `serializeDurableImportJob`
- Client one-shot summary: `summarizePptxImportWarnings` + HomePage

## Requirements

### Functional

- Build `_pptxImportReport` (server-owned) on imported presentation:

```text
{
  schemaVersion: 1,
  jobId,
  createdAt,
  summary: { warningCount, byType, unsupportedFeatureCount, omittedCount },
  diagnostics: [ /* capped */ ],
  statsDigest?: { slideCount, sceneGraphMappedNodes, sceneGraphUnmapped, ...small }
}
```

- Caps (defaults): max **100** diagnostics entries; max **64 KiB** serialized JSON; `omittedCount = fullCount - stored`; `byType` counts always complete.
- Terminal in-memory job may still carry full warnings within TTL **or** only report — prefer report + same summary for both after this phase to avoid dual shapes; if full warnings kept, still apply same budget (P2 phase 5 may own accumulate-time budget — this phase at least bounds durable/persist path).
- Durable GET result: `{ presentationId, reportSummary }` (or full report if small) so client can show summary after restart.
- Editor/Home can load report from presentation after open if job result lost.
- Do not store unbounded warning arrays on durable job.
- **Authority surfaces (red-team F-2 — required):** allowlist report key in:
  - `server/services/pptx-import/authority-sanitizer.js` (`SAFE_PPTX_METADATA_KEYS` or equivalent)
  - `server/services/pptx-import/package-store/dto.js` / `toPresentationEditorDto`
  - `server/services/pptx-import/compatibility-view.js` `SERVER_OWNED_METADATA_KEYS` / nested preserve
  so GET returns report and package-backed PUT/save **preserves** server report (client cannot inject/enlarge).

### Non-functional

- Report is projection metadata, not package authority blob.
- Wrong surface: relying only on `stripClientPptxOriginalPaths` without DTO/merge allowlists.

## Architecture

```text
importer warnings[] + stats
  -> buildBoundedImportReport(warnings, stats, jobId)
  -> attach on stamped projection before outbox upsert
  -> allowlisted through sanitizer/DTO/merge
  -> completeJob + serializeDurableImportJob include visibility + reportSummary
```

New small module: `server/services/pptx-import/import-report.js` (<200 LOC).

## File Inventory

| Path | Action |
| --- | --- |
| `server/services/pptx-import/import-report.js` | Create |
| `server/services/pptx-import/import-report.test.js` | Create |
| `server/services/pptx-import/authority-sanitizer.js` | Modify allowlist |
| `server/services/pptx-import/package-store/dto.js` | Modify if needed |
| `server/services/pptx-import/compatibility-view.js` | Preserve server report on merge |
| `server/routes/pptx-import.js` | serialize + complete payload + visibility |
| stamp helper / outbox projection | Attach report |
| `client/src/utils/pptx-import-summary.js` | Consume durable summary |
| HomePage import slice or hook | Prefer report summary |
| Docs | Report bounds + server-owned |

## Dependency Map

- Requires phase 2 outbox path so report lands once via sole writer.
- Enables phase 4 crash tests asserting report presence.
- Phase 5 may tighten accumulate-time warning budget using same omittedCount shape.

## Tests Before (TDD)

1. 200 warnings → diagnostics length ≤ 100; omittedCount correct.
2. Serialized size ≤ 64 KiB with oversized messages.
3. `byType` complete when diagnostics capped.
4. Durable serialize includes `reportSummary` + visibility-safe fields (not presentationId-only phantom).
5. **Import → GET editor DTO includes report** (not stripped by authority sanitizer).
6. **Import → package-backed PUT edit → GET still has server report** (merge preserve).
7. Malicious PUT body cannot inject/enlarge report.
8. Clear Map + durable GET returns reportSummary when presentation exists.

## Refactor / Implementation Steps

1. Implement `buildBoundedImportReport`.
2. Attach on import projection before publish/drain.
3. Enrich durable job receipt fields if schema allows extension in package jobs[].
4. Update `serializeDurableImportJob`.
5. HomePage/editor summary fallback from presentation when job result thin.

## Tests After

- Durable job GET after Map TTL miss returns summary.
- Critical journey still opens presentation.

## Regression Gate

```bash
npx vitest run server/services/pptx-import/import-report.test.js server/routes/pptx-import-durable-job.test.js server/routes/pptx-import.test.js client/src/utils/pptx-import-summary.test.js
```

## Test Scenario Matrix

| ID | Scenario | Priority |
| --- | --- | --- |
| R1 | Cap diagnostics | Critical |
| R2 | Byte budget | Critical |
| R3 | byType complete | High |
| R4 | Durable GET summary | Critical |
| R5 | Client strip of report field | High |
| R6 | Empty warnings | Medium |

## Function / Interface Checklist

- [x] `buildBoundedImportReport`
- [x] `serializeDurableImportJob` enrichment
- [x] Projection attachment
- [x] Client summary consumer

## Success Criteria

- [x] Report survives process restart simulation (read presentation JSON)
- [x] No unbounded warnings on durable path
- [x] R1–R5 green

## Risk Assessment

| Risk | Mitigation |
| --- | --- |
| Package job schema rigidity | Prefer presentation-owned report; job only summary pointer |
| UX loses detail | Cap + omittedCount + byType sufficient for milestone |

## Security Considerations

- Cap prevents memory/HTTP blowup from pathological packages.
- Report is server-authored.

## Todo

- [x] Tests Before bounds
- [x] implement import-report module
- [x] wire route + durable serialize
- [x] client fallback
- [x] Regression gate

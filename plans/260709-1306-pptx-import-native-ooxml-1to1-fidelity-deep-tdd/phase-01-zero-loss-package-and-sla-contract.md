---
phase: 1
title: "Zero-loss package and SLA contract"
status: completed
priority: P0
effort: "2-4d"
dependencies: []
tdd: true
---

# Phase 1: Zero-loss package and SLA contract

## Overview

Make **zero-loss package** real: every successful PPTX import persists the original `.pptx` bytes with hash verification, exposes download/API access, deletes with the presentation, and codifies the SLA metric contract used by later phases. No visual work yet — foundation only.

## Requirements

### Functional
- **Atomic server path (RT-03):** on successful import, server **creates the presentation** and persists original `.pptx` together (rollback if either fails). Client is not the binder of original↔presentation.
- Presentation metadata only (no client filesystem paths — RT-04):
  - `pptxOriginal.id` (uuid)
  - `pptxOriginal.sha256`
  - `pptxOriginal.byteLength`
  - `pptxOriginal.uploadedAt`
- Stored file bytes match upload `sha256`.
- `GET /api/presentations/:id/pptx-original` streams bytes; server maps id→uuid only.
- Soft-delete + permanent DELETE cascade unlink original.
- Cancel/fail: no orphan originals.
- Job done payload: `{ presentationId, stats, warnings }` for client `onOpen`.
- `sla-contract.js` for engineering milestones only.

### Non-functional
- Path traversal impossible (UUID under `server/data/pptx-originals/`; realpath jail).
- Same size cap as upload (`MAX_FILE_BYTES`).
- Does not break single-import concurrency or job SSE contract.
- Single-user model documented; multi-tenant needs extra auth (RT-02).

## Architecture

```
POST /api/pptx/import → job → importPptxFile
  → persist original as uuid.pptx
  → storage.createPresentation({ ..., pptxOriginal: { id, sha256, ... } })  // SERVER
  → job.complete({ presentationId, stats, warnings })
  → client onOpen(presentationId)  // no createPresentation with paths
```

**Forbidden:** client `createPresentation` with user-supplied `pptxOriginal.filename` path.

```
server/data/pptx-originals/
  {uuid}.pptx
server/data/upload-hashes.json  (optional bucket pptx-original)
```

## Related Code Files

- Create:
  - `server/services/pptx-import/sla-contract.js` — milestone thresholds + metric ids
  - `server/services/pptx-import/original-package.js` — persist/verify/delete helpers
  - `server/services/pptx-import/original-package.test.js`
  - `server/services/pptx-import/sla-contract.test.js`
  - `server/routes/pptx-original.test.js` (or extend presentations tests)
- Modify:
  - `server/services/pptx-import/importer.js` — return artifact handle
  - `server/routes/pptx-import.js` / job complete payload
  - `server/services/storage.js` + presentation schema validation
  - `server/routes/presentations.js` — create/get/delete + download route
  - `client/src/utils/api.js` + HomePage bind if needed
  - `docs/system-architecture.md`, `docs/pptx-import-fidelity-report.md` (short note)

## Tests (TDD) — write first (RED)

| ID | File | Assert |
|----|------|--------|
| T1.1 | `original-package.test.js` | `persistOriginalPptx(buf)` writes file; `verifySha256` matches |
| T1.2 | same | path rejects `../` / absolute escape |
| T1.3 | same | oversize buffer rejected (413 semantics) |
| T1.4 | route integration | successful job `status=done` includes `presentationId` + `result.stats`; presentation exists on disk with `pptxOriginal.sha256` |
| T1.5 | presentations route test | GET download returns bytes equal to fixture; client-supplied path fields ignored/rejected |
| T1.6 | presentations route test | soft-delete + permanent DELETE both unlink original file |
| T1.7 | job cancel test | cancelled import leaves no original in pptx-originals |
| T1.8 | `sla-contract.test.js` | exports milestone table; Phase 01 requires `P1` only |
| T1.9 | security | download with wrong presentation id → 404; `../` id rejected |
| T1.10 | failure | if createPresentation fails after original write → original rolled back / unlinked |

## Implementation Steps

1. **RED** — add T1.1–T1.10 failing.
2. Implement `original-package.js` with sha256 + UUID filename under data dir.
3. Wire `runImport` to: map → persist original → createPresentation server-side → complete job with `presentationId`; unlink temp only after success path staged; rollback original on create fail.
4. Extend storage schema; **reject** client path fields.
5. Download route + soft/hard delete cascade.
6. HomePage: use `presentationId` from job result (stop second create if server created).
7. Add `sla-contract.js`.
8. **GREEN** — all T1.* pass.
9. Docs one paragraph.

### Critical sequencing note
`runImport` currently `unlink`s temp in `finally` (`pptx-import.js`). Persist **before** unlink; never leave bind to client race after job TTL.

## Success Criteria

- [x] All T1.* green
- [x] Manual: import corpus file → download original → sha256 match (covered by T1.4/T1.5 integration tests)
- [x] Cancel import → originals dir clean for that job
- [x] `sla-contract.js` committed and tested
- [x] G0: `npx vitest run server/services/pptx-import server/routes/pptx-import` pass

## Verify

```bash
npx vitest run server/services/pptx-import/original-package.test.js server/services/pptx-import/sla-contract.test.js server/routes/pptx-import --reporter=dot
# plus any new presentations original tests
npx vitest run server/routes/presentations --reporter=dot
```

**Exit 0 required.**

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Disk growth | lifecycle = presentation; document; optional admin prune later |
| Client creates presentation without binding original | Prefer server-side bind in import→create single transaction if possible; else require originalArtifactId on create |
| Double storage (temp + original) | Move/rename from temp when safe |

## Definition of Done

Phase 01 complete only when T1.* + verify green and docs mention original package. **Does not** claim visual 1:1.

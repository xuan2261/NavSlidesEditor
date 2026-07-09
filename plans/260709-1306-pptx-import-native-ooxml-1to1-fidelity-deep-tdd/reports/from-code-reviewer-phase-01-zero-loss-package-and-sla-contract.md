# Phase 01 Code Review — Zero-loss package and SLA contract

**Verdict: FAIL** (1 High data-loss side-effect; AC core mostly met)  
**Date:** 2026-07-09  
**Plan:** `plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`  
**Phase:** 01 — Zero-loss package and SLA contract  
**Reviewer:** code-reviewer (static + test-source evidence)

> **Tests:** Required vitest command not executed in this agent session (no shell tool). Lead must re-run:
> `npx vitest run server/services/pptx-import/original-package.test.js server/services/pptx-import/sla-contract.test.js server/routes/pptx-import.test.js server/routes/pptx-original.test.js --reporter=dot`

---

## Scope

| Area | Files |
|------|--------|
| New | `original-package.js` + test, `sla-contract.js` + test, `create-imported-presentation.js`, `pptx-original.test.js` |
| Modified | `pptx-import.js` + tests, `presentations.js`, `storage.js`, `HomePage.jsx`, `api.js`, docs |
| LOC (approx) | ~450 production + ~400 tests |

**Scout focus:** path jail, atomic create/rollback, delete lifecycle, cancel orphans, client double-create, PUT/duplicate side effects, job SSE contracts.

---

## Acceptance criteria checklist

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Atomic server path: create + persist original; rollback original if create fails | **PASS** | `runImport` persist → create; create catch + outer catch call `deleteOriginal` (`pptx-import.js:76-113`). T1.10 asserts empty originals dir after create fail. |
| 2 | Metadata only `pptxOriginal.{id,sha256,byteLength,uploadedAt}` — no client paths (RT-04) | **PARTIAL** | Create strips via `stripClientPptxOriginalPaths` + hard `delete presentation.pptxOriginal` on POST. **PUT still spreads `req.body` including `pptxOriginal` path fields** (`presentations.js:335-339`; schemas `.passthrough()`). |
| 3 | GET `/:id/pptx-original` streams bytes; server maps presentation id → uuid only | **PASS** | `presentations.js:291-311` uses `presentation.pptxOriginal.id` + `readOriginalPptx`. T1.5/T1.9. |
| 4 | Permanent DELETE unlinks; cancel/fail no orphan originals | **PASS*** | Permanent: `unlinkPresentationOriginal` (`:398`). Soft-delete intentionally keeps file (restore). Cancel-before-persist T1.7; fail T1.10. *See High: shared uuid on duplicate. |
| 5 | Job done: `presentationId`, `stats`, `warnings` | **PASS** | `completeJob` payload `pptx-import.js:103-109`. T1.4. Additive `presentation` kept for legacy. |
| 6 | `sla-contract.js` milestone table; Phase 01 = P1 only | **PASS** | `MILESTONES.phase01.requires = [P1]`; `phase01RequiresP1Only()`; T1.8. |
| 7 | Path traversal impossible (UUID under pptx-originals; jail) | **PASS** | `UUID_RE` + `path.relative` escape check (`original-package.js:15-35`). T1.2. Note: comment says "realpath" but impl is resolve+relative — sufficient with UUID gate. |
| 8 | Same size cap as upload (`MAX_FILE_BYTES` / 413) | **PASS** | Shared `constants.MAX_FILE_BYTES`; persist throws status 413. T1.3. Multer still enforces on upload. |
| 9 | HomePage uses `presentationId` from job (no second create when server created) | **PASS** | `HomePage.jsx:676-680` prefers `presentationId`; legacy fallback only if missing. |
| 10 | No regression job SSE/concurrency | **PASS** (static) | 202 + jobId, 429 in-progress, SSE stream, cancel 204/409 tests retained. Job result additive only. |

---

## Critical Issues

None for auth bypass / path traversal / missing atomic rollback on create-fail happy path.

---

## High Priority

### H1. Duplicate presentation shares original file id → permanent delete of one destroys package for the other

**Where:** `server/routes/presentations.js:426-439` (duplicate deep-clones full object including `pptxOriginal`) + permanent delete `:397-398`.

**Impact:** Zero-loss SLA broken after common user flow:

1. Import PPTX → original at `pptx-originals/{uuid}.pptx`
2. Duplicate presentation → copy.meta points at **same** `uuid`
3. Permanent-delete copy → `unlinkPresentationOriginal` removes shared file
4. Source deck still has `pptxOriginal` metadata but GET original → 404 / bytes gone

**Fix (pick one):**
- On duplicate: strip `pptxOriginal` (copy loses package), **or**
- `persistOriginalPptx` copy-on-write new uuid + rebind meta, **or**
- refcount / shared-ownership table before unlink

Same clone pattern on `save-as-template` (`:512-519`) stores original id on template; create-from-template currently strips at POST (`:221`) so less severe.

---

## Medium Priority

### M1. RT-04 incomplete on PUT

**Where:** `presentations.js:329-340`; `schemas.js` update schema `.passthrough()`.

Client (or malicious body) can write `pptxOriginal.filename` / `.path` / `.filePath`, or re-point `pptxOriginal.id` to another uuid.

Download still only uses id + UUID assert (no arbitrary path open), so not classic traversal — still violates metadata-only contract and can rebind/steal another deck’s package id in multi-deck single-user storage.

**Fix:** On PUT, either preserve server `pptxOriginal` immutably, or sanitize to `{id,sha256,byteLength,uploadedAt}` only and refuse unknown ids not owned by this presentation.

### M2. Cancel race after `createPresentation` succeeds

**Where:** `pptx-import.js:96-100`.

If abort after create, job → `cancelled` but presentation + original remain; client never gets `presentationId`. Not an unbound orphan file, but “cancelled” UX with silent leftover deck.

**Fix:** Treat post-create cancel as lost race → `completeJob` with `presentationId` (preferred), or delete presentation + original then cancel.

### M3. T1.4 does not assert presentation on disk

Plan text: “presentation exists on disk with pptxOriginal.sha256”. Test mocks `createPresentation` and only checks artifact + job payload. Real `createImportedPresentation` + storage path not integration-tested end-to-end.

**Fix:** One integration test using real `createImportedPresentation` + `readPresentations` / GET presentation.

---

## Low Priority / Informational

| ID | Note |
|----|------|
| L1 | `resolveOriginalPath` comments “realpath jail” but does not call `fs.realpath` — UUID gate makes symlink escape impractical; rename comment or add realpath on dir. |
| L2 | GET original loads full buffer (`readOriginalPptx`) up to 100MB — OK for cap; stream via `createReadStream` later. |
| L3 | Soft-delete keeps original (intentional for restore) — matches AC4 wording; differs from plan line “Soft-delete + permanent DELETE cascade unlink”. Docs should stay aligned with soft-keep. |
| L4 | Job still embeds full mapped `presentation` — additive, fine for transitional clients; size cost on SSE. |

---

## Edge cases (scout)

1. **Duplicate → dual owners of one original** (H1) — primary production risk.
2. **PUT autosave** rewrites `pptxOriginal` if client echoes GET body — usually OK; path injection only if client tampers (M1).
3. **Cancel mid-import** before persist — covered T1.7.
4. **Cancel after persist, before create** — rollback original (`:79-83`).
5. **Cancel after create** — leftover deck (M2).
6. **Create fail after persist** — rollback T1.10.
7. **Soft-delete + restore** — original retained; download still works if file present.
8. **Template save** carries original id in template JSON; create strips — OK if strip remains.
9. **Legacy HomePage fallback** `createPresentation(imported.presentation)` — POST strips `pptxOriginal`; legacy server without Phase01 loses zero-loss bind (expected transitional).

---

## Complexity lens

| Check | Result |
|-------|--------|
| Unnecessary abstraction? | No — `original-package` + `create-imported-presentation` domain-anchored |
| Reimplemented utilities? | Uses existing `withPresentations`, multer cap, job manager |
| Over-defensive? | Mild — double strip on create POST; acceptable RT-04 depth |
| Phantom tests? | T1.4 partially (M3); T1.1–T1.3, T1.7, T1.10 solid |

---

## Positive (risk calibration only)

- Atomic import wiring clear: map → persist → create → complete; rollback on create fail.
- Client no longer binds filesystem paths; prefers server `presentationId`.
- Concurrency/SSE tests retained; job contract additive.
- Soft-delete keep-original is correct for trash restore zero-loss.

---

## Recommended actions (priority)

1. **Block signoff until H1 fixed** — duplicate must not share unlinkable original uuid without COW/refcount.
2. Sanitize or freeze `pptxOriginal` on PUT (M1).
3. Resolve post-create cancel race (M2).
4. Add real storage integration assert for T1.4 (M3).
5. Run required vitest suite; attach exit 0 to phase close.

---

## Metrics

| Metric | Value |
|--------|-------|
| Type coverage | N/A (JS) |
| Phase T1 tests present | T1.1–T1.10 mapped in suite files |
| Lint/build | Not run this session |
| Side-effect risk | **High** if users duplicate imported decks then permanent-delete |

---

## Verdict summary

| Gate | Result |
|------|--------|
| (a) Every AC met | **No** — RT-04 partial (PUT); H1 breaks zero-loss lifecycle after duplicate |
| (b) No business-logic regression in touchpoints | **No** — duplicate lifecycle regression |
| (c) Public contracts | **OK** — additive `presentationId` |
| (d) Existing patterns | **OK** — job manager DI, storage helpers |
| (e) Lint/type/build | **Unverified** |

**Overall: FAIL** — fix H1 (and preferably M1) before Phase 01 complete.

---

## Unresolved questions

1. Product intent for duplicate of imported deck: drop original package, or deep-copy bytes?
2. Should `pptxOriginal` be immutable after import (server-owned) on all write paths?
3. Vitest exit code for required suite — needs lead re-run.

---
name: pptx-import-gap-fixes
description: Fix 5 PPTX import gaps: video/audio (missing), math LaTeX (text lost), shadow (lost), image filters (not extracted), diagram connectors (lost)
status: completed
priority: P2
effort: 3-4 days (actual: ~1h)
blockedBy: []
tags:
  - pptx
  - import
  - fidelity
  - gap-fixes
created: "2026-05-01T21:17:00.000Z"
completed: "2026-05-02T03:59:00.000Z"
---

# Plan: PPTX Import Gap Fixes

## Problem Statement

Burst 5 PPTX import gaps được phát hiện qua brainstorm + deep research:
1. **Video/Audio hoàn toàn thiếu** — `videoMode: 'none'`, `audioMode: 'none'` + không có handler
2. **Math LaTeX text bị mất** — chỉ giữ image, không giữ LaTeX string để editable
3. **Shadow bị mất trên mọi element** — pptxtojson output có `{h, v, blur, color}` nhưng mapper không extract
4. **Image filters không extract** — `brightness/contrast/saturation/sharpen` không được map sang NavSlides properties
5. **Diagram connectors bị mất** — SmartArt nodes được flatten thành shapes, connectors chỉ warning không tạo lines

## Context

- Source: brainstorm report `plans/reports/brainstorm-260501-2048-pptxtojson-element-coverage.md`
- Research 1: `plans/reports/researcher-260501-video-audio-math.md`
- Research 2: `plans/reports/researcher-260501-shadow-filters-diagram.md`
- Previous work: `plans/archive/2026-05/260425-1026-pptx-full-fidelity/` (completed)

## Target Fidelity Improvement

| Element/Property | Before | After |
|---|---|---|
| Video import | 0% | ~90% (formats supported by pptxtojson) |
| Audio import | 0% | ~90% (formats supported by pptxtojson) |
| Math LaTeX text | 0% (only image) | ~90% (editable LaTeX string) |
| Shadow on elements | 0% | ~95% |
| Image brightness/contrast | ~50% (property exists, data not extracted) | ~95% |
| Diagram connectors | 0% (warning only) | ~70% (line elements) |

## Phases

| Phase | Name | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 1 | Video & Audio Import | P1 | ~1 day | ✅ done |
| 2 | Math LaTeX Import | P1 | ~2h | ✅ done |
| 3 | Shadow Extraction | P2 | ~2h | ✅ done |
| 4 | Image Filter Extraction | P2 | ~2h | ✅ done |
| 5 | Diagram Connector Preservation | P2 | ~4h | ✅ done |
| 6 | Integration Tests & Fidelity Validation | P1 | ~1 day | ✅ done |

## Phase Dependencies

```
Phase 1 (Video/Audio) ──┐
                        ├──► Phase 6 (Tests)
Phase 2 (Math) ────────┤
Phase 3 (Shadow) ──────┤
Phase 4 (Filters) ─────┤
Phase 5 (Diagram) ─────┘
```

All phases 1-5 are independent — can be implemented in parallel. Phase 6 tests all.

## Modules to Modify

| Module | Phases | Changes |
|--------|--------|---------|
| `server/services/pptx-import/parse-worker.js` | 1 | `videoMode: 'blob'`, `audioMode: 'blob'` |
| `server/services/pptx-import/mapper.js` | 1,2,3,4,5 | Add `mapVideo`, `mapAudio`, fix `mapMath`, extract shadow, extract filters, preserve connectors; export all new functions for testing |
| `server/services/pptx-import/media.js` | 1 | Export `persistZipMediaRef` hoặc refactor để reuse cho video/audio (DRY) |
| `server/services/pptx-import/mapper.test.js` | 6 | Unit tests for all 5 new behaviors |
| `server/services/pptx-import/pptx-import-e2e-flow.test.js` | 6 | E2E tests for full import pipeline |
| `shared/src/element-renderers.js` | 2 | `renderLatex`: add try-catch fallback to `_fallbackSrc` image |

## Key Design Decisions

1. **Video/Audio: reuse `persistZipMediaRef`** — do NOT create new function. Refactor `persistZipMediaRef` to accept a MIME type hint or just call it directly with `element.ref`. Format whitelist: `mp4/webm/ogg/mp3/wav`. Use `uuidv4()` for filenames (consistent with `persistImageForElement`).
2. **Video/audio ZIP extraction: MUST use `mediaIndex.files.get(normalized)`** — `mediaIndex.files` is a `Map`, not a plain object. Must call `.get()` with path normalized: `String(ref).replace(/\\/g, '/').replace(/^\/+/, '')`. Must `await` the `entry.async('nodebuffer')` Promise.
3. **External media links: handle URL refs** — if `element.ref` is a valid HTTP(S) URL, use it directly as `src` instead of ZIP extraction.
4. **Math LaTeX: dual output + renderer fallback** — set both `content` (for `renderLatex`) and `latex` field. **Also: modify `renderLatex`** to catch KaTeX errors and fall back to `_fallbackSrc` image. Skip `<[^>]+>` regex stripping — `latexFormart` already handles entity decoding.
5. **Shadow: flat fields only** — `extractShadow` returns `{shadowX, shadowY, shadowBlur, shadowColor}`. **DO NOT assign as nested object.** Spread flat fields directly onto the element: `mapped.shadowX = s.h; mapped.shadowY = s.v; ...`
6. **Image filters: divide by 1000 (NOT 100)** — pptxtojson outputs fixed-point integers (e.g., 15000 = 150%). `/1000` → `150` → CSS `brightness(150%)`. Use `uuidv4()` filename pattern.
7. **Diagram connectors: detect inside `elements[]` by shapType** — pptxtojson Diagram type does NOT have `connectors[]`/`arrows[]` fields. Connectors are Shape-type elements inside `diagram.elements[]` with line-like `shapType`. Detect them in the existing node loop. Process nodes FIRST, then connectors (z-index correct).
8. **Stats initialization: single point of update** — add `videoCount: 0, audioCount: 0, mathCount: 0` in ONE place in `mapPptxOutput()` stats object, not spread across phases.
9. **Test exports: export mapper functions for testing** — add `mapVideo`, `mapAudio`, `extractShadow`, `mapMath` to `module.exports` in mapper.js. Test mocks must use `new Map()` not plain objects.

## Red Team Review

### Session — 2026-05-02
**Findings:** 17 accepted (4 Critical, 7 High, 6 Medium)
**Severity breakdown:** 4 Critical, 7 High, 6 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Phase 1: `persistVideoAudioBlob` missing `await` on `.async()` | Critical | Accept | Phase 1 |
| 2 | Phase 1: `mediaIndex.files[ref]` bracket notation on Map (must use `.get()`) | Critical | Accept | Phase 1 |
| 3 | Phase 4: brightness/contrast divisor = 100 → should be 1000 | Critical | Accept | Phase 4 |
| 4 | Phase 3: shadow assigned as nested object, renderer reads flat fields | Critical | Accept | Phase 3 |
| 5 | Phase 1+2: stats init missing videoCount/audioCount/mathCount | Critical | Accept | Phase 1, 2 |
| 6 | Phase 1: DRY — reuse `persistZipMediaRef` instead of new function | High | Accept | Phase 1 |
| 7 | Phase 5: `connectors[]`/`arrows[]` don't exist in pptxtojson Diagram type | High | Accept | Phase 5 |
| 8 | Phase 5: connectors z-index before nodes (reversed order) | High | Accept | Phase 5 |
| 9 | Phase 1: `mapVideo`/`mapAudio` not exported | High | Accept | Phase 1 |
| 10 | Phase 6: test mock uses plain object instead of Map | High | Accept | Phase 6 |
| 11 | Phase 1: external media links (URL refs) not handled | High | Accept | Phase 1 |
| 12 | Phase 3: success criteria includes image shadow (pptxtojson doesn't emit) | High | Accept | Phase 3 |
| 13 | Phase 2: `_fallbackSrc` never used by `renderLatex` | Medium | Accept | Phase 2 |
| 14 | Phase 6: no test corpus for fidelity validation | Medium | Accept | Phase 6 |
| 15 | Phase 2: `<[^>]+>` regex may corrupt valid LaTeX | Medium | Accept | Phase 2 |
| 16 | Phase 1: filename collision risk (Date.now vs uuidv4) | Medium | Accept | Phase 1 |
| 17 | Phase 5: reuse `arrowMarker()` pattern for connector detection | Medium | Accept | Phase 5 |

### Unresolved Questions
1. pptxtojson brightness/contrast output format: is it fixed-point (15000) or percentage (150)? Needs verification against real pptxtojson output. Use `/1000` divisor as safer bet.
2. Are diagram connectors emitted as `elements[]` Shape nodes in real SmartArt PPTX? Needs test file to verify.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01, phase-02, phase-03, phase-04, phase-05, phase-06
- Decision deltas checked: 17 (all red team accepted findings) + 3 (validation answers)
- Reconciled stale references: 1 (plan.md "Modules to Create" → removed `persist-media.js`, added `element-renderers.js` to Modify table)
- Unresolved contradictions: 0

### Validation Log

**Session 1 — 2026-05-02**

| # | Question | User Decision |
|---|----------|---------------|
| 1 | Filter scale factor (/1000 vs /100) | ✅ Implement với /1000 |
| 2 | SmartArt connector detection approach | ✅ Detect trong elements[] bằng shapType |
| 3 | External media URL handling | ✅ Allow direct URLs |

**Propagation:** All 3 decisions already match current plan design. No changes required.

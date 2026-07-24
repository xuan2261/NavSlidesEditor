---
title: "PPTX Import Native OOXML 1:1 Fidelity Deep TDD"
description: "Option B: native OOXML scene graph inside NavSlides for visual+editable 1:1 PowerPoint import, zero-loss original.pptx, SSIM oracle vs LibreOffice/PowerPoint, permanent-placeholder ban, TDD gates per phase."
status: stopped
priority: P0
effort: "4-9+ calendar months for full SLA claim (see effort honesty); MVP after Phase 01-04 ~4-8 weeks"
branch: "master"
tags: [deep, tdd, pptx-import, ooxml, fidelity, visual-oracle, charts, smartart, roundtrip]
blockedBy: []
blocks: []
supersededBy: "../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md"
relatedPlans:
  - 260617-0815-pptx-import-gates-and-parser-coverage-tdd
  - 260617-0814-pptx-import-strict-gates-and-ooxml-inspection-tdd
created: "2026-07-09T06:06:56.619Z"
createdBy: "ck:plan"
source: skill
mode: "--deep --tdd"
architectureChoice: "B-native-ooxml"
rejectedChoices: ["A-collabora-onlyoffice-engine", "C-hybrid-permanent-raster"]
redTeamReviewed: "2026-07-09"
redTeamResult: "conditional-pass-after-formal-review-amendments-applied"
validated: "2026-07-09"
validationResult: "passed-with-amendments"
---

# PPTX Import Native OOXML 1:1 Fidelity Deep TDD

> **Stopped 2026-07-10.** Superseded by the package-first OfficeCLI roundtrip plan at
> [`../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md`](../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md).
> Reusable native OOXML, scene-graph, corpus, and oracle work remains an input to the successor plan.

## Overview

Implement **Option B**: full-fidelity PPTX import **native to NavSlides** (canvas/ribbon/element model), not Collabora/OnlyOffice as the editor.

User SLA (locked 2026-07-09):

> Import 1:1 không mất mát: slide trông như PowerPoint; mọi thành phần vẫn edit được; chart/SmartArt/media/layout không được bỏ hoặc chỉ thành ảnh mãi; luôn giữ file gốc; đo được bằng so với PowerPoint/LibreOffice; cái chưa làm được = lỗi / chưa đạt, không phải “đủ dùng”.

This plan is **TDD-first**: every phase starts with failing tests and a measurable verify command. Permanent raster placeholders and silent drops are **out of scope as success** — they are fail states until the owning phase lands.

## Architecture choice (locked)

| Choice | Status |
|--------|--------|
| **B — Native OOXML in NavSlides** | **SELECTED** |
| A — Embed Collabora/OnlyOffice | Rejected for this plan |
| C — Hybrid permanent visual-only | Rejected as end state (temporary debug-only raster allowed, never SLA pass) |

### Target architecture

```
.pptx upload
  → zip guards + worker (keep)
  → persist original.pptx (hash) ............... Phase 01
  → OOXML scene graph (truth) ................. Phase 03
  → map → NavSlides editable elements ......... Phases 04-07
  → present/render NavSlides
  → SSIM vs LibreOffice/PowerPoint oracle ..... Phase 02
  → re-export policy prefer unedited parts .... Phase 08
```

`pptxtojson` remains a **helper**, not the sole source of truth after Phase 03.

## Baseline evidence (2026-07-09)

| Signal | Value | SLA read |
|--------|-------|----------|
| Unit import tests | 35 files / 374 pass | Infrastructure OK |
| Corpus strict | 11/11, semantic avg **100%**, round-trip avg **70%** | Semantic OK; round-trip **fail SLA** |
| Chart fixtures | often shape/line only; OOXML gap warnings | **fail SLA** (not native editable) |
| EMF/WMF | `unsupported-image` placeholder | **fail SLA** |
| `original.pptx` sidecar | not persisted | **fail SLA** |
| Visual SSIM vs LO/PP | not measured | **cannot claim 1:1** |
| Permanent placeholders / warnings-as-OK | current product attitude | **forbidden under this SLA** |

Sources: conversation code-review + `npm run test:corpus`; `docs/pptx-import-fidelity-report.md`; `server/services/pptx-import/*`; prior plans `260617-0815-*` (complete, gates only — does not deliver 1:1).

## Cross-plan dependencies

| Plan | Relation |
|------|----------|
| `260617-0815-pptx-import-gates-and-parser-coverage-tdd` | **Complete** — baseline gates/OOXML evidence. This plan **extends** (not blocked). Reuse `inspectOoxmlCoverage`, corpus CLI, browser audit scripts. |
| `260617-0814-*` | Superseded by 0815 — historical only. |
| Active UI remediation plans (260709-0913, 260708-1900, …) | **No file-level block** (different surface). Avoid concurrent edits to `HomePage.jsx` import UX without coordination. |

`blockedBy: []` — can start Phase 01 immediately.

## Phases

| Phase | Name | Priority | Depends | Effort (guide) |
|-------|------|----------|---------|----------------|
| 1 | [Zero-loss package and SLA contract](./phase-01-zero-loss-package-and-sla-contract.md) | P0 | — | 2–4d |
| 2 | [Visual oracle SSIM gate](./phase-02-visual-oracle-ssim-gate.md) | P0 | 1 | 3–6d |
| 3 | [OOXML scene graph source of truth](./phase-03-ooxml-scene-graph-source-of-truth.md) | P0 | 1 | 5–10d |
| 4 | [Editable primitives parity](./phase-04-editable-primitives-parity.md) | P0 | 2, 3 | 5–10d |
| 5 | [Native editable charts](./phase-05-native-editable-charts.md) | P0 | 3, 4 | 5–12d |
| 6 | [Native editable SmartArt](./phase-06-native-editable-smartart.md) | P1 | 3, 4 | 5–12d |
| 7 | [Vector media EMF/WMF parity](./phase-07-vector-media-emf-wmf-parity.md) | P1 | 3, 4 | 3–8d |
| 8 | [Master/layout/theme/animation + roundtrip](./phase-08-master-layout-theme-animation-and-roundtrip.md) | P1 | 4–7 | 8–16d |

**Claim “full 1:1 SLA met” only after Phases 01–08 green** (or explicitly waived feature rows with new SLA revision signed by product owner — not implementer).

### Progressive thresholds (honest staging)

Oracle metrics may **ratchet** so early phases ship without lying:

| Milestone | mean SSIM | permanent placeholder | chart gap | smartArt gap | original.pptx |
|-----------|-----------|----------------------|-----------|--------------|---------------|
| After Phase 01 | n/a | measured only | measured | measured | **required** |
| After Phase 02 | **baseline recorded** (expect fail) | measured | measured | measured | required |
| After Phase 04 | ≥ 0.95 corpus core | = 0 for text/shape/image/table/line | measured | measured | required |
| After Phase 05 | ≥ 0.97 + chart decks | + chart permanent = 0 | **0** | measured | required |
| After Phase 06–07 | ≥ 0.98 | + smartArt/EMF permanent = 0 | 0 | **0** | required |
| After Phase 08 (SLA full) | ≥ **0.99** mean, ≥ 0.97 per-slide | **0 all classes** | 0 | 0 | required + roundtrip policy |

Until a milestone’s row is green, **CI must fail** that milestone’s gate — not warn.

## Global SLA metrics (canonical)

```text
P1  original.pptx exists; sha256(upload) == sha256(stored)
V1  mean SSIM(import_present_slide, oracle_slide) >= milestone threshold
V2  min per-slide SSIM >= milestone floor
E1  every OOXML evidence node has editable Nav counterpart (class-specific)
E2  chartEvidence - nativeEditableChart == 0        (from Phase 05)
E3  smartArtEvidence - nativeEditableDiagram == 0   (from Phase 06)
E4  permanentPlaceholderCount == 0 for claimed classes
R1  round-trip stability >= milestone (Phase 08 raises floor from 0.50)
Guard G0  existing unit suite server/services/pptx-import + routes green
Guard G1  npm run test:corpus does not regress semantic floor
```

## TDD protocol (all phases)

1. **RED** — write failing tests listed in phase `## Tests (TDD)`.
2. **GREEN** — minimal implementation to pass those tests.
3. **REFACTOR** — keep tests green; no behavior change.
4. **VERIFY** — run phase verify command; exit 0 required.
5. **GUARD** — run G0 (+ G1 when corpus touched).
6. No “ship with known permanent placeholder” for classes that phase claims.

## Core touchpoints (expected)

| Area | Paths |
|------|--------|
| Route / jobs | `server/routes/pptx-import.js`, `server/services/pptx-import-job-manager.js` |
| Import pipeline | `server/services/pptx-import/importer.js`, `pptx-guards.js`, `worker-runner.js`, `parse-worker.js` |
| Mapper | `server/services/pptx-import/mapper/**` |
| OOXML | `server/services/pptx-import/ooxml-inspection.js` → expand / new `ooxml-scene-graph/` |
| Media | `media.js`, `media-dedup.js` |
| Storage | `server/services/storage.js`, presentation JSON schema |
| Client | `client/src/pages/HomePage.jsx`, `client/src/utils/api.js`, canvas `_pptxImportMeta` |
| Fidelity | `pptx-import-corpus-cli.js`, semantic tester, browser audit scripts |
| Export | `server/services/pptx-exporter.js`, shared export helpers |
| Docs | `docs/pptx-import-fidelity-report.md`, `docs/system-architecture.md`, README import section |

## Out of scope (explicit)

- Collabora/OnlyOffice as primary editor (Choice A).
- Claiming 1:1 from semantic corpus alone.
- Binary-identical re-export of unedited packages before Phase 08 policy.
- Macros / ActiveX / OLE full execution (document as permanent **unsupported product limit** in Phase 08 with explicit SLA carve-out file — must not be silent).
- Multi-tenant job auth (separate security plan); keep UUID jobs + existing single-user model unless multi-tenant is later required.

## Security / performance constraints (carry-forward)

- Keep zip bomb measured inflate, 100MB upload, worker heap/timeout, cancel AbortSignal.
- original.pptx storage: size = upload size; enforce disk quota or same MAX_FILE_BYTES; path under `server/data/` not public without auth model awareness.
- Scene graph parse: stay in worker or budget CPU; do not block event loop with multi-100MB XML on main process without streaming.
- External media URL allowlist remains; no SSRF regression.

## Red Team Review (formal 4-lens — 2026-07-09)

Reports:
- `reports/from-code-reviewer-to-planner-red-team-security-adversary-plan-review-report.md`
- `reports/from-code-reviewer-to-planner-red-team-assumption-destroyer-plan-review-report.md`
- `reports/from-code-reviewer-to-planner-red-team-failure-mode-analyst-plan-review-report.md`
- `reports/from-code-reviewer-to-planner-red-team-scope-complexity-critic-plan-review-report.md`

Inline pre-review was **insufficient** (scope critic: effort was under-ranked). Formal review is authoritative.

### Adjudication (deduped, evidence-filtered)

| ID | Sev | Finding | Disposition |
|----|-----|---------|-------------|
| RT-01 | Critical | Phase 07 converter RCE (LO/magick on untrusted EMF) | **Accept** → Phase 07 sandbox `execFile`, no shell, network-off, timeout+memory, non-root |
| RT-02 | Critical | Job IDOR + naked `pptx-original` download | **Accept** → Phase 01 bind download to presentation id server-side only; no client path; single-user note + optional job secret |
| RT-03 | Critical | Client bind race: temp unlink before createPresentation | **Accept** → Phase 01 **server atomic** import→create presentation + original; remove client-only bind path |
| RT-04 | Critical | Path traversal if client supplies `pptxOriginal` (schema passthrough) | **Accept** → server stores only internal uuid filename; create schema strip client paths |
| RT-05 | Critical | SSIM 0.99 vs LO ≠ “like PowerPoint”; fonts/present stack | **Accept** → Phase 02 metric = LO (pinned) + Nav **present** mode; product claim language “oracle-LO”; optional PP secondary; font policy task |
| RT-06 | Critical | Oracle greenwash (`PPTX_ORACLE=off`, no LO in CI) | **Accept** → required CI job with pinned LO; ban off on required; local skip ≠ CI pass |
| RT-07 | Critical | Semantic corpus 100% ≠ 1:1; chart fixtures shape-backed | **Accept** → G1 not SLA; hostile corpus + E metrics |
| RT-08 | Critical | Effort 12–24w understated for 05–08 | **Accept** → months for full SLA; MVP line after 01–04 |
| RT-09 | Critical | Phase 08 monolith | **Accept** → split 08a layout/theme, 08b animation, 08c roundtrip+SLA composite |
| RT-10 | High | Chart.js vs E2+SSIM | **Accept** → Phase 05 chart support matrix; expand model or strict fail per type |
| RT-11 | High | Progressive thresholds redefining SLA | **Accept** → milestones = engineering gates only; **product “1:1” only after final row** |
| RT-12 | High | Host OOM (zip+worker+graph+oracle) | **Accept** → host memory budget + large-deck stress test |
| RT-13 | High | Export part-copy can corrupt PPTX | **Accept** → package-open oracle (LO) before part reuse |
| RT-14 | High | Golden/baseline detonation unowned | **Accept** → each phase owns baseline updates + review checklist |
| RT-15 | High | Scene graph on main process | **Accept** → Phase 03 prefer worker or hard CPU budget |
| RT-16 | Med | SmartArt E3 counts `diagram` while flatten→shape | **Accept** → Phase 06 fixes metric vs representation |
| RT-17 | Med | Color/SVG XSS late | **Accept** → Phase 04 T4.5 + SVG sanitize in 07 |

### Effort honesty (post red-team)

| Slice | Realistic |
|-------|-----------|
| Phase 01–02 foundation | 1–3 weeks |
| Phase 03–04 primitives MVP | 3–6 weeks |
| **MVP user value** (original + oracle debt visible + primitives strict) | **after 01–04** |
| Phase 05 charts | 1–3 months |
| Phase 06 SmartArt | 1–3 months |
| Phase 07 EMF/WMF | 2–6 weeks (tooling/security) |
| Phase 08a–c | 2–4 months |
| **Full SLA claim** | **4–9+ months** calendar |

### MVP cut line (must not stall cook forever)

Ship product increments:
1. **MVP-A (01):** zero-loss original always recoverable  
2. **MVP-B (01–04):** primitives editable + strict inventory + measured SSIM baseline  
3. **MVP-C (05–07):** charts/SmartArt/EMF  
4. **MVP-D (08):** full SLA claim  

### Whole-Plan Consistency Sweep

- Decision delta applied to Phase 01 (atomic server create, no client path), Phase 02 (golden SSIM, present-mode), Phase 05 (support matrix), Phase 07 (sandbox), Phase 08 (split a/b/c), plan effort, progressive thresholds wording.
- Validation V-01: runtime native only; goldens not LO runtime.
- Rejected: none of Critical red-team findings.
- Unresolved contradictions: **none** after V-01.

## Validation Log

### Status
**passed-with-amendments** (user interview 2026-07-09).

### Interview answers

| Topic | Decision |
|-------|----------|
| Product runtime | **Native only** — no Collabora/OnlyOffice; no LO shell for user import |
| Visual measure | **Committed golden PNGs + SSIM** in CI; optional LO only to regenerate goldens offline (V-01) |
| original.pptx | **Lifetime of presentation** |
| Claim language | present-vs-golden SSIM + editable metrics; not “runtime PowerPoint” |

### Oracle vs native (explanation)

Third-party Office is **not** in the shipped app. Goldens are test fixtures (like any screenshot regression). Regenerating goldens can use LO/PP on a maintainer PC once; CI compares Nav present to those files.

### Verification Results (planner fact-check sample)

| Claim | Result | Evidence |
|-------|--------|----------|
| Import unlinks temp in finally | VERIFIED | `server/routes/pptx-import.js` ~L59-61 |
| Client createPresentation after import | VERIFIED | `client/src/pages/HomePage.jsx` ~L675 |
| createPresentationSchema passthrough | VERIFIED | `server/middleware/schemas.js` ~L58-66 |
| Chart type coercion scatter→line | VERIFIED | `chart-output-to-navslides-mapper.js` ~L11-25 |
| OOXML inspect rels-only charts/diagrams | VERIFIED | `ooxml-inspection.js` ~L53+ |
| Job IDOR comment documents no identity | VERIFIED | `pptx-import.js` ~L72-77 |
| MAX_CONCURRENT_RUNNING=1 | VERIFIED | `pptx-import-job-manager.js` |
| Corpus 11 decks semantic 100% RT ~70% | VERIFIED | 2026-07-09 `npm run test:corpus` |

- Tier: Full (8 phases)
- Failed path claims: 0 in sample

### Whole-Plan Consistency Sweep (post-validation)

- Phase 02 + plan Validation Log + red-team-and-validation.md aligned on golden-first oracle.
- Phase 01 retention = presentation lifetime.
- No remaining “CI must install LO” as hard requirement.

## Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multi-month effort | Schedule | Phase gates; partial product value after 01–04 |
| SSIM flaky | CI noise | Fixed viewport, font bundle, antialias settings, tolerance band |
| Memory (zip+graph+oracle) | OOM | Keep worker isolation; stream; cap concurrent imports=1 |
| Schema explosion | Editor complexity | Prefer extend existing types; new types only with element-defaults + tests |
| Round-trip 70% → 99% hard | Phase 08 slip | Prefer original parts for unedited nodes |

## Verify commands (repo-level)

```bash
# Guard G0
npx vitest run server/services/pptx-import server/routes/pptx-import --reporter=dot

# Guard G1
npm run test:corpus

# After Phase 02+
npm run test:pptx:oracle   # to be added

# Full claim (post Phase 08)
npm run test:pptx:strict && npm run test:pptx:oracle && npm run test:pptx:sla-1to1
```

## Progress

| Phase | Status |
|-------|--------|
| 01 Zero-loss package + SLA contract | **completed** |
| 02 Visual oracle SSIM | **completed** (+ `capture-present` / `test:pptx:oracle:capture`; real LO goldens still debt) |
| 03 OOXML scene graph | **advanced** — nodeId + name/sourceId match + multi-slide keys |
| 04 Editable primitives | **advanced** — placeholder inject + primitive ban tests |
| 05 Native charts | **advanced** — corpus chart decks E2 gap 0 via OOXML inject (T5.2–T5.5) |
| 06 Native SmartArt | **advanced** — data.xml parser + inject shapes with `_pptxDiagram` model |
| 07 EMF/WMF | **advanced** — convert→PNG when enabled; strict fails without convert |
| 08 Master/layout/theme/roundtrip | **advanced** — 08a theme/layout XML; 08b anim inventory; 08c original-bytes + dirty flag + sla-1to1 |

## Success criteria (whole plan)

- [ ] All 8 phases success checklists complete
- [ ] Full SLA row green (metrics table)
- [ ] Docs updated: fidelity report + system-architecture import section
- [x] `original.pptx` download path documented and tested (Phase 01)
- [ ] No permanent placeholder classes for claimed object types
- [ ] Red-team/validation amendments not regressed

## Open questions

1. CI image: install LibreOffice in GitHub Actions — approve package size/time? (Default plan: yes for oracle job, optional non-blocking until Phase 02 lands.)
2. Storage policy: keep original forever vs TTL with user re-upload? (Default: lifecycle = presentation lifetime.)
3. Font licensing for oracle parity (embed subset vs system fonts) — Phase 02/04.

## Post-plan cook entry

```bash
/ck:cook plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd
```

Start at **Phase 01** only; do not skip oracle/package foundations.

## Journal / mode

- Mode: `--deep --tdd`
- Research: codebase + corpus baseline 2026-07-09 + prior fidelity docs/plans
- Red-team: done (inline)
- Validate: done (inline)

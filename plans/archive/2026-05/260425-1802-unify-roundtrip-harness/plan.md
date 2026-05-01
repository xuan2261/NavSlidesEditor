---
title: "Unify Round-trip Stability Harness with Production Export Pipeline"
description: "Replace the minimal pptxgenjs harness exporter with production client export pipeline (ported to shared+server modules), improving round-trip stability from 1-7% to official target ≥98%. Phase 0: baseline, Phase 1: env verification, Phase 2: shared utilities, Phase 3: server renderers with mandatory rasterization, Phase 4: integrate harness, Phase 5: improve matching, Phase 6: tests, Phase 7: validate."
status: completed
priority: P1
branch: master
tags:
  - pptx
  - export
  - round-trip
  - stability
  - fidelity
blockedBy:
  - plans/260425-1026-pptx-full-fidelity/
blocks: []
created: "2026-04-25T11:02:00.000Z"
createdBy: "ck:plan"
source: skill
reviewedBy: "red-team-review"
---

# Unify Round-trip Stability Harness with Production Export Pipeline

## Overview

Phase 7 của `260425-1026-pptx-full-fidelity` đã implement fidelity tester với 2 metrics: **Semantic Fidelity (95%)** và **Round-trip Stability (1–7%)**. Round-trip thấp vì harness dùng minimal exporter.

**Root cause:** `exportPresentationForRoundTrip()` chỉ handle 5 element types với logic tối giản — `stripHtml()` cho text, chỉ `ellipse`/`rect` cho shape, không rasterization, không merged cells.

**Architecture:** Thay vì tạo HTTP endpoint, port production renderers sang `shared/src/` (pure utilities) + `server/utils/` (server-specific). Harness `require()` trực tiếp — không HTTP export endpoint. Rasterization vẫn phải có server-side renderer/file-system vendor access.

**Official goal:** Stability từ 1–7% → **≥98% round-trip**. Background gradients/images and rasterizable complex visual elements must be rasterized, not replaced by color/text placeholders.

## Red Team Findings (pre-plan)

1. `pptxgenjs` chỉ có ở `client/package.json`, không có ở server → **thêm vào server/package.json**
2. Client là ESM (`"type": "module"`), server là CommonJS → **convert imports → requires khi port**
3. `export-pptx-raster-capture.js` dùng browser APIs (FileReader, window.location) → **không port**, dùng `server/services/pptx-exporter.js` (Playwright) đã có
4. Phase 4 matching algorithm có 2 bugs: (a) `indexOf` returns wrong index cho duplicate fingerprints, (b) proximity check chạy sau match đã được accept → **rewrite**
5. Server raster endpoint hiện chỉ handle `html`/`latex`; background gradient raster via `getServerRasters({ elements: [] })` returns `{}` → **implement dedicated background rasterization**
6. Imported images use `/uploads/<file>`; client `normalizeImageSource()` would resolve this as filesystem root in Node → **add server image source resolver**
7. Matching `type-only` must not count as full stability match; it is diagnostic/partial only → **avoid inflated ≥98 metric**
8. Tests must use Vitest (`vi.mock`) and real corpus/generator fixtures; no `jest.mock`, no missing `/tmp/sample.pptx`
9. Phase 2/3 effort ước tính 9h → thực tế ~13h do module system conversion + mandatory rasterization

## Phases

| Phase | Name | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 0 | [Baseline Benchmark](./phase-00-baseline-benchmark.md) | P2 | 2h | Completed |
| 1 | [Environment Verification + pptxgenjs Setup](./phase-01-env-verification.md) | P1 | 1h | Completed |
| 2 | [Port Pure Utilities to shared/src](./phase-02-port-shared-utilities.md) | P1 | 5h | Completed |
| 3 | [Port Server-Specific Renderers to server/utils](./phase-03-port-server-renderers-reuse-pptx-exporter.md) | P1 | 8h | Completed |
| 4 | [Integrate Production Pipeline into Harness](./phase-04-integrate-production-export-into-harness.md) | P1 | 2h | Completed |
| 5 | [Improve Round-trip Matching Algorithm](./phase-05-improve-matching.md) | P1 | 4h | Completed |
| 6 | [Write Tests for All Phases](./phase-06-write-tests-for-all-phases.md) | P1 | 4h | Completed |
| 7 | [Validate on 4-Deck Corpus + Targets](./phase-07-validate-on-corpus.md) | P1 | 3h | Completed |

**Total effort:** ~29h (sequential, 8 phases)

## Dependencies

- Phase 0–7 completed: [plans/260425-1026-pptx-full-fidelity/](../260425-1026-pptx-full-fidelity/plan.md)
- Existing server raster: `server/services/pptx-exporter.js` — Playwright-based rasterization cho html/latex (đã có)
- Key source files: `client/src/utils/export-pptx-*.js` (10 files)

## Architecture

```
shared/src/                    (CommonJS — npm workspace package)
├── shared-color-utils.js       ← port: export-pptx-color-utils.js (pure)
├── shared-html-parser.js       ← port: export-pptx-html-parser.js (pure)
├── shared-text-runs.js         ← port: export-pptx-text-runs.js (pure)
├── shared-slide-notes.js       ← port: slide-notes.js (pure)
├── shared-pptx-core.js         ← port: export-pptx-core.js (pure)
└── index.js                   ← append PPTX exports, preserve existing exports

server/utils/                  (CommonJS — server-specific)
├── server-export.js            ← entry point: production export pipeline
├── server-background.js        ← port: export-pptx-background.js (server raster)
├── server-renderers.js        ← port: export-pptx-renderers.js
├── server-basic-renderers.js  ← port: export-pptx-basic-renderers.js
├── server-fallback.js         ← port: export-pptx-fallback-renderer.js
├── server-image-source.js     ← Node resolver for /uploads, data URIs, absolute paths
├── server-background-raster.js← dedicated Playwright background rasterization
└── server-raster.js           ← rasterize html/latex + rasterizable complex visual elements

server/services/
├── pptx-exporter.js           ← đã có: Playwright rasterization cho html/latex
└── pptx-import/
    └── pptx-import-semantic-and-roundtrip-fidelity-tester.js  ← tích hợp Phase 4+5

client/src/utils/              (ESM — không thay đổi Phase 2-3)
├── export-pptx-*.js           ← import từ shared/ sau này (NOT in scope)
```

**Harness integration (Phase 4):**
```js
// pptx-import-semantic-and-roundtrip-fidelity-tester.js
const { exportToFile } = require('../../utils/server-export')
// Thay vì fetch('http://localhost:3002/api/export-pptx', ...)
// Gọi trực tiếp: await exportToFile(presentation, filePath)
```

## Modules to Create

| Module | Phase | Purpose |
|-------|-------|---------|
| `shared/src/shared-*.js` | 2 | 5 pure utility modules (CommonJS) |
| `server/utils/server-export.js` | 3 | Export entry point |
| `server/utils/server-background.js` | 3 | Background renderer (uses dedicated background raster for gradient/image) |
| `server/utils/server-renderers.js` | 3 | Dispatcher renderer |
| `server/utils/server-basic-renderers.js` | 3 | Per-type renderers |
| `server/utils/server-fallback.js` | 3 | Fallback renderer |
| `server/utils/server-image-source.js` | 3 | Resolve `/uploads/*` and local paths in Node |
| `server/utils/server-background-raster.js` | 3 | Rasterize gradient/image backgrounds with Playwright |
| `server/utils/server-raster.js` | 3 | Rasterize html/latex and rasterizable complex visual elements |
| `server/services/pptx-import/roundtrip-matching.test.js` | 6 | Matching algorithm tests |

## Modules to Modify

| Module | Phase | Changes |
|-------|-------|---------|
| `server/package.json` | 1 | Thêm `pptxgenjs` |
| `shared/package.json` | 2 | Update main entry, verify CommonJS |
| `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` | 4, 5 | Thay minimal exporter bằng production pipeline; fix matching algorithm |
| `docs/pptx-import-fidelity-report.md` | 7 | Update stability scores |

## Key Design Decisions

1. **Shared module architecture** (thay vì HTTP endpoint): Port pure utilities to `shared/src/` (CommonJS). Server-specific renderers in `server/utils/`. Harness `require()` trực tiếp — không HTTP overhead, không server startup dependency cho export.
2. **Mandatory server rasterization**: Reuse `server/services/pptx-exporter.js` where valid, but add dedicated background rasterization and Node asset resolution. Background gradients/images cannot fall back to plain color for target runs.
3. **No visual placeholder for rasterizable types**: Complex visual types (`icon`/`drawing`/`markdown`/`qrcode`/`svg`, and any non-native chart fallback) must rasterize. Placeholder only allowed for truly non-static media (`audio`/`video`) and must count as a documented gap.
4. **ESM→CJS conversion**: Client files dùng `import`/`export` → Server files dùng `require`/`module.exports`. Mỗi port giữ nguyên logic, chỉ đổi syntax.
5. **Fingerprint matching**: Type + normalized position bucket (20px) + size bucket (10px) + text prefix (50 chars). Greedy matching với used-by-reference tracking. Only `exact` and `proximity` count as full stability matches; `type-only` is diagnostic.

## Round-trip Stability Breakdown

| Element | Harness | Official Target | Required Fix |
|---------|---------|-----------------|--------------|
| Text | 7% | ≥99% | HTML → text runs, exact bounds |
| Shape | 3% | ≥99% | 15+ native types, fill/stroke/rotation |
| Line | 5% | ≥99% | real coords + arrows + dash |
| Table | 2% | ≥95% | merged cells + styles |
| Image | 60% | ≥99% | `/uploads` resolver + crop/flip metadata |
| Background | 0% | ≥98% | mandatory gradient/image rasterization |
| Chart | low/unknown | ≥90% | native chart or raster fallback |
| **Overall** | **1–7%** | **≥98%** | production export + strict matcher |

Target ≥98% only counts when export method is `production`, rasterization is available, and no minimal fallback was used.

## Risks

1. **pptxgenjs server-side**: Client có `pptxgenjs@4.0.1`. Thêm vào server và verify hoạt động.
2. **ESM→CJS conversion**: Mỗi import cần convert. Verify tất cả transitive deps không có ESM-only syntax.
3. **Server raster coverage**: `pptx-exporter.js` chỉ rasterizes `html`/`latex`. Plan must add background and complex visual raster paths; placeholder fallback fails the official target.
4. **DRY violation**: Client và server có duplicate code. Acceptable cho Phase 3. Long-term: extract shared utilities to `shared/` incrementally.
5. **Corpus size**: 4 files → high variance in metrics. Document limitation, but do not lower official ≥98 target.
6. **Local asset resolution**: `/uploads/*` and vendor assets need Node-safe resolution for CLI harness and strict runs.

## Validation Log

### Session 1 — 2026-04-25
**Trigger:** Post-plan hard-mode validation (ck:plan validate)
**Questions asked:** 4

#### Questions & Answers

1. **[Effort] Phase 2/3 effort estimates — `getShapeType` + `htmlToPptTextRuns` not in revealjs-shared**
   - Options: (A) Tách sang Phase 2 riêng | (B) Giữ nguyên plan, tăng effort | (C) Chấp nhận DRY violation
   - **Answer:** A — Tách getShapeType + htmlToPptTextRuns sang Phase 2 riêng
   - **Rationale:** `getShapeType` và `htmlToPptTextRuns` là trong `export-pptx-core.js` (client/utils), không có trong `revealjs-shared`. Phase 2 cần port chúng vào `shared-pptx-core.js`. Effort tăng: 3h → 4h. Total: 22h. Superseded by Session 2 mandatory raster update.

2. **[Bug Labels] Phase 5 plan ghi "2 bugs trong current algorithm" nhưng Phase 4 là integration**
   - Options: (A) Sửa labels → "bugs to avoid" | (B) Giữ nguyên
   - **Answer:** A — Sửa plan: ghi là "bugs to avoid in new implementation"
   - **Rationale:** Bug #1 (`indexOf`) và Bug #2 (proximity-after-match) là patterns CẦN TRÁNH trong new fingerprint-based implementation, không phải bugs trong current code. Updated phase-05-improve-matching.md header + added Fix examples.

3. **[Baseline] Phase 0 baseline report — đã có scores trong docs, cần gì thêm?**
   - Options: (A) Tạo report từ kết quả có | (B) Chạy lại với verbose output | (C) Bỏ Phase 0
   - **Answer:** B — Chạy lại baseline với instrumented output
   - **Rationale:** Phase 0 cần instrumented output: per-element-type breakdown, element-by-element diffs, timing. Hiện tại fidelity tester chưa có per-type breakdown. Phase 0: instrument + run + save to baseline report.

4. **[pptxgenjs Setup] Server cần pptxgenjs — cách nào?**
   - Options: (A) Add to server/package.json | (B) Workspace symlink | (C) Add to shared/package.json
   - **Answer:** A — Thêm vào server/package.json
   - **Rationale:** Phase 01: `npm install pptxgenjs@4.0.1 --save --workspace=server`. Server dùng `require()` → resolves to `dist/pptxgen.cjs.js`. Workspace hoisting ensures single copy.

#### Confirmed Decisions
- Phase 2 effort: 3h → 4h (port getShapeType + htmlToPptTextRuns + 5 utilities; superseded to 5h in Session 2)
- Phase 5 bug labels: updated to "Common bugs to avoid"
- Phase 0: instrumented baseline run (per-type breakdown + diffs)
- pptxgenjs: add to server/package.json directly

#### Action Items
- [x] Update Phase 2 effort to 4h (superseded to 5h in Session 2)
- [x] Update Phase 5 "Bugs in Index-Based Algorithm" → "Common Bugs to Avoid in New Implementation"
- [x] Update Phase 01 to clarify pptxgenjs workspace installation
- [x] Update plan.md total effort: 21h → 22h (superseded to 29h in Session 2)

#### Impact on Phases
- Phase 2: effort 3h→4h; now includes port of getShapeType + htmlToPptTextRuns as part of shared-pptx-core.js. Superseded to 5h in Session 2.
- Phase 5: no logic change, only label + documentation fix
- Phase 1: no change needed (already covers pptxgenjs to server/package.json)

### Session 2 — 2026-04-25
**Trigger:** Debug review follow-up; user confirmed official target remains docs target ≥98 round-trip and rasterization is mandatory.

#### Confirmed Decisions
- Official round-trip target: **≥98% overall**, not ≥80/90.
- Background gradients/images: **must rasterize**; color fallback invalid for official validation.
- Rasterizable complex visual types (`icon`/`drawing`/`markdown`/`qrcode`/`svg`) must rasterize or fail strict mode.
- `type-only` matching is diagnostic only; it does not count as stable.
- Minimal exporter fallback is development-only and invalid for official target reports.

#### Action Items
- [x] Update target and success criteria from ≥80/90 to ≥98.
- [x] Fix harness require path to `../../utils/server-export`.
- [x] Add server `/uploads/*` image resolver requirement.
- [x] Replace gradient `getServerRasters()` assumption with dedicated background rasterization.
- [x] Update tests to Vitest, real corpus fixture, strict production export, and ≥98 threshold.
- [x] Update total effort to 29h.

#### Impact on Phases
- Phase 2: effort 4h→5h; preserve existing `shared/src/index.js`, replace client constants with shared-safe constants.
- Phase 3: effort 5h→8h; add `server-image-source.js` and `server-background-raster.js`.
- Phase 5: effort 3h→4h; count only exact/proximity matches as stable.
- Phase 6: effort 3h→4h; add raster/background/image-source tests.
- Phase 7: effort 2h→3h; strict validation target is ≥98 with mandatory rasterization.

### Session 3 — 2026-04-25
**Trigger:** Final strict corpus validation and plan sync.

**Result:** Semantic fidelity 97.0%, round-trip stability 99.0%, export method production, 4/4 corpus decks passed.

**Reports:** `plans/reports/baseline-roundtrip-report.md`, `plans/reports/final-roundtrip-report.md`

**Status:** Completed

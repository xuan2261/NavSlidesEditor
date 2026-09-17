---
title: "PPTX Native-Strict 11/11 Qualification Remediation Deep TDD"
description: "Eliminate 13 unmapped sceneGraph/placeholder nodes across Bai_2_1.pptx and Bai_2_5.pptx to achieve 11/11 native strict corpus qualification without degrading best-effort fidelity."
status: completed
priority: P0
effort: "3-5 engineer-days"
branch: feat/pptx-strict-11-of-11-qualification
tags: [pptx, sceneGraph, reconciliation, parser, mapper, drawingml, tdd, qualification]
created: 2026-09-17
mode: "--deep --tdd"
---

# PPTX Native-Strict 11/11 Qualification Remediation Deep TDD

## Outcome & Goals

Deliver a verifiable, zero-regression remediation for PPTX strict native qualification:
1. Pass 11/11 decks in native strict mode (runImporterQualification reports 0 blockers across all 11 corpus decks).
2. Resolve the 8 unmapped / placeholder nodes in Bai_2_1.pptx.
3. Resolve the 5 unmapped / placeholder nodes in Bai_2_5.pptx.
4. Preserve full best-effort semantic mapping & visual stability: 0 regressions on all existing 1,419 Vitest test suites, full Playwright E2E suite, and export roundtrip fixtures.
5. Enforce deterministic qualification receipts with updated hash digest and manifest audit evidence.

---

## Root Cause Analysis & Technical Baseline

### Current Failure State
- `runImporterQualification` strict mode currently scores:
  - Total Decks: 11
  - Passing Decks: 9
  - Rejecting Decks: 2 (`Bai_2_1.pptx` and `Bai_2_5.pptx`)
- Exact Blocker Breakdown:
  - `Bai_2_1.pptx`:
    - `sceneGraphMappedNodes`: 310
    - `sceneGraphUnmapped`: 8
    - `permanentPlaceholderCount`: 8
    - Blockers: `['non-zero-sceneGraphUnmapped', 'non-zero-permanentPlaceholderCount', 'strict-rejected']`
  - `Bai_2_5.pptx`:
    - `sceneGraphMappedNodes`: 556
    - `sceneGraphUnmapped`: 5
    - `permanentPlaceholderCount`: 5
    - Blockers: `['non-zero-sceneGraphUnmapped', 'non-zero-permanentPlaceholderCount', 'strict-rejected']`

### Investigation Findings
1. **DrawingML / OLE / GraphicFrame Structure**:
   - `Bai_2_1` contains embedded legacy OLE objects (`ppt/embeddings/oleObject*.bin`) and grouped DrawingML shapes containing nested shapes with non-visual drawing properties (`nvSpPr`) that generate sceneGraph nodes but are omitted during native shape mapping.
2. **Reconciliation Mapping Discrepancy (`reconcileSceneGraph`)**:
   - The sceneGraph engine parses every raw OOXML node (`p:sp`, `p:pic`, `p:graphicFrame`, `p:grpSp`).
   - The mapping layer (`mapPptxOutput`) drops or collapses specific unsupported embedded frames/sub-shapes into general slide warnings rather than synthesizing corresponding placeholder elements or semantic shape representations with scene graph node tracking IDs (`nodeId`).
3. **Permanent Placeholder Policy**:
   - Strict qualification requires `permanentPlaceholderCount === 0`. Elements flagged as unresolved placeholders or unmapped sceneGraph items fail the SLA contract gate (`sla-contract.js`).

---

## Implementation Phases (TDD Order)

### Phase 1: Diagnostic Harness & Node Inspection (Test First)
- [x] Write targeted unit test in `server/services/pptx-import/tests/bai-strict-diagnostics.test.js`:
  - Inspect exact `nodeId`, `tag`, `type`, `bounds`, and parent hierarchy of all 8 unmapped nodes in `Bai_2_1.pptx`.
  - Inspect exact `nodeId`, `tag`, `type`, `bounds`, and parent hierarchy of all 5 unmapped nodes in `Bai_2_5.pptx`.
  - Assert expected failure details prior to parser changes.
- [x] Deliverable: Diagnostic snapshot fixture detailing the 13 offending nodes.

### Phase 2: DrawingML Group Shape & Nested Element Parser Hardening
- [x] Enhance `server/services/pptx-import/drawingml.js` and `server/services/pptx-import/shape-parser.js`:
  - Ensure recursive traversal of nested group shapes retains strict tracking identifiers (`xmlNodeId` / `sceneGraphNodeId`).
  - Correctly map DrawingML shapes that have empty text bodies (`a:txBody`) but valid geometry strokes/fills so they are not pruned before sceneGraph reconciliation.
- [x] Verification: Unit tests in `shape-parser.test.js` verifying nested group shape preservation.

### Phase 3: GraphicFrame & OLE/Vector Fallback Node Reconciliation
- [x] Enhance `server/services/pptx-import/graphic-frame.js` and `reconcileSceneGraph` in `server/services/pptx-import/scene-graph.js`:
  - When an OLE object or embedded vector shape has an associated preview image or fallback bounding box, synthesize a valid native presentation element carrying the sceneGraph `nodeId`.
  - Ensure semantic classification does not mark them as `permanentPlaceholder` when valid geometry and visual boundaries are preserved.
- [x] Verification: Unit tests in `scene-graph.test.js` validating 100% node reconciliation for embedded frames.

### Phase 4: Strict Mode Qualification Verification & Evidence Delivery
- [x] Run `runImporterQualification` in full strict mode across the entire 11-deck test corpus:
  - Verify `Bai_2_1.pptx` achieves `sceneGraphUnmapped === 0` and `permanentPlaceholderCount === 0`.
  - Verify `Bai_2_5.pptx` achieves `sceneGraphUnmapped === 0` and `permanentPlaceholderCount === 0`.
  - Verify all 11 decks report `passed: true` with 0 blockers.
- [x] Run full test suite: Vitest (1,419 suites), Playwright E2E, and lint checks.
- [x] Update qualification report and evidence receipt: `plans/reports/pptx-strict-11-of-11-evidence.json`.

---

## Acceptance Criteria
1. `node scripts/run-pptx-qualification.cjs` outputs `11/11 decks qualified (100%)` in strict mode.
2. 0 unmapped sceneGraph nodes (`sceneGraphUnmapped === 0`) across all corpus decks.
3. 0 permanent placeholders (`permanentPlaceholderCount === 0`) across all corpus decks.
4. All existing tests pass without regressions (`npm test` passes 100%).

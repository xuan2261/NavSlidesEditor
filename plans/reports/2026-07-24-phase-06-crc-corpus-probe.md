# Phase 6 — CRC corpus probe + fail-closed decision

**Date:** 2026-07-24  
**Plan:** `260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd`  
**Phase:** 6 CRC Policy And Adversarial Corpus Breadth

## Probe method

Load each metrics-lane `.pptx` under `server/data/test-corpus/` with JSZip
`checkCRC32: true` (same enforcement path chosen for import).

## Results

| Metric | Value |
| --- | --- |
| Decks probed | 11 |
| Pass (CRC OK) | 11 |
| Fail (false positive) | **0** |
| False-positive rate | 0% |

### Per deck

All OK: `background-image-notes-footer`, `Bai_2_1`, `Bai_2_2`, `Bai_2_5`,
`chart-bars-lines`, `chart-pie-scatter`, `diagram-process-flow`,
`math-rich-text`, `non-default-4x3-resolution`, `STTre_Duc`, `table-shapes-media`.

## Decision

**Ship fail-closed** import CRC policy:

- `IMPORT_CRC_POLICY.mode = 'fail-closed'`
- `checkCRC32: true` on `validatePptxPackage` / `loadPptxArchive`
- Stable reject code: `zip-crc-mismatch`
- No warn-only default; no silent accept of bad CRC

## JSZip behavior note

- `checkCRC32: true` rejects on load with message `Corrupted zip : CRC32 mismatch`
- `checkCRC32: false` accepts corrupt declared CRC and returns inflated payload

## Adversarial lane

Isolated via `npm run test:pptx:adversarial` — fixtures under
`server/data/test-corpus/adversarial/` are **not** included in metrics averages.

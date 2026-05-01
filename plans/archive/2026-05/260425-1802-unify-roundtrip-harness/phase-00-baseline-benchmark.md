---
phase: 0
title: "Baseline Benchmark"
status: completed
priority: P2
effort: 2h
dependencies: []
---

# Phase 0: Baseline Benchmark

## Overview

Đo round-trip stability hiện tại của 4 deck trong corpus `PPTX/` bằng `--roundtrip` flag, ghi nhận per-element breakdown để có baseline so sánh sau khi implement production pipeline. **Budget 2h** (red team found 1h too optimistic).

## Requirements

- Functional: Chạy fidelity tester với `--roundtrip` trên 4 deck, thu thập metrics chi tiết
- Non-functional: Baseline metrics phải reproducible

## Architecture

```
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip
```

Output: per-deck stability %, per-slide breakdown, diff list (element-drift, element-count-mismatch).

## Related Code Files

- Modify: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` — thêm detailed breakdown output
- Read: `PPTX/*.pptx` — 4 corpus files
- Read: `docs/pptx-import-fidelity-report.md` — existing metrics

## Implementation Steps

### Step 1: Instrument fidelity tester

Thêm output chi tiết trong `computeRoundTripStability()`:
- Per-slide matched/total count
- Per-element type matched count (text/shape/line/table/image)
- List các diffs với type, slide, index, method (element-drift, element-count-mismatch)

```js
// Trong computeRoundTripStability, thêm:
const diffs = []
const byType = { text: 0, shape: 0, line: 0, table: 0, image: 0, other: 0 }
const byTypeTotal = { text: 0, shape: 0, line: 0, table: 0, image: 0, other: 0 }
```

### Step 2: Enhance reporter

Trong `reportResults()`, thêm:
```
Round-trip per-element breakdown:
  text: X/Y matched (Z%)
  shape: X/Y matched (Z%)
  line: X/Y matched (Z%)
  table: X/Y matched (Z%)
  image: X/Y matched (Z%)
```

### Step 3: Run baseline

```bash
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip
```

Lưu output vào `plans/reports/baseline-roundtrip-report.md`

### Step 4: Classify diffs

Đọc diff list, phân loại:
- `element-count-mismatch` → element bị skip hoàn toàn
- `element-drift` với `sameType=false` → type không match
- `element-drift` với `sameType=true, positionClose=false` → position/size out of 2px tolerance

### Step 5: Document baseline

Record kết quả:
- Overall: X%
- Per deck: Bai_2_1=X%, Bai_2_2=X%, Bai_2_5=X%, STTre_Duc=X%
- Per element breakdown
- Gap analysis: tại sao stability thấp (đã biết từ investigation — stripHtml, shape simplification, etc.)

## Success Criteria

- [x] Baseline round-trip stability recorded for all 4 decks
- [x] Per-element type breakdown available
- [x] Diff classification documented
- [x] Report saved to `plans/reports/baseline-roundtrip-report.md`

## Risk Assessment

- **Risk:** Harness crash on certain deck — **Mitigation:** Wrap each deck test in try/catch, continue with remaining decks
- **Risk:** Baseline already known (1–7%) — **Mitigation:** This phase is documentation + instrumentation; proceed to Phase 1

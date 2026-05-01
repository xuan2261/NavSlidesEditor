---
name: pptx-import-fidelity-improvements
description: Fix fidelity tester bugs and improve image/group property coverage in PPTX import
status: completed
priority: P2
blockedBy: []
---

# Plan: PPTX Import Fidelity Improvements

## Problem Statement

After the zIndex fix (commit `4c00cb9`), fidelity testing reveals two remaining issues:

1. **Image property coverage 75-88%**: A measurement bug in `evaluateCapture` + unrecognized `math` type from pptxtojson
2. **Group geometry "drift" 481-807px**: Primarily a measurement artifact — groups are flattened to children but fidelity test measures groups vs placeholders

## Key Findings

### Scale & Coordinate System
- pptxtojson v2.0.2 returns `output.size = {width: 960, height: 540}` (canvas units)
- `scale = CANVAS_SIZE / source_size = 1.0` for all corpus files
- All coordinates are ALREADY in canvas units — no EMU conversion needed
- `mapBox` with scale=1 is a pass-through — no double-scaling issue exists
- Group children coordinates from pptxtojson are in canvas units (e.g., child `left=0` is relative to group origin in canvas space)

### Group Geometry
- ALL groups in corpus have `rotate=0` — rotation code paths untested in corpus
- Large "drift" (481-807px) is because fidelity test compares GROUP source positions against PLACEHOLDER nav elements — these are fundamentally different objects
- The actual group CHILDREN positions are computed correctly (canvas coordinates with scale=1)

### Image Property Coverage
- Bai_2_2 "other" type (0% coverage, 4 source → 0 nav): these are `math` elements from pptxtojson (Office math/equations) — no handler exists
- Fidelity test `evaluateCapture` has a logic bug: `if (navEl.objectFit) gaps.push('preserved-objectFit')` — this PUSHES a gap when objectFit IS present, when it should only gap when it's MISSING from source

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Fix fidelity tester bugs (image scoring + "math" type) | completed |
| 2 | Fix group geometry fidelity measurement + unit tests | completed |
| 3 | Harden image property mapping | completed |

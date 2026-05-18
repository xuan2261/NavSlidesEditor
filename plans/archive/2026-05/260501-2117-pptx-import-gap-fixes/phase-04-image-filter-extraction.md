---
phase: 4
title: "Image Filter Extraction from pptxtojson Filters Object to NavSlides Image Element"
status: pending
priority: P2
effort: ~2h
dependencies: []
---

# Phase 4: Image Filter Extraction from pptxtojson Filters Object to NavSlides Image Element

## Overview

Extract image adjustments/filters từ pptxtojson (`element.filters: {brightness?, contrast?, saturation?, sharpen?}`) và map sang NavSlides image element properties.

## Red Team Fixes Applied
- **[FIX #3]** Brightness/contrast divisor = 1000 KHÔNG PHẢI 100. pptxtojson outputs fixed-point integers (e.g., 15000 = 150%). `/1000` → `150` → CSS `brightness(150%)`. Renderer check: `el.filterBrightness !== 100` → expects percentage scale (0-200+).

## Context Links
- Research: `plans/reports/researcher-260501-shadow-filters-diagram.md` (Gap 2)
- Mapper: `server/services/pptx-import/mapper.js` (`mapImage()`)
- Types: `shared/src/types/presentation.js` (filterBrightness, filterContrast, filterGrayscale)
- Renderer: `shared/src/element-renderers.js` (`renderImage()` at line 78-86 — reads `el.filterBrightness !== 100` expecting percentage scale)

## Requirements
- Functional: Image brightness/contrast được preserve từ PPTX
- Non-functional: Scale correctly — divide by 1000 for pptxtojson fixed-point to CSS percentage

## Related Code Files
- Modify: `server/services/pptx-import/mapper.js` — extract filters in mapImage

## Implementation Steps

### 1. Add filter extraction in mapImage

File: `server/services/pptx-import/mapper.js`, trong `mapImage()` — thêm vào `img` object sau phần border:

```js
// Existing: borderColor, borderWidth
if (element.borderColor) img.borderColor = element.borderColor
if (readNumber(element.borderWidth, 0) > 0) img.borderWidth = readNumber(element.borderWidth, 0)

// [FIX #3] Extract image filters — divide by 1000 for pptxtojson fixed-point → CSS percentage
if (element.filters) {
  const f = element.filters
  // brightness: pptx fixed-point (e.g., 15000 = 150%) → /1000 = 150 → CSS brightness(150%)
  if (typeof f.brightness === 'number' && f.brightness !== 100000) {
    img.filterBrightness = Math.round(f.brightness / 1000)
  }
  // contrast: pptx fixed-point → /1000 = CSS percentage
  if (typeof f.contrast === 'number' && f.contrast !== 100000) {
    img.filterContrast = Math.round(f.contrast / 1000)
  }
  // saturation: 0 = full grayscale, 100000 = full color
  if (typeof f.saturation === 'number' && f.saturation !== 100000) {
    if (f.saturation === 0) {
      img.filterGrayscale = 100
    } else if (f.saturation < 50000) {
      // Partial desaturation — approximate as grayscale percentage
      img.filterGrayscale = Math.round((1 - f.saturation / 100000) * 100)
    }
  }
  // sharpen: pptx 0-1+ range — not mappable to CSS, store in meta
  if (typeof f.sharpen === 'number' && f.sharpen > 0) {
    img._pptxImportMeta = { ...(img._pptxImportMeta || {}), _pptxSharpen: f.sharpen }
  }
  // colorTemperature: warm/cool — store in meta, not directly mappable
  if (typeof f.colorTemperature === 'number') {
    img._pptxImportMeta = { ...(img._pptxImportMeta || {}), _pptxColorTemp: f.colorTemperature }
  }
}
```

### 2. Verify element-renderers.js handles filters correctly

File: `shared/src/element-renderers.js` line 78-86 — đã handle sẵn:
```js
const imgFilterParts = [
  el.filterBrightness != null && el.filterBrightness !== 100
    ? `brightness(${el.filterBrightness}%)`  // expects 0-200+ range
    : '',
  el.filterContrast != null && el.filterContrast !== 100 ? `contrast(${el.filterContrast}%)` : '',
  el.filterGrayscale ? `grayscale(${el.filterGrayscale}%)` : '',
]
```

**Verified:** With `/1000` divisor, brightness=15000 → 150 → `brightness(150%)` → matches renderer's `!== 100` check ✅. No renderer changes needed.

## Success Criteria
- [ ] `mapImage()` extract `brightness` → `/1000` → `filterBrightness` (percentage scale)
- [ ] `mapImage()` extract `contrast` → `/1000` → `filterContrast` (percentage scale)
- [ ] `mapImage()` extract `saturation=0` → `filterGrayscale=100`
- [ ] `mapImage()` extract `sharpen` → `_pptxImportMeta._pptxSharpen` (sidecar)
- [ ] `renderImage()` apply CSS filter string từ these properties (verified — no change needed)

## Risk Assessment
- **Risk:** pptxtojson fixed-point scale unverified — could be 10000 not 1000 → **Mitigation:** Test with real PPTX containing brightness-adjusted images. The `/1000` is based on PPTX EMU→percentage conversion standard (100000 = 100%).
- **Risk:** `filterBrightness !== 100` renderer check — with `/1000`, 100000 (normal brightness) → 100 → fails check → no filter applied ✅. 15000 (150%) → 150 → passes check → filter applied ✅.

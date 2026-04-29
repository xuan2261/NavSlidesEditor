---
phase: 4
title: "Integrate Production Pipeline into Harness"
status: completed
priority: P1
effort: 2h
dependencies: ["3"]
---

# Phase 4: Integrate Production Pipeline into Harness

## Overview

Thay thế `exportPresentationForRoundTrip()` trong fidelity tester bằng direct call đến `server/utils/server-export.js`. Không dùng HTTP export endpoint. Official target runs require production export + mandatory rasterization; minimal fallback is development-only and cannot satisfy target.

## Requirements

- Functional: Harness export sử dụng production pipeline, stability scores target ≥98%
- Non-functional: `--allow-fallback` flag cho development only, `--strict` cho official validation

## Architecture

```
pptx-import-semantic-and-roundtrip-fidelity-tester.js
│
├─ importPresentation(filePath)          ← pptxtojson + mapper (unchanged)
│
├─ exportToFile()                      ← NEW: server/utils/server-export.js
│   (presentation, roundTripPath, baseUrl)
│
├─ importPresentation(roundTripPath)    ← re-import (unchanged)
│
└─ computeRoundTripStability()         ← Phase 5: improved matching
```

## Related Code Files

- Modify: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`

## Implementation Steps

### Step 1: Replace minimal exporter with production

```js
// pptx-import-semantic-and-roundtrip-fidelity-tester.js

// OLD (Phase 0-2): local minimal exporter
async function exportPresentationForRoundTrip(presentation, filePath) { ... }

// NEW (Phase 3+): production export via server-export.js
async function exportViaProduction(presentation, filePath, options = {}) {
  const { exportToFile } = require('../../utils/server-export')
  const baseUrl = options.baseUrl || 'http://127.0.0.1:3002'
  await exportToFile(presentation, filePath, {
    baseUrl,
    strictRaster: true,
  })
}
```

### Step 2: Update testCorpusFile with fallback strategy

```js
// Trong testCorpusFile(), thay export call:
let exportMethod = 'production'
try {
  await exportViaProduction(imported.presentation, roundTripPath, {
    baseUrl: process.env.NAVSLIDES_API_URL || 'http://127.0.0.1:3002'
  })
} catch (err) {
  if (!options.allowFallback) {
    throw new Error(`Production export unavailable: ${err.message}`)
  }
  exportMethod = 'minimal'
  await exportPresentationForRoundTrip(imported.presentation, roundTripPath)
  result.warnings.push(`Production failed (${err.message}), minimal fallback`)
}
result.roundTripExportMethod = exportMethod
```

### Step 3: Add --allow-fallback flag

```js
const args = process.argv.slice(2)
const allowFallback = args.includes('--allow-fallback')
const strictMode = args.includes('--strict')

// Pass through runCorpusTests(corpusDir, { skipRoundTrip, allowFallback, strict: strictMode })

if (exportMethod === 'minimal' && strictMode) {
  throw new Error('Production export required in strict mode.')
}
```

Default behavior should be production-only. `--allow-fallback` may keep local development moving, but reports generated with fallback must be labeled invalid for official ≥98 target.

### Step 4: Update reporter

```js
lines.push(`  Export Method: ${r.roundTripExportMethod || 'N/A'} (production|minimal)`)
```

### Step 5: Run integration

```bash
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip --strict
```

Verify: Export method = production, stability target ≥98% overall. If rasterization is unavailable, strict/default run fails instead of silently falling back.

### Step 6: Verify regression

- Semantic fidelity: unchanged (still ≥95%)
- Minimal fallback still works (--allow-fallback)
- Error messages clear

## Success Criteria

- [x] Harness calls `exportToFile()` from server-export.js (direct, no HTTP)
- [x] Export method recorded as 'production' in results
- [x] `--allow-fallback` flag works
- [x] `--strict` flag fails if production unavailable
- [x] Default run fails if production export/rasterization unavailable
- [x] Stability scores ≥ 98% overall across 4 decks
- [x] No regression in semantic fidelity

## Risk Assessment

- **Risk:** Playwright/vendor assets unavailable → rasterization fails — **Mitigation:** strict/default validation fails clearly; only `--allow-fallback` permits minimal export for development
- **Risk:** Raster cache grows unbounded — **Mitigation:** Use weak map or TTL cache; clear between corpus files
- **Risk:** Base URL for rasterization — **Mitigation:** Use `NAVSLIDES_API_URL` override or file-system vendor route; document exact validation environment

---
phase: 2
title: "Port Pure Utilities to shared/src"
status: completed
priority: P1
effort: 5h
dependencies: ["1"]
---

# Phase 2: Port Pure Utilities to shared/src

## Overview

Port 5 pure-utility modules từ `client/src/utils/` sang `shared/src/` — **CommonJS** format. Đây là utilities không có browser deps, có thể dùng ở cả client và server. Giữ existing shared exports; không overwrite `shared/src/index.js`.

## Requirements

- Functional: 5 modules ported và hoạt động đúng
- Non-functional: Pure functions, no side effects, no browser APIs

## Architecture

```
shared/src/
├── shared-color-utils.js     ← export-pptx-color-utils.js (pure)
├── shared-html-parser.js     ← export-pptx-html-parser.js (pure)
├── shared-text-runs.js       ← export-pptx-text-runs.js (pure)
├── shared-slide-notes.js     ← slide-notes.js (pure)
└── shared-pptx-core.js      ← export-pptx-core.js (pure)
```

**ESM→CJS conversion rules:**
- `import X from './x'` → `const X = require('./x')`
- `import { a, b } from './x'` → `const { a, b } = require('./x')`
- `export function foo()` → `exports.foo = function foo()`
- `export default X` → `module.exports = X` (hoặc `exports.default = X`)
- Keep inline comments về source file

**No behavior changes** — chỉ convert module syntax + replace client-only constants/import paths with shared-safe equivalents.

## Related Code Files

- Create: `shared/src/shared-color-utils.js`
- Create: `shared/src/shared-html-parser.js`
- Create: `shared/src/shared-text-runs.js`
- Create: `shared/src/shared-slide-notes.js`
- Create: `shared/src/shared-pptx-core.js`
- Modify: `shared/src/index.js` — append PPTX utility exports while preserving existing exports
- Verify: `shared/package.json` already points to `src/index.js`
- Read (sources):
  - `client/src/utils/export-pptx-color-utils.js`
  - `client/src/utils/export-pptx-html-parser.js`
  - `client/src/utils/export-pptx-text-runs.js`
  - `client/src/utils/slide-notes.js`
  - `client/src/utils/export-pptx-core.js`

## Implementation Steps

### Step 1: Port shared-color-utils.js

```js
// shared/src/shared-color-utils.js
const { normalizeCssColor, normalizeImageSource, createSvgDataUri } = require('./shared-pptx-core')
// Export all color utilities that are pure functions
```

Verify: `node -e "const c = require('./shared/src/shared-color-utils'); console.log(Object.keys(c).slice(0,5))"`

### Step 2: Port shared-html-parser.js

Source: `client/src/utils/export-pptx-html-parser.js`
- Pure tokenizer — no browser deps
- `parseHtmlTree()`, `getBlockNodes()`, `mergeInlineStyle()`, `normalizeAlign()`

### Step 3: Port shared-text-runs.js

Source: `client/src/utils/export-pptx-text-runs.js`
- Uses `shared-html-parser.js` → update import
- `htmlToPptTextRuns()`, `stripHtmlToPlainText()`

### Step 4: Port shared-slide-notes.js

Source: `client/src/utils/slide-notes.js`
- Pure: extracts notes from slide object

### Step 5: Port shared-pptx-core.js

Source: `client/src/utils/export-pptx-core.js`
- Pure utilities: `getPresentationResolution`, `getPptxLayout`, `scaleElementBounds`, `getShapeType`, `mapLineDashType`, `mapArrowType`, `normalizeCssColor`, `normalizeImageSource`, `createSvgDataUri`, `getNativeChartDefinition`
- **NOTE:** This is the largest file — port carefully, verify all 10 functions
- Replace `../data/slide-constants` import with local constants:
  - `CANVAS_WIDTH = 960`
  - `CANVAS_HEIGHT = 540`
- Keep `createSvgDataUri()` Node-safe with `Buffer.from(...)`; do not assume `btoa`.

### Step 6: Update shared/src/index.js

`shared/package.json` already has `"main": "src/index.js"`. Do not replace existing index content; append PPTX exports to the existing `module.exports` object.

```js
module.exports = {
  ...shapeUtils,
  ...htmlGenerator,
  ...slideNotes,
  ...require('./shared-color-utils'),
  ...require('./shared-html-parser'),
  ...require('./shared-text-runs'),
  ...require('./shared-pptx-core'),
}
```

### Step 7: Verify all exports

```bash
node -e "
  const shared = require('./shared/src/index.js')
  const funcs = ['normalizeCssColor', 'parseHtmlTree', 'htmlToPptTextRuns', 'getSlideNotes', 'getShapeType', 'scaleElementBounds', 'getPptxLayout']
  funcs.forEach(f => console.log(f, typeof shared[f] === 'function' ? 'OK' : 'MISSING')
"
```

## Success Criteria

- [x] All 5 modules ported to `shared/src/`
- [x] All exports work from `shared/src/index.js` and existing `shapeUtils`/`htmlGenerator`/`slideNotes` exports still work
- [x] No browser APIs (`window`, `document`, `fetch`) in shared modules
- [x] No client-only imports such as `client/src/data/slide-constants`
- [x] All functions produce same output as source (run existing tests)
- [x] ESM→CJS conversion complete, no `import`/`export` syntax left

## Risk Assessment

- **Risk:** Transitive ESM imports — **Mitigation:** Verify each source file's imports. If any import ESM-only module, keep that specific function in server/utils instead
- **Risk:** Named vs default exports — **Mitigation:** pptxgenjs text runs use named exports; convert carefully
- **Risk:** shared-pptx-core is large (10+ functions) — **Mitigation:** Port incrementally, test each function

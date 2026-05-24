# TDD-Safe Mapper Split: Research Report
**Date:** 2026-05-24  
**Scope:** `server/services/pptx-import/mapper.js` (999 LOC → `mapper/` ~9 files ≤180 LOC each)

---

## 1. Characterization Test / Golden Master Pattern

### What it is
A "golden master" (aka characterization test / approval test) captures current output as a reference artifact. Subsequent runs diff against it. Anything that changes is flagged — including unintended regressions from refactoring.

### When to use vs property-based tests
- Use **golden master** for refactor phases where behavior must not change at all.
- Use **property-based** when designing new invariants (e.g., "zIndex is always unique per slide"). The two complement each other.
- For this refactor: golden master is primary. Property-based tests already exist (`geometry-drift.test.js`, `roundtrip-matching.test.js`).

### How to apply to NavSlides mapper
The corpus tester already produces structured output (semantic fidelity %, geometry drift, element counts). Two golden targets exist:

**Golden A — unit output snapshots** (synthetic inputs from `mapper.test.js`):  
Strip the `id` field (it's `crypto.randomUUID()` — non-deterministic) and snapshot the rest.

```js
// mapper/golden-master.test.js
import { expect, it } from 'vitest'
import mapperModule from './index.js'  // future barrel

const { mapPptxOutput } = mapperModule

it('golden: shape element output', async () => {
  const result = await mapPptxOutput({ /* fixed synthetic input */ })
  const stable = stripIds(result.presentation.slides[0].elements)
  expect(stable).toMatchSnapshot()
})

function stripIds(elements) {
  return elements.map(({ id: _id, ...rest }) => rest)
}
```

Vitest snapshot support is confirmed active (vitest.config.mjs uses `vitest`; `toMatchSnapshot` is available via `globals: true`). **No snapshot files exist today** — this is a gap to fill before refactoring.

**Golden B — corpus metrics snapshot**:  
Serialize the corpus-run output (`corpus-run-output.txt` format) to a JSON fixture. Assert metrics do not regress below the current baseline:
```
Avg Semantic Fidelity: 98.0%
Avg Round-trip Stability: 99.0%
```
The corpus tester already emits `computeDetailedFidelityMetrics()` and `applyStrictPerTypeGates()` — wire those into a Vitest test that runs against `PPTX/*.pptx` with `it.skip`-if-no-corpus pattern (same as `harness-integration-real-export-path.test.js:12`).

### JSON comparison tooling
- **Vitest `toMatchSnapshot()`** — simplest; diff on failure. Recommended for unit-level.
- **Custom comparator**: strip `id`, `_pptxImportMeta._pptxSharpen` (float precision), then `JSON.stringify(obj, Object.keys(obj).sort())` for stable key order before comparing. Do NOT use `JSON.stringify` directly on raw output — key order from `baseElement` spread is deterministic but `_pptxImportMeta` extensions aren't.
- **No external libs needed** (`js-yaml` or `jest-snapshot` are overkill for this).

---

## 2. Recommended Split Strategy

### Option A: New module alongside old, swap at end
Create `mapper/index.js` that re-exports from sub-modules. `mapper.js` stays untouched. Tests are pointed at `mapper/index.js`. Old `mapper.js` deleted after green.

### Option B: Move-in-place (incremental re-export)
Extract one function group at a time into `mapper/map-shape.js` etc., re-export from `mapper.js`, delete `mapper.js` after all functions extracted.

### Recommendation: **Option B (move-in-place)**

**Rationale:**
1. The existing test suite imports `./mapper` via two callers only: `importer.js:4` and `pptx-import-semantic-and-roundtrip-fidelity-tester.js:13`. The path does not change until the very last step when `mapper.js` becomes `mapper/index.js`.
2. Option A requires maintaining two parallel implementations simultaneously — any bug fix during the split must be applied twice.
3. Option B keeps all existing tests green at every intermediate commit. Each extraction is a `git diff` of ~40 lines: remove from `mapper.js`, add `require('./mapper/map-shape')` re-export.
4. Intermediate state (mapper.js shrinking + re-exporting) is not "messy" — it is the standard Node.js module migration path.
5. Risk mitigation: run `npm test` after each function group extraction. The regression gate is identical at every step.

**Move-in-place sequence (recommended order):**

| Step | Extract to | Functions | Est. LOC |
|------|-----------|-----------|----------|
| 1 | `mapper/utils-color.js` | `colorValue`, `normalizeGradientStops`, `gradientBackground`, `svgAttr`, `arrowMarker` | ~50 |
| 2 | `mapper/utils-text.js` | `plainText`, `normalizeFontSize`, `normalizeFontFamily`, `buildBaseTextStyle`, `applyTextStyle`, `extractTextMetadata`, `extractTextInsets` | ~80 |
| 3 | `mapper/utils-base.js` | `baseElement`, `shapeName`, `warning`, `extractShadow`, `placeholder` | ~70 |
| 4 | `mapper/map-shape.js` | `mapShape` | ~80 |
| 5 | `mapper/map-image.js` | `mapImage` | ~90 |
| 6 | `mapper/map-table.js` | `mapTable` | ~100 |
| 7 | `mapper/map-media.js` | `mapVideo`, `mapAudio`, `mapMath` | ~90 |
| 8 | `mapper/map-group.js` | `flattenGroupElement`, `buildGroupMatrix`, `flattenDiagramElement`, `MAX_GROUP_DEPTH` | ~180 |
| 9 | `mapper/map-presentation.js` | `mapPptxOutput`, `mapElement` | ~130 |

After step 9, rename `mapper.js` → `mapper/index.js` and update the two `require('./mapper')` callers. Total: ~870 LOC across 9 files, well under 180 LOC each.

---

## 3. Circular Dependency Avoidance

### The recursive call chain
```
mapPptxOutput → mapElement → flattenGroupElement → mapElement (recursion)
                           → mapShape / mapImage / mapTable / mapVideo / ...
```

`mapElement` is a central dispatcher that calls all per-type mappers AND calls itself recursively via `flattenGroupElement`. This is the only circular risk.

### Clean dispatch pattern: dependency injection

Pass `mapElement` as a parameter into `flattenGroupElement` and `flattenDiagramElement`:

```js
// mapper/map-group.js
async function flattenGroupElement(group, context, mapElementFn, depth = 0, ...) {
  // ...
  const mappedChildren = await mapElementFn(transformedChild, childContext)
}
module.exports = { flattenGroupElement }
```

```js
// mapper/map-presentation.js  
const { flattenGroupElement } = require('./map-group')
const { mapShape } = require('./map-shape')
// ...

async function mapElement(element, context) {
  if (element.type === 'group') return flattenGroupElement(element, context, mapElement)
  // ...
}
```

This breaks the potential circular chain: `map-group.js` does NOT import from `map-presentation.js`. The `mapElement` function is injected at call time. No circular `require()`.

**Alternative**: use a central `dispatch.js` that owns `mapElement` and imports all mappers — also valid but adds one more file. The injection approach is simpler (KISS).

---

## 4. Test File Slicing Strategy

### Current state
`mapper.test.js` (1508 LOC) has one top-level `describe('pptx mapper')` with nested `describe` blocks for element types:
- Line 1110: `describe('mapVideo')`
- Line 1149: `describe('mapAudio')`
- Line 1171: `describe('mapMath via mapPptxOutput')`
- Line 1252: `describe('extractShadow')`
- Line 1278: `describe('mapShape — shadow')`
- Line 1302: `describe('mapText — shadow')`
- Line 1327: `describe('mapImage — filters')`
- Line 1388: `describe('flattenDiagramElement — connector detection')`
- Lines 1-1109: flat `it()` tests (sanitizer, text, shape, group, table, chart, zIndex, etc.)

### Slice approach
DO NOT delete from `mapper.test.js` until the new sub-module tests pass. The sequence:

1. **Co-locate new test file** alongside extracted module: `mapper/map-shape.test.js`
2. Copy relevant `describe` block from `mapper.test.js` → new file, update import to `./map-shape.js`
3. Run only the new file: `npx vitest run server/services/pptx-import/mapper/map-shape.test.js`
4. Only after green, remove the block from `mapper.test.js`

**Tests that use `mapPptxOutput` as integration surface** (lines 80-1109, ~70 tests) — these stay in `mapper.test.js` / move to `mapper/integration.test.js`. They test the full pipeline, not individual sub-modules.

**Tests that test exported sub-functions directly** (`mapVideo`, `mapAudio`, `mapMath`, `extractShadow`) — these move to per-file test files (`mapper/map-media.test.js`, `mapper/utils-base.test.js`).

Import path in new test files: `import { mapVideo } from './map-media.js'` (direct named import, not through barrel).

---

## 5. Mandatory Regression Gates

Ordered by run cost (fast → slow):

| Gate | Command | Blocking? | Notes |
|------|---------|-----------|-------|
| LOC budget | manual / `wc -l` | Yes | Each new file ≤180 LOC |
| Unit tests pass | `npm test` | Yes | All vitest tests including `mapper.test.js` and new sub-files |
| Golden master snapshots match | `npm test` | Yes | New snapshots added before refactor starts |
| Corpus tester (fast) | `npm run test:corpus` | Yes | Avg semantic ≥98%, round-trip ≥99% — baseline from `corpus-run-output.txt` |
| No circular deps | `node -e "require('./server/services/pptx-import/mapper/index.js')"` | Yes | Crashes on circular require |
| Coverage thresholds | `npm test -- --coverage` | Yes | Enforced by `vitest.config.mjs` thresholds (lines:33, branches:28, fns:26) |
| Cyclomatic complexity | optional — `npx complexity-report` | No | Useful for `flattenGroupElement` (currently complex) |

Note: The corpus tester is excluded from coverage (`vitest.config.mjs:46`) but IS a valid regression gate via `npm run test:corpus`.

---

## 6. In-Codebase Prior-Refactor Conventions

### `server/routes/` (flat file per concern)
- Pattern: one file per domain, no barrel `index.js` — files are individually imported in `server/index.js`
- Naming: kebab-case (`pptx-import.js`, `games-rest-api-handler.js`) — matches CLAUDE.md rule
- Tests co-located: `share.js` → `share.test.js` in same directory
- No index barrel — routes are individually required

### `client/src/components/ribbon/` (flat + `controls/` subfolder)
- Pattern: flat folder with one `controls/` subfolder for sub-components
- Naming: kebab-case, long descriptive names (`ribbon-format-tab-element-position-size-rotation-controls.jsx`)
- Tests co-located: `ribbon-section.jsx` → `ribbon-section.test.jsx`
- No barrel `index.js` observed

### `server/services/pptx-import/` (current flat, becoming modular)
- Existing peer files already split by concern: `geometry.js`, `media.js`, `sanitize.js`, `chart-output-to-navslides-mapper.js` — all without barrel
- **Implication**: the `mapper/` subfolder should follow the same pattern: no barrel unless callers need it. Since only two callers use `require('./mapper')`, a `mapper/index.js` barrel is appropriate and minimal.

**Conventions to follow:**
- Kebab-case file names (required by CLAUDE.md)
- Test file co-located in same folder as implementation (`mapper/map-shape.test.js` next to `mapper/map-shape.js`)
- No default exports — use named exports (`module.exports = { mapShape }`)
- CommonJS (`require`/`module.exports`), not ESM — all pptx-import files use CJS; test files use ESM `import` (Vitest handles interop)

---

## 7. TDD-for-Refactor Phase Template

```markdown
## Phase N: Extract [module name]

**Status:** [ ] Not started / [ ] In Progress / [ ] Complete

### Tests Before (Characterization Gate)
- [ ] Confirm `npm test` green on current `mapper.js`
- [ ] Add/update golden snapshot tests covering functions to be extracted
- [ ] Run `npm test` — snapshots committed to repo

### Extract
- [ ] Create `mapper/[name].js` with extracted functions
- [ ] Re-export from `mapper.js`: `const { fn } = require('./mapper/[name]'); module.exports.fn = fn`
- [ ] Verify no `require` cycles: `node -e "require('./mapper/[name].js')"`

### Tests After (New Unit Tests)
- [ ] Create `mapper/[name].test.js` with isolated unit tests for extracted functions
- [ ] Run `npx vitest run server/services/pptx-import/mapper/[name].test.js` — green

### Regression Gate
- [ ] `npm test` — full suite green (includes mapper.test.js, geometry-drift, group-transform, property-mapping, roundtrip-matching)
- [ ] Golden snapshots unchanged
- [ ] `npm run test:corpus` — semantic ≥98%, round-trip ≥99%
- [ ] New file LOC ≤180: `(Get-Content mapper/[name].js).Count` ≤ 180

### Cleanup (only after gate passes)
- [ ] Remove extracted functions from `mapper.js`
- [ ] Remove re-exports from `mapper.js` if all callers updated
- [ ] Run regression gate again
```

---

## 8. Risks Specific to This Refactor

### Shared mutable `context` object
`context` is passed by reference throughout: `context.stats.imageCount += 1`, `context.warnings.push(...)`, `context.zIndex += 1` (mutation in `flattenDiagramElement:793`). Extracting functions must NOT copy `context` — always pass by reference. Any accidental `{ ...context }` spread in extracted code will silently break stat accumulation.

**Specific danger:** `flattenDiagramElement` mutates `context.zIndex` directly (line 793: `context.zIndex += 1`). This is side-effecting across function boundaries. Document this in the extracted file's comments.

### `uuidv4` lazy require
`mapper.js:1`: `const uuidv4 = () => require('node:crypto').randomUUID()` — this is function-scoped. Any extracted module that calls `uuidv4()` needs to redeclare this line or import a shared helper. Do NOT try to import it from another mapper sub-module — inline it in each file that uses it (5 files need it).

### Exports contract at `mapper.js:992-999`
Currently exports: `mapPptxOutput`, `sanitizeHtml`, `mapVideo`, `mapAudio`, `extractShadow`, `mapMath`. Tests in `mapper.test.js:9` destructure all 6. The barrel `mapper/index.js` must re-export all 6 with identical names. `sanitizeHtml` lives in `sanitize.js` — it's already imported by mapper and re-exported. This chain must be preserved.

### `mapMath` calls `mapImage` internally (line 578-589)
`mapMath` is async-adjacent (calls `mapImage` which is async). When `mapMath` moves to `map-media.js`, it needs to import `mapImage` from `map-image.js`. This is fine as long as `map-image.js` does not import from `map-media.js` — it doesn't, so no circular risk.

### `flattenGroupElement` depth-first recursion via `mapElement`
`mapElement` is in `map-presentation.js`. `flattenGroupElement` is in `map-group.js`. Using the injection pattern (section 3) avoids circular dep but means `flattenGroupElement`'s signature changes. If any test directly calls `flattenGroupElement` (it does — indirectly via `mapPptxOutput`), the behavior is preserved because `mapPptxOutput` passes `mapElement` as the injected fn.

---

## Unresolved Questions

1. **Snapshot determinism for `id` fields**: `uuidv4()` uses `crypto.randomUUID()` — every run generates new IDs. Snapshots must strip `id` fields. Need to confirm no test currently asserts on specific `id` values (quick grep shows none, but verify).

2. **Corpus test speed**: `npm run test:corpus` runs 4 PPTX files with round-trip export. `Bai_2_2.pptx` took 34s alone. As a per-phase regression gate this is slow (~2 min total). Consider running corpus gate only at end-of-phase-8 (group flatten, highest risk) and phase-9 (mapPptxOutput), not for every minor utility extraction.

3. **`context.zIndex` mutation in `flattenDiagramElement`**: this is a side effect that could cause ordering bugs if the function is ever called without the outer `allResults` sort. Document whether this mutation is intentional load-bearing design or an accident to fix. Not in scope for refactor, but note it.

4. **LOC count includes comments/blanks**: the 180 LOC limit should specify whether blank lines and comments count. For files like `map-group.js` (~180 LOC with logic), the limit may be tight. Consider 200 LOC as the practical ceiling for `map-group.js` only, or split group + diagram into two files.

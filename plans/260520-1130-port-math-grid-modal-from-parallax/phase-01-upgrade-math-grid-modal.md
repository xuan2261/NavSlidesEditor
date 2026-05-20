# Phase 01: Upgrade ParametricMathGridSurfacePlotterModal (TDD)

Plan: `port-math-grid-modal-from-parallax-overview.md`
Status: completed
Priority: P2 (cherry-pick from sibling repo; UI quality + security uplift)
Effort: M (1 session)
Risk: 2/5

## Context Links

- Source: `jbirky/parallax-presentations` @ `ce548c5` -- `client/src/components/MathGridModal.jsx` (281 LOC)
- Stashed source: `plans/reports/_source-MathGridModal.jsx.tmp`
- Local stub: `client/src/components/parametric-math-grid-surface-plotter-modal.jsx` (125 LOC, canvas+eval2)
- Local test: `client/src/components/parametric-math-grid-surface-plotter-modal.test.jsx` (54 LOC, 5 cases)
- Sibling reference (port pattern to mirror):
  - `client/src/components/anime-js-animation-template-selector-modal.jsx` (modal shell)
  - `client/src/data/anime-js-animation-templates.js` (AGPL-headed data module)
  - `client/src/components/three-js-3d-scene-template-selector-modal.jsx` + `client/src/data/three-js-3d-scene-templates.js`
  - `client/src/components/kinetic-text-animation-template-selector-modal.jsx` + `client/src/data/kinetic-text-animation-templates.js`
- Call site: `client/src/pages/EditorPage.jsx:82` (import), `:1506` (`onAddMathGrid`), `:1888-1892` (modal render)
- Embed wiring: `EditorPage.jsx insertEmbedHtml(html) -> addElement('html', { content: html })`
- Render path: `shared/src/element-renderers.js renderHtml:146`, `:499 html: renderHtml`
- Sibling plans:
  - `plans/260519-2114-port-three-modal-from-parallax/` (commit `72343090`)
  - `plans/260519-2310-port-kinetic-text-modal-from-parallax/`
- Three.js port journal (lessons): `docs/journals/journal-260519-three-modal-port.md`

## Overview

Local has a working but bare 125-LOC canvas+`eval2` stub that emits an `html` element. The sibling Anime/Three/Kinetic ports established the canonical pattern: split into `data/<feature>-templates.js` + `<feature>-modal.jsx` (each under 200 LOC), use Tailwind, AGPL/SPDX header on ported strings, and 1-arg `onInsert(html)`.

This phase upgrades the math-grid modal to match that bar **and** adopts source's superior output model (inline SVG instead of canvas+JS) -- removing a script execution surface from the inserted slide element. Local's regex sanitizer is **kept and tightened** because source's `new Function()` compilation has no allowlist (a real injection vector if ported verbatim).

## Key Insights

- **Output model change: canvas+JS -> inline SVG.** Source emits `<svg viewBox=... ><polyline .../></svg>` with no script. Local emits `<canvas>` + script that calls `eval2`. SVG output is non-executable, smaller, scales via `viewBox`, and removes the inserted-element script surface. **Already-inserted canvas elements are unaffected** -- they're stored as `html` with their original content; the renderer doesn't change.
- **Preview parity with output: inline SVG, no iframe.** Anime/Three/Kinetic ports use `<iframe srcDoc sandbox="allow-scripts">` because their output executes JS. Math-grid output is static SVG -- iframe wrapping adds zero security and complicates layout. Use inline `<svg>` (source's pattern). **Diverges from sibling iframe pattern intentionally** -- documented under R2 in red-team.
- **Math compilation: source's `new Function()` is the right primitive, but unsafe without an allowlist.** Source uses `new Function('u','v','const {sin,cos,...}=Math;return('+expr+')')` -- no sanitization. A user-typed `xExpr = "constructor.constructor('fetch(`/api/secret`)')()"`  executes in the React parent context. Local's existing `ALLOWED_MATH_TOKENS` regex blocks this. **Keep + tighten the allowlist** (block `constructor`, `prototype`, `globalThis`, `window`, `eval`, `import`, brackets `[]`, backticks, `=`).
- **Drop "Lissajous" preset.** Local has 11 presets; source has 10. Lissajous (`x=sin(3u), y=sin(2u)`) is a 1D parametric *curve*, not a 2D parametric *surface* -- it doesn't fit the grid mesh model. Removing it = test churn (1 assertion update) but feature integrity gain.
- **Per-preset range/division metadata.** Source ships each preset with its own `uMin/uMax/vMin/vMax/uDiv/vDiv`. Polar wants `[0..2*PI]` with 32 v-divisions; Cartesian wants `[-5..5]` with 10 each. Local applies fixed defaults to every preset, so most presets render visibly wrong. Adopt source's per-preset metadata.
- **`evalRange('2*PI')` parses string literals.** Source's `evalRange` accepts numbers OR strings like `'2*PI'` so presets can declare ranges symbolically. Adopt -- otherwise presets compute wrong bounds.
- **No call-site change.** `EditorPage.jsx:1888-1892` already wires `onInsert={insertEmbedHtml}` and `onClose={() => setShowMathGridModal(false)}`. 1-arg `onInsert(html)` is the existing shape.
- **Source omits `onClose()` after `onInsert`; siblings call it.** Local stub also calls `onClose()` after insert. Adopt sibling/local pattern -- close-on-insert is the established UX in this codebase.
- **AGPL header on data module only.** Per Three.js port journal: locally rewritten modal shell needs no header; ported strings (PRESETS array, helper signatures `compileExpr`/`evalRange`/`generateGrid`) live in the data module which carries the SPDX line.
- **Tightened sanitizer regex.** Current local regex: `/^(?:[0-9+\-*/().%\s,]|u|v|sin|cos|...|atan|atan2)+$/`. Two improvements:
  - Add source's helpers: `log2`, `hypot`, `sign`, `sinh`, `cosh`, `tanh`.
  - Confirm regex blocks `constructor`, `prototype`, `globalThis`, `window`, `eval`, `import`, `Function`, `=`, `[`, `]`, `` ` ``, `;`, `:`, `?`, `&`, `|`, `<`, `>`, `\\`, `'`, `"` -- they fall outside the allowlist by construction. Add explicit unit tests for each.

## Requirements

### Functional

- 10 presets: Cartesian, Polar, Wave Mesh, Log Polar, Perspective, Gravity Well, Saddle, Spiral, Diamond, Sinusoidal.
- Each preset ships its own `xExpr`, `yExpr`, `uMin`, `uMax`, `vMin`, `vMax`, `uDiv`, `vDiv`. Range fields may be string literals (`'2*PI'`) parsed via `evalRange`.
- Inputs: `x(u,v)` text, `y(u,v)` text, `u min`, `u max`, `v min`, `v max`, `u lines` (number), `v lines` (number), color, line width, opacity, bg, u-line toggle, v-line toggle.
- Live preview: inline `<svg viewBox=... >` reflecting current params (no iframe). `useMemo` re-derives grid on param change.
- Insert button calls `onInsert(svgHtml)` then `onClose()`. Disabled when grid has compile or empty-points error.
- Cancel + close (X) buttons call `onClose()`.
- Compile error (`new Function` throws) shows inline error message and disables Insert.
- Empty-points error (`!isFinite(minX)` after eval) shows inline error message and disables Insert.
- Sanitizer: only allowlisted tokens (digits, `+-*/().%`, whitespace, `,`, `u`, `v`, and the math helper names) accepted. Disallowed input -> Insert button generates `'0'` for the offending expression.

### Non-functional

- Modal file <= 200 LOC.
- Data module file <= 250 LOC (PRESETS + 3 pure helpers + sanitizer + AGPL header).
- Match Tailwind class naming with sibling Anime/Three/Kinetic modals (`bg-card`, `border-border`, `text-text-primary`, `bg-hover`, `bg-accent`, `text-text-muted`).
- All useful existing test cases continue to pass after rewrite (4 of 5 -- "Lissajous" assertion removed in TDD step 1).
- New test coverage matches sibling depth (16 cases total).
- AGPL/SPDX header on data module file.
- No EditorPage call-site changes.

## Architecture

### File split

```
client/src/components/parametric-math-grid-surface-plotter-modal.jsx    (modal shell + GridSVG -- ~190 LOC)
client/src/data/parametric-math-grid-templates.js                       (PRESETS, sanitizeMathExpr, compileExpr, evalRange, generateGrid, generateMathGridSvgHtml, ALLOWED_MATH_TOKENS -- ~200 LOC)
client/src/components/parametric-math-grid-surface-plotter-modal.test.jsx (extended -- ~180 LOC, ~13 cases)
```

### Data flow

```
User edits params
  v
useState (xExpr, yExpr, uMin, uMax, vMin, vMax, uDiv, vDiv, color, lineWidth, opacity, showU, showV, bg)
  v
useMemo grid = generateGrid(xExpr, yExpr, { uMin, uMax, vMin, vMax, uDiv, vDiv })
  v
<GridSVG grid={grid} strokeColor={color} strokeWidth={lineWidth} opacity={opacity} showU={showU} showV={showV} />
  v
[Insert] -> generateMathGridSvgHtml(grid, { color, lineWidth, opacity, showU, showV, bg }) -> onInsert(html) -> onClose()
  v
EditorPage.insertEmbedHtml -> addElement('html', { content })
  v
shared/src/element-renderers.js renderHtml -> reveal.js iframe-wrapped html element
```

### Module exports (`client/src/data/parametric-math-grid-templates.js`)

```js
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky
// Compilation/eval helpers and PRESETS ported from parallax-presentations
// (jbirky/parallax-presentations @ ce548c5, AGPL-3.0-or-later).
// Adapted into a NavSlides data module: regex sanitizer added, UI shell rewritten locally.

export const ALLOWED_MATH_TOKENS = /^(?:[0-9+\-*/().%\s,]|u|v|sin|cos|tan|abs|sqrt|pow|exp|log2|log|ceil|floor|round|min|max|PI|E|asin|acos|atan2|atan|hypot|sign|sinh|cosh|tanh)+$/

export function sanitizeMathExpr(expr) { /* trim + regex test; return '0' on reject */ }

export const PRESETS = [
  { name: 'Cartesian', xExpr: 'u', yExpr: 'v', uMin: -5, uMax: 5, vMin: -5, vMax: 5, uDiv: 10, vDiv: 10 },
  { name: 'Polar', xExpr: 'u*cos(v)', yExpr: 'u*sin(v)', uMin: 0.5, uMax: 5, vMin: 0, vMax: '2*PI', uDiv: 8, vDiv: 32 },
  // ... 8 more, verbatim from source
]

export function compileExpr(expr) { /* sanitizeMathExpr + new Function(... const {sin,...}=Math ...) */ }
export function evalRange(val) { /* number | string -> number; defaults to 0 on parse fail */ }
export function generateGrid(xExpr, yExpr, params) { /* returns { uLines, vLines, bounds } | { error } */ }
export function generateMathGridSvgHtml(grid, style) { /* returns SVG html string for onInsert */ }
```

### Modal contract

```js
ParametricMathGridSurfacePlotterModal({ onInsert, onClose })
// onInsert(html: string): void
// onClose(): void
```

No `slideW`/`slideH` props (preview is inline SVG with `viewBox`, scales naturally). Drop them from sibling pattern.

## Related Code Files

### To modify

- `client/src/components/parametric-math-grid-surface-plotter-modal.jsx` -- rewrite from canvas stub to SVG port
- `client/src/components/parametric-math-grid-surface-plotter-modal.test.jsx` -- update + extend (TDD step 1)

### To create

- `client/src/data/parametric-math-grid-templates.js` -- AGPL-headed data module

### To delete

- `plans/reports/_source-MathGridModal.jsx.tmp` (after port verified)

### To verify untouched

- `client/src/pages/EditorPage.jsx` -- import + render call already correct (lines 82, 239, 1506, 1888-1892)
- `shared/src/element-renderers.js` -- `html` element render path unchanged
- Sibling data + modal files (anime/three/kinetic) -- no edits

## Implementation Steps (TDD-ordered)

### Step 1 -- Tests first: rewrite + extend test file (RED)

1. Rewrite `client/src/components/parametric-math-grid-surface-plotter-modal.test.jsx` with the target 13 cases. Run `npx vitest run client/src/components/parametric-math-grid-surface-plotter-modal.test.jsx` -- expect failures (no SVG output yet, "Lissajous" assertion removed, new assertions absent).

   Test inventory:

   | # | Case | Type |
   |---|------|------|
   | 1 | Renders all 10 source presets (Cartesian..Sinusoidal); does NOT render "Lissajous" | UI |
   | 2 | Insert emits `<svg ` and `<polyline ` (no `<canvas>`, no `<script`) | Output contract |
   | 3 | Insert HTML contains `viewBox="..."` with finite numbers | Output structure |
   | 4 | Switching preset updates xExpr / yExpr / range / div in inputs | UI state |
   | 5 | Compile error (e.g., `xExpr = "u +"` -- syntax error) shows error message and disables Insert | Error path |
   | 6 | Empty-points error (e.g., `xExpr = "1/0"`) shows error message and disables Insert | Error path |
   | 7 | u-line toggle off -> emitted SVG has no u-polylines (only v) | Output contract |
   | 8 | v-line toggle off -> emitted SVG has no v-polylines (only u) | Output contract |
   | 9 | Color change reflected in `stroke="..."` of emitted SVG | Output contract |
   | 10 | Line-width change reflected in `stroke-width="..."` of emitted SVG | Output contract |
   | 11 | Opacity change reflected in `opacity="..."` of emitted SVG | Output contract |
   | 12 | bg=`#0a0a14` reflected in emitted `<style>...background:#0a0a14...</style>` | Output contract |
   | 13 | Sanitizer: `xExpr = "constructor.constructor('hi')()"` rejected -> compileExpr returns null OR generated SVG path is empty / Insert disabled | Security regression guard |
   | 14 | Sanitizer unit (data module): tokens `[`, `]`, `=`, `` ` ``, `constructor`, `prototype`, `globalThis`, `window`, `eval`, `import`, `Function` each return `'0'` from `sanitizeMathExpr` | Security regression guard |
   | 15 | `evalRange('2*PI')` parses to `~6.283`; `evalRange(5)` returns `5`; `evalRange('))(')` returns `0` | Helper unit |
   | 16 | Iframe is NOT used for preview (regression guard for sibling-pattern drift) | Architecture guard |

   Note: 16 cases total. Cases #14-16 are data-module / architecture asserts that don't require rendering -- they live in the same test file and import the data module directly.

### Step 2 -- Create data module (GREEN, part 1)

2. Create `client/src/data/parametric-math-grid-templates.js`:
   1. Add SPDX + Copyright + adaptation note header (mirror sibling format).
   2. Export `ALLOWED_MATH_TOKENS` regex (current local + add `log2`, `hypot`, `sign`, `sinh`, `cosh`, `tanh`).
   3. Export `sanitizeMathExpr(expr) -> string`. Empty / non-string / regex-reject -> `'0'`.
   4. Export `PRESETS` -- 10 entries verbatim from source.
   5. Export `compileExpr(expr) -> Function | null`. Internally calls `sanitizeMathExpr` first; passes to `new Function('u','v','const {sin,cos,tan,abs,sqrt,pow,exp,log,log2,PI,E,min,max,floor,ceil,round,atan2,hypot,sign,asin,acos,atan,sinh,cosh,tanh}=Math;return(' + safe + ')')`. Catches and returns `null`.
   6. Export `evalRange(val) -> number`. Number passthrough; string -> `new Function('const {PI,E}=Math;return(' + val + ')')()`. Catches and returns `0`.
   7. Export `generateGrid(xExpr, yExpr, params) -> { uLines, vLines, bounds, error? }`. Verbatim port of source `generateGrid` body (compile, eval grid, polyline-segment, bounds + 5% pad). Preserve source's `uStep = uDiv > 0 ? (uMax - uMin) / uDiv : 1` zero-guards (and the matching `vStep` guard). Add early `error: 'Invalid expression'` when either `compileExpr` returns null. Add `error: 'No valid points'` when `!isFinite(minX)`.
   8. Export `generateMathGridSvgHtml(grid, { color, lineWidth, opacity, showU, showV, bg }) -> string`. Verbatim port of source `handleInsert` body, returns the SVG `<style>...</style>\n<svg ...>...</svg>` string. Preserve source's `bw = ... || 1` and `bh = ... || 1` zero-guards.

3. Run `npx vitest run client/src/data/parametric-math-grid-templates`  if a data-module unit test exists (cases #14-15). Expect them to pass.

### Step 3 -- Rewrite modal (GREEN, part 2)

4. Rewrite `client/src/components/parametric-math-grid-surface-plotter-modal.jsx`:
   1. Imports: `useState`, `useMemo` from React; `PRESETS`, `evalRange`, `generateGrid`, `generateMathGridSvgHtml` from data module.
   2. State: 14 fields per Architecture data flow above.
   3. `useMemo` `grid` computed from `xExpr`, `yExpr`, range params, divisions.
   4. `applyPreset(p)` populates xExpr/yExpr/range/div from preset object.
   5. `handleInsert()`: bail if `grid.error`; call `generateMathGridSvgHtml(grid, { color, lineWidth, opacity, showU, showV, bg })`; pass result to `onInsert`; call `onClose()`.
   6. Inline `<GridSVG />` JSX component (or local `function GridSVG({ grid, ... })` definition above the export). Uses `viewBox` from `grid.bounds`; emits `<polyline>` per segment with computed `strokeWidth = lineWidth * bw / previewWidth` (source pattern).
   7. Layout: header (title + close X), 2-column body (left: presets + expressions + ranges + toggles + style + error), right: preview SVG, footer (Cancel + Insert).
   8. Tailwind classes mirror sibling Anime/Three/Kinetic modal naming.
   9. Insert button `disabled={!!grid.error}`.

5. Run `npx vitest run client/src/components/parametric-math-grid-surface-plotter-modal.test.jsx`. Expect all 16 cases to pass.

### Step 4 -- Verify build, lint, sibling regression

6. Run `npm run lint` -- fix any errors.
7. Run `npm run build` -- fix any compile errors.
8. Run `npx vitest run client/src/components/anime-js-animation-template-selector-modal.test.jsx three-js-3d-scene-template-selector-modal.test.jsx kinetic-text-animation-template-selector-modal.test.jsx parametric-math-grid-surface-plotter-modal.test.jsx` -- all pass.

### Step 5 -- Manual smoke (browser)

9. `npm run dev`.
10. Open editor, Insert -> Math Grid.
11. Click each of 10 presets; verify the preview SVG visibly differs.
12. Edit `xExpr` / `yExpr` -- preview re-renders without flicker.
13. Inject `xExpr = "constructor.constructor('alert(1)')()"` -- preview shows error / Insert disabled.
14. Click Insert -- element appears in slide.
15. Switch to present mode -- math grid renders inside reveal.js html element.
16. Open exported offline HTML (`File > Export Offline HTML`) -- math grid renders.

### Step 6 -- Cleanup

17. Delete `plans/reports/_source-MathGridModal.jsx.tmp`.
18. Optional housekeeping: re-check whether `_source-AnimeModal.jsx.tmp` / `_source-KineticTextModal.jsx.tmp` remain stashed and remove if also stale.

## Todo List

- [ ] **TDD-1** Rewrite test file with 16 cases (RED): preset list, SVG output assertions, error paths, sanitizer, architecture guards
- [ ] **TDD-2** Create `client/src/data/parametric-math-grid-templates.js` with AGPL/SPDX header, tightened `ALLOWED_MATH_TOKENS`, `sanitizeMathExpr`, `PRESETS` (10 entries), `compileExpr`, `evalRange`, `generateGrid`, `generateMathGridSvgHtml`
- [ ] **TDD-3** Rewrite `parametric-math-grid-surface-plotter-modal.jsx` with Tailwind shell, `useMemo` grid, inline `GridSVG`, line-width / opacity / bg / u-toggle / v-toggle controls, error display, disabled-insert guard (GREEN)
- [ ] **TDD-4** Run targeted vitest -- expect all 16 cases green
- [ ] **TDD-5** Run `npm run lint && npm run build` -- fix any errors
- [ ] **TDD-6** Sibling regression: run vitest on anime/three/kinetic-text modal tests
- [ ] **TDD-7** Manual browser smoke: each preset distinct, error path, Insert + present mode + offline export round-trip
- [ ] **TDD-8** Delete stashed `plans/reports/_source-MathGridModal.jsx.tmp`

## Success Criteria

- Modal file <= 200 LOC; data module file <= 250 LOC.
- 10 presets render distinct grid geometries in preview SVG.
- Lissajous is not present (regression-asserted via test #1).
- Emitted HTML contains `<svg`, `<polyline`, no `<canvas`, no `<script` (regression-asserted).
- Inline error message visible when expression fails compile or yields empty grid; Insert disabled in those states.
- All 16 test cases pass; sibling Anime/Three/Kinetic test suites unchanged and green.
- `npm run lint` clean; `npm run build` clean.
- Manual smoke: math-grid element inserts, renders in present mode, survives offline export.
- AGPL/SPDX header present on data module; absent on locally rewritten modal shell.
- No EditorPage call-site change (`EditorPage.jsx:1888-1892` untouched).
- Sanitizer rejects `constructor`, `prototype`, `globalThis`, `window`, `eval`, `import`, `Function`, `[`, `]`, `=`, `` ` `` -- regression-asserted.

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| File size creep beyond 200 LOC | M | Aggressive split: PRESETS + 4 helpers + sanitizer in data module; modal is shell + small inline `GridSVG` |
| Test fragility on SVG numeric output (floats) | M | Match against substring patterns (`<polyline`, `stroke="#xxxxxx"`) and structural shape, not exact float values |
| `new Function()` injection via missed allowlist token | L | Tighten regex first; add unit tests for each blocked token (case #14); allowlist is "characters + named functions only", `=` blocked so `constructor.x=` cannot mutate |
| Already-inserted canvas-stub elements break | L | They're stored as `html` element with original content; `renderHtml` doesn't change. Add manual smoke step verifying an old presentation still renders |
| Diverging from sibling iframe-preview pattern confuses future ports | L | Documented in red-team R2 + journal-next-step; output type (executable JS vs static SVG) is the discriminator, not "all preview modals use iframes" |
| Source's `generateGrid` returns `{}` for invalid input but `useMemo` still has stale `bounds` | L | Adopt source guard `if (!isFinite(minX)) return error`; `grid.error` short-circuits both preview and Insert |
| Test runner unable to render `<svg>` in jsdom | L | jsdom has SVG namespace support; sibling tests already render JSX with attribute matching. Assert HTML output shape via `onInsert.mock.calls[0][0]`, not via DOM rendering of `<svg>` |
| Old test "Lissajous" assertion still in CI | L | TDD step 1 explicitly rewrites the test file; CI fails until matched -- this is the intended RED phase |

## Security Considerations

- **Tightened sanitizer.** Math expression is the only user-controlled input that flows into `new Function()`. The allowlist regex caps total alphabet to `[0-9 + - * / ( ) . % whitespace , u v]` plus a closed set of named identifiers. Tokens like `constructor`, `prototype`, `globalThis`, `Function`, `[`, `]`, `=`, backtick fall outside the allowlist and are replaced with `'0'`. Unit-tested per case #14.
- **`new Function()` execution context.** Even when sanitized, `compileExpr` runs in the modal's parent React context. The result is a *pure* function over `(u,v)` -- it cannot reference outer scope because the `const {sin,...}=Math` destructuring shadow + the allowlist limit references to `u`, `v`, and Math members. There is no `this`, `arguments` cannot reach the parent (modal calls `xFn(u, v)` not `xFn.call(...)`). Acceptable.
- **Inserted SVG output is non-executable.** No `<script>`, no event handlers, no `javascript:` URLs in `polyline` `stroke` (color is constrained to a `<input type=color>` value). Per `README.md:117-130` security model, HTML embeds are trusted author content; the math-grid output strictly *reduces* the surface vs the prior canvas+JS stub.
- **Preview is inline SVG (no iframe).** No new XSS surface -- preview SVG is generated from sanitized expressions inside a React tree the parent already owns.
- **Color / bg fields are constrained.** `<input type=color>` and `<select>` of fixed options. No raw color string injection.
- **No new server endpoint, no upload, no auth touch.**
- **License compliance.** Ported `PRESETS` array + `compileExpr` / `evalRange` / `generateGrid` / `handleInsert`-equivalent helper signatures carry SPDX header. Modal shell is locally rewritten and needs no header (per Three.js port journal).

## Next Steps

After this phase ships:

1. Update CHANGELOG entry under v1.10.0-pending (bump version per release rules).
2. Optional follow-up: write the `MathGrid` AGPL/SPDX-header pattern + "preview parity with output type" rule into `docs/code-standards.md` so future modal ports know when to use iframes (executable JS) vs inline (static SVG/markup). Same outcome promised but not delivered after the Three.js port -- bundle into one `docs/code-standards.md` update across all four ports.
3. Optional follow-up: add a `MathGrid` corpus example to `npm run test:corpus` to verify SVG output renders identically across browsers.
4. Optional follow-up: surface a "Custom expression library" preset slot for users to save their own xExpr/yExpr/range tuples (deferred per Out of Scope).

## Status

**DONE** -- plan ready for `/ck:cook --tdd`.
**Summary:** TDD upgrade of the canvas-based math-grid stub: replace with SVG-only port mirroring source's `generateGrid` + `GridSVG` while keeping (and tightening) local's regex sanitizer. Split into Tailwind modal + AGPL-headed data module, drop "Lissajous" preset, add line-width/opacity/bg/u-line/v-line controls, ship 16 tests including sanitizer regression guards.
**Concerns/Blockers:** None.

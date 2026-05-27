## Finding 1: Phase 8 visual gate targets a dead import contract
- Severity: Critical
- Location: Phase 8 -> Architecture -> Visual regression spec
- Flaw: The proposed Playwright spec posts to `/api/pptx-import` and expects `{ id }`. The actual API is async: `POST /api/pptx/import` returns `202 { jobId }`, then callers must poll/SSE `/api/pptx/jobs/:jobId`.
- Failure scenario: Phase 8 gets implemented as written, every visual-fidelity test fails before rendering. Or worse, the implementer adds a second sync endpoint just to satisfy the plan, duplicating the existing async import system.
- Evidence: `server/routes/pptx-import.js:87` defines `router.post('/import', ...)`, `server/routes/pptx-import.js:102` returns `res.status(202).json({ jobId })`, and `server/routes/pptx-import.js:112` defines `GET /jobs/:jobId`. Existing e2e follows that contract: `tests/e2e/pptx-import-fidelity.spec.js:37` posts `/api/pptx/import`, `tests/e2e/pptx-import-fidelity.spec.js:46-48` expects 202 + `jobId` and waits for job completion.
- Suggested fix: Rewrite Phase 8 visual spec around the existing `waitForPptxImport(request, jobId)` helper pattern. Do not create a new import endpoint.

## Finding 2: Phase 8 points work at a nonexistent corpus runner
- Severity: High
- Location: Phase 8 -> Context Links / Related Code Files / Step 2
- Flaw: The plan says to modify `server/services/pptx-import/test-corpus-runner.js`, but the repository's corpus gate is `pptx-import-corpus-cli.js` over `pptx-import-semantic-and-roundtrip-fidelity-tester.js`. This will send implementation into file discovery churn and may create a parallel runner.
- Failure scenario: Acceptance criteria are wired into a new or wrong file, while `npm run test:corpus` keeps using the old harness and never enforces the new invariants.
- Evidence: `package.json:44` defines `test:corpus` as `node server/services/pptx-import/pptx-import-corpus-cli.js --roundtrip --strict`; `server/services/pptx-import/pptx-import-corpus-cli.js:85` calls `runCorpusTests`; `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:1076` defines `runCorpusTests`.
- Suggested fix: Replace every `test-corpus-runner.js` reference with `pptx-import-semantic-and-roundtrip-fidelity-tester.js` and `pptx-import-corpus-cli.js`. Specify exact function hooks to extend.

## Finding 3: Phase 3's unit math contradicts its own defect model
- Severity: High
- Location: Phase 3 -> Overview / Requirements / Architecture
- Flaw: The phase says default 16:9 decks still miss `pt -> px` conversion (`2pt` should become `2.67px`), but the required helper only computes `num * scaleAxis`. For a default source, `scale.x === 1`, so raw `2` remains `2`.
- Failure scenario: Tests pass for the 4:3 fixture because `scale.x = 4/3`, but default-size decks still store raw stroke/border/shadow widths. The original default-deck fidelity bug remains for every non-CSS numeric field.
- Evidence: `server/services/pptx-import/geometry.js:24-27` defines scale as `CANVAS_SIZE.width / width` and `CANVAS_SIZE.height / height`; default canvas is `960x540` at `server/services/pptx-import/constants.js:10`, so default source size yields scale 1. Current raw fields are indeed unconverted: image `borderWidth` is copied at `server/services/pptx-import/mapper/map-image.js:36`, line stroke at `server/services/pptx-import/mapper/map-shape.js:41`, diagram stroke at `server/services/pptx-import/mapper/map-diagram.js:36` and `server/services/pptx-import/mapper/map-diagram.js:63`.
- Suggested fix: First decide the contract: are pptxtojson geometric widths in the same coordinate unit as `left/top/width/height`, or CSS pt? If they need CSS pt conversion, helper must be `num * (96 / 72) * scaleAxis` and tests must cover scale `{x:1,y:1}`. If not, delete the default-size pt claim from the plan.

## Finding 4: Phase 6 updates the wrong export surface and underspecifies shape rendering
- Severity: High
- Location: Phase 6 -> Requirements / Step 3
- Flaw: The plan says both shared and client renderers should honor `shape.textHtml`, but actual shape rendering is SVG `<text>` generated from `element.text`; rich HTML cannot be dropped into that path directly. Separately, PPTX export already honors `textHtml`, so adding more export work there is likely churn.
- Failure scenario: Implementer adds `dangerouslySetInnerHTML` around shape text in the React renderer but leaves shared `shapeSvgString` using escaped plain text, causing editor and exported HTML to diverge. Or they spend time changing PPTX export that already works while canvas/reveal rendering still loses rich text.
- Evidence: Client canvas shape renderer only renders `element.text` inside SVG `<text>` at `client/src/components/canvas/element-renderers/shape-element-renderer.jsx:113-123`. Shared HTML renderer delegates shape output to `shapeSvgString` at `shared/src/element-renderers.js:148-150`; `shapeSvgString` escapes `el.text` into SVG `<text>` at `shared/src/shapeUtils.js:99-104`. PPTX export already checks `element.text || element.textHtml` at `client/src/utils/export-pptx-basic-renderers.js:117` and converts `element.textHtml` to runs at `client/src/utils/export-pptx-basic-renderers.js:130-138`.
- Suggested fix: Scope Phase 6 to editor + shared HTML rendering only. Specify a concrete SVG-compatible approach: either `foreignObject` with sanitized HTML, or a run-to-`<tspan>` converter. Do not touch PPTX export unless a failing test proves a gap.

## Finding 5: Phase 5 misses the PPTX export consumer for new per-cell fonts
- Severity: High
- Location: Phase 5 -> Related Code Files / Step 3
- Flaw: The phase adds `cellStyles.fontSizes` and `fontFamilies` and updates shared/client canvas renderers, but omits the client PPTX export table renderer. That exported PPTX path still uses table-level `element.fontSize`, so imported tables can render correctly in editor but lose cell font fidelity on export.
- Failure scenario: User imports a table with 24pt header and 14pt body, sees it correctly in the editor, exports to PPTX, and the exported deck collapses all cells to one font size.
- Evidence: Import currently omits font fields at `server/services/pptx-import/mapper/map-table.js:60` and `server/services/pptx-import/mapper/map-table.js:80-88`. Canvas table renderer uses table-level `fontSize` at `client/src/components/canvas/element-renderers/table-element-renderer.jsx:25` and applies it at `client/src/components/canvas/element-renderers/table-element-renderer.jsx:107`. PPTX export table renderer reads `cellStyles` at `client/src/utils/export-pptx-basic-renderers.js:219-220`, but writes `fontSize: element.fontSize || 12` at `client/src/utils/export-pptx-basic-renderers.js:241-243`.
- Suggested fix: Add `client/src/utils/export-pptx-basic-renderers.js` to Phase 5, or explicitly declare PPTX re-export fidelity out of scope. If in scope, use `getCellStyle('fontSizes', rowIndex, colIndex)` and `fontFamilies` there too.

## Finding 6: Phase 5 underestimates table edit contract changes
- Severity: Medium
- Location: Phase 5 -> Risk Assessment / Todo List
- Flaw: The plan treats table row/col mutation as a risk/follow-up, but existing row/col controls mutate only `data`. New 2D style arrays will become stale unless this is part of the phase.
- Failure scenario: Imported table has per-cell `fontSizes`; user adds/removes a row/column; style arrays no longer match table shape. Later selected-cell edits or render/export use wrong style indexes.
- Evidence: `client/src/components/properties/table-properties.jsx:29-33` adds a row by updating only `data`; `client/src/components/properties/table-properties.jsx:42` adds a column by updating only `data`; `client/src/components/properties/table-properties.jsx:39` and `client/src/components/properties/table-properties.jsx:47` remove rows/cols by updating only `data`. Defaults define `cellStyles` as 2D arrays at `client/src/data/element-defaults.js:135-141`.
- Suggested fix: Promote this from risk to required Step 3: centralize table structure mutation so `data`, `cellStyles.*`, `colWidths`, `rowHeights`, and `mergedCells` stay in sync.

## Finding 7: Phase 7 promotes padding to schema without an editing contract
- Severity: Medium
- Location: Phase 7 -> Key Insights / Requirements / Step 4
- Flaw: The plan promotes imported insets to a top-level `padding` field and says PropertiesPanel may already edit it. Codebase does not have a generic text `padding` field; text rendering has hardcoded padding. This creates a new element schema surface without defining editor behavior, persistence semantics, or export behavior.
- Failure scenario: Imported text looks correct, but any edit/save path that rebuilds text element content ignores `padding`; exported HTML/PPTX still uses hardcoded margins; users cannot inspect or adjust the value.
- Evidence: Text preview hardcodes `padding: '8px 12px'` in `client/src/components/canvas/canvas-element-wrapper.jsx:86` and renders that style at `client/src/components/canvas/canvas-element-wrapper.jsx:112-113`. Text mapper currently stores insets only under `_pptxImportMeta` at `server/services/pptx-import/mapper/map-presentation.js:48-49`; shape mapper does the same at `server/services/pptx-import/mapper/map-shape.js:62-63`. Element defaults shown around text/table include `cellPadding` for tables but no generic text `padding`; table defaults are at `client/src/data/element-defaults.js:113-147`.
- Suggested fix: Keep Phase 7 narrower: apply `_pptxImportMeta.textInsets` during text/shape rendering only, and defer first-class editable `padding` until a PropertiesPanel/export contract is planned.

## Finding 8: Phase 4 risks adding a parser for a theoretical path bug
- Severity: Medium
- Location: Phase 4 -> Step 4 / Risk Assessment
- Flaw: The phase allows a new SVG path scaler/parser and possible dependency before proving current corpus exposure. The current path branch already stores a complete `svg` element with escaped path data; Strategy B is disproportionate unless real pptxtojson output proves absolute coordinates.
- Failure scenario: Implementation adds a fragile partial SVG path parser. Arc/cubic commands scale incorrectly, malformed paths get mangled, and a low-severity "needs verify" item becomes a new import regression source.
- Evidence: Current path branch is small and self-contained: `server/services/pptx-import/mapper/map-shape.js:10-21` maps path shapes to `type: 'svg'` and escapes the path through `svgAttr`. Client SVG rendering sanitizes the stored SVG content before insertion at `client/src/components/canvas/element-renderers/svg-element-renderer.jsx:22`. The corpus already has 10 fixtures, but listed files show no explicit custom-path fixture; current corpus contents are fixed under `server/data/test-corpus` and the strict gate is driven by `package.json:44`.
- Suggested fix: Make Phase 4 read-only diagnostic unless a real fixture fails. If no corpus deck exposes this, add a fixture and only use Strategy A. Reject Strategy B/new dependency in this plan.

**Status:** DONE_WITH_CONCERNS
**Summary:** Red-team plan review complete. Main blockers: Phase 8 import API is factually wrong, Phase 8 corpus file target is wrong, Phase 3 unit conversion contract is internally inconsistent, and Phase 5/6 miss real consumers while adding scope elsewhere.
**Concerns/Blockers:** No lint/build/test run per instruction. Findings are based on grep/read-only verification only.

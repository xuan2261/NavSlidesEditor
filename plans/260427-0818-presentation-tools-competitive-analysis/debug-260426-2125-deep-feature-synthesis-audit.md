# Deep Feature Synthesis - Audit And Debug Report

## Executive Summary
- **Issue:** `brainstorm-260426-1740-deep-feature-synthesis.md` is useful but mixed-current-state with stale assumptions.
- **Impact:** Main risk = wrong roadmap priority, especially PPTX Phase E and Slide Master sequencing.
- **Root cause:** Synthesis was not re-verified against current code/docs/test corpus after recent PPTX fidelity work.
- **Status:** Investigated. No code changes.
- **Fix:** Update decision matrix: keep SlideCanvas decomposition P0, downgrade/reframe PPTX chart work, validate Slide Master demand before 5-week build.

## Evidence
| Area | Source checked | Result |
| --- | --- | --- |
| README context | `README.md` | Self-hostable, no account/cloud/tracking, 17 element types, PPTX/PDF/export/live scope confirmed. |
| File size | line counts | `SlideCanvas.jsx` 2759 LOC, `EditorPage.jsx` 1662 LOC. God-component claim confirmed. |
| Clipboard | `editor-store.js`, `use-clipboard.js`, `SlideCanvas.jsx` | Duplication confirmed: store state + hook + inline handlers in SlideCanvas. |
| Keyboard | `use-keyboard.js`, tests, Toolbar | Hardcoded switch confirmed, no registry/customization/conflict detection. |
| PPTX import | `mapper.js`, `chart-output-to-navslides-mapper.js`, docs, tests | Synthesis stale: chart mapper and diagram flattening already exist. |
| PDF import | `pdf-import.js` | Visual-only raster import confirmed. No editable extraction path. |
| Analytics | `analytics.js`, `socket-handler.js`, `htmlGenerator.js` | View events persisted; live navigation/session timing not persisted. |
| MCP | repo search | No MCP infrastructure confirmed. |
| Slide Master | repo search | Only reserved `showMasterPanel` state found; no master data model. |

## Verification Run
```text
npm run test -- server/services/pptx-import/mapper.test.js server/services/pptx-import/pptx-import-e2e-flow.test.js server/services/pptx-import/roundtrip-matching.test.js client/src/hooks/use-keyboard.test.js client/src/utils/pdf-import.test.js server/services/socket-handler.test.js
6 files passed, 119 tests passed.

npm run test:corpus
Files: 4 total, 4 passed, 0 failed
Avg Semantic Fidelity: 97.0%
Avg Round-trip Stability: 99.0%
Export Method: production
```

## Confirmed Findings

### P0 - SlideCanvas Decomposition Is Real
- Current `SlideCanvas.jsx` is 2759 LOC, still owns interaction, clipboard, crop, render dispatch, chrome, inline renderer helpers.
- Synthesis correctly identifies this as unblocking work.
- But target `~400 LOC` conflicts with roadmap success criteria `<=1200 LOC`; `400 LOC` likely over-split.
- Better first target: extract `CanvasElement`, `CropOverlay`, canvas chrome, clipboard/key interaction, then stop when behavior is stable.

### P0 - Clipboard/Keyboard Duplication Must Be Fixed Before Big Refactor
- `use-clipboard.js` exists but `SlideCanvas.jsx` still implements copy/cut/paste/duplicate inline.
- `use-keyboard.js` exists but SlideCanvas also registers keydown handlers.
- Root risk: future shortcut registry can call one path while canvas still handles another path.
- Fix direction: one command layer for clipboard and keyboard, then decompose canvas.

### P1 - Custom Shortcuts Claim Is Accurate
- `use-keyboard.js` uses `e.key.toLowerCase()` and a switch.
- No registry, no user overrides, no conflict detection, no UI in Settings.
- Report recommendation mostly valid.
- Adjustment: physical `e.code` is not automatically better for all users. It supports physical shortcuts but can surprise localized keyboard users. Needs product decision.

### P1/P2 - Slide Master Is Strategically Strong But Demand-Unproven
- Only `showMasterPanel` reserved state exists.
- Hybrid model is reasonable, but 5-week effort is large.
- Must not begin before current renderer/data-flow is simplified.
- Validate user demand first; built-in templates may already satisfy casual users.

### P2 - PDF Editable Import Claim Is Accurate
- Current `pdf-import.js` renders each page via `pdfjs-dist` canvas and uploads PNG.
- No text extraction, layout reconstruction, OCR, or server-side Python.
- Editable mode should start as a separate spike, not full feature commitment.

### P2 - Analytics Gap Is Accurate
- `recordView()` persists total views and token/referrer events only.
- Live socket events update room state and broadcast navigation but do not persist sessions, slide time, fragments, or drop-off.
- Add privacy/retention rules before storing richer analytics.

## Stale Or Incorrect Findings

### High - PPTX Chart/SmartArt Claims Are Stale
- Synthesis says charts are placeholders and chart data not extracted.
- Current code maps `element.type === 'chart'` via `mapChart()`.
- Current docs report Phase 4 chart import and Phase 6 group/SmartArt flattening.
- Current strict corpus: 97.0% semantic, 99.0% round-trip.
- Correct next step is not "build chart extraction from scratch"; it is add chart-heavy corpus and close residual metadata gaps.

### Medium - "SmartArt Always Rasterize" Is No Longer Current
- `flattenDiagramElement()` converts diagram nodes to shapes up to 50 nodes.
- Complex nested layouts may still lose hierarchy, but not "always rasterize."

### Medium - PPTX Priority Needs Reframe
- Keep Phase E, but rename scope:
  - expand corpus with chart/SmartArt/OLE/equation decks
  - enforce per-type gates
  - improve chart metadata: legend, axis titles, styles
  - decide unsupported OLE/equation fallback
- Do not prioritize JSZip/XLSX parser until a chart-heavy real deck proves pptxtojson misses embedded data.

### Low - Markdown Renderer Advice Needs Narrowing
- `markdownToHtml()` is local in `SlideCanvas.jsx`, but shared render/export already exists in `shared/src/element-renderers.js` and client has `marked`.
- Better framing: unify editor preview vs shared export rendering contract; do not create another shared parser casually.

## Revised Priority
| Priority | Work | Decision |
| --- | --- | --- |
| P0 | Clipboard/keyboard command unification inside current canvas | Do first, reduces refactor risk. |
| P0 | SlideCanvas decomposition | Do, target <=1200 LOC first pass. |
| P1 | Custom shortcut registry/UI | Do after command path is unified. |
| P1 | PPTX fidelity hardening | Do as corpus/gates/metadata work, not greenfield chart extraction. |
| P1/P2 | Slide Master hybrid | Validate demand, then plan after canvas decomposition. |
| P2 | PDF editable import | Spike first; Python/Electron packaging decision required. |
| P2 | Presentation analytics | Incremental backend work; privacy rules required. |
| P3 | Per-element animations | Defer. Fragment system already works. |
| Later | MCP server | Skip v1.x unless developer/enterprise demand appears. |
| Never/Non-roadmap | Real-time collab, SaaS, mobile editing, plugin marketplace | Keep skipped; aligns roadmap. |

## Recommended Corrections To Source Report
1. Replace PPTX Feature 4 section with current-state evidence from `docs/pptx-import-fidelity-report.md`.
2. Change "Charts placeholder" to "Charts mapped, metadata incomplete; corpus lacks chart-heavy real decks."
3. Change "SmartArt skipped" to "Diagram flattening exists, hierarchy loss remains."
4. Change SlideCanvas target from `~400 LOC` to staged `<=1200 LOC`, then reassess.
5. Add explicit dependency: shortcut customization depends on removing duplicate canvas key handlers.
6. Add privacy constraints to Analytics before adding live session persistence.

## Unresolved Questions
1. Does current 4-deck corpus include real chart-heavy decks? Current corpus output has no chart per-type breakdown.
2. Is Python runtime acceptable for Electron packaging if PDF editable import uses PyMuPDF/Camelot/Tesseract?
3. Do users actually need Slide Master, or are templates sufficient for near-term roadmap?
4. For shortcuts, prefer physical keys (`e.code`) or localized character keys (`e.key`)?
5. Analytics: what retention, opt-out, and privacy wording fit "no tracking" product identity?

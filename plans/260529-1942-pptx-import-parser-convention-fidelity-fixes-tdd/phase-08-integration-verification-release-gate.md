---
phase: 8
title: "Integration Verification + Release Gate"
status: completed
priority: P0
effort: "1d"
dependencies: [2, 3, 4, 5, 6, 7]
---

# Phase 8: Integration Verification + Release Gate

## Overview
Prove all 6 root-cause fixes hold together end-to-end on a real browser render, not just in unit isolation. Each prior phase fixed one family and promised a "Phase 8 visual audit"; this phase redeems those promises with one synthetic deck exercising every fix, run through the existing corpus + strict browser-audit gates. No real `.pptx` required (per user decision: self-built fixture).

## Key Insights (verified)
- Real gates already exist (`package.json:44-48`):
  - `test:corpus` → `pptx-import-corpus-cli.js --roundtrip --strict` (semantic + roundtrip fidelity).
  - `test:pptx:browser-audit` → `scripts/run-pptx-browser-audit.js --strict --scope=smoke` (PR-fast).
  - `test:pptx:browser-audit:full` → `--scope=full` (5-deck release gate).
  - `test:pptx:strict` → corpus + full browser audit.
- Audit artifacts write to `plans/reports/pptx-import-real-browser-audit-runs/` (git-ignored; may contain slide content — README:294).
- Phase 1 fixture (`pptxtojson-2.0.2-output.fixture.js`) is parser-shaped data; Phase 8 needs a **real `.pptx` binary** the corpus CLI can parse via the live `pptxtojson@2.0.2`, to cross-check the fixture against true lib output (Phase 1 Risk: "fixture drifts from true lib output").
- The acceptance gate (`acceptance-criteria.js`, fixed in Phase 2) runs inside the import path — it must pass on the synthetic deck, not just in unit tests.

## Requirements
- Functional: a self-built synthetic `.pptx` containing every fixed feature — pt-sized text + table, an image with brightness/contrast/saturation corrections, a multi-stop gradient shape + gradient slide background, a rotated group (shape + line), a stacked bar chart, an area chart, a SmartArt/diagram node with long text, and an EMF image.
- Functional: importing it produces font_px ≈ pt (no 1.333× overflow), non-black corrected image, distinct gradient stops, correctly-placed unbloated grouped shapes, stacked chart, diagram fit clamp, and an EMF placeholder — verified in a real browser render.
- Functional: the live-parser output of this deck matches the Phase 1 fixture's shape (string `pos`, `/1e5` fractions, pt font) — closes the fixture-drift risk.
- Non-functional: all existing suites stay green (no regression); audit screenshots retained as evidence.

## Architecture
```
synthetic.pptx ─► importer (live pptxtojson@2.0.2) ─► mappers (all 6 fixes) ─► acceptance gate ─► presentation JSON
                                                                                                      │
   ┌──────────────────────────────────────────────────────────────────────────────────────────────┘
   ▼ corpus-cli --roundtrip --strict  (semantic + roundtrip fidelity, headless)
   ▼ run-pptx-browser-audit --strict --scope=full  (real Chromium render, overflow/clip/contrast checks + screenshots)
```
Add the synthetic deck to the corpus/audit deck set so it is a permanent regression gate, not a one-off. If generating a `.pptx` programmatically is heavy, reuse the existing PPTX **export** path (`server/services/pptx-exporter.js`) to author the deck from a NavSlides JSON, then re-import it (export→import roundtrip doubles as a fidelity check).

## Related Code Files
- Create: `server/services/pptx-import/__fixtures__/synthetic-fidelity-deck.pptx` (or a generator script that emits it)
- Read for context: `server/services/pptx-import/pptx-import-corpus-cli.js`, `scripts/run-pptx-browser-audit.js`, `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`, `server/services/pptx-exporter.js`
- Modify (if deck set is a manifest): the corpus/audit deck registry to include the new deck
- Tests: cross-check test asserting live-parser output shape == Phase 1 fixture shape

## Implementation Steps
1. **Build the synthetic deck.** Prefer authoring a NavSlides JSON with every feature, export via `pptx-exporter.js` → `.pptx`, confirm `pptxtojson` parses it. Fallback: hand-craft minimal OOXML. Keep it small (1–3 slides).
2. **Fixture cross-check (closes Phase 1 risk):** parse the synthetic deck with the live parser; assert its output shape matches `pptxtojson-2.0.2-output.fixture.js` conventions (string `pos`, fractional filters, pt font). If divergent, reconcile the Phase 1 fixture to true output and re-run dependent phases' unit tests.
3. **Headless gate:** run `npm run test:corpus`. Resolve any semantic/roundtrip regressions surfaced by the new deck.
4. **Browser gate:** run `npm run test:pptx:browser-audit:full`. Inspect screenshots in `plans/reports/pptx-import-real-browser-audit-runs/` for each fix:
   - R1: text/table inside box, no overflow; insets/borders proportional.
   - R2: corrected image visible (not black/gray); neutral image untouched.
   - R3: gradient shows distinct stops + correct direction; shape gradient renders (no `fill="gradient"`).
   - R4: grouped rotated shape sized correctly + placed at rotated center; line not double-rotated.
   - R5: stacked bars stacked; area filled; diagram node text clamped.
   - R6: EMF slot shows labelled placeholder, not broken image.
5. **Full strict run:** `npm run test:pptx:strict` (corpus + full audit) must pass clean.
6. **Whole-suite regression:** `npm run test && npm run lint && npm run build`. Then `npm run test:e2e` smoke.

## Tests (this phase)
- live-parser-shape cross-check == Phase 1 fixture conventions (drift guard, real binary)
- `test:corpus` strict roundtrip green on the synthetic deck
- `test:pptx:browser-audit:full` strict green; screenshots archived as evidence
- full `npm run test` + lint + build green (no regression from 6 fixes)
- acceptance gate passes inside the real import of the synthetic deck

## Success Criteria
- [ ] Synthetic deck exercises all 6 root-cause fixes and lives in the permanent deck set
- [ ] Live-parser output matches Phase 1 fixture shape (fixture-drift risk closed)
- [ ] `npm run test:pptx:strict` green; browser-audit screenshots confirm each fix visually
- [ ] Full `npm run test`, `lint`, `build` green; e2e smoke green
- [ ] Acceptance gate passes on real import (not only unit fixtures)

## Risk Assessment
- Risk: programmatic `.pptx` authoring is fiddly. Mitigation: reuse the export path (export→import roundtrip) instead of hand-rolling OOXML.
- Risk: browser audit flags pre-existing unrelated issues. Mitigation: baseline the audit on master before changes; only new regressions block.
- Risk: a fix passes unit but fails visually (e.g. SVG gradient angle). Mitigation: this phase is the visual backstop — fail here routes back to the owning phase, do not patch blindly.

## Security Considerations
- Synthetic deck is author-controlled; no external fetch. Audit screenshots are git-ignored (may contain slide content) — do not commit them.

## Next Steps
- On green: update `docs/project-changelog.md` + `docs/system-architecture.md` (PPTX import unit convention now scale-based, not 96-DPI). Bump README release note. Archive plan via `/ck:plan archive`.

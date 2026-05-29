/**
 * Expected post-fix NavSlides mapper output, keyed by source element.
 *
 * Each later phase fills its own slice and asserts the real mapper (run on
 * pptxtojson-2.0.2-output.fixture.js) produces these values. Phase 1 ships
 * empty placeholders; do NOT assert against an empty slice — a phase that
 * touches a slice replaces its placeholder with concrete expectations.
 *
 * Convention (all phases): standard 16:9 / 4:3 decks have scale = {x:1, y:1},
 * so 1pt → 1px on the 960×540 (72-DPI) canvas.
 */

module.exports = {
  // Phase 2 (R1): font/inset/border length conversion.
  text: {},
  table: {},

  // Phase 3 (R2): brightness/contrast/saturation fraction → CSS percent.
  image: {},
  neutralImage: {},

  // Phase 4 (R3): gradient stop parse + angle + SVG paint.
  gradientShape: {},

  // Phase 5 (R4): grouped shape/line affine (no double rotation, no bloat).
  rotatedGroup: {},

  // Phase 6 (R5): chart stacked/area fields + diagram fit-meta.
  stackedChart: {},
  areaChart: {},
  diagram: {},

  // Phase 7 (R6): EMF/WMF placeholder.
  emfImage: {},
}

# Semantic text layout boundary

Text that has the same characters can still have different line breaks, baselines
and bidi shaping. Editor zoom, Reveal transforms and generated-document styles
must not become independent text-layout engines: a saved source run must retain
its size and shaping context on each surface. Positioning individual glyph-range
rectangles is not an equivalent replacement for painting an intact shaped line.

The [layout boundary](../shared/src/pptx-text-layout.js) binds the canonical text,
local text rectangle, exact font evidence and browser/DPR profile. Measurement
uses an isolated browser document so surrounding slide styles and transforms do
not supply font metrics. The [shared label painter](../shared/src/pptx-shape-label.js)
is the editor and presentation paint boundary; the
[generated-text mount boundary](../shared/src/pptx-text-output.js) requires that
same measured paint before generated output can report readiness. A labelled,
unmeasured preview is not measured output or native-fidelity evidence.

Unsupported source semantics must remain located failures. Generic anywhere
wrapping, font-size floors, heuristic shrinking, clamped text rectangles and
unproven font substitution cannot establish support. Exact font bytes and glyph
coverage are required for this measurement profile; an installed family name
alone does not establish which glyphs the browser actually used. A source,
font or renderer-profile mismatch invalidates a prior layout.

Source preservation does not establish layout support. The
[body source reader](../server/services/pptx-import/ooxml-semantic-text-body.js)
and [layout support boundary](../shared/src/pptx-text-layout-plan.js) deliberately
separate retained DrawingML declarations from measured output. In particular,
unqualified column and compatible-spacing semantics must not acquire a native
fidelity claim merely because the source imports and survives serialization.

The [canonical layout assertions](../tests/pptx-semantic/semantic-text-layout.test.js),
[pinned-font paint assertions](../tests/pptx-semantic/semantic-text-layout-paint-browser.test.js)
and [generated-output lifecycle assertions](../tests/pptx-semantic/semantic-text-output-browser.test.js)
separate source preservation, browser geometry and output readiness. They do not
supply independent PowerPoint references.

Browser measurement remains **unqualified for native fidelity**. Native line-box,
spacing, script-font and autofit acceptance requires source-bound native references
with matching font assets and renderer evidence. Unsupported vertical, complex
line-break/list/tab profiles and shape-autofit geometry are not approximated by
this profile. Applying authored normal-autofit factors is not proof of native
refitting after an edit. No PowerPoint fidelity, edited-PPTX export eligibility or
release readiness follows from this boundary or its browser assertions.

## Layout invariants & cross-surface invalidation

1. **Canonical source sizes and metrics**: Run font sizes (`fontSizePt`) remain in authored native points. Neither an 8px browser minimum nor heuristic font shrinking is introduced. Normal autofit scales font sizes by `(fontScale / 100000)` and line spacing by `(1 - lineSpaceReduction / 100000)` without clamping. `shape` autofit is rejected because shape refitting requires geometry restructuring, not text-flow distortion; a `0` font scale is rejected explicitly.
2. **Font identity & missing/substituted rejection**: Exact SFNT bytes and `cmap` table coverage are verified against the declared SHA-256 asset hash. Any missing face (`font-missing`), ambiguous candidate (`font-ambiguous`) or substituted font (`font-substituted`) marks the layout `status: 'unsupported'` and `qualified: false`. Font fallback is never silently tolerated.
3. **Spacing, baseline, kerning, tabs and bullets**:
   - Line and paragraph spacing support both exact points and percent scaling.
   - Baseline shift (`baseline`) is applied as a CSS vertical shift in pixels; a 0 shift maintains the `baseline` inline alignment context to preserve ligatures and kerning across identical adjacent spans.
   - Font kerning is enabled when run size meets or exceeds `kerningPt`.
   - Tab stops support `l`, `ctr`, `r`, and `dec` (decimal alignment against the active locale prefix).
   - Bullets (character and numbered schemes) retain hanging indent, color, and relative size overrides.
   - Bidi text retains authored direction and unicode embedding; script fonts (`fontLatin`, `fontEastAsian`, `fontComplexScript`) are selected per script segment across explicit run boundaries.
4. **Surface shaping isolation and cache invalidation**:
   - `TEXT_SHAPING_RESET` neutralizes host Reveal themes, inspector typography, and surrounding CSS (`word-spacing`, `text-transform`, `font-stretch`, `font-feature-settings`) on both the measurement frame and the painted DOM line/run spans.
   - Cache identity `textLayoutIdentity` binds the complete normalized document, shape EMU extents, text rectangle, font profile and renderer profile (including `devicePixelRatio`, user agent, platform, and session ID). Any variation immediately invalidates cached lines.
   - Output font runtimes track owned family aliases and invalidate cached layouts if foreign `FontFace` instances claim an owned alias (`stale-table-output-fonts`).

## Oracle prerequisite

Independent native PowerPoint qualification requires:
- Physical Microsoft `Aptos` and `Aptos Display` font files (or exact licensed SFNT asset bytes with matching SHA-256 hashes).
- Independent line box references captured directly from a validated PowerPoint COM/native engine execution on identical source decks, including baseline offsets, glyph advances, line bounds, and paragraph margins.
- Verification that native line wraps and line counts match without heuristic browser font substitutions.

In the absence of these native assets and reference captures, the layout engine strictly yields `qualified: false`. Browser measurement is never substituted for native qualification.

## Native reference capture (2026-10-27)

The read-only [PowerPoint capture receipt](../.omo/evidence/pptx-semantic/native-text-table-shapes-media-oct27/native-capture.json)
binds the unchanged corpus source, native PDF, COM text ranges and capture script
by SHA-256. The [PDF origin extraction](../.omo/evidence/pptx-semantic/native-text-table-shapes-media-oct27/native-text-origins.json)
retains one page, 14 trace spans and 170 character origins. It is a native-rendered
reference artifact, not canonical source-to-glyph or font qualification.

The title declares `Aptos Display` in COM but its PDF trace names
`MicrosoftJhengHeiBold`. The table has XML native ID 2 but COM ID 4; IDs alone
cannot establish component ownership. Repeated `Green` cell text also prevents
unique text-only association. COM offsets, source IDs and trace names must not
be silently treated as canonical run offsets, occurrence IDs or physical font
provenance. Both receipts retain `nativeQualified=false`; no capture rewrites the
source, changes export gates or supplies the missing native acceptance.

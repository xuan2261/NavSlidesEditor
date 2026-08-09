# PPTX Export Fidelity, All Surfaces

## Outcome

Improve export fidelity for charts, tables, images, and local uploaded media while
preserving the security boundary and truthful fidelity reporting.

## Locked decisions

- Rotated tables remain editable native tables. Export emits a structured warning
  rather than silently claiming visual rotation parity.
- Audio and video embed only from validated local uploads. Remote URLs remain
  static fallback only, never server-fetched.
- Images with CSS filters or rounded corners rasterize only on the affected
  element; ordinary images remain native and editable.

## Non-goals

- Editable PPTX parity for raw HTML, SVG, LaTex/TikZ, games, timelines, or
  arbitrary browser media.
- Promoting imported PPTX charts from preserve-only to editable.
- Fetching remote media or accepting arbitrary filesystem paths during export.

## Phase 1, shared export contracts

1. Centralize image options and source classification used by client and server.
2. Define chart strategies: native supported types, intentional raster fallback,
   and placeholder as the final failure mode.
3. Validate table merge metadata against dimensions and overlap before native
   table construction.
4. Add structured warning helpers for table rotation, local-media limitations,
   and image rasterization.

**Acceptance:** client/server parity tests cover safe image sources, crop, fit,
flip, opacity, alt text, borders, invalid merge metadata, and warning shape.

## Phase 2, chart and table fidelity

1. Route `polarArea` directly to an intentional raster fallback, avoiding a
   misleading native-export error.
2. Prove native radar export and map only supported authored chart options
   (stacking, area fill, legend placement, and axis titles) after OOXML checks.
3. Preserve valid disjoint table merges through both exporters.
4. Export rotated tables as native tables with one auditable accepted-limit
   warning.

**Acceptance:** client/server unit tests and package assertions cover radar,
polar fallback, authored chart options, valid/invalid merged tables, and
rotation warning behavior.

## Phase 3, image visual fallback

1. Detect filters and border radius without altering ordinary-image export.
2. Raster only affected images through the existing bounded raster policy.
3. Retain dimensions, rotation, opacity, and alt text on the fallback frame.

**Acceptance:** native images remain editable; filtered or rounded images
produce a raster warning and a visually bounded PPTX image.

## Phase 4, local audio and video embedding

1. Embed validated upload-root audio/video with PptxGenJS `addMedia`.
2. Use a validated video poster when available; keep external or unsupported
   sources on the existing static fallback.
3. Warn for browser-only semantics with no proven OOXML mapping, including trim,
   playback speed, autoplay, loop, and muted.
4. Reject MIME-changing package-native image/media replacement until its
   content-type transaction is implemented and tested.

**Acceptance:** package tests assert embedded media parts and relationships;
negative tests prove no external fetch, traversal, or unsafe source embedding.

## Phase 5, evidence and documentation

1. Add client/server parity fixtures plus E2E export fixtures for image, video,
   audio, radar, polar, merged table, and rotated table.
2. Update the feature matrix and export limits to distinguish editable-native,
   visual-raster, and static fallback behavior.
3. Add Office-compatible package evidence before claiming playable embedded
   media fidelity.

## Validation gates

Run focused client/server/export tests after each phase, then:

```powershell
npm run matrix
npm run lint
npm run build
npm run test
```

No phase may widen the trusted-content boundary or weaken URL, upload-root,
MIME, or resource-limit validation.

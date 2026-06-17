# Phase 03 Media Element Controls

## Context Links

- [Current audit report](../260609-0830-element-control-functional-fixes-tdd/reports/260617-element-control-audit-matrix-current-state-report.md)
- `C:/Work/NavSlidesEditor/client/src/components/properties/image-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/media-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.jsx`
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`

## Overview

Priority: P0
Status: Completed
Goal: harden image/video/audio controls, especially legacy `videoUrl`, audio preview parity, image border authoring, crop/filter export policy.

## Key Insights

- `videoUrl || src` can make Source edits look ignored on old data.
- Audio properties write autoplay/loop/muted, but canvas audio preview needs verification.
- Image border exists in render/export paths, but UI authoring is unclear.
- CSS image filters and round corners are real PPTX export limits unless rasterized.

## Requirements

Functional:
- Migrate or neutralize legacy `videoUrl` precedence without data loss.
- Define the video source contract: canonical `src` wins when present; legacy `videoUrl` is read fallback only when `src` is absent; migration is idempotent and never deletes valid legacy data until `src` is safely populated.
- Verify video src, poster, objectFit, trim, playbackRate, controls/autoplay/loop/muted.
- Verify audio src/autoplay/loop/muted preview/export parity.
- Document image border authoring as `partial` unless an existing visible control is broken; do not add new border UI only for audit completeness.
- Verify image crop/reset, filters, flip, citation, Copy URL.
- Define media URL scheme policy for render, export, offline packaging, and Copy URL.

Non-functional:
- Backward compatible with saved decks.
- No breaking upload/media library flow.
- Do not add large image-processing dependency.

## Architecture

```text
MediaProperties / ImageProperties
  -> element fields (src, videoUrl legacy, filters, crop, flags)
  -> CanvasElement media DOM
  -> shared HTML renderer
  -> PPTX native image or fallback policy
```

## Related Code Files

Tests:
- `C:/Work/NavSlidesEditor/client/src/utils/migrate-video-src.test.js`
- `C:/Work/NavSlidesEditor/client/src/components/properties/media-properties.test.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-media-renderer.test.jsx`
- `C:/Work/NavSlidesEditor/tests/e2e/canvas/media-controls.spec.js`
- `C:/Work/NavSlidesEditor/shared/tests/element-renderers.test.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-image-opacity.test.js`

Potential source:
- `C:/Work/NavSlidesEditor/client/src/utils/migrate-video-src.js`
- `C:/Work/NavSlidesEditor/client/src/pages/EditorPage.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/image-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/media-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.jsx`
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-basic-renderers.js`

## Tests First

1. Unit: old video element `{ videoUrl, src }` migrates safely to canonical `src`; cover empty `src`, conflicting `src`/`videoUrl`, repeated migration, save/reload, and explicit user source edit.
2. RTL: MediaProperties source edit updates render-effective source.
3. Canvas unit/RTL: audio element applies autoplay/loop/muted flags consistently.
4. E2E: video trim + playbackRate persisted and visible in exported HTML string or render config.
5. E2E: image crop commit/reset updates `imageW`, `imageH`, offsets as expected.
6. Unit: image border authoring is marked `partial` unless a visible UI control exists and is tested.
7. Unit/security: media URL policy rejects or neutralizes unsafe schemes such as `javascript:`, local `file:`, unsafe `data:` HTML, and private/local network fetch targets where server-side fetching exists.
8. Export unit: filters/radius are either rasterized or explicitly listed as PPTX accepted limits.

Commands:

```bash
npm run test -- client/src/utils/migrate-video-src.test.js
npm run test -- shared/tests/element-renderers.test.js client/src/utils/export-pptx-image-opacity.test.js
npx playwright test tests/e2e/canvas/media-controls.spec.js
```

## Implementation Steps

1. Lock decision: `src || videoUrl` is the effective read path after migration; all UI writes canonical `src`; valid `videoUrl` is retained only as legacy fallback while `src` is empty or migration confidence is incomplete.
2. Add migration test and implementation if existing migration incomplete.
3. Add MediaProperties source test.
4. Fix audio canvas attributes if failing.
5. Keep image border authoring documented as imported/display/export fidelity unless an existing control is proven no-op.
6. Add URL allowlist/negative fixture coverage before marking media URL rows `works`.
7. Add crop/filter/citation coverage.
8. Update matrix rows.

## Todo List

- [x] Add video migration tests.
- [x] Add media properties tests.
- [x] Add audio canvas parity test.
- [x] Add media URL policy tests.
- [x] Add image border `partial` decision and test.
- [x] Add crop/filter export policy tests.
- [x] Update matrix.

## Progress Notes

- Updated `migrateVideoSrc` contract: canonical `src` wins when present, legacy `videoUrl` fills empty `src`, and legacy data is retained as non-destructive fallback.
- Updated canvas and shared HTML video renderers to resolve `src || videoUrl`, preventing stale `videoUrl` from overriding explicit Source edits.
- Added media properties coverage proving the Source URL field writes only canonical `src`.
- Added canvas/shared audio coverage for `autoplay`, `loop`, `muted`, and controls parity.
- Added client/shared media URL policy helpers and render-level negative tests for executable/local/unsafe data schemes.
- Added ImageProperties coverage proving round-corner authoring exists while image border width/color authoring remains intentionally partial.
- Added PPTX image export coverage for `cropData`, legacy image offsets, objectFit mapping, rectangular border overlay, and accepted native limits for CSS filters/rounded image corners.
- Updated matrix image rows with concrete Phase 03 evidence while keeping PPTX filter/radius as `export-gap`.
- Review fix: Copy URL now uses the same media URL policy for non-`blob:` sources and rejects unsafe `data:text/html` media URLs.
- Review fix: PPTX image-source helpers now reject non-image data URIs; matrix wording now limits native objectFit support to cover/contain and keeps fill/none as accepted gaps.

## Success Criteria

- Video Source control cannot be silently overridden by `videoUrl`.
- Legacy video migration cannot erase a valid source when `src` is empty or stale.
- Audio canvas preview and export use same media flags where browser permits.
- Image border status is no longer ambiguous.
- Unsafe media schemes cannot pass through render/export/copy paths without explicit accepted policy.
- Accepted PPTX filter/radius limits are explicit.

## Risk Assessment

- Risk: migration changes saved deck behavior.
  Mitigation: keep read fallback in shared renderer until load migration is idempotent and fixture-backed; do not delete legacy fields during this plan.
- Risk: autoplay behavior differs by browser.
  Mitigation: assert attributes, not actual playback.

## Red Team Review Applied

- Finding 4/7: `videoUrl` migration now has a safe data contract and must cover empty, conflicting, repeated, and save/reload cases.
- Finding 4: image border authoring is not added as a new product feature for audit completeness; mark `partial` unless current UI is broken.
- Finding 9: media URL allowlist and unsafe-scheme negative fixtures are required.

## Security Considerations

<!-- Updated: Validation Session 1 - security scope is policy, warnings, negative tests, and docs; no broad runtime hardening unless needed to enforce existing accepted policy. -->

- Media URLs must keep existing unsafe scheme filtering where copied or rendered.
- Upload paths must remain server-provided; do not inline local file paths.
- Accepted schemes must be explicit for each path. Default policy should allow server-controlled uploads and ordinary HTTP(S) media, and reject executable/local/private schemes unless a documented legacy exception exists.
- Do not broaden this phase into a sandbox/CSP/runtime redesign; fix runtime only where current media behavior violates the accepted URL policy.

## Next Steps

Phase 04 covers text, code, markdown, HTML, LaTeX, and chart controls.

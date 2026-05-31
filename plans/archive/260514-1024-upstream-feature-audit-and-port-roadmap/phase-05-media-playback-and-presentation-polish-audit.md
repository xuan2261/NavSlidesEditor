# Phase 05 - Media Playback And Presentation Polish Audit

## Context Links

- [Plan](./plan.md)
- Relevant upstream commits: `a388d35b`, `f7a3a351`, `904ffca0`, `00287342`, `f7261b2c`

## Overview

- Priority: P2
- Status: Complete
- Estimate: 4h
- Goal: audit media/playback/presentation polish candidates and port only low-risk improvements.

## Key Insights

- Local supports video/audio elements already.
- Export/PPTX paths may rasterize or render media differently.
- Some upstream commits may already exist locally or be irrelevant.

## Requirements

- Check local video/audio schema before adding fields.
- Do not add UI controls without present/export behavior.
- Do not port docs/landing-only changes.
- Prefer verification-only if local already aligned.

## Architecture

```text
Media properties
  -> element model: src, start/end, playbackRate, format support
  -> editor renderer
  -> present/export renderer
  -> e2e media smoke
```

## Related Code Files

- Modify if needed:
  - `client/src/components/properties/media-properties.jsx`
  - `client/src/components/canvas/canvas-element-wrapper.jsx`
  - `shared/src/element-renderers.js`
  - `shared/src/types/presentation.js`
  - `server/middleware/schemas.js`
  - `tests/e2e/element-properties.spec.js`
- Read:
  - `server/routes/upload.js`
  - `server/routes/media.js`
  - `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`
- Delete: none.

## Implementation Steps

1. Audit current media model:
   - supported mime/extensions
   - start/end support
   - playback rate support
   - present/export behavior
2. Compare upstream commits:
   - `.ogv` support
   - playback speed
   - video start/end trimming
   - grouped slides page number fix
3. Decide per candidate:
   - if schema missing and value high, adapt.
   - if only upload MIME missing, add validation/test.
   - if grouped page number issue already absent, mark aligned.
4. Add tests for any accepted media field.

## Todo List

- [x] Audit local media schema.
- [x] Audit upload MIME validation.
- [x] Compare present/export support.
- [x] Port only low-risk fields.
- [x] Update tests.

## Success Criteria

- Media candidate decisions documented.
- Accepted controls work in editor and present mode.
- Upload validation remains strict.

## Verification

Required:
```powershell
npm run lint
npm run build
npm run test
```

Targeted E2E:
```powershell
npm run test:e2e -- tests/e2e/element-properties.spec.js
npm run test:e2e -- tests/e2e/export.spec.js
```

Manual smoke:
- Add video and audio.
- Test start/end/playback rate if implemented.
- Present.
- Export HTML.

## Risk Assessment

- Risk: media controls imply browser compatibility behavior.
- Mitigation: add feature only where native media element supports it clearly.

## Security Considerations

- Do not loosen upload validation beyond intentional MIME/extension allowlist.
- Do not allow remote URLs to bypass current trusted-content model.

## Next Steps

- Decide whether optional timeline epic is worth implementation.

## Unresolved Questions

None.

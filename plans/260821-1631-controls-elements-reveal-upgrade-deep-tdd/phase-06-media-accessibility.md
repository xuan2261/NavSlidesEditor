---
title: "Phase 06: Image and Media Accessibility Metadata"
status: completed
---

# Phase 06: Image and Media Accessibility Metadata

## Goal

Add authoring, rendering, portability, and export contracts for image alternatives and media captions/transcripts using existing image/video/audio element types.

## Dependencies

- Phase 03 Reveal 6 asset/runtime baseline.
- Phase 05 semantic controls and shared URL policy.

## Canonical Files

- `shared/src/types/presentation.js`
- `client/src/data/element-defaults.js`
- `client/src/utils/editor-presentation-migration.js`
- `client/src/components/properties/image-properties.jsx`
- `client/src/components/properties/media-properties.jsx`
- `shared/src/element-renderers.js`
- `client/src/components/canvas/canvas-element-wrapper.jsx`
- `client/src/utils/offlineExport.js`, project media/archive utilities
- `shared/src/pptx-image-options.js`, `shared/src/pptx-media-options.js`, export policy/matrix
- Focused tests for migration, renderers, Properties, offline/archive, and PPTX

## Data Contract

- Image: `alt: string`, `decorative: boolean`, optional `longDescription: string`.
- Video/audio: optional `transcript: string`, optional `audioDescription: string`, and bounded `tracks[]` records with `{ src, srcLang, label, kind, default }`; `kind` is captions/subtitles/descriptions/chapters/metadata as supported by HTML media.
- Absent fields preserve legacy behavior. Migration normalizes invalid arrays/booleans/strings without inventing descriptive content.
- Decorative images render `alt=""` and do not expose long-description associations. Non-decorative images with blank alt generate an editor/accessibility warning but legacy decks remain loadable.
- Track URLs use the shared media URL policy and participate in project archive/offline asset collection and rewriting.
- Transcript text is user-authored metadata, not auto-generated. No transcription service is introduced.

## RED

- [x] Properties tests for alt, decorative toggle, long description, unique labels, validation message, mixed selection, locks, and decorative-state disabling.
- [x] Media Properties tests for adding/removing/reordering caption tracks, language/label/default semantics, transcript/audio description, URL rejection, and repeated-row naming.
- [x] Migration tests for absent legacy fields, malformed track records, duplicate defaults, oversized arrays/text, and vertical child slides.
- [x] Shared renderer tests for image `alt`, decorative output, `aria-describedby`/long-description behavior, video/audio `<track>` output, transcript disclosure/link policy, and sanitized invalid URLs.
- [x] Offline/project archive tests include local track assets in manifest/rewrite for top-level and child slides and make offline playback work without network.
- [x] PPTX tests preserve image alt text natively, explicitly report decorative/long-description/media-track limitations, and never claim transcript/caption preservation when flattened.

## GREEN

- [x] Extend shared JSDoc contracts and canonical defaults/normalizer without adding element discriminators.
- [x] Add accessible Properties sections using the Phase 05 field primitives.
- [x] Render metadata through existing image/video/audio renderers; keep controls, autoplay, poster, trim, and playback-rate behavior unchanged.
- [x] Extend media collectors/URL rewriters recursively through vertical child slides and track sources.
- [x] Feed alt text into existing native PPTX image options; add deterministic warnings for unsupported media semantics.
- [x] Add deck-level accessibility findings for non-decorative blank alt, missing track label/language, duplicate default tracks, and unsafe sources.

## REFACTOR

- [x] Share track normalization between client migration, renderer, offline collector, and export policy.
- [x] Keep authoring warnings separate from destructive normalization; never fabricate alt/transcript content from filenames.
- [x] Delete any renderer-local permissive URL handling replaced by the shared policy.

## Focused Verification

```bash
npm test -- client/src/components/properties/image-properties.test.jsx client/src/components/properties/media-properties.test.jsx
npm test -- client/src/utils/editor-presentation-migration.test.js shared/tests/element-renderers.test.js
npm test -- client/src/utils/offlineExport.test.js client/src/utils/project-media-utils.test.js
npm test -- shared/src/pptx-image-options.test.js shared/src/pptx-media-options.test.js shared/src/pptx-export-policy.test.js
```

Browser smoke: author image/media metadata, reload, present with keyboard/screen reader, switch to a vertical child slide, export offline, disable network, and verify captions/transcript/alt behavior.

## Success Criteria

- [x] Image alternatives are authorable, persisted, rendered, and natively exported where supported.
- [x] Decorative images are silent to assistive technology and still show a visible focus outline if separately actionable.
- [x] Captions/transcripts/audio descriptions are authorable and render in Reveal/offline HTML.
- [x] Local track assets survive project archive and offline export for parent and child slides.
- [x] Unsupported PPTX semantics produce deterministic warnings, not silent loss or false preservation claims.

## Risks / Rollback

- Requiring alt on load would break legacy decks. Warn and guide; enforce only on explicit user submission/export quality gates where product policy permits.
- Remote caption CORS behavior is unknowable at authoring time. Validate URL syntax and surface runtime load failure; do not claim availability.
- Rollback removes authoring/runtime use but must preserve unknown metadata on round-trip to avoid destructive downgrade.
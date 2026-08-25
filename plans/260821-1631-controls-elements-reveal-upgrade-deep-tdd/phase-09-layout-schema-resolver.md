---
title: "Phase 09: Slide Master/Layout Schema and Resolver"
status: completed
---

# Phase 09: Slide Master/Layout Schema and Resolver

## Goal

Introduce an additive reusable layout/master model and one pure effective-element resolver before adding authoring UI or export behavior.

## Dependencies

- Phase 03 Reveal 6 generated-HTML baseline.

## Canonical Files

- `shared/src/types/presentation.js`
- Recommended new module: `shared/src/slide-layouts.js`
- `client/src/utils/editor-presentation-migration.js`
- `server/middleware/schemas.js`
- `client/src/data/slide-templates.js` and `client/src/data/slide-templates/*.js`
- `client/src/hooks/slide-operation-helpers.js`, `client/src/hooks/use-slide-operations.js`
- Migration/schema/resolver/duplication tests

## Data Contract

Presentation adds bounded `layoutMasters[]`:

```js
{
  id: string,
  name: string,
  system?: boolean,
  safeArea?: { x: number, y: number, width: number, height: number },
  tokens?: DesignTokens,
  fixedElements: SlideElement[],
  placeholders: [{
    id: string,
    type: ElementType,
    role: 'title'|'subtitle'|'body'|'image'|'media'|'chart'|'footer'|'custom',
    x: number, y: number, width: number, height: number,
    zIndex?: number,
    locked?: boolean,
    contentPolicy?: object
  }]
}
```

Slide adds optional `layoutId` and bounded `layoutOverrides` with `hiddenElementIds`, `elementPatches`, and `placeholderBindings` from placeholder ID to slide-owned element ID. Absence of `layoutId` is the detached/legacy state; do not add a redundant detached boolean.

- Built-in `SLIDE_TEMPLATES` remains the single source. An adapter exposes system layout definitions while preserving existing template IDs and materialized insert behavior.
- User templates from server template routes remain whole-deck templates, not layout masters.
- Effective elements = namespaced master fixed elements + bound placeholder instances + slide-owned elements, merged with validated overrides and deterministic z-order.
- Fixed master elements are immutable in normal slide mode. Bound placeholder content remains slide-owned. Missing layout references render slide-owned elements only and surface a warning.
- No master inheritance/base-layout chain in this phase; avoiding it removes cycle/rebase ambiguity. Custom masters are complete definitions.

## RED

- [x] Server schema accepts bounded valid layout/master metadata and rejects duplicate IDs, invalid geometry/types, oversized registries/arrays/patches, dangling bindings, and attempts to patch immutable identity/type fields.
- [x] Client migration preserves legacy decks exactly, normalizes new fields non-mutatively, recurses into vertical children, and degrades missing/malformed layout refs to slide-only rendering plus warning.
- [x] Resolver tests cover fixed elements, placeholders, hidden overrides, allowed patches, token merge, ID collision namespacing, deterministic z-order, missing refs, vertical children, and source immutability.
- [x] Apply/change/detach pure command tests: apply preserves user elements; change matches placeholder roles non-destructively; detach materializes the effective slide and clears layout metadata without visual loss.
- [x] Duplicate/copy tests preserve the layout reference, deep-copy overrides, regenerate slide-owned IDs, and remap placeholder bindings only to copied elements.
- [x] Built-in adapter tests prove every existing `SLIDE_TEMPLATES` key remains available and compiles deterministically.

## GREEN

- [x] Implement normalized validators/limits in shared pure code and mirror/enforce them at the server API boundary.
- [x] Add `resolveEffectiveSlide`/`resolveEffectiveElements`, `applyLayout`, `changeLayout`, and `detachLayout` pure commands.
- [x] Namespace ephemeral fixed-element IDs so they cannot collide with slide-owned IDs or become persisted accidentally.
- [x] Add client migration and server schema support without materializing default layout fields into legacy documents.
- [x] Adapt built-in templates into read-only system layout definitions; keep existing create/insert callers working through the stable registry.
- [x] Update slide duplication helpers to preserve links/overrides and obey fresh-ID rules.

## REFACTOR

- [x] Keep all effective-element composition out of React components and export loops.
- [x] Remove any second layout catalog introduced during development; only the adapter around `SLIDE_TEMPLATES` may define built-in layouts.
- [x] Keep safe areas as guide/validation metadata, not clipping or a constraint solver.

## Focused Verification

```bash
npm test -- shared/src/slide-layouts.test.js client/src/utils/editor-presentation-migration.test.js
npm test -- server/middleware/schemas.test.js client/src/hooks/slide-operation-helpers.test.js client/src/hooks/use-slide-operations.test.jsx
```

## Success Criteria

- [x] Legacy decks with no layout metadata are behaviorally unchanged.
- [x] Effective element resolution is deterministic, pure, and shared-ready.
- [x] Apply/change never destroys unmatched user content; detach is visually lossless.
- [x] Missing/malformed references do not crash or hide slide-owned content.
- [x] Existing template IDs and insert behavior remain stable.
- [x] Registry and override limits prevent pathological payloads.

## Risks / Rollback

- Persisting resolved fixed elements would duplicate sources and break future master edits. Guard ephemeral IDs and test serialization boundaries.
- Placeholder matching can be destructive if based on array position. Match explicit role/type and retain unmatched elements.
- Rollback renders slide-owned elements and preserves unknown layout metadata; do not strip registry/refs on save.
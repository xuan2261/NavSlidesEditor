---
phase: 3
title: "TemplateGallery component split"
status: pending
priority: P1
dependencies: [2]
---

# Phase 03: TemplateGallery component split

## Overview

Refactor `TemplateGallery.jsx` into a coordinator plus smaller components and a data hook. Behavior should not change in this phase.

## Requirements

- Functional: Same modal behavior, same filters, same favorites, same card selection.
- Non-functional: Keep each new component small and testable. Avoid adding new dependencies.

## Architecture

Target structure:

```text
client/src/components/dashboard/template-gallery/
├── template-gallery-header.jsx
├── template-gallery-sidebar.jsx
├── template-gallery-card.jsx
├── template-gallery-grid.jsx
├── template-gallery-empty-state.jsx
└── use-template-gallery-data.js
```

`client/src/components/dashboard/TemplateGallery.jsx` remains the public import path and composes the extracted modules.

Extraction constraint: do not create pass-through wrappers just to match this target tree. Start with `TemplateGalleryCard`, `TemplateGallerySidebar`, and `use-template-gallery-data.js`. Extract `Header`, `Grid`, and `EmptyState` only when each has a clear prop contract and either behavior, branching, or direct tests.

## Related Code Files

- Modify: `client/src/components/dashboard/TemplateGallery.jsx`
- Create: `client/src/components/dashboard/template-gallery/template-gallery-header.jsx`
- Create: `client/src/components/dashboard/template-gallery/template-gallery-sidebar.jsx`
- Create: `client/src/components/dashboard/template-gallery/template-gallery-card.jsx`
- Create: `client/src/components/dashboard/template-gallery/template-gallery-grid.jsx`
- Create: `client/src/components/dashboard/template-gallery/template-gallery-empty-state.jsx`
- Create: `client/src/components/dashboard/template-gallery/use-template-gallery-data.js`
- Modify: `client/src/components/dashboard/TemplateGallery.test.jsx`

## TDD Steps

1. Keep Phase 01/02 tests as the regression suite.
2. Add focused tests for:
   - hook handles successful fetch
   - hook handles failed fetch
   - favorite toggle writes `localStorage`
   - card click calls `onSelectTemplate`
3. Run tests before refactor to confirm baseline.

## Implementation Steps

1. Move constants (`ICON_MAP`, category groups, class names) into a local module if needed.
2. Extract `useTemplateGalleryData` for fetch/favorites/filter/sort.
3. Extract `TemplateGalleryCard` and `TemplateGallerySidebar` first.
4. Extract header/sidebar/grid/card/empty components one at a time only when the extraction reduces responsibility.
5. Keep `TemplateGallery.jsx` responsible only for modal shell, close behavior, and composition.
6. Preserve current CSS classes unless a class is clearly broken.

## Success Criteria

- [ ] `TemplateGallery.jsx` is primarily orchestration code.
- [ ] Extracted components receive data via props and do not fetch independently.
- [ ] Public import path stays unchanged.
- [ ] Focused tests pass:

```powershell
npx vitest run client/src/components/dashboard/TemplateGallery.test.jsx client/src/utils/template-filters.test.js
```

## Risk Assessment

Risk: extraction breaks event propagation, especially favorite click vs card click.  
Mitigation: test that favorite toggle does not call `onSelectTemplate`.

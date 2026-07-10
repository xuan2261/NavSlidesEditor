---
phase: 4
title: "Search, filter, and empty-state UX polish"
status: pending
priority: P2
dependencies: [3]
---

# Phase 04: Search, filter, and empty-state UX polish

## Overview

Make TemplateGallery user states clearer without adding a new marketplace feature. This phase is UX polish: labels, clear search, active filter indication, and better empty states.

## Requirements

- Functional: Users can clear search, see active filter state, and understand why no templates are visible.
- Non-functional: Keep UI lightweight and consistent with existing Tailwind/button primitives.

## Architecture

Use extracted components from Phase 03. Add state-derived UI only, not new global state. Keep all copy in one local constants file or near the components.

## Related Code Files

- Modify: `client/src/components/dashboard/template-gallery/template-gallery-header.jsx`
- Modify: `client/src/components/dashboard/template-gallery/template-gallery-sidebar.jsx`
- Modify: `client/src/components/dashboard/template-gallery/template-gallery-empty-state.jsx`
- Modify: `client/src/components/dashboard/TemplateGallery.test.jsx`

## TDD Steps

1. Add test for clear search button restoring all templates.
2. Add test for empty state when search has no result.
3. Add test for empty state when selected category has no result.
4. Add test that UI chrome/action labels use the chosen app-default English copy while metadata-driven labels still render `name` / `titleVi` when present.
5. Confirm tests fail where UI does not exist yet.

## Implementation Steps

1. Add clear button to TemplateGallery search input.
2. Display active filter/search summary with English chrome and metadata value, for example `Filter: Tương tác`.
3. Replace generic empty state with variants:
   - initial loading
   - fetch failed
   - no templates at all
   - no result for search/category
4. Standardize TemplateGallery chrome/action labels through local constants, defaulting to existing app English labels:
   - `Template Gallery`
   - `Loading...`
   - `Newest`
   - `Difficulty`
   - `Slide count`
   - `Close`
5. Preserve Vietnamese metadata fields when data provides them:
   - category display may use `cat.name`
   - template title may use `titleVi || title`

## Success Criteria

- [ ] Empty states explain the actual condition.
- [ ] Search can be cleared with one click.
- [ ] UI chrome/action labels are consistent with the existing app English style.
- [ ] `Template Gallery`, `Loading...`, `Newest`, `Difficulty`, `Slide count`, and `Close` remain English UI chrome/action labels.
- [ ] Metadata-driven category/template labels still render Vietnamese fields when provided.
- [ ] Category names still render from `cat.name`; template titles still prefer `titleVi || title`.
- [ ] Focused UI tests pass:

```powershell
npx vitest run client/src/components/dashboard/TemplateGallery.test.jsx
```

## Risk Assessment

Risk: over-standardizing language hides useful Vietnamese marketplace metadata.  
Mitigation: standardize only UI chrome/actions, not template/category content fields.

---
phase: 2
title: "Template metadata normalization"
status: pending
priority: P1
dependencies: [1]
---

# Phase 02: Template metadata normalization

## Overview

Create a single frontend metadata normalization layer so UI code consumes a stable template shape. This reduces repeated optional guards and makes old built-in data safer.

## Requirements

- Functional: Every template shown in frontend gets safe defaults for display and filtering.
- Non-functional: Do not change backend response shape or persisted JSON format in this phase.

## Architecture

Extend `client/src/utils/template-filters.js` or create `client/src/utils/template-metadata.js` if the helper grows. Use a strict boundary so raw and normalized shapes do not drift:

- Normalize immediately after successful fetch in `use-template-gallery-data.js` once Phase 03 exists.
- Until Phase 03, normalize at the `TemplateGallery` data boundary.
- Normalize `HomePage` marketplace templates inside the existing marketplace fetch setter or marketplace `useMemo`.
- Keep backend responses unchanged.
- Ensure `filterMarketplaceTemplates` accepts raw input but normalizes internally before matching.

Recommended normalized shape:

```js
{
  id: string,
  title: string,
  titleVi: '',
  description: '',
  category: 'uncategorized',
  tags: [],
  difficulty: null,
  slides: [],
  thumbnail: null,
  colorScheme: null,
}
```

## Related Code Files

- Modify: `client/src/utils/template-filters.js`
- Modify or create: `client/src/utils/template-metadata.js`
- Modify: `client/src/utils/template-filters.test.js`
- Modify: `client/src/components/dashboard/TemplateGallery.jsx`
- Modify: `client/src/pages/HomePage.jsx`

## TDD Steps

1. Write unit tests for `normalizeTemplateMetadata`.
2. Cover missing `title`, `description`, `tags`, `slides`, `category`, and non-string tags.
3. Write tests proving `filterMarketplaceTemplates` works on raw and normalized templates.
4. Run tests and confirm failures before implementation if helper is new.

## Implementation Steps

1. Add normalization helper.
2. Update `filterMarketplaceTemplates` and `matchesTemplateCategory` to call the helper internally so callers can pass raw templates safely.
3. Update `TemplateGallery` and `HomePage` to normalize `marketplaceData.templates` at one boundary each, not throughout render code.
4. Keep display fallback explicit, for example unnamed templates display as `Untitled Template`.

## Success Criteria

- [ ] No direct UI access assumes `template.title`, `template.description`, or `template.tags` exists.
- [ ] Search and category filters work on malformed but recoverable metadata.
- [ ] Focused tests pass:

```powershell
npx vitest run client/src/utils/template-filters.test.js client/src/components/dashboard/TemplateGallery.test.jsx
```

## Risk Assessment

Risk: normalization masks authoring mistakes in built-in templates.  
Mitigation: frontend normalizes for resilience, backend schema tests still flag missing required fields where appropriate.

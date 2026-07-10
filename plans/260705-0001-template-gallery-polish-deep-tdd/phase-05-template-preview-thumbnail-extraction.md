---
phase: 5
title: "Template preview thumbnail extraction"
status: pending
priority: P2
dependencies: [3]
---

# Phase 05: Template preview thumbnail extraction

## Overview

Extract the lightweight slide preview renderer from `TemplatePreview.jsx` so it can be reused and tested without pulling in full editor canvas behavior.

## Requirements

- Functional: Preview modal continues to show slide thumbnails for text, image, shape, code, latex, html, chart, table, and markdown placeholders.
- Non-functional: Do not use full `SlideCanvas`; keep renderer lightweight and dependency-free.
- Trust boundary: preserve trusted-author text preview behavior from the current renderer. Do not sanitize or escape authored rich text in a way that changes presentation fidelity.

## Architecture

Create `client/src/components/dashboard/TemplateSlideThumbnail.jsx`. `TemplatePreview.jsx` imports it. `TemplateGalleryCard` may use it later for richer card previews, but only if it does not hurt performance.

## Related Code Files

- Create: `client/src/components/dashboard/TemplateSlideThumbnail.jsx`
- Create: `client/src/components/dashboard/TemplateSlideThumbnail.test.jsx`
- Modify: `client/src/components/dashboard/TemplatePreview.jsx`
- Modify: `client/src/components/dashboard/TemplateGallery.test.jsx`

## TDD Steps

1. Add tests for background types:
   - no background
   - color
   - gradient
   - image
2. Add tests for common element placeholders.
3. Add test that thumbnail safely ignores missing `elements`.
4. Add test that text content renders in trusted-author context.
5. Add accessibility tests for thumbnail usage in card/button contexts where practical.

## Implementation Steps

1. Move thumbnail functions and component out of `TemplatePreview.jsx`.
2. Export default `TemplateSlideThumbnail`.
3. Keep current behavior and CSS as close as possible.
4. Optionally add props for `width`, `height`, `scale`, and `className`.
5. Update `TemplatePreview.jsx` imports.

## Success Criteria

- [ ] `TemplatePreview.jsx` no longer contains internal thumbnail renderer code.
- [ ] `TemplateSlideThumbnail` has dedicated tests.
- [ ] Trusted-author rich text preview behavior is preserved.
- [ ] Decorative thumbnail images/elements are not exposed as noisy duplicate accessible names.
- [ ] Preview insert workflow still passes.
- [ ] Focused tests pass:

```powershell
npx vitest run client/src/components/dashboard/TemplateSlideThumbnail.test.jsx client/src/components/dashboard/TemplateGallery.test.jsx
```

## Risk Assessment

Risk: thumbnail extraction changes visual output subtly.  
Mitigation: preserve existing styles first, polish only in a later design-specific plan.

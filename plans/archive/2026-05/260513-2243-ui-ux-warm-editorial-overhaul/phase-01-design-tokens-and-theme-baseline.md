# Phase 01 - Design Tokens And Theme Baseline

## Context Links

- [Plan](./plan.md)
- [Design applicability](./research/researcher-01-design-applicability-report.md)
- `DESIGN.md`
- `client/src/index.css`
- `client/tailwind.config.js`
- `docs/design-guidelines.md`

## Overview

- Priority: P1
- Status: Complete
- Effort: 5h
- Goal: create warm editorial semantic tokens without changing component behavior yet.

## Key Insights

- Existing theme tokens are the correct entry point.
- Need distinct tokens for brand, accent, focus, selection.
- Light mode should feel parchment/ivory. Dark mode should feel warm charcoal.

## Requirements

- Functional:
  - Define warm light/dark tokens in `index.css`.
  - Preserve existing token names consumed by Tailwind.
  - Add optional semantic aliases: `--brand`, `--brand-hover`, `--focus`, `--selection`.
- Non-functional:
  - No canvas/export fidelity changes.
  - No raw hex migration in components yet except token file.
  - Contrast target: body text >= 4.5:1, secondary >= 3:1.

## Architecture

Token layer:

```text
index.css :root / [data-theme='light']
  -> tailwind.config.js aliases
  -> existing className usage
  -> shared components in later phases
```

## Related Code Files

- Modify: `client/src/index.css`
- Modify: `client/tailwind.config.js`
- Modify: `docs/design-guidelines.md`
- Do not modify: canvas renderers, export utilities.

## Implementation Steps

1. Snapshot current token values in notes/comment or changelog.
2. Add warm palette tokens:
   - light: parchment, ivory, warm sand, warm text, warm borders.
   - dark: near black, dark surface, warm silver, dark border.
3. Keep `--bg-canvas-default: #ffffff`.
4. Add focus/selection token aliases.
5. Map Tailwind aliases only if needed; avoid class churn.
6. Update `docs/design-guidelines.md` color section to match real tokens.

## Todo List

- [x] Define final token palette.
- [x] Update CSS variables.
- [x] Check light/dark contrast manually.
- [x] Update design docs.
- [x] Run build.

## Verify / Tests

- `npm run build`
- `npm run test -- --run client/src/components/ui/Button.test.js`
- Manual: toggle light/dark on Home and Editor.
- Manual: verify canvas remains white when slide background is default.

## Success Criteria

- Theme changes visible with no broken class names.
- Existing screens render with no unreadable text.
- No component markup changed in this phase.

## Risk Assessment

- Risk: accent token change affects selection visibility.
- Mitigation: keep selection/focus separate from brand.

## Security Considerations

- None. Token-only.

## Next Steps

- Phase 02 shared primitives.

## Implementation Notes

- `--brand` / `--brand-hover` use terracotta for primary CTAs.
- `--focus` and `--selection` remain blue so keyboard focus and editor selection stay technical and distinct.
- `--accent` remains a backward-compatible alias for brand.
- `--bg-canvas-default` remains `#ffffff`.

## Unresolved Questions

- None.

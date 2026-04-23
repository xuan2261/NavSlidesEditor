---
phase: 2
title: "Design Tokens And Tailwind Foundation"
status: completed
priority: P1
effort: "1 day"
dependencies: [1]
---

# Phase 2: Design Tokens And Tailwind Foundation

## Overview

Finish the Tailwind foundation so later UI checks are testing a stable styling layer. This phase owns tokens, global CSS, Tailwind config, class merge utilities, scoped preflight behavior, and build integration.

## Requirements

- Keep the existing visual language; do not introduce a new theme.
- Eliminate migration leftovers that force components back to broad inline styles.
- Ensure dark/light tokens resolve in dashboard, editor, overlays, and live pages.
- Keep CSS selectors scoped enough to avoid Reveal.js/editor content regressions.
- Make Tailwind class composition deterministic through existing helpers.

## Architecture

Core styling path:

`client/tailwind.config.js` -> `client/src/index.css` -> component class names -> `client/src/lib/utils.js` class merge helper -> Vite CSS build.

Risk boundary: Reveal slide content can contain authored HTML/CSS. Global Tailwind/preflight changes must not mutate slide-rendered output unexpectedly.

## Related Code Files

- `client/tailwind.config.js`
- `client/vite.config.js`
- `client/src/index.css`
- `client/src/lib/utils.js`
- `client/src/components/ui/*`
- `client/src/utils/tailwind-inline-style-audit.test.js`
- Any component still using broad `style={{ ... }}` for normal UI layout/color.

## Implementation Steps

1. Review token definitions:
   - Background, foreground, border, muted, accent, danger, success, warning.
   - Editor-specific canvas, ruler, selection, overlay, slide sorter colors.
2. Verify Tailwind content globs include all app code and exclude build artifacts.
3. Check scoped preflight and base layers:
   - No global reset that breaks Reveal output.
   - No duplicate CSS variables with conflicting names.
   - No `!important` strategy unless documented and scoped.
4. Replace remaining ordinary UI inline colors/spacing with tokens/classes.
5. Keep dynamic styles only where they represent authored slide data or computed geometry.
6. Verify `cn`/class merge helper handles conditional classes without conflicting Tailwind utilities.
7. Add or update audit coverage for allowed inline-style exceptions.

## Verification & Tests

- `npm run build`
- `npm run lint`
- `npx vitest run client/src/utils/tailwind-inline-style-audit.test.js`
- Static checks:
  - `rg "style=\\{\\{" client/src/components client/src/pages`
  - `rg "#[0-9a-fA-F]{3,8}" client/src`
  - `rg "rgba?\\(" client/src`
- Browser smoke:
  - Dashboard loads with correct background/borders.
  - Editor loads with toolbar, sidebar, canvas, and status bar styled.
  - Live view loads without Tailwind base breaking slide HTML.
- Visual viewports:
  - 1440x900
  - 1024x768
  - 390x844

## Success Criteria

- [ ] CSS build has no unknown utility or PostCSS error.
- [ ] Token names cover all common migrated UI colors.
- [ ] Remaining inline styles are documented exceptions: geometry, authored slide content, animation values, or third-party editor integration.
- [ ] No global CSS regression on Reveal slide rendering.

## Risk Assessment

- Risk: Tailwind preflight changes slide HTML. Mitigation: test Reveal preview/export pages after foundation changes.
- Risk: overzealous inline-style cleanup breaks dynamic element positioning. Mitigation: allow geometry styles and document them.
- Risk: class conflicts hide state styles. Mitigation: use `cn`/`tailwind-merge` and add focused component checks.

## Security Considerations

- Do not move user-authored CSS into unsafe global selectors.
- Preserve sanitization boundaries for generated HTML and slide content.

## Todo List

- [ ] Token audit complete.
- [ ] Inline-style audit updated.
- [ ] Build/lint/unit checks recorded.
- [ ] Foundation screenshots captured for dashboard/editor/live.

## Next Steps

Proceed to Phase 3 once base styling is stable. Later phase visual failures should not be solved by ad hoc component colors unless the token system is missing a legitimate token.

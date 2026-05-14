# Phase 04 - Editor UX Micro Ports

## Context Links

- [Plan](./plan.md)
- [Candidate matrix phase](./phase-02-upstream-candidate-matrix.md)
- Relevant upstream commits: `315eee97`, `6d971eb0`, `8050b08a`, `2913f7a6`

## Overview

- Priority: P1
- Status: Complete
- Estimate: 7h
- Goal: port small editor UX improvements that fit current local architecture.

## Key Insights

- Local properties UI is split into type-specific components.
- Fragment controls live in `common-element-controls.jsx`.
- Text link behavior may already exist via TipTap; Ctrl+K must not conflict with command palette shortcut.

## Requirements

- Add only controls that map cleanly to local element schema.
- Preserve `data-testid` selector contract.
- Do not bloat `PropertiesPanel.jsx`; update type-specific files.
- Ensure present/export parity for any visual property.

## Architecture

```text
Properties panel
  -> common element controls: fragment animation
  -> misc/latex/media properties: type-specific controls
  -> element model update
  -> canvas renderer + shared export renderer parity
```

## Related Code Files

- Modify likely:
  - `client/src/components/properties/common-element-controls.jsx`
  - `client/src/components/properties/misc-properties.jsx`
  - `client/src/components/canvas/element-renderers/latex-element-renderer.jsx`
  - `shared/src/element-renderers.js`
  - `shared/src/types/presentation.js`
  - `shared/tests/element-renderers.test.js`
  - `tests/e2e/element-properties.spec.js`
- Read:
  - `client/src/components/Toolbar.jsx`
  - `client/src/hooks/use-keyboard.js`
  - `client/src/utils/default-keyboard-shortcut-definitions-registry.js`
- Delete: none.

## Implementation Steps

1. LaTeX/TikZ font size/color:
   - inspect local latex element schema.
   - add `fontSize` and `textColor`/`fontColor` only if not already supported.
   - expose controls in type-specific properties file.
   - update canvas renderer.
   - update shared export renderer.
2. Fragment animation options:
   - extend allowed options in common controls:
     - `slide-in`, `slide-out` or upstream exact class if reveal.js supports it.
     - `flip`, `strike` only if CSS/export support exists.
   - if custom CSS needed, add to shared HTML output and editor preview consistently.
3. Ctrl+K link modal:
   - audit current command palette shortcut.
   - only port if no conflict or if scoped correctly.
   - prefer existing TipTap link extension patterns.
4. Add tests before/with behavior:
   - unit render tests for shared HTML.
   - component tests for properties controls if practical.
   - E2E for visible property persistence.

## Todo List

- [x] Audit current LaTeX schema/render/export.
- [x] Add LaTeX controls if missing.
- [x] Add fragment options only with renderer support.
- [x] Audit Ctrl+K conflict before any change.
- [x] Add focused tests.

## Success Criteria

- LaTeX font size/color displays in editor and present/export.
- New fragment animations are selectable and render consistently.
- No shortcut conflict with command palette.
- No accessibility regression in properties panel.

## Verification

Required:
```powershell
npm run lint
npm run build
npm run test -- shared/tests/element-renderers.test.js
npm run test -- client/src/components/properties/import-fidelity-properties.test.jsx
```

Targeted E2E:
```powershell
npm run test:e2e -- tests/e2e/element-properties.spec.js
npm run test:e2e -- tests/e2e/element-interactions.spec.js
npm run test:e2e -- tests/e2e/toolbar-elements.spec.js
npm run test:e2e -- tests/e2e/export.spec.js
```

Manual smoke:
- Add LaTeX/TikZ element.
- Change font size/color.
- Reload presentation.
- Present.
- Export HTML/PDF/PPTX.
- Add fragment animation and step through reveal.js fragments.

## Risk Assessment

- Risk: reveal.js does not support upstream fragment classes exactly.
- Mitigation: verify class support, add minimal CSS only if needed.

## Security Considerations

- Style values must be constrained to safe CSS values.
- Avoid raw HTML injection through property values.

## Next Steps

- Proceed to Phase 05 media audit.

## Unresolved Questions

- Whether Ctrl+K should be link modal or keep command palette priority.

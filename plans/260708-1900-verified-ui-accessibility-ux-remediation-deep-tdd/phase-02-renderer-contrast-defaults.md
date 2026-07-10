---
phase: 2
title: "Renderer Contrast Defaults"
status: pending
priority: P1
dependencies: [1]
effort: "1-2 dev-days"
---

# Phase 2: Renderer Contrast Defaults

## Overview

Fix chart, markdown, and table renderer defaults so new/default content stays readable on light and dark slides while preserving explicit author-selected colors.

## Requirements

- Functional: chart labels/grid/legend, markdown text, table body/header/borders must use tokenized or contrast-aware defaults.
- Functional: explicit user colors must not be overwritten.
- Functional: editor preview and shared/export rendering should not diverge where the same element data is used.
- Non-functional: avoid broad theme redesign or automatic mutation of saved presentations.

## Architecture

Add small color resolution helpers rather than embedding ad hoc fallbacks in each renderer. Prefer existing `resolveColorField` and `auto` semantics. For Chart.js iframe `srcDoc`, compute safe colors outside the string and inject serialized values through `JSON.stringify`.

## Related Code Files

- Modify: `client/src/components/canvas/element-renderers/chart-element-renderer.jsx`
- Modify: `client/src/components/canvas/element-renderers/markdown-element-renderer.jsx`
- Modify: `client/src/components/canvas/element-renderers/table-element-renderer.jsx`
- Evaluate/modify: `client/src/data/element-defaults.js`
- Evaluate/modify for export parity: `shared/src/element-renderers.js`
- Tests: `client/src/components/canvas/element-renderers/chart-element-renderer.test.jsx`
- Tests: `client/src/components/canvas/element-renderers/markdown-element-renderer.test.jsx`
- Tests: `client/src/components/canvas/element-renderers/table-element-renderer.test.jsx`
- Tests: `shared/src/element-renderers.test.js` or nearest existing shared renderer test file

## Implementation Steps

1. Start from Phase 1 failing renderer tests.
2. Define acceptable fallback pairs:
   - Light/unknown slide fallback: near-black text/grid muted enough for charts.
   - Dark slide fallback: existing light text acceptable.
   - Token fallback: `var(--ns-...)` when element type supports design tokens.
3. Update `MarkdownRenderer` so `element.textColor` resolves through `resolveColorField`; fallback must not be raw `white`.
4. Update `TableRenderer` defaults for text, header text, border, and header background. Preserve `safeCssColor` and explicit cell styles.
5. Update `ChartRenderer` to accept optional `element.textColor`, `gridColor`, `legendColor`, or token-derived defaults; remove hardcoded white-only strings.
6. Check `shared/src/element-renderers.js` for export/share paths with the same defaults. If shared export still hardcodes unreadable values, align it in the same phase.
7. Add regression tests:
   - Default markdown/table/chart on light background produces non-white default text.
   - Explicit white user color remains white.
   - `auto` resolves safely.
   - Chart `srcDoc` escapes values safely and does not introduce raw HTML/script injection.
8. Add shared/export tests that render chart/markdown/table element HTML on light and dark slide backgrounds and assert readable default colors.
9. Add one browser smoke or generated-HTML inspection for exported/shared HTML if JSDOM cannot verify actual contrast.
10. Run targeted renderer tests.

## Success Criteria

- [ ] Chart, markdown, and table default colors are readable on light and dark backgrounds.
- [ ] Explicit user colors stay unchanged.
- [ ] Editor and export/shared rendering are aligned for touched defaults.
- [ ] Shared/export renderer tests cover chart, markdown, and table defaults.
- [ ] Targeted renderer tests pass.

## Risk Assessment

- Risk: changing defaults visually alters existing decks.
  - Mitigation: apply only to missing/`auto`/unsafe defaults; never mutate presentation JSON.
- Risk: Chart iframe string injection.
  - Mitigation: serialize all injected values, keep existing `<` escaping.

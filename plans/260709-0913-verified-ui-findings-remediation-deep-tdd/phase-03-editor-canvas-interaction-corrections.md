---
phase: 3
title: "Editor Canvas Interaction Corrections"
status: pending
priority: P0
dependencies: [1]
effort: "1-2 dev-days"
---

# Phase 3: Editor Canvas Interaction Corrections

## Overview

Correct the canvas-specific verified defects: generic accessible names, reversed keyboard nudge step, hard-coded selection chrome colors, and right panel fixed offset layout.

## Requirements

- Functional: canvas elements expose useful accessible names without leaking excessive slide content.
- Functional: Arrow keys nudge selected element by 1px; Shift+Arrow nudges by 10px, matching docs.
- Functional: selection handles, fragment/group badges, and rotation controls use theme tokens.
- Functional: right-side panels align with editor shell layout without fixed `80px` assumptions.
- Non-functional: preserve mouse drag, resize, rotate, crop, and multi-select behavior.

## Architecture

- Extend `getElementAccessibleName(element)` with type-specific summaries:
  - text/table: short sanitized text prefix;
  - image/video/audio: alt/name/src basename when safe;
  - chart/table/code/markdown/latex/html: type plus meaningful subtype;
  - locked/hidden/selected state appended.
- Keep keyboard nudge logic local to `canvas-element-wrapper.jsx`.
- Inspect existing CSS/Tailwind theme tokens before replacing inline raw colors. Use existing high-contrast tokens where possible; add a new token only once in the theme source with light/dark contrast checks.
- Replace EditorPage side panel vertical offset with a layout row/column that naturally sits below the ribbon.

## Related Code Files

- Modify: `client/src/components/canvas/canvas-element-wrapper.jsx`
- Modify: `client/src/components/canvas/canvas-element-wrapper.test.jsx`
- Modify: `client/src/pages/EditorPage.jsx`
- Modify/Create: `client/src/__tests__/ui-accessibility-findings-regression.test.js`
- Inspect only: `website/guide/keyboard-shortcuts.md`, `website/vi/guide/keyboard-shortcuts.md`

## Implementation Steps

1. Update tests first from Phase 1 for:
   - enriched accessible label;
   - ArrowRight = `{ x: 1 }`;
   - Shift+ArrowRight = `{ x: 10 }`;
   - selected/locked state included when appropriate;
   - no raw selection chrome colors.
2. Implement accessible name helper with strict length cap, e.g. 60-80 chars.
   - strip HTML from text/table content;
   - never include full slide text or raw HTML;
   - append state such as selected/locked only when useful.
3. Fix nudge step: `const step = event.shiftKey ? 10 : 1`.
4. Inspect `client/src/index.css`, `client/tailwind.config.*`, and existing selection/focus variables. Then replace raw style colors:
   - fragment badge background;
   - group badge background;
   - resize handle background/border;
   - rotation guide/handle background.
5. Refactor right panel shell:
   - remove duplicated `mt-[80px] h-[calc(100%-80px)]`;
   - align `PropertiesPanel` and `DesignIdeasPanel` in the editor workspace flex/grid area;
   - test normal ribbon-visible editor state;
   - test collapsed/hidden ribbon state if the existing `Ctrl+Alt+R` ribbon toggle remains supported;
   - verify PropertiesPanel open, DesignIdeasPanel open, canvas visible height greater than zero, and workspace scroll behavior.
6. Run canvas component tests, source token tests, and targeted EditorPage layout tests.

## Success Criteria

- [ ] Canvas labels are useful and bounded.
- [ ] Nudge behavior matches docs in English and Vietnamese guide.
- [ ] Existing delete/edit keyboard behavior still passes.
- [ ] No raw `#6366f1`, `#8b5cf6`, or `#14b8a6` remains in canvas selection chrome.
- [ ] Replacement tokens are confirmed to exist or are added once with light/dark contrast checks.
- [ ] Editor right panels render without fixed `80px` offset classes.
- [ ] PropertiesPanel, DesignIdeasPanel, canvas height, and workspace scroll behavior remain usable.
- [ ] Ribbon-visible and ribbon-hidden/toggled states are verified when the current product supports both.
- [ ] Targeted unit tests pass.

## Risk Assessment

- Risk: richer labels expose too much text. Mitigation: sanitize and truncate.
- Risk: layout refactor affects editor viewport sizing. Mitigation: keep DOM structure minimal and add visual/browser check.
- Risk: token replacement changes contrast. Mitigation: choose existing high-contrast selection/focus tokens and verify light/dark modes.

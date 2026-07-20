---
phase: 6
title: "Slide Navigator And Accessibility Baseline Burn Down"
status: complete
priority: P0
effort: "3-4 dev-days"
dependencies: [3]
---

# Phase 6: Slide Navigator And Accessibility Baseline Burn Down

## Overview

Make slide navigation semantically correct, keyboard-complete and visually informative, then remove editor-specific axe exceptions for nested controls and unnamed presentation fields.

## Requirements

### Functional

- Slide navigator uses a locked DOM contract: named `nav`, top-level `ul/li`, one selection `button` per slide, sibling action buttons, and a nested child `ul` outside the parent button.
- Preserve click, Ctrl/Cmd multi-select, Shift range-select, drag reorder, context menu and batch actions.
- Add roving focus with ArrowUp/Down, Home/End, Enter/Space and Shift+F10.
- Escape from context menu restores focus to the originating slide.
- Vertical child thumbnails render representative child content, not background only.
- Thumbnail previews use a static element whitelist. HTML, games, active media and embeds render inert placeholders; no preview iframe may use `allow-scripts`.
- Auto-slide and Navigation Mode expose real labels.
- Remove editor-specific `nested-interactive`, `label` and `select-name` axe baselines only after raw scans pass.

### Non-functional

- No new axe exclusions, disabled rules or broad allowlists.
- Reuse one preview renderer for parent and child slides.
- Split `SlidePanel.jsx` into focused components below 200 LOC.
- Preserve current selection and persistence behavior.

## Architecture

```text
SlidePanel
  -> nav[aria-label="Slides"]
     -> ul
        -> li non-interactive wrapper
           -> selection button
           -> sibling action buttons
           -> static thumbnail preview
           -> nested child ul outside parent button
     -> context menu with origin focus

Properties labels -> native accessible names
Component fixes -> raw axe scan -> remove baseline entries
```

## File Inventory

| Action | File | Planned impact |
|---|---|---:|
| Modify | `client/src/components/SlidePanel.jsx` | Extract semantics/preview/focus logic |
| Create | `client/src/components/slide-panel/slide-navigator-item.jsx` | 120-180 LOC |
| Create | `client/src/components/slide-panel/slide-thumbnail-preview.jsx` | 120-180 LOC |
| Create | Focused tests for both components | 120-190 LOC each |
| Modify | `client/src/components/SlidePanel.test.jsx` | Selection/context regression |
| Modify | `client/src/components/PropertiesPanel.jsx` and tests | Real labels |
| Modify | Axe helper and editor axe spec | Remove editor baseline targets |
| Create | Focused slide-navigator semantics and selection E2E specs | Split each below 200 LOC |
| Delete | None | Baseline entries removed by edit only |

## Interfaces To Protect

- SlidePanel public props and `data-testid="slide-panel-item"`.
- Plain, additive and range-selection semantics, with selected slide IDs as authority and indices derived only at callback boundaries.
- Drag-and-drop `dragIndexRef` behavior.
- Last-slide delete guard.
- Batch duplicate/delete and vertical child callbacks.
- Context actions and pointer positioning.
- `aria-current` for the actively edited slide.
- Properties value/update behavior.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Raw axe editor scan | Zero serious/critical editor violations |
| Critical | Semantic structure | No nested interactive descendant |
| Critical | Current/multi-selection | Current and selected state announced correctly |
| Critical | Arrow/Home/End | Roving focus moves without accidental activation |
| Critical | Context menu | Shift+F10 opens; arrows wrap; Escape restores origin |
| Critical | Parent/child preview | Both render background and representative content |
| High | Duplicate/Delete | Reachable through focus-within and execute once |
| High | Vertical child keyboard | Unique labels and correct callbacks |
| High | External index change | Internal selected state synchronizes safely |
| High | Reorder/duplicate/delete after multiselect | Stable selected IDs continue to reference the same slides |
| High | Auto-slide/Navigation Mode | Role/name queries succeed |
| Medium | Drag reorder | Pointer behavior remains unchanged |
| Medium | Last slide | Delete remains disabled and announced |

## Accessibility Acceptance Metrics

- `scanA11y(...).blocking` for EditorPage equals `[]` without `newBlockingViolations`.
- `A11Y_BASELINE_KNOWN_BLOCKING.editor` is empty or removed.
- No new include/exclude/disable rule is introduced.
- Exactly one navigator item participates in roving tab order.
- Every visible form control has a computed accessible name.
- Focus remains visible and inside viewport.
- Selection is not communicated by color alone.
- Thumbnail preview DOM contains no executable scripts, active media, focusable descendants or network-capable embeds.

## Tests Before

1. Add component test proving current nested-interactive structure.
2. Add raw axe RED assertion before deleting baseline entries.
3. Add roving-focus, context-origin and identity-based selection tests.
4. Add vertical-child content preview test.
5. Add PropertiesPanel role/name tests.
6. Add pointer selection/reorder characterization before semantic restructuring.

## Refactor

1. Extract shared thumbnail renderer.
2. Define a static preview whitelist and inert placeholders; remove scripted iframe behavior from navigator previews.
3. Render parent and child content through the same inert preview pipeline.
4. Split `ul/li` wrapper, selection button, nested child list and sibling actions exactly as specified.
5. Replace index-authoritative multiselection with stable slide IDs and derive indices at dispatch.
6. Add roving focus independent from activation/selection.
7. Preserve context-menu geometry; add origin focus management.
8. Add real labels to presentation settings.
9. Remove baseline entries only after component and browser scans pass.

## Tests After

- Verify multi-select and range selection announcements.
- Verify action buttons are hidden and untabbable only when truly unavailable.
- Verify external current-index updates do not leave stale visual selection.
- Verify reorder, duplicate, parent/child deletion and external index changes preserve ID-based selection intent.
- Verify context menu works with keyboard and mouse.
- Verify raw axe scan under both editor themes where practical.
- Verify no thumbnail script executes and no preview descendant is focusable.

## Implementation Steps

1. Write RED semantics/a11y/preview tests.
2. Extract preview component.
3. Extract semantic navigator item.
4. Add roving focus and context restoration.
5. Label presentation controls.
6. Run raw axe scan.
7. Remove exact baseline entries.
8. Run slide management, vertical-slide and full phase gates.

## Regression Gate

```powershell
npx vitest run client/src/components/SlidePanel.test.jsx client/src/components/slide-panel/slide-navigator-item.test.jsx client/src/components/slide-panel/slide-thumbnail-preview.test.jsx client/src/components/PropertiesPanel.test.jsx
npx playwright test tests/e2e/a11y/slide-navigator-semantics-focus-and-selection.spec.js tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js --project=chromium
npx playwright test tests/e2e/slides.spec.js tests/e2e/slide-management.spec.js --project=chromium
npm run lint
npm run test
npm run build
```

## Success Criteria

- [x] No editor-specific axe exceptions remain for nested controls or labels.
- [x] Slide navigator is complete for keyboard and screen reader use.
- [x] Parent and vertical-child thumbnails show meaningful content.
- [x] Selection, reordering, batch actions and context actions retain parity.
- [x] Properties presentation fields have programmatic labels.
- [x] SlidePanel responsibilities are split into maintainable files.

## Completion Evidence

Completed 2026-07-13. Semantic navigator structure, stable-ID selection, inert shared thumbnails, keyboard/context focus behavior, labels, and editor axe baseline removal are implemented and verified by focused gates.

## Risk Assessment

- **Selection behavior drift:** store stable IDs, separate focus movement from activation, and derive indices only at callback time.
- **Hover styling regression:** keep a non-interactive item wrapper with sibling controls.
- **Context-menu pointer regression:** preserve positioning utilities.
- **Premature baseline deletion:** raw-zero test goes RED first; baseline removed last.
- **Preview execution/performance:** static whitelist only; no `allow-scripts`, active media, games or embeds.

## Security And Privacy

Thumbnail accessible labels must identify type/title succinctly, not expose full private slide content. Preview HTML remains non-interactive and follows existing trusted-author boundaries.

## Rollback

Revert semantic components and restore exact baseline entries only as a temporary branch rollback. Baseline restoration cannot be the phase's final state.

## Next Steps

Phase 8 later moves remaining slide orchestration out of EditorPage; this phase owns navigator semantics permanently.

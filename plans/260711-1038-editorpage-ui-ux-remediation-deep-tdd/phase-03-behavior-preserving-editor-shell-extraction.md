---
phase: 3
title: "Behavior Preserving Editor Shell Extraction"
status: complete
priority: P1
effort: "2-3 dev-days"
dependencies: [1, 2]
---

# Phase 3: Behavior Preserving Editor Shell Extraction

<!-- Updated: Validation Session 1 - preserve current dual panels here; Phase 4 converts them into one tabbed inspector host -->

## Overview

Extract layout-only seams from `EditorPage.jsx` before responsive, ribbon, navigation and accessibility changes. Preserve state ownership and behavior exactly; controller extraction is deferred to Phase 8.

## Requirements

### Functional

- Preserve header, ribbon, slide navigator, canvas, properties, design ideas, modals and tour DOM order.
- Preserve all callbacks, public props, test IDs, focus behavior and stacking contexts.
- Conditional panel toggles mount only their intended region.
- Shell rerenders must not remount SlideCanvas, TipTap or modal controllers.

### Non-functional

- Layout components contain no API, persistence, history, TipTap or mutation logic.
- Use slot-based composition to avoid an enormous callback prop interface.
- Every new production file stays below 200 LOC.
- First extraction pass copies existing classes before any responsive changes.

## Architecture

```jsx
<EditorShell
  smallScreenGuard={guard}
  header={<EditorHeader ... />}
  leftPanel={leftPanel}
  ribbon={ribbon}
  canvas={canvas}
  rightPanels={rightPanels}
  overlays={modals}
  tour={tour}
/>
```

```text
App route -> EditorPage controller -> EditorShell layout
                               ├── EditorHeader
                               ├── SlidePanel slot
                               ├── RibbonPanel + SlideCanvas slots
                               ├── Properties/DesignIdeas slots
                               └── EditorModals + ProductTour slots
MainLayout continues to own StatusBar
```

## File Inventory

| Action | File | Planned impact |
|---|---|---:|
| Modify | `client/src/pages/EditorPage.jsx` | Net -80 to -130 LOC layout only |
| Modify | `client/src/pages/__tests__/editor-page-renderability-spike.test.jsx` | +40-70 LOC |
| Create | `client/src/components/editor/editor-shell.jsx` | 80-120 LOC |
| Create | `client/src/components/editor/editor-header.jsx` | 70-100 LOC |
| Create | `client/src/components/editor/editor-shell.test.jsx` | 150-195 LOC |
| Delete | None | No controller or legacy hook deletion |

## Interfaces To Protect

- `EditorPage({ presentationId, isTemplate = false, onGoHome })`.
- Existing child callback surfaces for SlidePanel, RibbonPanel, SlideCanvas and PropertiesPanel.
- StatusBar bridge effects for slide position and present handler.
- Modal/tour mount count and focus behavior.
- Header title placeholder, template badge, Save, Undo, Redo, File, Share and Present.
- Root `height`, `min-width`, `min-height`, `overflow`, `shrink` and z-index contracts.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Sentinel slots | Exact header/body/overlay/tour order |
| Critical | Rerender shell props | Existing canvas child node identity preserved |
| Critical | Left/right toggles | Only selected slot mounts/unmounts |
| Critical | Real EditorPage render | Existing callbacks reach controller-owned behavior |
| Critical | Modal/tour composition | Each mounts exactly once |
| High | Guard/desktop classes | Existing breakpoint behavior unchanged in this phase |
| High | Template route | Badge and title placeholder preserved |
| High | Loading/not-found | Bypass shell as before |
| Medium | Landmarks | No duplicate toolbar/complementary region |

## Tests Before

1. Build `editor-shell.test.jsx` with sentinel nodes and node-identity assertions.
2. Extend real EditorPage renderability coverage for all shell regions.
3. Add callback smoke tests for Back, title, Save, panel toggles and Present.
4. Run all existing EditorPage characterization suites before moving JSX.

## Refactor

1. Extract `EditorHeader` with visual props and callbacks only.
2. Extract `EditorShell` with slots and copied layout classes.
3. Replace inline outer JSX in narrow hunks.
4. Keep current local state, refs, effects, hooks and child construction in EditorPage.
5. Avoid creating `editor-workspace.jsx` until Phase 4 proves a separate responsive boundary is needed.

## Tests After

- Verify shell rerenders do not remount stateful descendants.
- Verify both properties and design-ideas panels can coexist.
- Verify overlays retain correct stacking and focus.
- Verify no source behavior moved into layout components.

## Implementation Steps

1. Freeze Phase 1-2 gates and record a focused diff/ownership manifest for the EditorPage render region.
2. Add shell contract tests.
3. Extract header only; run targeted tests.
4. Extract outer shell slots; run targeted tests.
5. Run all EditorPage characterization suites.
6. Run editor/autosave/keyboard E2E.
7. Check file sizes and imports.
8. Run lint, full unit and build.

## Regression Gate

```powershell
npx vitest run client/src/components/editor/editor-shell.test.jsx client/src/pages/__tests__/editor-page-renderability-spike.test.jsx client/src/pages/__tests__/editor-page-ai-generate.characterization.test.jsx client/src/pages/__tests__/editor-page-command-palette-actions.characterization.test.jsx client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx client/src/pages/__tests__/editor-page-present-wiring.test.jsx client/src/pages/__tests__/editor-page-slide-ops.characterization.test.jsx client/src/pages/__tests__/editor-page-vertical-slides.test.jsx client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx
npx playwright test tests/e2e/editor.spec.js tests/e2e/autosave-flush-on-leave.spec.js tests/e2e/keyboard-shortcuts.spec.js --project=chromium
git diff --check
npm run lint
npm run test
npm run build
```

## Success Criteria

- [x] Shell and header are isolated, focused components below 200 LOC.
- [x] EditorPage retains all controller/state ownership.
- [x] Canvas and TipTap are not remounted by unrelated shell changes.
- [x] Existing desktop appearance is unchanged.
- [x] All EditorPage characterization and focused browser contracts pass.
- [x] User-owned save/PPTX behavior remains intact.

## Completion Evidence

Completed 2026-07-13. The editor shell/header extraction and composition contracts are implemented, with focused characterization and responsive browser evidence green. The blocked full E2E release gate remains Phase 9 work.

## Risk Assessment

- **Flex/overflow drift:** copy classes verbatim, change layout only in Phase 4.
- **Stateful child remount:** preserve hierarchy and keys; assert node identity.
- **Prop explosion:** pass rendered slots, not every child callback.
- **Stacking regression:** preserve relative root and header/popup z-index boundaries.
- **Accidental controller refactor:** reject imports of API, TipTap, stores or mutation hooks inside shell.

## Security Considerations

No trust boundary changes. Preserve modal backdrop/focus behavior so hidden editor controls cannot receive accidental input.

## Rollback

Use the verified Phase 3 reverse patch for extracted imports/render hunks and new shell files only. Never restore the whole EditorPage file.

## Next Steps

Phase 4, Phase 5 and Phase 6 build on this stable shell boundary.

---
title: "Tab-Based Ribbon Controls Implementation"
description: "Migrate EditorPage toolbar from flat 2-row Toolbar+InsertMenu+EditorMenuBar to a 7-tab ribbon system (Home, Insert, Design, Format, Transitions, Animations, View)"
status: complete
priority: P1
effort: 18d
tags: [frontend, refactor, ui, ribbon]
blockedBy: []
blocks: []
created: 2026-05-17
---

# Tab-Based Ribbon Controls Implementation Plan

## Overview

Migrate the EditorPage toolbar from a flat 2-row layout (Toolbar 1294 LOC + InsertMenu 621 LOC + EditorMenuBar 420 LOC = 2335 LOC) to a 7-tab ribbon system. The migration is incremental — old toolbar works until Phase 8 removal. Each phase has TDD structure: regression tests first, then refactor, then new tests.

## Validation Status

Hard validation completed 2026-05-17. Plan is viable, but implementation must respect the correction notes now embedded in the phase files:

- Phase 1 must define exact two-slot integration for current `EditorPage` header/body layout before coding.
- Phase 1 dependency install must target the `client` workspace.
- Phase 3 must preserve all current InsertMenu entries, including Timeline and File Browser.
- Phase 3 must preserve SVG upload as local FileReader text import, not multer upload.
- Phase 5 Speaker Notes is an action that focuses the notes textarea, not a third `viewMode` unless a real notes view is added.
- Phase 7 animation types must be centralized from existing code before UI work because current lists disagree.
- Phase 8b E2E migration must audit every `.tour-step-toolbar`, `InsertMenuHelper`, and toolbar selector reference, not only the seven listed specs.

## Cross-Plan Dependencies

None — this is a standalone frontend refactor.

## Architecture Decision

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tab primitive | Radix UI Tabs | Accessibility built-in, matches shadcn/ui pattern |
| Dev toggle shortcut | `Ctrl+Alt+R` | NOT Ctrl+Shift+R (browser hard refresh, not capturable) |
| Feature flag | Zustand boolean `useRibbon` | Conditional render, not CSS hiding |
| State management | Add `activeTab`, `useRibbon` to ui-store.js | Ribbon is UI chrome, not separate store |
| Shared controls | Custom hooks + shared components | Composable, testable, no duplication |
| TipTap selection | `onMouseDown` + `preventDefault()` | Proven pattern from Toolbar.jsx:149-183 |
| Responsive | Horizontal scroll tabs | Standard pattern (Office, Google Slides) |

## Final Validation Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Fragment `zoom-out` | Do not add in this migration | Keep migration/refactor scope stable; defer new behavior to follow-up |
| Fragment animation list | Centralize existing supported set in `client/src/constants/fragment-animation-types.js` | Prevent third duplicated list; fix current drift between PropertiesPanel and AnimationTimeline |
| Timeline location | Insert > Interactive | Timeline is a dynamic/interactive visual element, closer to Kinetic Text/Math Grid/Anime.js/Three.js than static content |
| Speaker Notes in View tab | Action button that scrolls/focuses existing notes textarea | Current `viewMode` only supports `normal | sorter`; no new notes mode in this migration |
| SVG insertion | Keep `FileReader.readAsText()` raw SVG import | SVG element needs raw content for render/edit/export; do not upload through `/api/upload` |
| Ribbon placement | Two surfaces: `RibbonHeaderBar` + `RibbonPanel` | Current UI has header menu and canvas toolbar in separate slots; both share `ui-store.activeTab` |

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Ribbon Shell & Tab Infrastructure](./phase-01-ribbon-shell-infrastructure.md) | Complete | 2d |
| 2 | [Home Tab — Clipboard, Font, Paragraph, Canvas, Arrange](./phase-02-home-tab-controls.md) | Complete | 2d |
| 3 | [Insert Tab — Element Galleries from InsertMenu](./phase-03-insert-tab-galleries.md) | Complete | 2d |
| 4 | [Design Tab — Themes, Background, Slide Size, Footer, Navigation](./phase-04-design-tab-controls.md) | Complete | 2d |
| 5 | [View Tab — Views, Show, Zoom, Find](./phase-05-view-tab-controls.md) | Complete | 1d |
| 6 | [Transitions Tab — Gallery, Direction, Duration, Preview](./phase-06-transitions-tab-controls.md) | Complete | 2d |
| 7 | [Animations Tab — Fragment, Type, Timeline, Preview](./phase-07-animations-tab-controls.md) | Complete | 1d |
| 8 | [Format Tab & Cleanup — Contextual Controls, Remove Old Surfaces](./phase-08-format-tab-and-cleanup.md) | Complete | 5d (8a: 3d + 8b: 2d) |

## Key Files

### Create
- `client/src/components/ribbon/RibbonShell.jsx`
- `client/src/components/ribbon/TabBar.jsx`
- `client/src/components/ribbon/ribbon-tabs-config.js`
- `client/src/components/ribbon/RibbonSection.jsx`
- `client/src/components/ribbon/HomeTabContent.jsx`
- `client/src/components/ribbon/InsertTabContent.jsx`
- `client/src/components/ribbon/DesignTabContent.jsx`
- `client/src/components/ribbon/FormatTabContent.jsx`
- `client/src/components/ribbon/TransitionsTabContent.jsx`
- `client/src/components/ribbon/AnimationsTabContent.jsx`
- `client/src/components/ribbon/ViewTabContent.jsx`
- `client/src/components/ribbon/ShapeGallery.jsx`
- `client/src/components/ribbon/GameGallery.jsx`
- `client/src/components/ribbon/ThemeGallery.jsx`
- `client/src/components/ribbon/TransitionGallery.jsx`
- `client/src/components/ribbon/controls/*.jsx` (shared controls)
- `client/src/components/ribbon/FileDropdown.jsx` (Phase 8b)
- `client/src/hooks/use-element-insertion.js`
- `client/src/hooks/use-modal-state.js`
- `client/src/hooks/use-text-formatting.js`
- `client/src/hooks/use-selection-preservation.js`

### Modify
- `client/src/pages/EditorPage.jsx` — compose RibbonShell, extract hooks
- `client/src/stores/ui-store.js` — add activeTab, useRibbon
- `client/src/components/Toolbar.jsx` — remove after Phase 8
- `client/src/components/InsertMenu.jsx` — remove after Phase 8
- `client/src/components/EditorMenuBar.jsx` — split File actions before removal

### Delete (Phase 8)
- `client/src/components/Toolbar.jsx`
- `client/src/components/InsertMenu.jsx`
- `client/src/components/EditorMenuBar.jsx`

## Dependencies

- Radix UI Tabs (`@radix-ui/react-tabs`) — install in client workspace: `npm install @radix-ui/react-tabs --workspace=client`
- Existing: Zustand, Tailwind, Lucide icons, TipTap, cn() utility
- Existing hooks: useSlideOperations, useClipboard, useKeyboard
- Existing UI: Button, Input, Select, ColorPicker, ModalShell

## Success Metrics

1. All 7 tabs render with correct controls
2. All 22 element types insert via ribbon
3. All keyboard shortcuts preserved
4. TipTap selection preserved across ribbon interactions
5. No horizontal page scroll at 375px, 768px, 1024px, 1440px
6. ARIA tablist/tab/tabpanel contract met
7. `npm run test` + `npm run test:e2e` pass after each phase

## Additional Acceptance Criteria (from validation)

8. **File dropdown** — Open, Export (HTML/PDF/PPTX), Publish, History accessible from header left of tabs (Phase 8b)
9. **Insert Quick defaults** — Shape→rectangle, Image→URL prompt, Chart→bar chart, Text→textbox (Phase 2)
10. **Upload parity** — Image/Audio/SVG upload via same multer endpoint as InsertMenu (Phase 3)
11. **Background persistence** — Color/gradient/image backgrounds persist on save and export correctly (Phase 4)
12. **Zoom sync** — Zoom controls in Home tab and View tab both read/write same editor-store.zoom (Phase 2+5)
13. **Per-slide transition override** — "Use presentation default" clears override, export uses global (Phase 6)
14. **Fragment order conflicts** — Validate 1-20 range, warn on duplicate order numbers (Phase 7)
15. **Bundle size** — Radix UI Tabs is tree-shakeable; monitor bundle impact after Phase 1
16. **Ribbon height stability** — Fixed ~100-120px total, no layout shift on tab switch

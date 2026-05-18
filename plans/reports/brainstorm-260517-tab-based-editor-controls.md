# Brainstorm Report: Tab-Based Editor Controls

**Date:** 2026-05-17
**Status:** Approved, pending implementation plan update
**Scope:** EditorPage toolbar redesign — migrate current menu/toolbar controls into a 7-tab ribbon system without breaking existing editor shortcuts, TipTap selection behavior, exports, or canvas layout

## Design Decisions (Approved)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tab placement | Add ribbon shell in editor header area | 7 tabs in header, AI/Share/Present buttons on right |
| Tab count | 7 tabs | Home, Insert, Design, Format, Transitions, Animations, View |
| Format tab | Contextual | Shows relevant controls based on selected element type |
| File menu | Header dropdown (left of tabs) | Tách biệt thao tác file khỏi chỉnh sửa |
| PropertiesPanel | Keep both (sidebar + Format tab) | Sidebar for detail, Format tab for quick access |
| Migration strategy | Incremental wrap + migrate | Avoid rewriting `Toolbar.jsx` / `InsertMenu.jsx` in one pass |
| Responsive | Compact, scroll-safe ribbon | Tabs scroll horizontally, content wraps within fixed ribbon height, canvas keeps usable space |

---

## Problem Statement

The current EditorPage toolbar has **35+ controls crammed into 2 rows** with a single mega-dropdown (InsertMenu) containing 22+ element types across 7 categories. This creates:

1. **Discoverability issues** — users must remember which dropdown/menu contains what
2. **Overcrowding** — Row 1 has 15+ buttons, Row 2 has 20+ controls, all visible simultaneously
3. **No task-based grouping** — formatting, inserting, designing, and animating controls are mixed together
4. **Buried features** — Transitions and Animations are hidden in Settings menu / floating panels
5. **No progressive disclosure** — everything is either always visible or hidden in a dropdown

## Solution: 7-Tab Ribbon System

Introduce a **tab bar + contextual content area** inspired by PowerPoint's ribbon, adapted for a dense web editor.

The implementation should be incremental:

1. Add `RibbonShell` and tab state while the existing `EditorMenuBar`, `Toolbar`, and `InsertMenu` still work.
2. Migrate controls tab-by-tab into reusable ribbon sections.
3. Remove old toolbar/menu surfaces only after parity tests pass.

Do not do a big-bang replacement of `Toolbar.jsx` or `InsertMenu.jsx`. Both contain upload, TipTap selection preservation, color palettes, background controls, and many insert callbacks that can regress if copied loosely.

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Back] [Title Input]     Home|Insert|Design|Format|Trans|Anim|View  │
│                              [AI] [Share] [Present]                  │
├──────────────────────────────────────────────────────────────────────┤
│  [Tab content area — contextual controls for active tab]            │
│  Section 1  │  Section 2  │  Section 3  │  Section 4                │
├──────────────────────────────────────────────────────────────────────┤
│ SlidePanel │          SlideCanvas                │ PropertiesPanel   │
│            │                                     │                   │
│            │                                     │                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Key changes:**
- `EditorMenuBar` visual surface → gradually replaced by header File dropdown + ribbon tabs
- `Toolbar` visual surface → gradually replaced by tab content area
- `InsertMenu` content → migrated into Insert tab galleries
- File/project actions stay in a File dropdown, not in Home
- AI/Share → right-side buttons (kept as-is)
- Present button → right-side CTA (kept as-is)
- Existing keyboard shortcuts and command palette remain functional

---

## Tab Definitions

### Tab 1: Home (default, highest frequency)

The 80% tab — covers daily editing actions without switching tabs. It should not become a second File menu.

| Section | Controls | Size |
|---------|----------|------|
| **Clipboard** | Paste, Cut, Copy, Duplicate | Large |
| **Insert Quick** | Text, Image, Shape, Chart (one-click insert) | Large |
| **Font** | Family, Size, Weight, Bold, Italic, Underline, Strike, Text Color, Highlight | Small |
| **Paragraph** | Alignment (L/C/R), Lists (bullet/ordered), Line Height, Clear Format | Small |
| **Canvas** | Grid, Smart Guides, Rulers, Zoom In/Out/Fit | Small |
| **Arrange** | Group, Ungroup, Layer Forward/Backward/To Front/To Back | Small |

**Absorbs from current:** Toolbar Row 1 (most), Toolbar Row 2 (font/paragraph), QuickAccessToolbar (undo/redo stays in header)

**Explicitly not in Home:** Open project, export, GitHub push, cloud sync, version history. These remain in the header File dropdown.

### Tab 2: Insert (all insertable elements)

Replaces the current `InsertMenu` mega-dropdown. Organized by category.

| Section | Elements | Presentation |
|---------|----------|--------------|
| **Basic** | Text, Image, Upload Image | Large buttons |
| **Shapes** | Shape (opens picker gallery), Line/Arrow, Icon (opens picker), Callout | Large + gallery popup |
| **Content** | Chart, Table, Code Block, Markdown, LaTeX, QR Code | Medium grid |
| **Media** | Video, Audio, Upload Media, Media Library | Medium buttons |
| **Embed** | HTML Embed, SVG, Drawing Canvas, Divider | Medium buttons |
| **Interactive** | Kinetic Text, Math Grid, Anime.js, Three.js | Medium buttons |
| **Games** | 7 game types as icon gallery cards | Gallery popup |

**Element grouping (22 types → 7 sections):**
- Basic: text, image, svg (upload)
- Shapes: shape (15 variants), line, icon, callout
- Content: chart, table, code, markdown, latex, qrcode
- Media: video, audio
- Embed: html, drawing, divider, svg
- Interactive: kinetic-text, math-grid, anime, three-js
- Games: name-picker, hot-potato, jeopardy, four-corners, relay-race, trivia-champ, scattergories

**Shape picker gallery (15 shapes, grouped visually):**
- Geometric: rect, rounded-rect, circle, triangle, diamond, hexagon, pentagon
- Directional: arrow-right, line
- Organic: cloud, star, bracket
- 3D-look: cylinder, parallelogram, trapezoid

### Tab 3: Design (slide-level design)

Currently buried in Settings menu. Now gets dedicated space.

| Section | Controls |
|---------|----------|
| **Themes** | Visual gallery of 11 themes (black, white, league, beige, sky, night, serif, simple, solarized, moon, dracula) as thumbnail cards |
| **Background** | Color picker + palette, Gradient presets + custom, Image URL/upload + size/position, None |
| **Slide Size** | 16:9 (960x540), 4:3 (960x720), Portrait (540x960), Full HD (1920x1080), Custom |
| **Footer** | Toggle, Section name, Page number format (c/t vs c), Font/size/colors |
| **Navigation** | Mode (Default 2D / Linear Flat), Auto-slide seconds, Loop toggle, Kiosk mode |

**Absorbs from current:** Settings menu (theme, size, transition, footer, grid toggles), Background popup

**Correction:** global presentation transition can be shown here as a default presentation setting, but detailed transition editing belongs to the Transitions tab.

### Tab 4: Format (contextual — changes based on selection)

**No selection / slide selected:**
| Section | Controls |
|---------|----------|
| **Slide** | Background, Transition, Auto-slide, Navigation mode |
| **Footer** | Page number, Section name, Footer style |

**Shape/Line selected:**
| Section | Controls |
|---------|----------|
| **Shape Style** | Fill color, Stroke color, Stroke width (0-20px), Line style (solid/dashed/dotted) |
| **Markers** | Start/End markers (none/arrow/circle/square/diamond) |
| **Effects** | Drop Shadow (X, Y, blur, color), Opacity |
| **Position** | X, Y, Width, Height, Rotation, Lock |

**Image selected:**
| Section | Controls |
|---------|----------|
| **Image** | Object Fit, Alt Text, Crop toggle |
| **Effects** | Drop Shadow, Opacity |
| **Position** | X, Y, Width, Height, Rotation, Lock |

**Chart selected:**
| Section | Controls |
|---------|----------|
| **Chart** | Type (bar/line/pie/doughnut/radar/polarArea), Labels, Series editor |
| **Position** | X, Y, Width, Height, Rotation, Lock |

**Table selected:**
| Section | Controls |
|---------|----------|
| **Table** | Add/Remove rows/cols, Header toggle, Header BG, Border color/style |
| **Cell** | Per-cell text colors, BG, bold, align, vAlign, merged cells |
| **Position** | X, Y, Width, Height, Rotation, Lock |

**Video/Audio selected:**
| Section | Controls |
|---------|----------|
| **Media** | Source URL, Poster, ObjectFit, Start/End time, Playback rate |
| **Playback** | Controls, Autoplay, Loop, Muted |
| **Position** | X, Y, Width, Height, Rotation, Lock |

**Code selected:**
| Section | Controls |
|---------|----------|
| **Code** | Language (24), Theme (10), Font size |
| **Position** | X, Y, Width, Height, Rotation, Lock |

**Any element selected (common):**
| Section | Controls |
|---------|----------|
| **Fragment** | Toggle, Order (1-20), Type gallery (13 animation types) |
| **Effects** | Drop Shadow, Opacity |
| **Position** | X, Y, Width, Height, Rotation, Lock |

### Tab 5: Transitions

Currently buried in Settings menu. Now dedicated tab.

| Section | Controls |
|---------|----------|
| **Transition** | Visual gallery: None, Fade, Slide, Convex, Concave, Zoom |
| **Direction** | Up/Down/Left/Right (contextual, shown when applicable) |
| **Duration** | Slider (0.1s - 5s) with numeric input |
| **Preview** | Replay button with iframe preview |

**Current code reality:** export/rendering already reads per-slide transition fields:
- `slide.transition`
- `slide.transitionDirection`
- `slide.transitionDuration`

The missing work is mainly editor UI and persistence flow:
- choose global default transition from `presentation.transition`
- optionally override active slide transition
- clear override to return to global default
- preview active slide transition via existing `TransitionPreview` or a focused replacement

### Tab 6: Animations

Currently a floating panel. Now integrated into tab system.

| Section | Controls |
|---------|----------|
| **Fragment** | Toggle, Order (1-20) |
| **Type** | Visual gallery: fade-in/out/up/down/left/right, strike, grow, shrink, zoom-in, highlight-red/green/blue |
| **Auto-Animate** | Toggle per slide |
| **Timeline** | Open Animation Timeline panel button |
| **Preview** | Play, Step Forward, Step Back, Close |

### Tab 7: View

Absorbs View menu items + display toggles.

| Section | Controls |
|---------|----------|
| **Views** | Normal, Slide Sorter, Speaker Notes |
| **Show** | Grid toggle, Rulers toggle, Guides toggle, Page Numbers toggle |
| **Zoom** | Zoom In, Zoom Out, Fit, percentage dropdown (25/50/75/100/150/200/400%) |
| **Find** | Find & Replace, Command Palette |

**Absorbs from current:** View menu, Canvas zoom controls, Grid/Rulers/Guides toggles

---

## File Menu Policy

File/project-level actions must stay in a dedicated header File dropdown. Do not scatter them across Home.

| Action | Location |
|--------|----------|
| Open Project | Header > File |
| Export PDF/PPTX/HTML/Offline HTML | Header > File > Export group |
| Export Project | Header > File > Export group |
| GitHub Push | Header > File > Publish group |
| Cloud Sync | Header > File > Publish group |
| Version History | Header > File > History group |

Rationale: these actions affect the whole project/presentation and are lower-frequency than editing operations. Keeping them separate preserves Home as the fast editing tab.

---

## Accessibility and Interaction Contract

Ribbon tabs and galleries must meet the same a11y bar as existing toolbar work.

| Area | Requirement |
|------|-------------|
| Tabs | `role="tablist"`, each tab `role="tab"`, active tab `aria-selected`, content `role="tabpanel"` |
| Keyboard | Left/Right moves between tabs, Home/End jumps first/last, Enter/Space activates tab |
| Focus | Visible `focus-visible` ring using existing `--focus` token |
| Icon buttons | All icon-only controls require stable `aria-label` or accessible text |
| Toggle buttons | Use `aria-pressed` for Grid, Rulers, Guides, Bold, Italic, etc. |
| Galleries | Escape closes, focus returns to trigger, arrow navigation for grid/gallery options where practical |
| Dropdowns | Close on Escape and outside click; no keyboard trap |
| Reduced motion | Preview/animation UI respects `prefers-reduced-motion` for chrome transitions |

Use Lucide icons for editor chrome. Do not introduce emoji as structural icons.

---

## Responsive Contract

The ribbon must not make the canvas unusable on small screens.

| Viewport | Expected behavior |
|----------|-------------------|
| 375px | Tab row horizontally scrolls; content becomes compact icon+tooltip groups; no page-level horizontal scroll |
| 768px | Two-line ribbon content allowed; galleries open as constrained popovers/sheets |
| 1024px | Standard ribbon density; slide canvas still gets primary space |
| 1440px+ | Full labels and richer gallery previews allowed |

Rules:
- Reserve a stable ribbon height per breakpoint.
- Do not let expanding tab content push `SlideCanvas` below usable height.
- Popovers/galleries must fit viewport and scroll internally.
- Touch targets should be at least 44px where the UI is likely to be used on touch devices.
- Text labels wrap or collapse to icon-only with tooltip; no clipped labels.

---

## Controls Migration Map

| Current Location | New Location |
|-----------------|--------------|
| EditorMenuBar > File > Open | Header > File |
| EditorMenuBar > File > Export PDF/PPTX/HTML | Header > File > Export group |
| EditorMenuBar > File > Export Project | Header > File > Export group |
| EditorMenuBar > File > GitHub Push | Header > File > Publish group |
| EditorMenuBar > File > Cloud Sync | Header > File > Publish group |
| EditorMenuBar > File > Version History | Header > File > History group |
| EditorMenuBar > View > Find & Replace | View > Find section |
| EditorMenuBar > View > Animation Timeline | Animations > Timeline button |
| EditorMenuBar > View > Custom CSS | Design > Custom CSS section |
| EditorMenuBar > View > Speaker Notes | View > Views section |
| EditorMenuBar > View > Slide Sorter | View > Views section |
| EditorMenuBar > Settings > Theme | Design > Themes |
| EditorMenuBar > Settings > Slide Size | Design > Slide Size |
| EditorMenuBar > Settings > Transition | Transitions tab |
| EditorMenuBar > Settings > Grid/Footer/Page# | View > Show section + Design > Footer |
| EditorMenuBar > Settings > Auto-advance/Loop/Kiosk | Design > Navigation |
| EditorMenuBar > Settings > Presenter Tools | Design > Presenter Tools |
| EditorMenuBar > AI | Header AI button (kept) |
| EditorMenuBar > Share | Header Share button (kept) |
| Toolbar Row 1 > Insert | Tab 2: Insert |
| Toolbar Row 1 > Line/Arrow | Tab 2: Insert > Shapes |
| Toolbar Row 1 > BG popup | Tab 3: Design > Background |
| Toolbar Row 1 > Grid/Guides/Rulers | Tab 7: View > Show |
| Toolbar Row 1 > Alignment | Tab 1: Home > Arrange |
| Toolbar Row 1 > Group/Ungroup | Tab 1: Home > Arrange |
| Toolbar Row 2 > Font controls | Tab 1: Home > Font |
| Toolbar Row 2 > Text formatting | Tab 1: Home > Font + Paragraph |
| Toolbar Row 2 > Table ops | Tab 4: Format (table selected) |
| Toolbar Row 2 > Link/Image/Math | Tab 1: Home > Insert Quick |
| PropertiesPanel (element) | Tab 4: Format (contextual) |
| PropertiesPanel (slide) | Tab 3: Design + Tab 4: Format (no selection) |
| AnimationTimeline panel | Tab 6: Animations > Timeline button |

---

## Implementation Considerations

### Component Architecture

```
EditorPage
├── Header (Back, Title, TabBar, AI, Share, Present, Undo/Redo)
├── RibbonShell / TabContentArea (renders based on active tab)
│   ├── HomeTabContent
│   ├── InsertTabContent
│   ├── DesignTabContent
│   ├── FormatTabContent (contextual)
│   ├── TransitionsTabContent
│   ├── AnimationsTabContent
│   └── ViewTabContent
├── Body
│   ├── SlidePanel
│   ├── SlideCanvas
│   └── PropertiesPanel (slimmed down — some controls move to tabs)
```

### Reuse Strategy

Avoid duplicating business logic between the ribbon and `PropertiesPanel`.

Shared controls should be extracted for:
- position and size controls
- lock/layer controls
- shadow/opacity controls
- fragment controls
- shape stroke/fill controls
- media playback controls
- chart/table type-specific controls where practical

`PropertiesPanel` remains the detailed inspection sidebar. `FormatTabContent` should reuse shared controls for quick actions, not fork independent implementations.

### New Files Needed

| File | Purpose |
|------|---------|
| `client/src/components/ribbon/RibbonShell.jsx` | Owns tab layout, responsive shell, tabpanel rendering |
| `client/src/components/ribbon/TabBar.jsx` | Tab bar with 7 tabs |
| `client/src/components/ribbon/ribbon-tabs-config.js` | Single source of truth for tab IDs, labels, icons, order |
| `client/src/components/ribbon/HomeTabContent.jsx` | Home tab controls |
| `client/src/components/ribbon/InsertTabContent.jsx` | Insert tab controls |
| `client/src/components/ribbon/DesignTabContent.jsx` | Design tab controls |
| `client/src/components/ribbon/FormatTabContent.jsx` | Contextual format controls |
| `client/src/components/ribbon/TransitionsTabContent.jsx` | Transitions tab controls |
| `client/src/components/ribbon/AnimationsTabContent.jsx` | Animations tab controls |
| `client/src/components/ribbon/ViewTabContent.jsx` | View tab controls |
| `client/src/components/ribbon/RibbonSection.jsx` | Section wrapper with separator |
| `client/src/components/ribbon/ShapeGallery.jsx` | Shape picker gallery |
| `client/src/components/ribbon/GameGallery.jsx` | Game type picker gallery |
| `client/src/components/ribbon/ThemeGallery.jsx` | Theme thumbnail gallery |
| `client/src/components/ribbon/TransitionGallery.jsx` | Transition visual gallery |
| `client/src/components/ribbon/controls/*.jsx` | Shared controls reused by ribbon and panel where useful |

### Files to Modify

| File | Change |
|------|--------|
| `EditorPage.jsx` | Compose RibbonShell, keep old surfaces during phased migration, then remove after parity |
| `Toolbar.jsx` | Refactor only after equivalent ribbon controls exist and tests pass |
| `EditorMenuBar.jsx` | Split File actions/header actions before removal |
| `PropertiesPanel.jsx` | Keep as detail sidebar; extract shared controls instead of copying logic |
| `InsertMenu.jsx` | Reuse data/callback structure during Insert tab migration, remove after parity |
| `ui-store.js` | Add `activeTab` state |

### Implementation Phasing

| Phase | Scope | Parity Gate |
|-------|-------|-------------|
| 1 | Add `RibbonShell`, `TabBar`, `activeTab`, empty tab panels | Existing toolbar/menu still work |
| 2 | Migrate Home tab low-risk controls: clipboard, canvas toggles, arrange | Shortcuts and selection unchanged |
| 3 | Migrate Insert tab galleries from `InsertMenu` | All element types still insert correctly |
| 4 | Migrate Design + View tabs | Theme, background, grid/ruler/guides, sorter, notes, find still work |
| 5 | Add Transitions tab with global + per-slide override UI | Existing global transition preserved; slide override exports |
| 6 | Add Animations tab and timeline entry points | Fragment order/type/preview still match current behavior |
| 7 | Add Format tab shared controls and slim sidebar only where duplication is proven | No duplicated divergent property logic |
| 8 | Remove obsolete old surfaces and update tests/docs | Build + relevant unit/e2e tests pass |

### Risks

| Risk | Mitigation |
|------|------------|
| Tab switching adds clicks for common actions | Home tab covers 80% of daily actions; Command Palette (Ctrl+K) for power users |
| Contextual Format tab may confuse users | Show "No selection — select an element to format" message; default to slide properties |
| Breaking existing keyboard shortcuts | All shortcuts preserved; tabs are visual-only grouping |
| PropertiesPanel duplication with Format tab | Keep PropertiesPanel for detailed inspection; Format tab for quick access |
| Large refactor touching many files | Phase implementation: TabBar first, then migrate controls tab-by-tab |
| TipTap selection lost when moving text controls | Reuse current selection preservation pattern from `Toolbar.jsx` |
| Ribbon consumes too much vertical space | Fixed responsive ribbon height + internal overflow |
| Per-slide transition UI conflicts with global transition | Show explicit "Use presentation default" vs "Override this slide" state |
| A11y regression from custom tabs/galleries | Add role/keyboard/focus contract and test with semantic selectors |

---

## Success Metrics

1. **Discoverability**: Users find any control within 2 clicks (currently some require 3-4)
2. **Reduced cognitive load**: Each tab shows 8-15 controls vs current 35+ visible simultaneously
3. **Task completion time**: Common actions (insert element, change font, add transition) faster
4. **Feature discovery**: Users find Transitions/Animations features (currently buried)
5. **Behavior parity**: Existing keyboard shortcuts, insert actions, exports, autosave, and TipTap editing still work
6. **Accessibility parity**: Tabs/galleries are keyboard reachable with visible focus and correct ARIA semantics
7. **Responsive stability**: No horizontal page scroll at 375px, 768px, 1024px, 1440px

## Next Steps

1. User approves design
2. `/ck:plan` — create phased implementation plan
3. Phase 1: RibbonShell + TabBar + active tab state, old toolbar/menu still active
4. Phase 2: Home tab parity for low-risk edit/canvas/arrange actions
5. Phase 3: Insert tab migration from InsertMenu
6. Phase 4: Design + View tabs
7. Phase 5: Transitions + Animations tabs
8. Phase 6: Format tab using shared controls
9. Phase 7: cleanup old surfaces only after tests pass

---

## Unresolved Questions

1. Should the first implementation keep a feature flag or can the ribbon shell be enabled immediately while old controls remain available?
2. Should per-slide transition override UI ship in the same milestone as the Transitions tab, or be a follow-up once global transition migration is stable?

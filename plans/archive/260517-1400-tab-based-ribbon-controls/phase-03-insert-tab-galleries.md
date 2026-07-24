---
phase: 3
title: "Insert Tab — Element Galleries from InsertMenu"
status: complete
priority: P1
effort: 2d
dependencies: [1, 2]
---

# Phase 3: Insert Tab — Element Galleries from InsertMenu

## Overview

Migrate all 22+ element types from InsertMenu.jsx (621 LOC) into the ribbon Insert tab, organized by 7 categories. Create gallery components for shapes, icons, games. All elements insert via the same `addElement(type)` callback.

## Context Links

- Current InsertMenu: `client/src/components/InsertMenu.jsx`
- Brainstorm Tab 2 Insert: `plans/reports/brainstorm-260517-tab-based-editor-controls.md` (Tab 2)
- Element constants: `client/src/constants/game-element-types-constants.js`
- Shared shapes: `revealjs-shared` SHAPES array

## Requirements

### Functional
- **Basic section**: Text, Image, Upload Image (large buttons)
- **Shapes section**: Shape picker gallery (15 shapes), Line/Arrow, Icon picker, Callout
- **Content section**: Chart, Table, Code Block, Markdown, LaTeX, QR Code (medium grid)
- **Media section**: Video, Audio/Upload, Media Library, File Browser when `onOpenFileBrowser` exists (medium buttons)
- **Embed section**: HTML Embed, SVG, Drawing Canvas, Divider (medium buttons)
- **Interactive section**: Kinetic Text, Math Grid, Anime.js, Three.js, Timeline (medium buttons). Final decision: Timeline belongs here because it is a dynamic/interactive visual element, not static content.
- **Games section**: 7 game types as icon gallery cards

### Non-functional
- Shape picker: visual gallery grouped by Geometric/Directional/Organic/3D
- Icon picker: searchable paginated grid (~100 Lucide icons)
- Table picker: hover-grid size selector (default: 3x3)
- Upload flows: preserve existing behavior exactly:
  - Image upload delegates to `onAddImageUpload` from `EditorPage` and uses `api.uploadFile`.
  - Audio/video upload posts to `/api/upload` or shared `api.uploadFile`.
  - SVG upload reads file content with `FileReader.readAsText()` and calls `onAddSvgElement(content)`; it does not upload via multer. Final decision: keep raw SVG content import for render/edit/export parity.

### Implementation Strategy Decisions
- **addElement callback**: Same `addElement(type, overrides)` extracted in Phase 1. All insertion buttons call this single callback.
- **IconGallery source**: Extract ICON_CATALOG/ICON_MAP constants from InsertMenu.jsx into `client/src/constants/icon-catalog-constants.js` for reuse.
- **TableSizePicker default**: 3 rows x 3 cols on direct click; hover-grid allows custom selection.

## Architecture

```
InsertTabContent
├── RibbonSection label="Basic"
│   ├── TextButton, ImageButton, UploadImageButton
├── RibbonSection label="Shapes"
│   ├── ShapeGallery (popup grid of 15 shapes)
│   ├── LineArrowButton
│   ├── IconGallery (searchable popup)
│   └── CalloutButton
├── RibbonSection label="Content"
│   ├── ChartButton, TableButton, CodeBlockButton
│   ├── MarkdownButton, LatexButton, QRCodeButton
├── RibbonSection label="Media"
│   ├── VideoButton, AudioUploadButton, MediaLibraryButton, FileBrowserButton
├── RibbonSection label="Embed"
│   ├── HTMLEmbedButton, SVGButton, DrawingButton, DividerButton
├── RibbonSection label="Interactive"
│   ├── KineticTextButton, MathGridButton, AnimeButton, ThreeJSButton, TimelineButton
├── RibbonSection label="Games"
│   └── GameGallery (7 game type cards)
```

## Related Code Files

### Create
- `client/src/components/ribbon/InsertTabContent.jsx` (~150 LOC)
- `client/src/components/ribbon/ShapeGallery.jsx` (~80 LOC)
- `client/src/components/ribbon/IconGallery.jsx` (~90 LOC)
- `client/src/components/ribbon/GameGallery.jsx` (~60 LOC)
- `client/src/components/ribbon/TableSizePicker.jsx` (~40 LOC)

### Modify
- `client/src/components/ribbon/RibbonShell.jsx` — pass insertion callbacks to InsertTabContent

### Read for context
- `client/src/components/InsertMenu.jsx` — element categories, callbacks, upload logic
- `client/src/constants/game-element-types-constants.js` — GAME_TYPES

## Tests Before (Regression Coverage)

1. **InsertMenu inserts all element types**
   - Text, Image, Shape, Line, Arrow, Icon, Callout
   - Chart, Table, Code Block, Markdown, LaTeX, QR Code
   - Video, Audio, HTML Embed, SVG, Drawing, Divider
   - Kinetic Text, Math Grid, Anime.js, Three.js
   - 7 game types

2. **Shape picker shows 15 shapes**
   - Geometric: rect, rounded-rect, circle, triangle, diamond, hexagon, pentagon
   - Directional: arrow-right, line
   - Organic: cloud, star, bracket
   - 3D: cylinder, parallelogram, trapezoid

3. **Upload flows work**
   - Image upload via file picker
   - Audio upload via file picker
   - SVG upload via file picker

```js
// client/src/components/ribbon/insert-tab-content.test.jsx
describe('InsertTabContent', () => {
  it('renders 7 sections', () => { ... })
  it('has all 22+ element type buttons', () => { ... })
  it('calls addElement with correct type on each button click', () => { ... })
  it('ShapeGallery renders 15 shape options', () => { ... })
  it('GameGallery renders 7 game types', () => { ... })
  it('TableSizePicker shows hover grid', () => { ... })
  it('all buttons have aria-label', () => { ... })
})
```

## Implementation Steps

1. Create `ShapeGallery.jsx` — grid of 15 shapes using SHAPES from revealjs-shared, grouped visually
2. Create `IconGallery.jsx` — searchable paginated grid using ICON_CATALOG/ICON_MAP
3. Create `GameGallery.jsx` — 7 game type cards using GAME_TYPES
4. Create `TableSizePicker.jsx` — hover-grid for rows/cols selection
5. Create `InsertTabContent.jsx` — compose all sections with category headers
6. Wire `addElement(type, overrides)` callback from EditorPage through RibbonShell
7. Implement upload flows with current parity: image/media via upload endpoint, SVG via local text read
8. Add URL prompt popovers for Video, Image (URL) elements
9. Add Timeline and File Browser coverage; both exist in current InsertMenu and must not regress

## Tests After (New Behavior)

1. **All element types insert via ribbon**
   - Each button calls `addElement` with correct type
   - Upload elements trigger file picker

2. **Gallery components work**
   - ShapeGallery: click shape inserts shape element
   - IconGallery: search filters icons, click inserts icon
   - GameGallery: click game type inserts game element
   - TableSizePicker: hover highlights, click inserts table

3. **Parity with InsertMenu**
   - Same 22+ element types available
   - Same callback signatures

## Regression Gate

```bash
npm run lint
npm run build
npm run test
```

All element types insert correctly via both old InsertMenu and new Insert tab.

## Success Criteria

- [ ] 7 sections render with correct labels
- [ ] All 22+ element types available
- [ ] Timeline and File Browser entry points preserved
- [ ] Shape gallery with 15 shapes works
- [ ] Icon gallery with search works
- [ ] Game gallery with 7 types works
- [ ] Upload flows work
- [ ] All tests pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Upload flow breaks | Reuse exact same upload/TextReader behavior + error handling |
| Shape picker regression | Use same SHAPES array from revealjs-shared |
| Icon picker performance | Paginate at 20 icons per page |

## Next Steps

Phase 4: Design tab — themes, background, slide size, footer, navigation.

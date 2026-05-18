---
phase: 4
title: "Design Tab — Themes, Background, Slide Size, Footer, Navigation"
status: complete
priority: P1
effort: 2d
dependencies: [1]
---

# Phase 4: Design Tab — Themes, Background, Slide Size, Footer, Navigation

## Overview

Create the Design tab with slide-level design controls currently buried in EditorMenuBar Settings menu: theme gallery, background picker, slide size, footer settings, and navigation options.

## Context Links

- Current Settings menu: `client/src/components/EditorMenuBar.jsx` lines 180-350
- Background popup: `client/src/components/Toolbar.jsx` lines 288-400
- Brainstorm Tab 3 Design: `plans/reports/brainstorm-260517-tab-based-editor-controls.md` (Tab 3)
- Footer system: `client/src/components/canvas/canvas-footer-overlay-with-section-and-page-number.jsx`

## Requirements

### Functional
- **Themes section**: Visual gallery of 11 themes as thumbnail cards
- **Background section**: Color picker + palette, Gradient presets + custom, Image URL/upload + size/position, None
- **Slide Size section**: 16:9 (960x540), 4:3 (960x720), Portrait (540x960), Full HD (1920x1080), Custom
- **Footer section**: Toggle, Section name, Page number format (c/t vs c), Font/size/colors
- **Navigation section**: Mode (Default 2D / Linear Flat), Auto-slide seconds, Loop toggle, Kiosk mode

### Non-functional
- Theme gallery: visual thumbnails using color swatches (dark/light/bg/accent colors extracted from theme CSS variables), NOT static images. Each card shows 4 color dots + theme name.
- Background: same controls as current Toolbar BG popup
- Slide size: custom size via popover (width/height inputs)

## Architecture

```
DesignTabContent
├── RibbonSection label="Themes"
│   └── ThemeGallery (11 theme thumbnail cards)
├── RibbonSection label="Background"
│   ├── ColorPickerButton + palette
│   ├── GradientPresets + custom
│   ├── ImageURL/upload + size/position
│   └── NoneButton
├── RibbonSection label="Slide Size"
│   ├── PresetButtons (16:9, 4:3, Portrait, Full HD)
│   └── CustomSizePopover (width/height inputs)
├── RibbonSection label="Footer"
│   ├── FooterToggle
│   ├── SectionNameInput
│   ├── PageNumberFormat (c/t vs c)
│   └── FooterStyleControls (font, size, colors)
├── RibbonSection label="Navigation"
│   ├── NavigationModeSelect (Default 2D / Linear Flat)
│   ├── AutoSlideInput (seconds)
│   ├── LoopToggle
│   └── KioskToggle
```

## Related Code Files

### Create
- `client/src/components/ribbon/DesignTabContent.jsx` (~160 LOC)
- `client/src/components/ribbon/ThemeGallery.jsx` (~80 LOC)
- `client/src/components/ribbon/BackgroundControls.jsx` (~100 LOC)
- `client/src/components/ribbon/SlideSizeControls.jsx` (~50 LOC)
- `client/src/components/ribbon/FooterControls.jsx` (~60 LOC)
- `client/src/components/ribbon/NavigationControls.jsx` (~50 LOC)

### Modify
- `client/src/components/ribbon/RibbonShell.jsx` — pass slide/presentation props to DesignTabContent

### Read for context
- `client/src/components/EditorMenuBar.jsx` — theme list, slide size options, footer settings
- `client/src/components/Toolbar.jsx` — background popup (BG_COLORS, GRADIENT_PRESETS)

## Tests Before (Regression Coverage)

1. **Theme change works via EditorMenuBar**
   - Selecting theme updates presentation.theme
   - Theme persists on save

2. **Background change works via Toolbar BG popup**
   - Solid color background
   - Gradient background
   - Image background (URL + upload)

3. **Slide size change works**
   - Preset sizes update slide width/height
   - Custom size via popover

4. **Footer settings work**
   - Toggle footer on/off
   - Page number format changes

```js
// client/src/components/ribbon/design-tab-content.test.jsx
describe('DesignTabContent', () => {
  describe('ThemeGallery', () => {
    it('renders 11 theme cards', () => { ... })
    it('calls onUpdatePresentation with theme on click', () => { ... })
    it('highlights current theme', () => { ... })
  })
  describe('BackgroundControls', () => {
    it('renders color picker, gradient, image, none options', () => { ... })
    it('updates slide background on color select', () => { ... })
  })
  describe('SlideSizeControls', () => {
    it('renders 4 preset size buttons', () => { ... })
    it('shows custom size popover', () => { ... })
  })
  describe('FooterControls', () => {
    it('renders footer toggle', () => { ... })
    it('shows page number format when footer enabled', () => { ... })
  })
  describe('NavigationControls', () => {
    it('renders auto-slide input', () => { ... })
    it('renders loop toggle', () => { ... })
    it('renders kiosk toggle', () => { ... })
  })
})
```

## Implementation Steps

1. Create `ThemeGallery.jsx` — 11 theme cards with visual preview (dark/light swatches)
2. Create `BackgroundControls.jsx` — color picker, gradient presets, image upload/URL, none
3. Create `SlideSizeControls.jsx` — 4 presets + custom popover
4. Create `FooterControls.jsx` — toggle, section name, page format, style
5. Create `NavigationControls.jsx` — mode, auto-slide, loop, kiosk
6. Create `DesignTabContent.jsx` — compose all sections
7. Wire `slide`, `onUpdateSlide`, `presentation`, `onUpdatePresentation` props

## Tests After (New Behavior)

1. **Theme gallery works**
   - 11 themes render as cards
   - Click updates presentation.theme

2. **Background controls work**
   - Color/gradient/image/none all functional
   - Same behavior as old Toolbar BG popup

3. **Slide size works**
   - Presets and custom size functional

4. **Footer controls work**
   - Toggle, section name, page format

5. **Navigation controls work**
   - Auto-slide, loop, kiosk

## Regression Gate

```bash
npm run lint
npm run build
npm run test
```

Theme, background, size, footer, navigation changes persist correctly.

## Success Criteria

- [ ] 5 sections render with correct controls
- [ ] Theme gallery with 11 themes works
- [ ] Background controls match old BG popup
- [ ] Slide size presets + custom work
- [ ] Footer controls functional
- [ ] Navigation controls functional
- [ ] All tests pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Background upload breaks | Reuse exact same multer endpoint |
| Custom size popover UX | Same pattern as EditorMenuBar PromptPopover |
| Footer complexity | Start with basic mode, sequence mode later |

## Next Steps

Phase 5: View tab — views, show, zoom, find.

---
phase: 6
title: "Transitions Tab — Gallery, Direction, Duration, Preview"
status: complete
priority: P2
effort: 2d
dependencies: [1]
---

# Phase 6: Transitions Tab — Gallery, Direction, Duration, Preview

## Overview

Create the Transitions tab with a visual gallery of 6 transition types, direction controls, duration slider, and preview button. Supports both global presentation default and per-slide override. Data model already exists in slide fields.

## Context Links

- Current transitions in Settings: `client/src/components/EditorMenuBar.jsx` lines 240-260
- TransitionPreview: check `client/src/components/TransitionPreview.jsx` if exists
- Brainstorm Tab 5 Transitions: `plans/reports/brainstorm-260517-tab-based-editor-controls.md` (Tab 5)

## Requirements

### Functional
- **Transition section**: Visual gallery: None, Fade, Slide, Convex, Concave, Zoom (6 types)
- **Direction section**: Up/Down/Left/Right (contextual, shown when applicable)
- **Duration section**: Slider (0.1s - 5s) with numeric input
- **Preview section**: Replay button with iframe preview
- **Scope**: Global default (presentation.transition) + per-slide override (slide.transition)
- **"Use presentation default" option**: Clear override to return to global

### Non-functional
- Gallery shows visual preview of each transition
- Duration slider has numeric label
- Direction only shown for transitions that support it (slide, convex, concave)

## Architecture

```
TransitionsTabContent
├── RibbonSection label="Transition"
│   └── TransitionGallery (6 types: None, Fade, Slide, Convex, Concave, Zoom)
├── RibbonSection label="Direction"
│   └── DirectionButtons (Up/Down/Left/Right) — contextual
├── RibbonSection label="Duration"
│   ├── DurationSlider (0.1s - 5s)
│   └── DurationNumericInput
├── RibbonSection label="Preview"
│   └── ReplayButton + TransitionPreview iframe
```

## Related Code Files

### Create
- `client/src/components/ribbon/TransitionsTabContent.jsx` (~100 LOC)
- `client/src/components/ribbon/TransitionGallery.jsx` (~70 LOC)
- `client/src/components/ribbon/TransitionDirectionControls.jsx` (~30 LOC)
- `client/src/components/ribbon/TransitionDurationControls.jsx` (~40 LOC)

### Read for context
- `client/src/components/EditorMenuBar.jsx` — transition types list
- `shared/src/htmlGenerator.js` — how transition fields are read for export

## Tests Before (Regression Coverage)

1. **Global transition change works via Settings menu**
   - Selecting transition updates presentation.transition
   - Transition persists on save

2. **Per-slide transition fields exist in data model**
   - `slide.transition`, `slide.transitionDirection`, `slide.transitionDuration`
   - Export reads these fields correctly

3. **TransitionPreview component works**
   - Shows transition animation in iframe

```js
// client/src/components/ribbon/transitions-tab-content.test.jsx
describe('TransitionsTabContent', () => {
  describe('TransitionGallery', () => {
    it('renders 6 transition types', () => { ... })
    it('highlights current transition', () => { ... })
    it('calls onUpdatePresentation on global change', () => { ... })
    it('calls onUpdateSlide on per-slide override', () => { ... })
  })
  describe('DirectionControls', () => {
    it('shows Up/Down/Left/Right for slide transition', () => { ... })
    it('hides direction for fade transition', () => { ... })
  })
  describe('DurationControls', () => {
    it('renders slider from 0.1 to 5.0', () => { ... })
    it('shows numeric value', () => { ... })
    it('updates slide.transitionDuration on change', () => { ... })
  })
  describe('Preview', () => {
    it('renders Replay button', () => { ... })
  })
})
```

## Implementation Steps

1. Create `TransitionGallery.jsx` — 6 transition type cards with visual preview thumbnails
2. Create `TransitionDirectionControls.jsx` — Up/Down/Left/Right button group
3. Create `TransitionDurationControls.jsx` — slider + numeric input
4. Create `TransitionsTabContent.jsx` — compose sections with scope selector (global vs per-slide)
5. Wire `presentation`, `slide`, `onUpdatePresentation`, `onUpdateSlide` props
6. Implement "Use presentation default" to clear per-slide override

## Tests After (New Behavior)

1. **Transition gallery works**
   - 6 types render
   - Click sets transition
   - Current transition highlighted

2. **Direction controls work**
   - Show for slide/convex/concave
   - Hide for fade/zoom/none

3. **Duration controls work**
   - Slider updates duration
   - Numeric input syncs with slider

4. **Scope selector works**
   - Global: updates presentation.transition
   - Per-slide: updates slide.transition
   - "Use default" clears slide override
   - Explicit test: Set global to Fade → set slide 2 override to Zoom → click "Use presentation default" → slide 2 uses Fade → export confirms Fade

## Regression Gate

```bash
npm run test
```

Global transition changes persist. Per-slide overrides export correctly.

## Success Criteria

- [ ] Transition gallery with 6 types works
- [ ] Direction controls contextual
- [ ] Duration slider functional
- [ ] Global + per-slide scope works
- [ ] Preview button triggers
- [ ] All tests pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Per-slide override conflicts with global | Explicit scope selector with clear UI |
| Transition preview performance | Lazy-load iframe, destroy on unmount |

## Next Steps

Phase 7: Animations tab.

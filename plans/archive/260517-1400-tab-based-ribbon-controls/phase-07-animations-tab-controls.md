---
phase: 7
title: "Animations Tab — Fragment, Type, Timeline, Preview"
status: complete
priority: P2
effort: 1d
dependencies: [1]
---

# Phase 7: Animations Tab — Fragment, Type, Timeline, Preview

## Overview

Create the Animations tab integrating fragment animation controls and timeline entry points. Currently a floating panel, now part of the ribbon system. Fragment controls support order (1-20). Animation type list must be centralized before UI work because current code has inconsistent lists.

## Context Links

- Fragment controls in PropertiesPanel: `client/src/components/properties/common-element-controls.jsx`
- AnimationTimeline: check `client/src/components/AnimationTimeline.jsx` if exists
- Brainstorm Tab 6 Animations: `plans/reports/brainstorm-260517-tab-based-editor-controls.md` (Tab 6)

## Requirements

### Functional
- **Fragment section**: Toggle fragment on/off, Order input (1-20)
- **Type section**: Visual gallery using a single exported fragment animation constant. Final decision: do not add `zoom-out` during this migration. Centralize the existing supported set: `fade-in`, `fade-out`, `fade-up`, `fade-down`, `fade-left`, `fade-right`, `strike`, `grow`, `shrink`, `zoom-in`, `highlight-red`, `highlight-green`, `highlight-blue`. Validation note: `common-element-controls.jsx` already has these 13 options, while `AnimationTimeline.jsx` currently omits `strike`; fix that drift by importing the shared constant.
- **Auto-Animate section**: Toggle per slide
- **Timeline section**: Open Animation Timeline panel button
- **Preview section**: Play, Step Forward, Step Back, Close — delegates to existing AnimationTimeline panel. Play toggles `showTimeline` and starts auto-advance through fragments. Step Forward/Back navigates fragment order (find next/prev fragment order number on current slide). Close stops preview and resets fragment index. Note: `useElementCycle` cycles through ALL elements, not fragments — preview navigation needs a separate approach (filter elements with fragment data, sort by order).

### Non-functional
- Fragment order input validates 1-20 range and duplicate order warnings are non-blocking unless implementation introduces enforced uniqueness
- Type gallery shows visual preview of each animation
- Timeline button toggles existing AnimationTimeline panel

## Architecture

```
AnimationsTabContent
├── RibbonSection label="Fragment"
│   ├── FragmentToggle
│   └── FragmentOrderInput (1-20)
├── RibbonSection label="Type"
│   └── FragmentTypeGallery (13 animation types)
├── RibbonSection label="Auto-Animate"
│   └── AutoAnimateToggle (per slide)
├── RibbonSection label="Timeline"
│   └── OpenTimelineButton
├── RibbonSection label="Preview"
│   ├── PlayButton, StepForwardButton, StepBackButton, CloseButton
```

## Related Code Files

### Create
- `client/src/components/ribbon/AnimationsTabContent.jsx` (~100 LOC)
- `client/src/components/ribbon/FragmentControls.jsx` (~50 LOC)
- `client/src/components/ribbon/FragmentTypeGallery.jsx` (~70 LOC)
- `client/src/components/ribbon/AnimationPreviewControls.jsx` (~40 LOC)

### Modify
- `client/src/stores/editor-store.js` — already has `showTimeline`

### Read for context
- `client/src/components/properties/common-element-controls.jsx` — fragment toggle, order, type
- Animation fragment types list from existing code

## Tests Before (Regression Coverage)

1. **Fragment toggle works via PropertiesPanel**
   - Toggle adds/removes fragment from element
   - Order input sets fragment order

2. **Fragment type selection works**
   - 13 animation types available
   - Type persists on element

3. **AnimationTimeline panel opens**
   - Toggle showTimeline in editor-store

```js
// client/src/components/ribbon/animations-tab-content.test.jsx
describe('AnimationsTabContent', () => {
  describe('Fragment section', () => {
    it('renders fragment toggle', () => { ... })
    it('renders order input with 1-20 range', () => { ... })
    it('disables order input when fragment is off', () => { ... })
  })
  describe('TypeGallery', () => {
    it('renders 14 animation types', () => { ... })
    it('highlights current type', () => { ... })
    it('calls onUpdateElement with type on click', () => { ... })
  })
  describe('AutoAnimate', () => {
    it('renders per-slide toggle', () => { ... })
    it('calls onUpdateSlide with autoAnimate flag', () => { ... })
  })
  describe('Timeline', () => {
    it('renders Open Timeline button', () => { ... })
    it('toggles showTimeline in editor-store', () => { ... })
  })
  describe('Preview', () => {
    it('renders Play, Step Forward, Step Back, Close buttons', () => { ... })
  })
})
```

## Implementation Steps

1. Create `client/src/constants/fragment-animation-types.js` and migrate `common-element-controls.jsx` + `AnimationTimeline.jsx` to use it
2. Create `FragmentControls.jsx` — toggle + order input
3. Create `FragmentTypeGallery.jsx` — cards from the shared fragment animation constant
4. Create `AnimationPreviewControls.jsx` — play/step/close buttons
5. Create `AnimationsTabContent.jsx` — compose all sections
6. Wire `selectedElement`, `onUpdateElement`, `slide`, `onUpdateSlide` props

## Tests After (New Behavior)

1. **Fragment controls work**
   - Toggle enables/disables fragment
   - Order input sets value

2. **Type gallery works**
   - 13 types render
   - Click sets animation type

3. **Timeline toggle works**
   - Opens/closes AnimationTimeline panel

4. **Preview controls work**
   - Play triggers animation preview
   - Step forward/back navigates fragments

## Regression Gate

```bash
npm run test
```

Fragment order/type preserved in export. AnimationTimeline still works.

## Success Criteria

- [ ] Fragment toggle + order work
- [ ] Animation types are centralized and gallery count matches the shared constant
- [ ] Auto-animate per-slide toggle
- [ ] Timeline panel opens
- [ ] Preview controls functional
- [ ] All tests pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Fragment order conflicts | Validate 1-20 range, warn on duplicate |
| Animation preview complexity | Delegate to existing AnimationTimeline |

## Next Steps

Phase 8: Format tab + cleanup.

---
phase: 1
title: "Convert Broken Components to Tailwind"
status: pending
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Convert Broken Components to Tailwind

## Overview

Convert 3 components có CSS classes hoàn toàn mất (orphaned) sang Tailwind inline classes. Đây là các component **vỡ hoàn toàn** khi render.

## Audit References

- Issue #1: SlideSorterView — 6 orphaned CSS classes
- Issue #2: SlidePanel context menu — 3 orphaned CSS classes
- Issue #3: TransitionPreview — 4 orphaned CSS classes
- Issue #13: SlidePanel spacing — thiếu `space-y`

## Related Code Files

### Modify:
- `client/src/components/SlideSorterView.jsx` (6462 bytes, 207 lines)
- `client/src/components/SlidePanel.jsx` (27129 bytes, 701 lines)
- `client/src/components/TransitionPreview.jsx` (5338 bytes, 136 lines)

## Implementation Steps

### Step 1.1 — SlideSorterView.jsx (CRITICAL)

Convert ALL orphaned CSS classes to Tailwind. Current orphaned classes and their replacements:

```diff
# Line 130: .slide-sorter-overlay
- className="slide-sorter-overlay"
+ className="fixed inset-0 z-[9999] bg-black/70 flex flex-col"

# Line 136: .slide-sorter-header
- <div className="slide-sorter-header">
+ <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border shrink-0">

# Line 149: .slide-sorter-grid
- <div className="slide-sorter-grid">
+ <div className="flex-1 overflow-y-auto p-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">

# Line 159: .sorter-slide-card + dynamic state classes
- className={`sorter-slide-card ${isCurrent ? 'current' : ''} ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''} ${isMultiSelected ? 'multi-selected' : ''}`}
+ className={`group relative rounded-lg border-2 cursor-pointer transition-all ${isCurrent ? 'border-accent shadow-lg shadow-accent/20' : 'border-border hover:border-border-strong'} ${isDragging ? 'opacity-50 scale-95' : ''} ${isOver ? 'border-accent border-dashed' : ''} ${isMultiSelected ? 'ring-2 ring-accent/50' : ''}`}

# Line 22: .sorter-slide-preview
- <div className="sorter-slide-preview" style={getBgStyle(slide.background)}>
+ <div className="aspect-video w-full overflow-hidden rounded-t-md" style={getBgStyle(slide.background)}>

# Line 169: .sorter-slide-number
- <div className="sorter-slide-number">{idx + 1}</div>
+ <div className="text-center py-1.5 text-xs font-medium text-text-secondary bg-card rounded-b-md">{idx + 1}</div>

# Line 178: .slide-context-menu (in sorter)
- className="slide-context-menu"
+ className="absolute z-[100] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
```

Also convert context menu buttons within SlideSorterView to use Tailwind:
```
Context menu items: "flex items-center gap-2 w-full px-3 py-2 text-[13px] text-text-primary hover:bg-hover transition-colors cursor-pointer"
```

### Step 1.2 — SlidePanel.jsx Context Menu + Spacing (CRITICAL)

**A) Fix slide spacing (Issue #13):**
```diff
# Line 76
- <div className="slide-list flex-1 overflow-y-auto p-2">
+ <div className="slide-list flex-1 overflow-y-auto p-2 space-y-2">
```

**B) Convert context menu classes (Issue #2):**
```diff
# Line 623: .slide-context-overlay
- <div className="slide-context-overlay" onMouseDown={() => setCtxMenu(null)} />
+ <div className="fixed inset-0 z-[9998]" onMouseDown={() => setCtxMenu(null)} />

# Line 625: .slide-context-menu
- className="slide-context-menu"
+ className="absolute z-[9999] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"

# Lines 655, 684: .context-separator
- <div className="context-separator" />
+ <div className="h-px bg-border my-1 mx-2" />
```

### Step 1.3 — TransitionPreview.jsx (CRITICAL)

Convert all 4 orphaned classes:

```diff
# Line 75: .transition-preview-overlay
- className="transition-preview-overlay"
+ className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center"

# Line 80: .transition-preview-modal
- <div className="transition-preview-modal">
+ <div className="bg-card rounded-xl border border-border shadow-2xl w-[620px] max-w-[90vw] overflow-hidden">

# Line 81: .transition-preview-header
- <div className="transition-preview-header">
+ <div className="flex items-center gap-3 px-4 py-3 border-b border-border">

# Line 117: .transition-preview-content
- <div className="transition-preview-content">
+ <div className="p-4 flex items-center justify-center bg-black/30 overflow-hidden" style={{height: 360}}>
```

## Success Criteria

- [ ] SlideSorterView renders styled overlay with grid layout
- [ ] SlideSorterView drag-and-drop visual states work (current, dragging, drag-over, multi-selected)
- [ ] SlideSorterView context menu appears styled when right-clicking
- [ ] SlidePanel thumbnails have visible spacing between them
- [ ] SlidePanel context menu renders with proper styling
- [ ] TransitionPreview shows centered modal overlay with iframe
- [ ] `npm run build` passes with no errors

## Verification

1. `npm run build` — zero errors
2. Browser subagent: Navigate to editor → Click View → Slide Sorter → verify styled grid
3. Browser subagent: Right-click slide thumbnail → verify context menu
4. Browser subagent: Check slide panel spacing between thumbnails
5. Visual inspection of TransitionPreview overlay (if testable)

## Risk Assessment

- **SlideSorterView drag states:** Tailwind conditional classes handle `isDragging`/`isOver` — may need fine-tuning for visual feedback
- **Context menu positioning:** `style` prop already sets `top`/`left` dynamically — Tailwind only handles visual styling

---
phase: 4
title: "Convert Inline Styles — SlideSorterView & TransitionPreview"
status: pending
priority: P2
effort: "30min"
dependencies: [1]
---

# Phase 4: Convert Inline Styles — SlideSorterView & TransitionPreview

## Overview

Convert remaining inline `style={{}}` objects to Tailwind utility classes in two partially-migrated components. These components have their main layouts in Tailwind but headers/controls still use inline styles.

## Requirements

- Functional: SlideSorterView header and TransitionPreview header/controls render identically after conversion
- Non-functional: Zero inline `style={{}}` except for dynamic/computed values

## Related Code Files

### Modify:
- `client/src/components/SlideSorterView.jsx` — Header controls (lines 138-142), context menu delete (line 197)
- `client/src/components/TransitionPreview.jsx` — Header title/subtitle (lines 82-86), select dropdown (lines 93-101), preview height (line 117)

## Implementation Steps

### SlideSorterView.jsx

#### Step 1: Header controls container (line 138)

```diff
- <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
+ <div className="flex items-center gap-2">
```

#### Step 2: Helper text (line 139-141)

```diff
- <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
+ <span className="text-[11px] text-text-muted">
```

#### Step 3: Delete button conditional color (line 197)

```diff
- style={{ color: slides.length > 1 ? 'var(--danger)' : 'var(--text-primary)' }}
+ className={`flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-hover transition-colors cursor-pointer bg-transparent border-none text-left ${slides.length > 1 ? 'text-danger' : 'text-text-primary'}`}
```
Note: Remove the existing className and merge with the conditional style.

### TransitionPreview.jsx

#### Step 4: Header title (line 82)

```diff
- <span style={{ fontWeight: 600, fontSize: 14 }}>Transition Preview</span>
+ <span className="font-semibold text-sm">Transition Preview</span>
```

#### Step 5: Header subtitle (lines 83-85)

```diff
- <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
+ <span className="text-xs text-text-muted">
```

#### Step 6: Controls container (line 86)

```diff
- <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
+ <div className="flex items-center gap-2 ml-auto">
```

#### Step 7: Select dropdown (lines 93-101)

```diff
- style={{
-   background: 'var(--bg-hover)',
-   border: '1px solid var(--border)',
-   color: 'var(--text-primary)',
-   padding: '4px 8px',
-   borderRadius: 4,
-   fontSize: 12,
-   cursor: 'pointer',
- }}
+ className="bg-hover border border-border text-text-primary px-2 py-1 rounded text-xs cursor-pointer"
```

#### Step 8: Preview container height (line 117)

```diff
- <div className="p-4 flex items-center justify-center bg-black/30 overflow-hidden" style={{height: 360}}>
+ <div className="p-4 flex items-center justify-center bg-black/30 overflow-hidden h-[360px]">
```

## Verification Steps

### Automated
```bash
# Count remaining style={{ in SlideSorterView
grep -c "style={{" client/src/components/SlideSorterView.jsx
# Expected: Only dynamic positioning styles remain (MiniPreview elements + context menu top/left)

# Count remaining style={{ in TransitionPreview
grep -c "style={{" client/src/components/TransitionPreview.jsx
# Expected: Only iframe dimensions remain (dynamic scale, can't be Tailwind)

# Build check
cd client && npx vite build --mode development
```

### Browser Visual Tests

**SlideSorterView:**
1. Open editor → View menu → "Slide Sorter" or equivalent
2. Verify header bar: "Slide Sorter" title + helper text visible in muted color
3. Verify close button aligned right
4. Right-click a slide → context menu appears → "Delete" text in red if >1 slides
5. Drag-and-drop reordering still works

**TransitionPreview:**
1. Open editor → click "Transition Preview" in View menu (if available)
2. Verify: header title "Transition Preview" in semibold
3. Verify: subtitle "Slide N → M" in muted text
4. Verify: select dropdown styled with hover background
5. Verify: preview area has 360px height
6. Verify: Replay and Close buttons work

## Success Criteria

- [ ] SlideSorterView header renders identically — helper text visible, proper gap
- [ ] SlideSorterView context menu delete shows red text for deletable slides
- [ ] TransitionPreview header renders identically — title bold, subtitle muted
- [ ] TransitionPreview select dropdown has proper styling
- [ ] Preview area is 360px height
- [ ] Only dynamic/computed inline styles remain
- [ ] Build passes

## Risk Assessment

- Low: All changes are 1:1 visual equivalents
- SlideSorterView delete button color: conditional class vs conditional style — functionally identical
- TransitionPreview iframe styles must stay inline (dynamic scaling)

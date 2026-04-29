---
phase: 5
title: "Fix Hybrid Styles & Hardcoded Colors"
status: pending
priority: P2
effort: "1h"
dependencies: [3, 4]
---

# Phase 5: Fix Hybrid Styles & Hardcoded Colors

## Overview

Fix remaining styling inconsistencies across migrated components:
- **M4**: Remove conflicting inline styles where Tailwind already handles the property
- **W2**: Replace hardcoded hex colors with design tokens
- **W4**: Add `position: relative` to MiniPreview parent
- **W5**: Remove duplicate styling logic

## Requirements

- **Functional**: No visual regression from color token replacement
- **Functional**: SlideSorterView MiniPreview elements position correctly
- **Non-functional**: All colors respond to dark/light theme switching

## Related Code Files

### Modify:
- `client/src/pages/HomePage.jsx` — Remove redundant inline styles in confirm dialog, create modal
- `client/src/pages/EditorPage.jsx` — Remove `var(--text-muted)` inline on L850, L866
- `client/src/components/SlideSorterView.jsx` — Add `relative` to MiniPreview, replace `#1e1e2e` with token
- `client/src/components/dashboard/TemplateGallery.jsx` — Replace hardcoded colors with tokens (post Phase 4)

## Implementation Steps

### Step 1: Fix MiniPreview positioning (W4)

[SlideSorterView.jsx L22](file:///d:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo/client/src/components/SlideSorterView.jsx#L22):

```diff
- <div className="aspect-video w-full overflow-hidden rounded-t-md" style={getBgStyle(slide.background)}>
+ <div className="relative aspect-video w-full overflow-hidden rounded-t-md" style={getBgStyle(slide.background)}>
```

### Step 2: Replace hardcoded fallback colors (W2)

```diff
// SlideSorterView.jsx getBgStyle function
- if (!bg) return { backgroundColor: '#1e1e2e' }
+ if (!bg) return { backgroundColor: 'var(--bg-card)' }
- if (bg.type === 'color') return { backgroundColor: bg.color || '#1e1e2e' }
+ if (bg.type === 'color') return { backgroundColor: bg.color || 'var(--bg-card)' }
- return { backgroundColor: '#1e1e2e' }
+ return { backgroundColor: 'var(--bg-card)' }
```

### Step 3: Replace `#22c55e` with `var(--success)` token

In SettingsPage (if not already converted in Phase 3):
```diff
- color: '#22c55e'
+ // Should be className="text-success" after Phase 3 conversion
```

### Step 4: Replace `#f59e0b` with `var(--warning)` token

In HomePage.jsx confirm dialog:
```diff
- color: confirmDialog.variant === 'danger' ? 'var(--danger)' : '#f59e0b'
+ color: confirmDialog.variant === 'danger' ? 'var(--danger)' : 'var(--warning)'
```

### Step 5: Convert remaining `var(--danger)` inline to Tailwind

In HomePage.jsx, multiple buttons use `style={{ color: 'var(--danger)' }}`:

```diff
- style={{ color: 'var(--danger)' }}
+ className="text-danger"
```

Occurrences: L842, L984, L1224, L1285

### Step 6: Remove redundant inline styles on hybrid elements

In EditorPage.jsx:
```diff
- style={{ color: 'var(--text-muted)' }}
+ className="text-text-muted"
```

### Step 7: Convert HomePage confirm dialog inline styles to Tailwind

Lines 1492-1520: The confirm dialog has extensive inline styles that should match the Tailwind pattern used elsewhere:

```diff
- <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
+ <div className="flex items-start gap-3.5">

- <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', ... }}>
+ <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
+   style={{ background: confirmDialog.variant === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}>

- <h2 style={{ fontSize: 16, marginBottom: 8 }}>{confirmDialog.title}</h2>
+ <h2 className="text-base mb-2">{confirmDialog.title}</h2>

- <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
+ <p className="text-sm text-text-secondary leading-normal">
```

## Success Criteria

- [ ] MiniPreview parent has `relative` class
- [ ] No `#1e1e2e` hardcoded in SlideSorterView
- [ ] No `#22c55e` hardcoded (use `--success` token)
- [ ] No `#f59e0b` hardcoded (use `--warning` token)
- [ ] `style={{ color: 'var(--danger)' }}` replaced with `className="text-danger"` in HomePage
- [ ] EditorPage inline `var(--text-muted)` replaced with Tailwind class
- [ ] Confirm dialog converted to Tailwind utilities
- [ ] `vite build` passes

## Test Plan

```bash
# Check for remaining hardcoded colors
grep -rn "#1e1e2e\|#22c55e\|#f59e0b\|#2d3748" client/src --include="*.jsx"

# Check for remaining var(--danger) inline usage in HomePage
grep -n "var(--danger)" client/src/pages/HomePage.jsx
```

**Browser Tests:**

| Component | Test | Expected |
|-----------|------|----------|
| SlideSorterView | Open sorter, check mini previews | Elements positioned within preview box, not overflowing |
| HomePage | Delete presentation | Confirm dialog has rounded icon container, correct colors |
| Settings | Save success | Green success color matches `--success` token |
| Theme toggle | Switch dark ↔ light | All hardcoded-fix areas respond to theme |

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Replacing `#1e1e2e` with `var(--bg-card)` changes color slightly | None | Both resolve to `#1e1e28` in dark mode — close enough |
| MiniPreview `relative` breaks existing absolute children | None | Fixes them — children were mispositioned before |

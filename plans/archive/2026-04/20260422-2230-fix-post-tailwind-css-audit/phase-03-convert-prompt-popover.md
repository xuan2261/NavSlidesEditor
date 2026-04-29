---
phase: 3
title: "Convert PromptPopover to Tailwind"
status: pending
priority: P2
effort: "20min"
dependencies: [1]
---

# Phase 3: Convert PromptPopover to Tailwind

## Overview

Replace all 5 orphaned CSS classes (`prompt-popover`, `prompt-popover-title`, `prompt-popover-actions`, `popover-overlay`, `select-sm`) in `PromptPopover.jsx` with Tailwind utility classes. This component is currently completely unstyled due to missing CSS definitions.

## Requirements

- Functional: PromptPopover displays as a floating card with backdrop overlay, styled input, and action buttons
- Non-functional: Consistent with existing modal/popover design system (bg-card, border-border, shadow-xl)

## Related Code Files

### Modify:
- `client/src/components/PromptPopover.jsx` — Replace all 5 orphaned classes + inline styles

## Implementation Steps

### Step 1: Replace `popover-overlay` (line 41)

```diff
- <div className="popover-overlay" onClick={onCancel} />
+ <div className="fixed inset-0 z-[9998] bg-black/40" onClick={onCancel} />
```

### Step 2: Replace `prompt-popover` container (line 42)

```diff
- <div className="prompt-popover" ref={wrapperRef} style={style}>
+ <div className="absolute z-[9999] bg-card border border-border rounded-lg shadow-xl p-3 min-w-[240px]" ref={wrapperRef} style={style}>
```

### Step 3: Replace `prompt-popover-title` (line 43)

```diff
- {title && <div className="prompt-popover-title">{title}</div>}
+ {title && <div className="text-xs font-semibold text-text-secondary mb-2">{title}</div>}
```

### Step 4: Replace `select-sm` input + inline styles (line 47-48)

```diff
- className="select-sm"
- style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}
+ className="w-full bg-surface-3 border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-[13px] focus:outline-none focus:border-accent"
```

### Step 5: Replace `prompt-popover-actions` (line 56)

```diff
- <div className="prompt-popover-actions">
+ <div className="flex items-center justify-end gap-2 mt-2">
```

### Step 6: Remove inline styles from buttons (lines 57, 63)

```diff
- <Button variant="ghost" onClick={onCancel} style={{ fontSize: 12 }}>
+ <Button variant="ghost" onClick={onCancel} className="text-xs">

- <Button variant="primary" onClick={handleSubmit} style={{ fontSize: 12, padding: '4px 12px' }}>
+ <Button variant="primary" onClick={handleSubmit} className="text-xs px-3 py-1">
```

## Verification Steps

### Automated
```bash
# No remaining orphaned classes
grep -n "prompt-popover\|popover-overlay\|select-sm" client/src/components/PromptPopover.jsx
# Expected: 0 results (only Tailwind classes)

# No remaining inline styles on buttons
grep -n "style={{" client/src/components/PromptPopover.jsx
# Expected: Only 1 result — the dynamic `style` prop on the container

# Build check
cd client && npx vite build --mode development
```

### Browser Visual Tests
1. Open editor → right-click a guide line or similar element that triggers PromptPopover
2. Verify: backdrop overlay appears (semi-transparent black)
3. Verify: popover card has bg-card background, border, shadow
4. Verify: input field is styled with surface-3 background
5. Verify: Cancel/OK buttons render correctly
6. Verify: ESC closes the popover

## Success Criteria

- [ ] PromptPopover renders with proper card styling (bg, border, shadow)
- [ ] Backdrop overlay is visible (black/40)
- [ ] Input field styled consistently with other inputs
- [ ] Action buttons aligned right with proper spacing
- [ ] 0 orphaned CSS classes remain in file
- [ ] Only 1 `style=` prop remains (dynamic positioning)
- [ ] Build passes

## Risk Assessment

- Low: PromptPopover is used in limited contexts (guide editing, URL prompts)
- The `style` prop for dynamic positioning must be preserved

---
phase: 6
title: "Verification & Visual Regression Testing"
status: pending
priority: P1
effort: "30min"
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Verification & Visual Regression Testing

## Overview

Comprehensive verification phase to confirm all fixes from Phase 1-5 are correct, no visual regressions introduced, and the application is in production-ready state.

## Requirements

- Functional: All Phase 1-5 fixes verified working
- Non-functional: Zero build errors, zero visual regressions

## Verification Pipeline

### Stage 1: Build Verification

```bash
# Clean build
cd client && npx vite build --mode development 2>&1
# Expected: Exit code 0, no warnings about missing classes
```

### Stage 2: Code Quality Grep Checks

```bash
# 1. No orphaned 'spin' class (should all be animate-spin)
grep -rn 'className="spin"' client/src/ --include="*.jsx"
# Expected: 0 results

# 2. No orphaned prompt-popover classes
grep -rn "prompt-popover\|popover-overlay\|select-sm" client/src/ --include="*.jsx"
# Expected: 0 results

# 3. No invalid text-primary in properties inputs
grep -rn "text-primary px-2" client/src/components/properties/ --include="*.jsx"
# Expected: 0 results

# 4. No invalid bg-surface (without number)
grep -rn "bg-surface " client/src/components/ --include="*.jsx"
# Expected: 0 results

# 5. No invalid placeholder:text-muted in properties
grep -rn "placeholder:text-muted" client/src/components/properties/ --include="*.jsx"
# Expected: 0 results

# 6. No inline styles in RemoteControlPage
grep -c "style={{" client/src/pages/RemoteControlPage.jsx
# Expected: 0

# 7. No btnStyle in RemoteControlPage
grep -n "btnStyle" client/src/pages/RemoteControlPage.jsx
# Expected: 0

# 8. qat-dot defined in CSS
grep -n "qat-dot" client/src/index.css
# Expected: 1+ results

# 9. Verify all Loader2 use animate-spin
grep -rn "className=\"animate-spin\"" client/src/ --include="*.jsx"
# Expected: 7+ results (QuickAccessToolbar, SettingsPage, AnalyticsModal, ShareModal, AITranslate, AIGenerator, AICopywriter)
```

### Stage 3: Browser Visual Tests — Dashboard

1. Navigate to `http://localhost:5175/`
2. **Dark mode:** Screenshot — verify sidebar, cards, thumbnails, action buttons, status bar
3. **Light mode:** Toggle theme → Screenshot — verify color inversion is clean
4. **Cards:** Hover over presentation card → verify hover effects (translate, shadow)
5. **New Presentation:** Click "+ New" → verify modal/template picker renders

### Stage 4: Browser Visual Tests — Editor

1. Click Edit on a presentation
2. **Toolbar area:**
   - QuickAccessToolbar: Save dot visible (accent-colored 8px circle)
   - Undo/Redo/Present buttons render correctly
3. **Canvas:** Click a text element → verify selection handles
4. **Properties Panel:**
   - All input fields have **white/light text** (not indigo)
   - Drop Shadow X/Y/Blur inputs readable
   - Placeholder text visible in muted gray
5. **Insert Menu:** Click Insert → verify all categories scrollable
6. **MiniToolbar:** Double-click text to edit → select text → verify floating toolbar
   - Font size select has `bg-surface-2` background

### Stage 5: Browser Visual Tests — Components

1. **SlideSorterView:** Open via View menu
   - Header: helper text in muted color, Close button aligned right
   - Right-click → Delete option in red
2. **TransitionPreview:** Open via View/toolbar
   - Header: "Transition Preview" bold, subtitle muted
   - Select dropdown styled with bg-hover
3. **PromptPopover:** Trigger a prompt action (e.g., guide line editing)
   - Card: bg-card background, border, shadow
   - Input: styled with surface-3 background
   - Overlay: semi-transparent backdrop
4. **SlidePanel footer:** Check bottom bar of slide panel
   - Has `bg-surface-2` background

### Stage 6: Regression Checklist

| Component | Check | Expected |
|-----------|-------|----------|
| QuickAccessToolbar | qat-dot visible | 8px accent dot |
| QuickAccessToolbar | Loader2 spins | animate-spin rotation |
| SettingsPage | Loader2 spins | animate-spin rotation |
| AnalyticsModal | Loader2 spins | animate-spin rotation |
| Properties inputs | Text color | white/light (text-text-primary) |
| Properties placeholders | Placeholder color | muted gray (text-text-muted) |
| MiniToolbar select | Background | surface-2 bg |
| SlidePanel footer | Background | surface-2 bg |
| PromptPopover | Full styling | Card + overlay + input |
| SlideSorterView header | Inline styles removed | Tailwind classes only |
| TransitionPreview header | Inline styles removed | Tailwind classes only |
| RemoteControlPage | Full migration | 0 inline styles |
| Dashboard | Dark/Light modes | No regressions |
| Editor | All panels | No regressions |

## Success Criteria

- [ ] `npm run build` — exit code 0
- [ ] All 9 grep checks pass (0 results for invalid patterns)
- [ ] Dashboard renders correctly in Dark + Light modes
- [ ] Editor Properties Panel inputs have correct text colors
- [ ] QuickAccessToolbar save dot visible
- [ ] All Loader2 icons animate
- [ ] SlideSorterView renders correctly
- [ ] TransitionPreview renders correctly
- [ ] PromptPopover renders correctly
- [ ] RemoteControlPage renders correctly
- [ ] SlidePanel footer has visible background
- [ ] MiniToolbar font size select has visible background

## Risk Assessment

- If any visual regression detected → rollback specific phase, investigate root cause
- Screenshot comparison is subjective — focus on functional correctness over pixel-perfect matching

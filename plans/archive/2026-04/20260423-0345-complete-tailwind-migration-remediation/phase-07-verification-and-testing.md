---
phase: 7
title: "Verification & Regression Testing"
status: pending
priority: P1
effort: "1h"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Verification & Regression Testing

## Overview

Final comprehensive verification pass to ensure zero regressions after all remediation work. Includes automated grep checks, production build validation, and browser-based visual regression testing across critical surfaces.

## Requirements

- **Functional**: All features work identically to pre-remediation
- **Non-functional**: Production build passes with zero errors
- **Non-functional**: No remaining undefined CSS variables in JSX files
- **Non-functional**: Inline style count reduced by 80%+

## Implementation Steps

### Step 1: Automated Code Quality Checks

```bash
# 1. No remaining var(--text) (without suffix)
echo "=== var(--text) check ==="
grep -Prn "var\(--text\)[^-]" client/src --include="*.jsx" | grep -v "var(--text-"

# 2. No remaining var(--radius-sm) or var(--radius-md) without definition
echo "=== var(--radius) check ==="
grep -rn "var(--radius" client/src --include="*.jsx"

# 3. No hardcoded dark theme colors
echo "=== Hardcoded colors check ==="
grep -rn "#1e1e2e\|#1e1e28" client/src --include="*.jsx" | grep -v "// " | grep -v "fallback"

# 4. important flag is scoped
echo "=== Important flag check ==="
grep "important:" client/tailwind.config.js

# 5. Inline style count per file
echo "=== Inline style counts ==="
for f in SettingsPage ExplorePage LivePresentationModal AnalyticsModal; do
  echo -n "$f: "
  grep -c "style={{" client/src/**/$f.jsx 2>/dev/null || echo "0"
done

# 6. Build
echo "=== Production Build ==="
cd client && npx vite build
```

### Step 2: Browser Visual Regression — Dashboard

Open `http://localhost:5173/` in browser and verify:

| Check | Expected |
|-------|----------|
| Sidebar nav items | Visible text, hover effects work |
| Presentation cards | Thumbnails render, action buttons visible |
| Template gallery | Cards with hover effects, no white/blank areas |
| Search | Input field has border, text visible |
| Create modal | Form fields styled correctly, template selector works |
| Confirm dialog | Rounded icon, proper colors for danger/warning |
| Empty states | Center-aligned, icons + text visible |

**Screenshot**: Capture before/after for comparison.

### Step 3: Browser Visual Regression — Editor

Open any presentation in editor and verify:

| Check | Expected |
|-------|----------|
| Canvas | Background matches slide settings, not Tailwind bg |
| Toolbar | All icons aligned, buttons have hover effects |
| Properties panel | Labels visible, color pickers work |
| Slide panel | Thumbnails render, context menu works |
| Insert menu | Submenus open without clipping |
| Slide sorter | Mini previews show elements correctly positioned |

### Step 4: Browser Visual Regression — Settings

Open `http://localhost:5173/settings` and verify:

| Check | Expected |
|-------|----------|
| All labels | Visible in dark mode (not black text) |
| Form fields | Borders visible, backgrounds match theme |
| Provider select | Dropdown works, options visible |
| Save button | Works, shows success message in green |
| Test connection | Spinner, success/error states display correctly |

### Step 5: Browser Visual Regression — Theme Toggle

Switch between dark and light mode and verify:

| Surface | Dark Mode | Light Mode |
|---------|-----------|------------|
| Dashboard bg | Dark (#0f0f14) | Light (#f5f5f9) |
| Card bg | Dark (#1e1e28) | White (#ffffff) |
| Text colors | Light on dark | Dark on light |
| Borders | Subtle white | Subtle black |
| Buttons | Accent visible | Accent visible |

### Step 6: Functional Smoke Tests

| Test | Steps | Expected |
|------|-------|----------|
| Create presentation | Click New → enter title → Create | Redirects to editor |
| Edit presentation | Open editor → add text → save | Autosave works |
| Settings | Change AI provider → save → test connection | Flow works end to end |
| Explore | Load explore page | Shows public presentations or empty state |
| LivePresentation | Open live modal → verify room code | Code displays, inputs copy |
| Analytics | Open analytics for presentation | Stats + chart render |
| Template Gallery | Open gallery → search → filter | All interactions work |
| Slide Sorter | Open sorter → drag slide → close | Reorder works |
| Presentation | Start presentation mode | Reveal.js renders, no Tailwind leakage |

### Step 7: E2E Test Suite

```bash
cd repo && npx playwright test --reporter=line
```

Review any failures — they may indicate selector changes from migration.

### Step 8: Final Build Verification

```bash
cd client && npx vite build 2>&1 | tee build_output.txt

# Check for warnings
grep -i "warning\|error" build_output.txt
```

## Success Criteria

- [ ] Zero `var(--text)` without suffix in JSX files
- [ ] Zero `var(--radius-sm/md)` without definition
- [ ] `important: '#root'` in tailwind.config.js
- [ ] `border-style: solid` in `*` reset
- [ ] SettingsPage inline styles ≤ 0
- [ ] ExplorePage inline styles ≤ 0
- [ ] LivePresentationModal inline styles ≤ 2
- [ ] AnalyticsModal inline styles ≤ 5 (dynamic bars)
- [ ] `vite build` exit code 0
- [ ] Main bundle < 2.5MB (if Phase 6 applied)
- [ ] No visual regression in dark mode
- [ ] No visual regression in light mode
- [ ] E2E tests pass (or documented failures with known causes)
- [ ] All 7 functional smoke tests pass

## Final Metrics Comparison

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Migration completion | 70-75% | 95%+ |
| Files with 100% inline styles | 6 | 0 |
| Undefined CSS variable usage | 16 | 0 |
| `important: true` | Active | Scoped to `#root` |
| Main bundle size | 4.3MB | < 2.5MB |
| Hardcoded colors | 8+ | 0 |
| MiniPreview position bug | Present | Fixed |
| Repo root artifacts | 8 files | 0 |

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| E2E tests fail due to selector changes | Medium | Review failures, update selectors if needed |
| Theme toggle reveals missed hardcoded colors | Low | Additional grep sweep after toggle test |
| Bundle chunking causes runtime errors | Low | Test all lazy routes before marking complete |

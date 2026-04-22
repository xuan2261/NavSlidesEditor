---
phase: 4
title: "Migrate Unmigrated Modals"
status: pending
priority: P1
effort: "2h"
dependencies: [2]
---

# Phase 4: Migrate Unmigrated Modals

## Overview

Migrate 4 modal components that were completely skipped during the migration:
- **LivePresentationModal.jsx** (147 lines, 100% inline) — 30 min
- **AnalyticsModal.jsx** (268 lines, ~30 inline) — 45 min
- **TemplateGallery.jsx** (647 lines, ~60 inline) — 45 min
- **TemplatePreview.jsx** (503 lines, ~40 inline) — planned separately already, verify only

## Requirements

- **Functional**: Modal overlay click-to-close works
- **Functional**: LivePresentationModal copy-to-clipboard works
- **Functional**: AnalyticsModal bar chart renders correctly
- **Functional**: TemplateGallery search, filter, sort work
- **Non-functional**: Dark/light theme parity

## Architecture

### Common Modal Pattern

All modals share the same overlay+content pattern. Convert to shared Tailwind pattern:

```jsx
// Overlay
<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
  {/* Content */}
  <div className="bg-card rounded-xl p-6 shadow-2xl border border-border"
       style={{ width: <dynamic> }}>
```

### AnalyticsModal Bar Chart

The bar chart uses dynamic height calculation via inline styles — this is a **valid use of inline styles** and should be preserved:

```jsx
// KEEP inline: dynamic height calculation
style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
```

Only convert **static layout styles** (grid, flex, padding, colors) to Tailwind.

## Related Code Files

### Modify:
- `client/src/components/LivePresentationModal.jsx`
- `client/src/components/AnalyticsModal.jsx`
- `client/src/components/dashboard/TemplateGallery.jsx`
- `client/src/pages/dashboard/TemplatePreview.jsx` (verify only — may have partial conversion)

## Implementation Steps

### LivePresentationModal.jsx (30 min)

#### Step 1: Convert overlay

```diff
- <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
+ <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
```

#### Step 2: Convert modal container

```diff
- <div style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }}>
+ <div className="bg-card rounded-xl p-6 w-[400px] shadow-2xl border border-border">
```

#### Step 3: Convert header, room code display, input fields

All layout styles (flex, gap, margin, padding, fontSize, color) → Tailwind utilities.

Keep `fontFamily: 'monospace'` as inline for room code display (no Tailwind equivalent for `font-mono` with letterSpacing combo).

#### Step 4: Convert input fields

```diff
- <input style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 12 }}>
+ <input className="flex-1 px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-xs">
```

### AnalyticsModal.jsx (45 min)

#### Step 1: Remove `overlay` and `modal` constant objects (L5-23)

Replace with inline Tailwind classes on the elements.

#### Step 2: Convert overlay + modal container (same pattern as LivePresentationModal)

#### Step 3: Convert stats grid

```diff
- <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
+ <div className="grid grid-cols-2 gap-3 mb-5">
```

```diff
- <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
+ <div className="bg-secondary rounded-lg px-4 py-3.5 flex items-center gap-3">
```

#### Step 4: Convert stat values — fix `var(--text)` simultaneously

```diff
- <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
+ <div className="text-2xl font-bold text-text-primary">
```

#### Step 5: Convert bar chart container (keep dynamic bar heights as inline)

```diff
- <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, ... }}>
+ <div className="flex items-end gap-0.5 h-20 px-1 bg-secondary rounded-lg">
```

**KEEP** individual bar `style={{ height: '...%' }}` — this is dynamic.

#### Step 6: Convert token breakdown list and recent events

Standard flex/padding/fontSize → Tailwind conversion.

### TemplateGallery.jsx (45 min)

**Strategy**: This is 647 lines. Migrate in sections to reduce risk.

#### Step 1: Header section (L233-289) — search input, sort select

```diff
- <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', ... }}>
+ <div className="px-5 py-4 border-b border-border flex items-center justify-between">
```

#### Step 2: Sidebar section (L293-420) — category buttons

```diff
- <div style={{ width: 210, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '12px 0', flexShrink: 0 }}>
+ <div className="w-[210px] border-r border-border overflow-y-auto py-3 shrink-0">
```

#### Step 3: Category group headers

```diff
- <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '10px 16px 4px', textTransform: 'uppercase', letterSpacing: 1 }}>
+ <div className="text-[10px] font-bold text-text-muted px-4 pt-2.5 pb-1 uppercase tracking-wider">
```

#### Step 4: Template card grid (L433-622) — LARGEST section

Convert grid container, card wrapper, badge overlays, card content.

**KEEP** dynamic gradient backgrounds as inline styles:
```jsx
// KEEP: dynamic color scheme
style={bgStyle}
```

#### Step 5: Footer section (L627-642)

```diff
- <div style={{ padding: 10, borderTop: '1px solid var(--border)', ... }}>
+ <div className="p-2.5 border-t border-border flex justify-between items-center">
```

#### Step 6: Badge DRY optimization

The 4 tag badges (interactive, dark, minimal, chart-heavy) share identical styling except color. Extract pattern:

```jsx
const badgeCls = (bg, color) =>
  `inline-flex items-center gap-0.5 px-[7px] py-0.5 rounded-[10px] text-[10px] font-semibold backdrop-blur-sm`
```

### TemplatePreview.jsx — Verify Only

Check current state. If inline styles remain, apply same conversion pattern.

## Success Criteria

- [ ] `LivePresentationModal.jsx` has ≤2 inline styles (font-family, dynamic values only)
- [ ] `AnalyticsModal.jsx` has inline styles only on dynamic bar chart heights
- [ ] `TemplateGallery.jsx` has inline styles only on dynamic backgrounds/gradients
- [ ] `overlay` and `modal` const objects removed from AnalyticsModal
- [ ] All modals open/close correctly
- [ ] AnalyticsModal bar chart renders proportionally
- [ ] TemplateGallery search + filter + sort work
- [ ] `vite build` passes

## Test Plan

```bash
# Inline style count reduction targets
grep -c "style={{" client/src/components/LivePresentationModal.jsx  # Target: ≤2
grep -c "style={{" client/src/components/AnalyticsModal.jsx         # Target: ≤5 (dynamic bars)
grep -c "style={{" client/src/components/dashboard/TemplateGallery.jsx  # Target: ≤10 (dynamic bg)
```

**Browser Tests:**

| Modal | Test | Expected |
|-------|------|----------|
| LivePresentation | Open via editor menu | Room code visible, inputs copy on click |
| Analytics | Open for presentation | Stats grid + bar chart render |
| TemplateGallery | Open via dashboard | Search, category filter, sort all work |
| TemplateGallery | Hover card | Border highlight, translateY effect |
| TemplateGallery | Toggle favorite | Star fills/unfills, persists in localStorage |

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| AnalyticsModal bar chart breaks | Low | Only convert static styles, preserve dynamic heights |
| TemplateGallery 647-line file, many touch points | Medium | Migrate section by section, build-test after each |
| Badge extraction creates DRY violation | Low | Optional optimization, can skip if time-constrained |

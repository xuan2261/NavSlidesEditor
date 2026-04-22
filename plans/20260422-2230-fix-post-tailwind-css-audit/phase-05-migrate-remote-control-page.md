---
phase: 5
title: "Migrate RemoteControlPage to Tailwind"
status: pending
priority: P2
effort: "45min"
dependencies: [2]
---

# Phase 5: Migrate RemoteControlPage to Tailwind

## Overview

Complete Tailwind migration for `RemoteControlPage.jsx` — the only page entirely missed during the full migration. Currently uses **100% inline styles** with `style={{}}` objects and a shared `btnStyle` object. Convert all to Tailwind utility classes.

## Requirements

- Functional: Remote control page renders identically — navigation buttons, timer, laser toggle, connection status
- Non-functional: Zero inline styles except dynamic/conditional values

## Related Code Files

### Modify:
- `client/src/pages/RemoteControlPage.jsx` — Full Tailwind conversion (275 lines)

## Implementation Steps

### Step 1: Root container (lines 93-101)

```diff
- style={{
-   minHeight: '100vh',
-   background: 'var(--bg-primary, #0f172a)',
-   color: 'var(--text, #e2e8f0)',
-   display: 'flex',
-   flexDirection: 'column',
-   fontFamily: 'Inter, system-ui, sans-serif',
- }}
+ className="min-h-screen bg-workspace text-text-primary flex flex-col font-[Inter,system-ui,sans-serif]"
```

### Step 2: Header container (lines 104-111)

```diff
- style={{
-   padding: '12px 16px',
-   display: 'flex',
-   justifyContent: 'space-between',
-   alignItems: 'center',
-   borderBottom: '1px solid var(--border, #334155)',
- }}
+ className="px-4 py-3 flex justify-between items-center border-b border-border"
```

### Step 3: Header right section (lines 119-126)

```diff
- style={{
-   display: 'flex',
-   alignItems: 'center',
-   gap: 16,
-   fontSize: 13,
-   color: 'var(--text-muted)',
- }}
+ className="flex items-center gap-4 text-[13px] text-text-muted"
```

### Step 4: Connection indicator + viewers (lines 128-141)

```diff
- <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
+ <span className="flex items-center gap-1">
   <div
-    style={{
-      width: 8, height: 8, borderRadius: '50%',
-      background: isConnected ? '#22c55e' : '#ef4444',
-    }}
+    className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`}
   />

- <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
+ <span className="flex items-center gap-1">
```

### Step 5: Speaker Notes section (lines 146-181)

```diff
- style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}
+ className="flex-1 p-4 overflow-y-auto flex flex-col gap-3"

- style={{ background: 'var(--bg-card, #1e293b)', borderRadius: 12, padding: 16, flex: 1, minHeight: 100 }}
+ className="bg-card rounded-xl p-4 flex-1 min-h-[100px]"

- style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}
+ className="mb-2 text-[13px] text-text-muted font-medium"

- style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}
+ className="text-[15px] leading-relaxed text-text-primary whitespace-pre-wrap"
```

### Step 6: Slide counter (lines 185-196)

```diff
- style={{
-   textAlign: 'center', padding: '8px 16px', fontSize: 20,
-   fontWeight: 700, color: 'var(--text)',
-   borderTop: '1px solid var(--border, #334155)',
- }}
+ className="text-center px-4 py-2 text-xl font-bold text-text-primary border-t border-border"
```

### Step 7: Navigation section + remove `btnStyle` object (lines 75-90, 199-245)

Delete the `btnStyle` const (lines 75-90).

Convert Prev button:
```diff
- <button onClick={goPrev} style={{ ...btnStyle, flex: 1 }}>
+ <button onClick={goPrev} className="flex-1 px-8 py-5 rounded-xl text-lg font-semibold border-2 border-border cursor-pointer flex items-center justify-center gap-2 bg-card text-text-primary touch-manipulation select-none hover:bg-hover transition-colors">
```

Convert Next button:
```diff
- <button onClick={goNext} style={{ ...btnStyle, flex: 1, background: 'var(--accent, #6366f1)', color: '#fff', border: 'none' }}>
+ <button onClick={goNext} className="flex-1 px-8 py-5 rounded-xl text-lg font-semibold border-none cursor-pointer flex items-center justify-center gap-2 bg-accent text-white touch-manipulation select-none hover:bg-accent-hover transition-colors">
```

Convert Laser button (conditional):
```diff
- style={{ ...btnStyle, flex: 1, fontSize: 14, padding: '12px 16px', background: laserActive ? 'rgba(239,68,68,0.2)' : 'var(--bg-card)', borderColor: laserActive ? '#ef4444' : 'var(--border)', color: laserActive ? '#ef4444' : 'var(--text)' }}
+ className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border-2 cursor-pointer flex items-center justify-center gap-2 touch-manipulation select-none transition-colors ${laserActive ? 'bg-danger/20 border-danger text-danger' : 'bg-card border-border text-text-primary hover:bg-hover'}`}
```

Convert Timer display:
```diff
- style={{ ...btnStyle, flex: 1, fontSize: 14, padding: '12px 16px', cursor: 'default', justifyContent: 'center' }}
+ className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold border-2 border-border cursor-default flex items-center justify-center gap-2 bg-card text-text-primary touch-manipulation select-none"
```

### Step 8: Navigation wrapper containers (lines 199, 200, 218)

```diff
- style={{ padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}
+ className="px-4 pt-3 pb-6 flex flex-col gap-3"

- style={{ display: 'flex', gap: 12 }}
+ className="flex gap-3"
```

### Step 9: Presenter Left overlay (lines 248-271)

```diff
- style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
+ className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center"

- style={{ textAlign: 'center', color: '#fff' }}
+ className="text-center text-white"

- style={{ marginTop: 12 }}
+ className="mt-3"
```
Note: Remove remaining `style={{ marginTop: 12 }}` from Go Home button.

## Verification Steps

### Automated
```bash
# Count remaining style={{ in RemoteControlPage
grep -c "style={{" client/src/pages/RemoteControlPage.jsx
# Expected: 0

# Verify btnStyle object removed
grep -n "btnStyle" client/src/pages/RemoteControlPage.jsx
# Expected: 0 results

# Build check
cd client && npx vite build --mode development
```

### Browser Visual Tests
(RemoteControlPage requires a live presentation session with room code)
1. Navigate to `/remote/test-room` (or create a live session)
2. Verify: Header with Exit button, connection status indicator (green/red dot), viewers count
3. Verify: Speaker Notes panel with card background
4. Verify: Slide counter displays "Slide N"
5. Verify: Prev/Next buttons — Prev has card bg, Next has accent bg
6. Verify: Laser toggle button — default: card bg, active: red tint
7. Verify: Timer display
8. Verify: Mobile-friendly touch targets (large buttons)

## Success Criteria

- [ ] 0 inline `style={{}}` props remain
- [ ] `btnStyle` object deleted
- [ ] Page renders identically in dark mode
- [ ] Connection indicator shows green/red dot correctly
- [ ] Laser toggle changes appearance on click
- [ ] "Session Ended" overlay renders with proper z-index
- [ ] Build passes

## Risk Assessment

- Low: Isolated page with no shared components
- Mobile layout must be tested — large touch targets are critical for remote control usage
- `touch-manipulation` and `select-none` classes ensure same mobile behavior as inline counterparts

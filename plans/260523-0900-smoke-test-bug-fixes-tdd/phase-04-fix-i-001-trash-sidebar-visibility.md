---
phase: 4
title: "Fix I-001 Trash Sidebar Visibility"
status: pending
priority: P1
effort: "1-2h"
dependencies: [1]
---

# Phase 4: Fix I-001 — Trash Sidebar Visibility (GREEN + REFACTOR)

## Overview

Trash entry is rendered unconditionally in `HomePage.jsx` but can fall outside the visible scroll area at smaller viewport heights or when the sidebar's "Import progress / warning" block grows. Pin it so it is always reachable.

## Severity & Scope

- **Severity:** Low (cosmetic; data accessible via `/api/presentations/trash/list`)
- **Affects:** every dashboard visit at viewport heights < ~700 px or after long import-warning text appears
- **Inspection point:** `client/src/pages/HomePage.jsx:856-870` — Trash render block sits inside the scrolling `<nav>` but no scroll occurs in the parent, so overflow clips it

## Requirements

### Functional
- Trash entry is reachable at any viewport height ≥ 480 px.
- Trash count badge still appears when `trashItems.length > 0`.
- Active-view highlight (`bg-primary/10 text-primary`) still works.
- Other sidebar entries (New Presentation, Import, Explore, etc.) are unaffected.

### Non-functional
- No new component, no new layout primitive. Single CSS edit.
- Mobile-friendly: Trash still visible on tablet portrait orientation.

## Architecture

Current layout:
```
<nav> (sidebar)
  - New Presentation menu
  - separator
  - Import / Open Project
  - separator
  - Explore
  - separator
  - Trash               ← can scroll off
  - mt-auto: import warnings  ← pushes Trash up but only if there's content
```

Target layout (per Red Team Finding 6 — `position: sticky` rather than `mt-auto`):

`mt-auto` pins to the bottom of the flex container, but if `importWarningSummary` text is verbose it still grows from above and can push Trash *off-screen* on small viewports. `position: sticky` with `bottom: 0` keeps Trash visible at the viewport edge regardless of warning length, and the warnings flow naturally beneath it inside the scroll region.

```
<nav> (sidebar) flex-col overflow-y-auto h-full
  - top section: New Presentation, Import, Explore, separators
  - Trash entry (sticky bottom: 0)  → always visible
  - import warnings (normal flow below Trash) → scroll into view if long
```

Move the Trash block into a sticky-positioned wrapper just before the warnings group.

## Related Code Files

- Modify: `client/src/pages/HomePage.jsx` (around lines 856-892 — Trash block + import warnings block)
- Read for context: existing CSS in `<nav>` parent (sidebar layout), Tailwind utility classes used here
- Tests verifying this fix: `tests/e2e/regression-smoke-fixes.spec.js` I-001 case from Phase 1.3

## Implementation Steps

### Step 4.1 — Restructure sidebar with sticky Trash

Current snippet (HomePage.jsx ~856-891):

```jsx
<div className="px-3 mb-2">
  <Button variant="ghost" ... onClick={() => setSidebarView('trash')}>
    <Trash size={16} /> Trash {trashItems.length > 0 && <span>...</span>}
  </Button>
</div>

{/* H-01: import progress/warning at sidebar bottom */}
<div className="mt-auto px-3 pb-2">
  {importProgress && <div>...</div>}
  {importWarningSummary && <div>...</div>}
</div>
```

Replace with — Trash is sticky-pinned to the viewport bottom; warnings flow naturally below it. This keeps Trash reachable regardless of how verbose the warnings get:

```jsx
{/* Sticky Trash entry — always reachable at viewport bottom */}
<div className="sticky bottom-0 bg-background z-10 px-3 mb-2 pt-2 border-t border-border/40">
  <Button
    variant="ghost"
    className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === 'trash' ? 'bg-primary/10 text-primary' : ''}`}
    onClick={() => setSidebarView('trash')}
  >
    <Trash size={16} />
    <span>Trash</span>
    {trashItems.length > 0 && (
      <span className="ml-auto text-[11px] text-text-muted bg-hover px-[7px] py-[1px] rounded-[10px]">
        {trashItems.length}
      </span>
    )}
  </Button>
</div>

{/* Import progress / warnings: flow normally below Trash; scroll if long */}
<div className="px-3 pb-2">
  {importProgress && (
    <div className="rounded border border-border bg-card px-2 py-1.5 text-[11px] text-text-secondary" role="status" aria-live="polite">
      {importProgress}
    </div>
  )}
  {importWarningSummary && (
    <div className="mt-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-[11px] text-text-secondary" role="alert">
      {importWarningSummary}
    </div>
  )}
</div>
```

Key change: Trash uses `sticky bottom-0` with a solid `bg-background` so content scrolling underneath does not show through. The `border-t` is a subtle visual divider from the scrolling region above. Z-index ensures Trash sits above the scroll content if any overflow shadows render.

### Step 4.2 — Verify parent `<nav>` allows overflow

Walk back up from line 700ish (find the `<nav>` opening tag) and confirm classes include `flex flex-col h-full overflow-y-auto`. Verified at scout time: `flex flex-col overflow-y-auto py-3` is already present — `h-full` may need to be added if not. `position: sticky` requires the parent to be a *scroll container* (which `overflow-y-auto` makes it).

### Step 4.3 — (Removed)

Step 4.3 in the previous draft set `overflow-y-auto` redundantly; merged into 4.2.

### Step 4.4 — Run Phase 1 RED → GREEN

```powershell
npx playwright test tests/e2e/regression-smoke-fixes.spec.js --grep "I-001"
```

Expected: Trash button visible + in viewport. Add a second variant test (small viewport) to lock in:

```js
test('I-001 small viewport: Trash entry still visible', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 480 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: /trash/i })).toBeInViewport()
})
```

Add this case to the spec file in Phase 1 retroactively, or as a follow-up assertion in this phase.

### Step 4.5 — Visual smoke

Open http://localhost:5174 in browser, resize window to ~500 px tall, confirm Trash is still at bottom with badge. Capture screenshot to `reports/phase-04-visual-evidence.png` (or skip if E2E covers).

### Step 4.6 — Commit

```text
fix(home): sticky Trash sidebar entry above import status (I-001)

Trash button was inside the scrolling region and could fall outside
viewport at small heights — and a long importWarningSummary could
push it off-screen even when wrapped in mt-auto. Switched to
position: sticky bottom-0 with solid bg-background so Trash always
sits at the viewport edge, with warnings flowing in normal flow below.
```

## Success Criteria

- [ ] Trash button uses `sticky bottom-0` + solid `bg-background` + `z-10`
- [ ] Parent `<nav>` has `flex flex-col h-full overflow-y-auto` (scroll container required for sticky)
- [ ] Phase 1.3 I-001 test passes at default viewport
- [ ] Small-viewport variant test added and passes (480 px height)
- [ ] Visual sanity at 1280×480 and 1280×720 with verbose import warnings
- [ ] Lint passes
- [ ] No other sidebar entry shifted in layout

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `mt-auto` only works when parent is `flex-col` | Step 4.2 explicitly confirms; if missing, add — quick safety check |
| Pinning Trash hides it behind a long Trash-items panel in trash view | Trash list panel is in the main content area (`flex-1 overflow-y-auto`), not the sidebar; unaffected |
| Sidebar scrolling now hides "Explore" or "Import" at very small heights | Acceptable trade-off: Trash + import status are the high-value pins. User can scroll within nav |
| Layout change ripples to other pages using same nav | This `<nav>` is local to `HomePage.jsx`; not shared. Confirmed by grepping for the JSX shape |

## Security Considerations

- Pure CSS/layout change. No data or auth surface affected.

## Red Team Adjustment

### Session 2 — 2026-05-23 (post-draft review)

| Finding | Severity | Disposition | Applied |
|---|---|---|---|
| 6. `mt-auto` only pins relative to flex container — long `importWarningSummary` can still push Trash off-screen at narrow heights | Medium | Accept | Step 4.1 switched from `mt-auto` group to `position: sticky bottom-0` on Trash only; warnings flow below it within the scroll region |

Sticky + solid `bg-background` + `z-10` + subtle `border-t` ensures Trash is always at the viewport edge regardless of warning length, and scrolling content does not bleed through visually.

## Next Steps

Phase 7 picks up this fix in the regression sweep.

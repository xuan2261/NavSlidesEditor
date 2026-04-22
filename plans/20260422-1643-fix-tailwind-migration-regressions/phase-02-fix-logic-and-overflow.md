---
phase: 2
title: "Fix Logic Bugs & Overflow Issues"
status: pending
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 2: Fix Logic Bugs & Overflow Issues

## Overview

Fix 3 functional bugs: Speaker Notes handler gọi sai function, InsertMenu Shape/Table submenus bị clip bởi overflow container.

## Audit References

- Issue #9: Speaker Notes handler calls `presentInWindow()` instead of toggling notes
- Issue #11: Shape submenu clipped by `overflow-y-auto`
- Issue #12: Table size picker clipped by `overflow-y-auto`

## Related Code Files

### Modify:
- `client/src/pages/EditorPage.jsx` — Fix `onSpeaker` handler (line ~1049)
- `client/src/components/InsertMenu.jsx` — Fix overflow clipping (lines 125, 283, 431)

## Implementation Steps

### Step 2.1 — Fix Speaker Notes Handler (CRITICAL — Issue #9)

**Current code (EditorPage.jsx ~line 1049):**
```javascript
onSpeaker={() => presentInWindow(presentation)}
```

**Problem:** User clicks View → Speaker Notes → opens presenter window. Should focus/show speaker notes area.

**Fix:**
```javascript
onSpeaker={() => {
  // Scroll to Speaker Notes section in PropertiesPanel
  const notesSection = document.querySelector('[data-section="speaker-notes"]') 
    || document.querySelector('textarea[placeholder*="speaker" i]')
    || document.querySelector('textarea[placeholder*="notes" i]')
  if (notesSection) {
    notesSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
    notesSection.focus()
  }
}}
```

**Also check:** Does `PropertiesPanel.jsx` have a `data-section` attribute on the Speaker Notes textarea? If not, add `data-section="speaker-notes"` to the textarea container for reliable querying.

### Step 2.2 — Fix InsertMenu Shape Submenu (Issue #11)

**Root cause:** Line 125 — main dropdown container has `overflow-y-auto` which creates a new overflow context, clipping absolute-positioned sub-panels.

**Current structure:**
```
<div className="... overflow-y-auto max-h-[70vh] ...">  ← clips absolute children
  ...
  <div className="insert-sub-panel absolute left-full ...">  ← gets clipped
  ...
</div>
```

**Fix strategy — Remove overflow from outer container, add it to inner scrollable area:**

```diff
# Line 125: Dropdown container
- className="... overflow-y-auto max-h-[70vh] ..."
+ className="... overflow-visible ..."

# Wrap menu items list in a scrollable inner div:
+ <div className="overflow-y-auto max-h-[70vh]">
    {/* all menu items */}
+ </div>

# Sub-panels stay OUTSIDE the scrollable div, positioned relative to dropdown
```

**Alternative approach (simpler):** Use React Portal to render sub-panel at document body level:
```jsx
import { createPortal } from 'react-dom'

// In sub-panel rendering:
{subMenu === 'shapes' && createPortal(
  <div className="fixed z-[10001] ..." style={{ top: panelTop, left: panelLeft }}>
    {/* shapes grid */}
  </div>,
  document.body
)}
```

**Recommended:** The simpler approach — restructure the overflow. Portal adds complexity but is more robust for all edge cases.

### Step 2.3 — Fix InsertMenu Table Size Picker (Issue #12)

**Same root cause as Step 2.2** — table picker (lines 431-454) is inside the `overflow-y-auto` container.

**Fix:** When Step 2.2's overflow restructure is applied, the table picker will also be fixed as it's in the same container. If using Portal approach, also portal the table picker.

**Table picker specific check:** Ensure the 8×8 grid renders fully visible. Current Tailwind classes on grid should be:
```
className="grid grid-cols-8 gap-0.5 p-2"
```

Each cell:
```
className="w-5 h-5 border border-border rounded-sm cursor-pointer hover:bg-accent/30 transition-colors"
```

## Success Criteria

- [ ] Clicking View → Speaker Notes scrolls to & focuses the notes textarea in PropertiesPanel
- [ ] Clicking Insert → Shape shows shape picker submenu (not clipped)
- [ ] Shape picker grid displays all shapes visually
- [ ] Clicking Insert → Table shows 8×8 size picker grid (not clipped)
- [ ] Table size picker allows hovering to select dimensions
- [ ] No existing Insert menu items broken by overflow change
- [ ] `npm run build` passes

## Verification

1. `npm run build` — zero errors
2. Browser subagent: Click View → Speaker Notes → verify notes textarea gets focus
3. Browser subagent: Click Insert → hover Shape → verify shape picker appears fully visible
4. Browser subagent: Click Insert → hover Table → verify 8×8 grid appears
5. Browser subagent: Test Insert → Icon → verify still works (regression check)
6. Browser subagent: Test Insert → Image → verify still works (regression check)

## Risk Assessment

- **HIGH: InsertMenu overflow change** may affect dropdown positioning and scrolling behavior when many items exist. Test with scroll.
- **MEDIUM: Speaker Notes query selector** — if PropertiesPanel textarea doesn't have a matching placeholder, the selector won't find it. Must verify the placeholder text.
- **LOW: Portal approach** would require calculating position coordinates — more complex but more reliable.

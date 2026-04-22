---
phase: 3
title: "Standardize Tailwind Tokens"
status: pending
priority: P2
effort: "1h"
dependencies: []
---

# Phase 3: Standardize Tailwind Tokens

## Overview

Fix ~15 files using invalid Tailwind tokens (`bg-muted`, `text-foreground`, `text-muted-foreground`) that don't exist in `tailwind.config.js`. Also fix double-prefix tokens (`bg-bg-primary`, `text-text`).

## Audit References

- Issue #6: `bg-muted`, `text-foreground`, `text-muted-foreground` (shadcn tokens)
- Issue #7: `text-text` standalone (should be `text-text-primary`)
- Issue #8: `bg-bg-primary`, `bg-bg-canvas-default` (double prefix)

## Token Mapping

Based on `tailwind.config.js` analysis:

| Invalid Token | Correct Token | Rationale |
|--------------|---------------|-----------|
| `bg-muted` | `bg-secondary` | `secondary` maps to `--bg-secondary` in config |
| `text-foreground` | `text-text-primary` | `text.primary` maps to `--text-primary` |
| `text-muted-foreground` | `text-text-muted` | `text.muted` maps to `--text-muted` |
| `text-text ` (standalone) | `text-text-primary` | Explicit is better than implicit |
| `bg-bg-primary` | `bg-panel` | Double prefix; `panel` maps to `--bg-panel` |
| `bg-bg-canvas-default` | `bg-canvas-default` | Remove extra `bg-` prefix |

## Related Code Files

### Files with `bg-muted` / `text-foreground` / `text-muted-foreground`:
- `client/src/components/FindReplaceBar.jsx`
- `client/src/components/AnimationTimeline.jsx`
- `client/src/components/SlideCanvas.jsx`

### Files with `text-text` standalone:
- `client/src/components/AICopywriterModal.jsx`
- `client/src/components/AIGeneratorModal.jsx`
- `client/src/components/AITranslateModal.jsx`
- `client/src/components/ShareModal.jsx`
- `client/src/components/SyncModal.jsx`
- `client/src/components/GitHubPushModal.jsx`
- `client/src/components/MediaLibraryModal.jsx`
- `client/src/components/HistoryModal.jsx`
- `client/src/components/MiniToolbar.jsx`

### Files with `bg-bg-*` double prefix:
- `client/src/pages/HomePage.jsx`
- `client/src/pages/SettingsPage.jsx`
- `client/src/pages/ExplorePage.jsx`
- `client/src/components/SlidePanel.jsx`

## Implementation Steps

### Step 3.1 — Fix shadcn token files (3 files)

**FindReplaceBar.jsx:**
```diff
# Line 147: find input
- className="find-input flex-1 bg-muted border border-border text-foreground ..."
+ className="find-input flex-1 bg-secondary border border-border text-text-primary ..."

# Line 155: find count
- className="find-count text-[11px] text-muted-foreground ..."
+ className="find-count text-[11px] text-text-muted ..."
```

**AnimationTimeline.jsx:**
```diff
# Lines 110, 136: step containers
- className="min-w-[140px] bg-muted border border-border ..."
+ className="min-w-[140px] bg-secondary border border-border ..."

# Lines 111, 140: step labels
- className="text-[11px] font-semibold text-muted-foreground ..."
+ className="text-[11px] font-semibold text-text-muted ..."

# Lines 116, 145: element items
- className="... text-foreground"
+ className="... text-text-primary"
```

**SlideCanvas.jsx:**
```diff
# Line 1376: zoom input
- className="bg-muted border border-border text-foreground ..."
+ className="bg-secondary border border-border text-text-primary ..."
```

### Step 3.2 — Fix `text-text` standalone (~9 files)

Global search-and-replace pattern:
- `text-text ` → `text-text-primary ` (note trailing space to avoid matching `text-text-primary`)
- `text-text"` → `text-text-primary"` (end of className string)

**IMPORTANT:** Do NOT replace `text-text-primary`, `text-text-secondary`, `text-text-muted` — only standalone `text-text`.

Files to process:
1. `AICopywriterModal.jsx`
2. `AIGeneratorModal.jsx`
3. `AITranslateModal.jsx`
4. `ShareModal.jsx`
5. `SyncModal.jsx`
6. `GitHubPushModal.jsx`
7. `MediaLibraryModal.jsx`
8. `HistoryModal.jsx`
9. `MiniToolbar.jsx`

### Step 3.3 — Fix double-prefix tokens (~4 files)

**HomePage.jsx, SettingsPage.jsx, ExplorePage.jsx:**
```diff
- className="h-full flex flex-col bg-bg-primary"
+ className="h-full flex flex-col bg-panel"
```

**SlidePanel.jsx:**
```diff
- className="... bg-bg-canvas-default ..."
+ className="... bg-canvas-default ..."
```

## Success Criteria

- [ ] Zero instances of `bg-muted` in codebase (grep verification)
- [ ] Zero instances of `text-foreground` in codebase
- [ ] Zero instances of `text-muted-foreground` in codebase
- [ ] Zero instances of standalone `text-text ` or `text-text"` (excluding `text-text-primary/secondary/muted`)
- [ ] Zero instances of `bg-bg-` double prefix
- [ ] All replaced tokens exist in `tailwind.config.js`
- [ ] `npm run build` passes
- [ ] Visual spot-check: colors render correctly in dark mode

## Verification

1. `npm run build` — zero errors
2. Grep verification:
   ```bash
   grep -r "bg-muted" client/src/ --include="*.jsx"       # expect 0
   grep -r "text-foreground" client/src/ --include="*.jsx"  # expect 0
   grep -r "text-muted-foreground" client/src/ --include="*.jsx"  # expect 0
   grep -r "bg-bg-" client/src/ --include="*.jsx"          # expect 0
   ```
3. Browser subagent: Open Find/Replace bar → check text colors
4. Browser subagent: Open Animation Timeline → check step labels
5. Browser subagent: Check page backgrounds match between light/dark

## Risk Assessment

- **LOW:** Token replacements are mechanical — one-to-one mapping
- **CAUTION:** `text-text` regex must be precise — avoid breaking `text-text-primary`
- **NOTE:** Some `text-text` instances may be inside template strings or conditional — check each occurrence manually

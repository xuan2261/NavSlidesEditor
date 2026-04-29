# Phase 05 — Emoji → Lucide Icons + CSS Polish

## Priority: 🟢 LOW

## Status: ⬜ Not started

## Effort: Small (~1h)

## Impact: ⭐⭐⭐

## Overview

Thay thế emoji icons trong toolbar/slide panel bằng Lucide SVG icons để đảm bảo visual consistency, cross-platform rendering, và professional appearance.

## Key Insights

### Emoji Icons cần thay (Toolbar.jsx)

| Current               | Location           | Replacement Lucide Icon                                |
| --------------------- | ------------------ | ------------------------------------------------------ |
| `📁` Media text       | L234 area          | Already has `FolderOpen` variant → dùng icon thay text |
| `✏` Drawing icon      | SlidePanel L338    | `Pencil`                                               |
| `↗` Line/Arrow icon   | SlidePanel L352    | `ArrowUpRight`                                         |
| `☰` Chart icon       | SlidePanel L280    | `BarChart3`                                            |
| `★` Icon icon         | SlidePanel L323    | `Star`                                                 |
| `⊞` Table button      | Toolbar L1630      | `Table2` (đã import)                                   |
| `∑` Math inline       | Toolbar L1736      | `Sigma` từ Lucide                                      |
| `∫` Math display      | Toolbar L1750      | `FunctionSquare` hoặc giữ serif char                   |
| `←L`, `↔`, `R→`, etc. | Toolbar L1112-1119 | Lucide alignment icons                                 |

### Alignment text labels → Lucide icons

| Current Text      | Lucide Replacement      |
| ----------------- | ----------------------- |
| `←L` Align left   | `AlignStartVertical`    |
| `↔` Center H      | `AlignCenterHorizontal` |
| `R→` Align right  | `AlignEndVertical`      |
| `↑T` Align top    | `AlignStartHorizontal`  |
| `↕` Center V      | `AlignCenterVertical`   |
| `B↓` Align bottom | `AlignEndHorizontal`    |
| `⇔` Distribute H  | `Columns3` hoặc custom  |
| `⇕` Distribute V  | `Rows3` hoặc custom     |

---

## Related Code Files

### Files to modify:

- `client/src/components/Toolbar.jsx` — Replace emoji/text labels with Lucide icons
- `client/src/components/SlidePanel.jsx` — Replace emoji in slide thumbnails
- `client/src/index.css` — Minor style adjustments

---

## Implementation Steps

### Step 1: Add new Lucide imports to Toolbar.jsx

```jsx
import {
  // existing...
  Pencil, // for Draw
  ArrowUpRight, // for Line/Arrow
  Star, // for Icon
  Sigma, // for Math inline
  BarChart3, // for Chart (if not already)
  AlignStartVertical,
  AlignEndVertical,
  AlignCenterHorizontal,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignCenterVertical,
} from 'lucide-react'
```

### Step 2: Replace alignment labels (Toolbar.jsx ~L1111-1129)

```jsx
// Before:
['left', '←L', 'Align left'],
['center-h', '↔', 'Center H'],
// ...

// After:
['left', AlignStartVertical, 'Align left'],
['center-h', AlignCenterHorizontal, 'Center H'],
['right', AlignEndVertical, 'Align right'],
['top', AlignStartHorizontal, 'Align top'],
['center-v', AlignCenterVertical, 'Center V'],
['bottom', AlignEndHorizontal, 'Align bottom'],
['distribute-h', Columns3, 'Distribute H'],
['distribute-v', Rows3, 'Distribute V'],

// Render:
{label}  →  <Icon size={13} />
```

### Step 3: Replace table button emoji (Toolbar.jsx ~L1630)

```jsx
// Before:
<button ... style={{ fontSize: 13 }}>⊞</button>

// After:
<button ...><Table2 size={14} /></button>
```

### Step 4: Replace SlidePanel emoji thumbnails (~L280-370)

```jsx
// Chart: ☰ → <BarChart3 size={8} />
// Drawing: ✏ → <Pencil size={8} />
// Line: ↗ → <ArrowUpRight size={8} />
// Icon: ★ → <Star size={8} />
```

### Step 5: CSS Polish — minor improvements

```css
/* Increase btn-icon min size for touch targets */
.btn-icon {
  min-width: 32px;
  min-height: 32px;
}

/* Improve toolbar gap between groups */
.toolbar-divider {
  margin: 0 6px; /* was 0 4px */
}

/* Add subtle transition to all toolbar buttons */
.btn-icon {
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}
.btn-icon:active {
  transform: scale(0.95);
}
```

---

## Todo List

- [ ] Add new Lucide icon imports
- [ ] Replace alignment text labels → Lucide icons
- [ ] Replace `⊞` table button → `Table2` icon
- [ ] Replace `∑` / `∫` math buttons (optional — serif chars acceptable)
- [ ] Replace SlidePanel emoji in thumbnails
- [ ] Adjust CSS: btn-icon min-size, toolbar-divider margin
- [ ] Cross-browser test: verify icons render correctly

## Success Criteria

1. Zero emoji characters used for functional icons
2. All icons are Lucide SVG → consistent sizing and color
3. Touch targets >= 32px
4. Professional, uniform visual appearance

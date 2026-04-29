# Phase 1 — UI/UX Overhaul

## Overview

- **Priority**: P1
- **Status**: ✅ Complete (core) — minor polish deferred
- **Effort**: 2-3 tuần
- **Dependencies**: Phase 0 (Foundation Refactor)
- **Mục tiêu**: Giao diện professional-grade, hiện đại, dễ sử dụng

## Key Insights

slides.com có UI rất clean với:

- Dashboard grid view + list view + search/filter
- Editor toolbar gọn, contextual (thay đổi theo element được chọn)
- Smooth transitions, micro-animations
- Dark theme mặc định, professional color palette

Dự án hiện tại:

- HomePage đơn giản, chỉ có grid thumbnails
- Không search, không filter, không sort
- Không categories/folders
- Preset themes hardcoded 500+ LOC trong HomePage
- Toolbar đơn, không responsive

## Implementation Steps

### 1. Dashboard Redesign (`HomePage.jsx`)

#### 1.1 Header Bar

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 Slides Editor          [Search...]    [⚙ Settings] [+]  │
└─────────────────────────────────────────────────────────────┘
```

- Logo + app name
- Global search bar (search presentations by title)
- Quick-access settings button → navigate to /settings
- New Presentation button (prominent)

#### 1.2 Sidebar Navigation

```
┌──────────┬──────────────────────────────────────────────────┐
│ Recent   │                                                  │
│ All      │        Presentations Grid                        │
│ ──────── │                                                  │
│ Templates│        [Card] [Card] [Card]                      │
│  Built-in│        [Card] [Card] [Card]                      │
│  My      │                                                  │
│ ──────── │                                                  │
│ Trash    │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

- **Recent**: Last 10 opened presentations
- **All**: All presentations
- **Templates**: Sub-sections for Built-in và My Templates
- **Trash**: Soft-delete, restore trong 30 ngày

#### 1.3 Presentation Cards (Improved)

```
┌──────────────────────────┐
│   [Slide Preview Area]   │  ← Live mini canvas preview
│                          │
├──────────────────────────┤
│ Presentation Title       │
│ 12 slides · Apr 14, 2026 │
│ [Edit] [Present] [⋮]    │  ← More menu: duplicate, export, share, delete
└──────────────────────────┘
```

- Hover effect: scale up + shadow
- Context menu (right-click): Edit, Duplicate, Export, Share, Delete
- Grid/List toggle view
- Sort by: Name, Date created, Date modified, Slides count

#### 1.4 Template Gallery (Enhanced)

```
┌───────────────────────────────────────────────────────┐
│ Template Gallery                            [Search]  │
├───────────────────────────────────────────────────────┤
│ Categories: [All] [Quân sự] [Kỹ thuật] [Chiến thuật] │
│            [Academic] [Corporate] [Creative] [Blank]  │
├───────────────────────────────────────────────────────┤
│ [Template] [Template] [Template] [Template]           │
│ [Template] [Template] [Template] [Template]           │
└───────────────────────────────────────────────────────┘
```

### 2. Editor UI Improvements

#### 2.1 Toolbar Redesign

Tách toolbar thành sections rõ ràng:

```
┌─────────────────────────────────────────────────────────────────┐
│ [← Home] [Title...              ] [Save ✓] [Present] [Export ▾]│
├─────────────────────────────────────────────────────────────────┤
│ INSERT:                  │ FORMAT:                    │ VIEW:   │
│ [Text][Image][Shape ▾]   │ [B][I][U][S][Color][Align] │ [Grid]  │
│ [Code][LaTeX][Chart ▾]   │ [Font ▾][Size ▾]           │ [Ruler] │
│ [Video][Table][Icon ▾]   │ [Link][List ▾]             │ [Snap]  │
└─────────────────────────────────────────────────────────────────┘
```

- **Top bar**: Navigation + title edit + save status + actions
- **Second bar**: Insert tools | Format tools (contextual) | View toggles
- Format section changes based on selected element type
- Dropdowns for grouped items (Shape types, Chart types, etc.)

#### 2.2 Properties Panel Redesign

```
┌──────────────────────┐
│ Element Properties   │
├──────────────────────┤
│ ▼ Position & Size    │  ← Collapsible sections
│   X: [120] Y: [80]  │
│   W: [400] H: [300] │
│   Rotation: [0°]    │
├──────────────────────┤
│ ▼ Style              │
│   Fill: [■ #333]     │
│   Stroke: [■ #fff]   │
│   Opacity: [═══○] 80%│
│   Shadow: [toggle]   │
├──────────────────────┤
│ ▼ Text               │
│   (text-specific)    │
├──────────────────────┤
│ ► Advanced           │  ← Collapsed by default
│   (z-index, lock...) │
└──────────────────────┘
```

#### 2.3 Slide Panel Improvements

- Larger thumbnails (150px width)
- Drag-to-reorder with visual indicator
- Slide number badge
- Hidden slide indicator (strikethrough number)
- Right-click context menu: Add, Duplicate, Delete, Hide, Move to...
- Section dividers (drag slide to create section break)

### 3. Design System / CSS Overhaul

#### 3.1 Color Palette Update

```css
:root {
  /* Primary */
  --color-primary: #6366f1; /* Indigo-500 */
  --color-primary-hover: #4f46e5;
  --color-primary-light: rgba(99, 102, 241, 0.15);

  /* Surface (Dark) */
  --surface-0: #0f0f14; /* App background */
  --surface-1: #16161d; /* Panels */
  --surface-2: #1e1e28; /* Cards */
  --surface-3: #262632; /* Inputs, hover */
  --surface-4: #2e2e3c; /* Active items */

  /* Text */
  --text-primary: #f0f0f5;
  --text-secondary: #9494a8;
  --text-muted: #5c5c72;

  /* Accent */
  --accent-green: #22c55e;
  --accent-amber: #f59e0b;
  --accent-red: #ef4444;

  /* Border */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.16);

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

#### 3.2 Micro-Animations

```css
/* Card hover */
.presentation-card {
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}
.presentation-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Button press */
.btn {
  transition:
    transform 100ms ease,
    background var(--transition-fast);
}
.btn:active {
  transform: scale(0.97);
}

/* Panel slide */
.panel-enter {
  animation: slideIn 200ms ease-out;
}
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
}

/* Tooltip fade */
.tooltip {
  animation: fadeIn 150ms ease;
}
```

#### 3.3 Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family:
    'Inter',
    -apple-system,
    system-ui,
    sans-serif;
}
h1 {
  font-weight: 700;
  letter-spacing: -0.02em;
}
h2 {
  font-weight: 600;
  letter-spacing: -0.01em;
}
.label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
```

### 4. Empty States & Onboarding

#### 4.1 Welcome Screen (First Visit)

```
┌─────────────────────────────────────────┐
│         Welcome to Slides Editor        │
│                                         │
│   [🚀 Create your first presentation]  │
│   [📂 Browse template gallery]         │
│   [📖 Quick start guide]              │
│                                         │
│   Features: WYSIWYG · LaTeX · Charts   │
│   Export: HTML · PDF · PPTX             │
└─────────────────────────────────────────┘
```

#### 4.2 Empty State Icons

- No presentations → large icon + CTA
- No search results → "No matches" illustration
- Empty slide → "Click to add content" center text

### 5. Responsive Behavior

- **< 1200px**: Properties panel becomes a slide-over from right
- **< 900px**: Slide panel collapses to icons-only
- **< 768px**: Show "Desktop recommended" message for editing; present mode works full-screen

## Files to Create/Modify

| File                                                   | Action                           |
| ------------------------------------------------------ | -------------------------------- |
| `client/src/index.css`                                 | MAJOR MODIFY — new design system |
| `client/src/pages/HomePage.jsx`                        | MAJOR MODIFY — full redesign     |
| `client/src/components/dashboard/`                     | NEW directory                    |
| `client/src/components/dashboard/DashboardSidebar.jsx` | NEW                              |
| `client/src/components/dashboard/PresentationCard.jsx` | NEW                              |
| `client/src/components/dashboard/TemplateGallery.jsx`  | NEW                              |
| `client/src/components/dashboard/SearchBar.jsx`        | NEW                              |
| `client/src/components/editor/ToolbarTop.jsx`          | NEW                              |
| `client/src/components/editor/ToolbarInsert.jsx`       | NEW                              |
| `client/src/components/editor/ToolbarFormat.jsx`       | NEW                              |
| `client/src/components/panels/PropertiesPanel.jsx`     | MAJOR MODIFY                     |
| `client/src/components/panels/PositionSection.jsx`     | NEW                              |
| `client/src/components/panels/StyleSection.jsx`        | NEW                              |

## Todo List

- [x] Design system CSS overhaul (colors, typography, spacing, shadows)
- [x] Dashboard sidebar navigation component
- [x] Presentation card redesign with hover effects
- [x] Search bar with filter functionality
- [x] Grid/List view toggle
- [x] Sort controls (name, date, slides)
- [x] Template gallery with categories
- [x] Toolbar visual grouping with dividers
- [x] Properties panel with collapsible sections
- [ ] Slide panel improvements (larger thumbs, context menu)
- [x] Empty states and onboarding
- [x] Micro-animations (hover, press, slide-in)
- [x] Light theme verified
- [x] Soft-delete (trash) feature
- [x] Responsive breakpoints

## Success Criteria

- [ ] Dashboard looks professional, comparable to slides.com
- [ ] Search finds presentations by title
- [ ] Templates browsable by category
- [ ] Smooth micro-animations on all interactive elements
- [ ] Toolbar is contextual based on selected element
- [ ] Properties panel sections are collapsible
- [ ] No visual regressions in editor functionality

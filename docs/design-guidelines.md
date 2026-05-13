# Design Guidelines — NavSlides Editor

## Layout

The editor uses a fixed 3-column layout:

```
┌──────────────┬──────────────────────────────┬─────────────────┐
│  SlidePanel  │         SlideCanvas          │ PropertiesPanel │
│  (left)      │         (center)             │  (right)        │
│  thumbnails  │   960×540 scaled canvas      │  per-element    │
│  + CRUD      │   drag / resize / rotate     │  property form  │
└──────────────┴──────────────────────────────┴─────────────────┘
                         Toolbar (top bar)
```

- **Toolbar** spans the full width above the 3-column area
- **FindReplaceBar** overlays the top of the canvas (activated by Ctrl+F)
- **AnimationTimeline** overlays the bottom of the canvas
- **Modals** render inline in `EditorPage` via conditional JSX (not portals)

---

## Color System

All colors are defined as CSS custom properties. Theme is applied via `data-theme` attribute on `<html>`.

### Dark Theme (default)

```css
:root {
  --bg-primary: #14110f; /* main app background */
  --bg-secondary: #1b1714; /* panels, sidebars */
  --bg-card: #241f1a; /* inputs, cards, raised surfaces */
  --text-primary: #f4eee7;
  --text-secondary: #c1b3a6;
  --brand: #c96442; /* primary action color */
  --focus: #4f8ef7; /* keyboard focus */
  --selection: #4f8ef7; /* editor selection */
  --border: rgba(244, 238, 231, 0.08);
  --danger: #ef4444;
}
```

### Light Theme

Overrides via `[data-theme="light"]` selector. The app chrome uses parchment and ivory surfaces, while the authored slide canvas stays pure white through `--bg-canvas-default: #ffffff`.

```css
[data-theme='light'] {
  --bg-primary: #f8f3ea;
  --bg-secondary: #fffaf2;
  --bg-card: #fffdf8;
  --text-primary: #241915;
  --text-secondary: #5f5147;
  --brand: #b95736;
  --focus: #2563eb;
  --selection: #2563eb;
}
```

`--accent` remains an alias for `--brand` for backward compatibility. New UI chrome should use `brand` for CTAs, `focus` for keyboard rings, and `selection` for editor selection or technical active states.

The implementation also defines these supporting tokens in `client/src/index.css`: `--surface-0` through `--surface-4`, `--bg-panel`, `--bg-hover`, `--bg-active`, `--bg-workspace`, `--border-light`, `--border-strong`, `--accent-hover`, `--accent-light`, `--brand-hover`, `--brand-muted`, `--selection-muted`, `--success`, `--danger-hover`, `--warning`, plus shared radius and z-index tokens.

### Theme Toggle

`App.jsx` toggles `data-theme` attribute and persists preference to `localStorage('editor-theme')`. Default is `dark` if no value is stored.

---

## Typography

### Editor UI

- **Primary font**: Inter (system font stack fallback to sans-serif)
- Font sizes follow a scale: 11px (labels), 13px (body), 15px (headings)

### Slide Canvas

Elements can use any of the Google Fonts available in the font picker. The editor loads fonts on demand. Fonts are **not bundled** — they require network access for rendering in the editor and in exported HTML.

Default font families offered in the font picker (verified in Toolbar):

- Inter, Roboto, Open Sans, Lato, Montserrat, Playfair Display, Source Code Pro, Merriweather, Raleway, Oswald, Poppins, Ubuntu

---

## Canvas

- **Fixed logical size**: 960 × 540 px (16:9 aspect ratio). This is a hard constraint — export fidelity depends on it.
- **Auto-scaling**: `SlideCanvas` uses a `ResizeObserver` on the container element. When the container size changes, it computes `scale = containerWidth / 960` and applies `transform: scale(scale)` with `transform-origin: top left`.
- **Coordinate system**: all element `x`, `y`, `width`, `height` values are in logical px at the 960×540 scale.

---

## Element Interaction

### Selection

- Single click on element → select (highlight border + handles)
- Shift+click → add to multi-selection
- Click canvas background → deselect all
- Double-click text element → enter TipTap text-edit mode

### Drag

- Click-drag selected element to reposition
- Smart guides appear when element edge or center aligns within 6px of another element or canvas edge/center
- Snaps to guide position on release

### Resize

- 8 resize handles on selection box
- Shift+drag → maintain aspect ratio
- Images have additional crop mode

### Rotate

- Rotation handle above selection box
- Shift+rotate → snap to 15-degree increments

### Multi-select

- Shift+click elements to build selection
- Move/delete all selected elements together
- Group selected elements → moves/resizes as a unit

### Context Menu

- Right-click element → context menu: copy, cut, paste, delete, lock, z-order, group/ungroup

---

## Component Patterns

### Buttons (5 variants)

| Variant                 | Use                              |
| ----------------------- | -------------------------------- |
| Primary (filled accent) | Main actions: Save, Export, Push |
| Secondary (outlined)    | Secondary actions: Cancel, Back  |
| Ghost (text only)       | Toolbar icon buttons             |
| Danger (red fill)       | Delete, Remove                   |
| Icon button             | Toolbar small icon-only actions  |

- Button variants must declare their border policy explicitly. Secondary buttons use `border border-border`; filled/ghost/icon variants use transparent borders unless a visible border is intentional.
- Icon-only buttons require an accessible name. Prefer explicit `aria-label` at the call site for destructive or context-sensitive actions. The shared Button supports `title` as a fallback for simple icon controls.
- Shared buttons use visible `focus-visible` rings with the blue focus token, not the brand color.
- Avoid broad `transition-all` on shared controls. Use property-specific transitions for color, border, shadow, opacity, or transform changes.

### Panels

- Background: `--bg-secondary`
- Border: 1px `--border` on the edge facing the canvas
- Padding: 12px internal
- Section headers: 11px uppercase label, `--text-secondary`
- Collapsible section headers should be real disclosure buttons with `aria-expanded` and visible keyboard focus. Slide thumbnail actions and selection controls should keep explicit labels and stable focus states.

### Modals

- Centered overlay with backdrop `rgba(0,0,0,0.6)`
- Background: `--bg-secondary`
- Max-width varies by content (400–800px)
- Close via Escape or explicit close button
- Use `role="dialog"`, `aria-modal="true"`, and a labelled title for interactive overlays.
- Move focus into the modal on open and return focus to the invoking control when the modal closes.
- Modal headers and action rows must wrap safely at narrow browser widths. Controls should not create horizontal page overflow.
- Shared `ModalShell` now covers the common dialog contract for migrated modals (`SyncModal`, `HistoryModal`, Home create/confirm, AI generator/copywriter/translate, share, media library, template picker): Escape/backdrop close, focus entry/trap/restore, latest-callback Escape handling after rerenders, and viewport-safe sizing.

### Product Tour

- `ProductTour.jsx` provides an interactive onboarding sequence via React-Joyride.
- Steps use explicit placements (`top`, `bottom`, `left`, `right`) with continuous navigation.
- The tour uses a `Joyride` callback to track completion and avoid manual `close => next` wiring.

### Toolbars

- Background: `--bg-secondary`
- Icon buttons: 32×32px, `--text-secondary` idle, `--text-primary` hover, `--accent` active/selected
- Separator: 1px vertical `--border` between groups
- Dropdowns open below the trigger button
- Toggle buttons must expose `aria-pressed` when they represent stateful editor chrome or active rich-text commands.
- Slide background swatches must be keyboard reachable and carry explicit labels.
- Highlight color controls use `listbox`/`option` semantics instead of plain button groups.
- Keep accessible names stable on icon-only toolbar controls.

### Property Inputs

- Text inputs: full width, `--bg-card` background, `--border` border, 6px radius, blue focus ring
- Text inputs and selects use `focus:border-focus` plus a blue `focus:ring-focus/25` contract.
- Number inputs: typically 60–80px wide with unit label
- Color pickers: small swatch + hex input, with a visible blue focus ring and neutral surface ring offset
- Sliders: custom range input styled with accent color
- Toggles: checkbox-style or pill-switch
- `PropertiesPanel` uses `role="complementary"` with the accessible name `Properties panel`.
- Common property lock/layer actions should use Lucide icons rather than structural emoji or arrow glyphs.

---

## Slide Templates (8 Layouts)

| Template       | Description                     |
| -------------- | ------------------------------- |
| blank          | Empty slide                     |
| title          | Large centered title + subtitle |
| two-column     | Two equal text columns          |
| three-column   | Three equal text columns        |
| image+text     | Image on left, text on right    |
| section-header | Full-width bold section label   |
| comparison     | Side-by-side with divider       |
| big-number     | Large stat/number + caption     |

Templates insert pre-positioned elements at standard canvas coordinates. Users can modify freely after insertion.

---

## Slide Thumbnails (SlidePanel)

- Fixed width left panel
- Each thumbnail is a scaled-down canvas preview (CSS transform)
- Active slide highlighted with accent border
- Drag-to-reorder via drag events
- Add/duplicate/delete controls per thumbnail
- Hidden slides shown with reduced opacity

---

## Animation & Transition

### Fragment Animations

Managed via `AnimationTimeline` (bottom overlay). Each element on a slide can have a fragment index — elements with higher indices appear later in presentation sequence. The timeline shows elements as horizontal blocks ordered by fragment index. Drag to reorder.

The timeline `Preview` action opens an in-editor `AnimationPreviewModal` instead of launching full present mode. The modal renders only the active slide through a Reveal iframe and steps through the slide's real fragment indices, including sparse fragment orders.

### Slide Transitions

Selected per presentation (not per slide). Available: none, fade, slide, convex, concave, zoom. `TransitionPreview` renders a sandboxed iframe with two slides loaded via CDN reveal.js to preview the transition before committing.

---

## Preset Themes (6)

Applied from `HomePage` and affect all element default styles and backgrounds. Color palettes and gradient presets are defined in `shared/src/shared-toolbar-text-bg-color-palette-gradient-presets-config.js`.

| Theme         | Character                                     |
| ------------- | --------------------------------------------- |
| Minimal Dark  | Dark background, white text, clean sans-serif |
| Minimal Light | White background, dark text, clean sans-serif |
| Academic      | Serif fonts, muted tones, formal layout       |
| Gradient      | Vibrant gradient backgrounds                  |
| Corporate     | Structured, blue accent, professional         |
| Neon          | Dark background, bright neon accent colors    |

Applying a preset overwrites the presentation's `theme`, `transition`, and default element styles.

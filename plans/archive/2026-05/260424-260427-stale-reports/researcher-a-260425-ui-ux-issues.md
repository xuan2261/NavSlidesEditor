# Findings: UI/UX Issues After Tailwind CSS Refactor

Sources: `SlidePanel.jsx`, `HomePage.jsx`, `Toolbar.jsx` — all read in full.

---

## [C-02] Slide index hardcoded `text-white/50`
File: `client/src/components/SlidePanel.jsx:207-213`
```jsx
<span className={`absolute top-1 left-1 text-[10px] text-white/50 bg-black/40 px-1 py-[1px] rounded-[3px] z-10 ${slide.locked ? 'line-through opacity-50' : ''}`}>
  {index + 1}
</span>
```
Change needed: Replace `text-white/50` with `text-text-muted` (CSS variable class). `bg-black/40` is also hardcoded dark — use `bg-surface-2` or `bg-primary/20` from the design system.

---

## [H-02] Vertical children `scale-[0.85]` hardcoded
File: `client/src/components/SlidePanel.jsx:388-390`
```jsx
<div className={`group rounded-sm border-2 cursor-pointer relative transition-all hover:border-border-strong mb-0.5 origin-top-left scale-[0.85] ...`}
```
Change needed: Replace `scale-[0.85]` with a CSS variable `--vertical-child-scale: 0.85` and class `scale-[var(--vertical-child-scale)]`. The hardcoded value prevents theming and responsive adjustment. Alternatively, move the scale transform to `transform: scale()` via inline style, and remove `origin-top-left` in favor of `transform-origin: top left` via CSS class — or simply reduce child thumbnail dimensions via width instead of scale.

---

## [M-07] Delete button disabled state visual
File: `client/src/components/SlidePanel.jsx:373`
```jsx
<button className={`... ${slides.length > 1 ? 'text-white' : 'text-white/30'}`} title="Delete" ...>
```
Change needed: Add `disabled={slides.length <= 1}` attribute and `cursor-not-allowed` class when disabled. The visual only changes color to `text-white/30` — no `disabled` attribute, so keyboard accessibility is not blocked. The opacity/pointer feedback is missing entirely.

---

## [A-03] Context menu keyboard nav
File: `client/src/components/SlidePanel.jsx:135-148, 474-551`
```jsx
useEffect(() => {
  if (!ctxMenu) return
  const close = () => setCtxMenu(null)
  const handleKey = (e) => { if (e.key === 'Escape') close() }
  document.addEventListener('mousedown', close)
  document.addEventListener('keydown', handleKey)
  ...
}, [ctxMenu])
```
Change needed: Add `role="menu"`, `role="menuitem"` on buttons, `tabIndex={0}` on first item, and `onKeyDown` handler for `ArrowUp`/`ArrowDown` to move focus between menu items. The menu currently has zero ARIA semantics and no keyboard navigation between items.

---

## [H-01] Import progress/warning inside sidebar
File: `client/src/pages/HomePage.jsx:796-805`
```jsx
{importProgress && (
  <div className="mx-3 mt-2 rounded border border-border bg-card px-2 py-1.5 text-[11px] text-text-secondary">
    {importProgress}
  </div>
)}
{importWarningSummary && (
  <div className="mx-3 mt-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-[11px] text-text-secondary">
    {importWarningSummary}
  </div>
)}
```
Change needed: Both status blocks render inline inside the sidebar nav list. Move `importProgress` and `importWarningSummary` to a fixed status bar (e.g., a `div` pinned to the sidebar bottom, outside the nav `<nav>` element) to avoid structural confusion and ensure visibility regardless of scroll.

---

## [H-04] List view double onClick risk
File: `client/src/pages/HomePage.jsx:1317-1321`
```jsx
<div key={pres.id} className="group flex items-center gap-4 px-4 py-3 rounded cursor-pointer transition-colors hover:bg-hover"
  onClick={() => onOpen(pres.id)}   // <-- opens on row click
>
  ...
  <div className="flex justify-end gap-1 px-3 py-2 border-t border-border">
    <Button ... onClick={(e) => { e.stopPropagation(); onOpen(pres.id) }} ...> {/* stopProp + open */}
    <Button ... onClick={(e) => handleDuplicate(e, pres.id)} ...>
    <Button ... onClick={(e) => handleDelete(e, pres.id)} ...>
```
Change needed: The entire row is clickable (opens presentation). The action buttons are nested inside the clickable row. The Edit button also calls `onOpen`. Remove `onClick` from the outer row container; put `onClick={() => onOpen(pres.id)}` only on the title area or thumbnail. The action buttons already use `stopPropagation` so they won't bubble, but the structural risk remains if any button's handler fails silently.

---

## [M-03] No search clear button
File: `client/src/pages/HomePage.jsx:630-641`
```jsx
<div className="relative w-full max-w-md">
  <Search size={15} className="absolute left-[11px] top-1/2 ... pointer-events-none" />
  <Input className="w-full pl-9" type="text" placeholder="Search presentations..."
    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
</div>
```
Change needed: Add a clear (X) button inside the input when `searchQuery` is non-empty: `<button onClick={() => setSearchQuery('')} ...>` positioned `absolute right-2 top-1/2 -translate-y-1/2`. Same fix needed for the marketplace search input at line 1073-1083.

---

## [M-06] Hardcoded `en-US` date format
File: `client/src/pages/HomePage.jsx:163-167`
```jsx
function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
```
Change needed: Replace `'en-US'` with `navigator.language` or a locale from `Intl.DateTimeFormat().resolvedOptions().locale` to respect user/browser locale. Alternatively, expose a locale config prop.

---

## [M-08] Modal z-index hardcoded `10000`
File: `client/src/pages/HomePage.jsx:1382-1383, 1526-1527`
```jsx
className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
```
Change needed: Define a CSS variable `--z-modal: 10000` in `:root` of `globals.css` (or the relevant Tailwind config), then use `z-[var(--z-modal)]` or a custom class. Two instances exist: create modal (line 1383) and confirm dialog (line 1527). A centralized token prevents stacking conflicts.

---

## [H-03] BG popup viewport overflow
File: `client/src/components/Toolbar.jsx:387-389`
```jsx
<div className="bg-popup-container absolute left-0 top-full mt-1 w-[260px] rounded-lg border border-border bg-card p-3 shadow-xl z-[1000]"
```
Change needed: Add `max-h-[80vh] overflow-y-auto` to prevent overflow when popup is near the bottom of the viewport. Also add `data-popup="bg-menu"` attribute (or `id`) for reliable close-on-outside-click targeting. The close handler at line 201-208 uses `e.target.closest?.('.bg-popup-container')` which is fragile — replace with a stable `id` or `data-attribute`.

---

## [M-05] Color swatch border logic hardcoded
File: `client/src/components/Toolbar.jsx:430-436`
```jsx
className={`w-full aspect-square rounded cursor-pointer ${
  bg.color === color
    ? 'border-2 border-white'
    : color === '#ffffff' || color === '#f8f9fa'
        ? 'border border-border'
        : 'border border-transparent'
}`}
```
Change needed: Replace `color === '#ffffff' || color === '#f8f9fa'` with a `Set`-based lookup matching `LIGHT_PRESET_COLORS` already defined in HomePage (line 161). Create a shared `LIGHT_BG_COLORS` Set in a shared utils file, import it, and use `.has(color)` for the light-color border check. This centralizes the light-color logic.

---

## [C-04] `COLOR_PALETTE` hardcoded constants
File: `client/src/components/Toolbar.jsx:52-108`
```jsx
const COLOR_PALETTE = ['#ffffff', '#e2e8f0', ...]
const COLOR_SWATCHES_BG = ['#1e1e2e', ...]
const GRADIENT_PRESETS_BG = ['linear-gradient(135deg, #1e1e2e, #4a0e8f)', ...]
```
Change needed: Move all three constants to a shared config file (e.g., `shared/src/colorConfig.js`) and import them in `Toolbar.jsx`. This prevents duplication (HomePage already has `LIGHT_PRESET_COLORS` as a Set) and makes palettes editable via a single source.

---

## [A-02] Color palette no ARIA role attribute
File: `client/src/components/Toolbar.jsx:874-919`
```jsx
{showColorPalette && (
  <div onMouseDown={(e) => e.stopPropagation()}
    className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-[1000] bg-card border border-border rounded-lg p-2 shadow-xl grid grid-cols-[repeat(8,22px)] gap-[3px]"
  >
    {COLOR_PALETTE.map((color) => (
      <Button ... />
    ))}
```
Change needed: Add `role="grid"` on the popup div, `role="gridcell"` on each swatch Button, and `aria-label={color}` for screen readers. Also add `aria-expanded`, `aria-haspopup="true"` on the toggle Button, and `aria-label="Text color palette"` on the popup container.

---

## Dependency Map

| Issue | Depends on | Relationship |
|---|---|---|
| [C-04] COLOR_PALETTE hardcoded | [M-05] border logic | M-05 reuses the same constants; both should be centralized |
| [M-08] Modal z-10000 | None | Standalone, low risk |
| [H-01] Import status in sidebar | None | Standalone reflow |
| [M-03] Search clear button | None | Standalone UX addition |
| [H-03] BG popup overflow | None | Standalone viewport fix |
| [A-02] Color palette ARIA | None | Standalone a11y |
| [C-02] text-white/50 | None | Standalone color fix |
| [M-06] en-US date format | None | Standalone i18n |
| [M-07] Delete disabled | None | Standalone a11y |
| [A-03] Context menu keyboard | None | Standalone a11y |
| [H-02] scale-[0.85] | None | Standalone CSS var |
| [H-04] List view onClick | None | Standalone interaction |

**No cross-file dependencies** — all 12 issues are self-contained. [C-04] and [M-05] share the same file (`Toolbar.jsx`) but are independent fixes.

## Unresolved Questions

- **[H-02]**: Should `--vertical-child-scale` be configurable via a theme setting, or just a CSS variable with a default?
- **[M-06]**: Should date formatting be localized to Vietnamese (`vi-VN`) by default given the project's user base, or follow browser locale?
- **[H-04]**: The list view row action buttons share the same `onOpen` path as the row click — should Edit button be removed from list rows to reduce redundancy?

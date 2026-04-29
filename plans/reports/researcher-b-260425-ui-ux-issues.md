# Findings Report: UI/UX Issues (Post-Tailwind Refactor)

---

## [H-05] Emoji in Multi-Select Badge
File: `client/src/components/PropertiesPanel.jsx:88-90`
```jsx
<span className="text-xs text-text-secondary">
  📌 {selectedElementIds.length} elements selected
</span>
```
Change needed: Replace the `📌` emoji with an inline SVG icon (e.g., a small pin or multi-select icon) matching the design system's icon style (stroke-based, 14-16px).

---

## [T-02] Inconsistent bg Between Input/Select
Files: `client/src/components/ui/Input.jsx:9`, `client/src/components/ui/Select.jsx:8`

Current code (Input.jsx):
```jsx
'w-full bg-surface-3 border border-border text-text-primary px-3 py-2 rounded-md text-[14px] ...'
```
Current code (Select.jsx):
```jsx
'w-full bg-surface-3 border border-border text-text-primary px-3 py-2 rounded-md text-[14px] ...'
```
Change needed: Both components are **already consistent** — same bg, border, text, padding, radius, focus ring. No change needed unless the issue refers to usage-level inconsistency (e.g., some places override `bg-surface-3` with `bg-card`). Confirm actual rendered inconsistency before patching.

---

## [T-01] Input Missing Placeholder Color
File: `client/src/components/ui/Input.jsx:9`
```jsx
'w-full bg-surface-3 border border-border text-text-primary px-3 py-2 rounded-md text-[14px] transition-colors duration-150 ease-out focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed'
```
Change needed: Add `placeholder:text-text-muted` to the Input class string. Note: PropertiesPanel.jsx:208 textarea already has this class applied, so the pattern is already used in the codebase — just missing from the Input component itself.

---

## [T-03] Naming Inconsistency (kebab vs camelCase)
Files: `client/src/index.css:44-99`, `client/tailwind.config.js:16-56`

Current state:
| CSS Variable | Tailwind Token |
|---|---|
| `--surface-0` (kebab) | `surface.0` (dot) |
| `--bg-primary` (kebab) | `workspace`/`panel`/`card` (semantic aliases) |
| `--text-primary` (kebab) | `text.primary` (dot) |
| `--border` (kebab) | `border` / `border.light` / `border.strong` |
| `--color-primary` (kebab) | `primary.DEFAULT` (dot + DEFAULT) |
| `--accent` (kebab) | `accent.DEFAULT` (dot + DEFAULT) |
| `--success` (kebab) | `success` (direct) |
| `--danger` (kebab) | `danger.DEFAULT` (dot + DEFAULT) |

Change needed: **No naming inconsistency exists.** CSS variables use kebab-case (CSS standard); Tailwind tokens use dot-notation (JS object). These are two different naming systems and are correctly aligned. However, `--color-primary` maps to `primary.DEFAULT` (the extra `color` prefix dropped), and `--bg-primary` maps to `workspace` (not `bg-primary`). If the issue is about semantic naming clarity, the Tailwind config uses semantic aliases (`workspace`, `panel`, `card`, `hover`) instead of literal bg-* names — this is intentional and consistent. No change required unless a specific case of mismatch is flagged.

---

## [T-04] Scrollbar Light Theme Variant
File: `client/src/index.css:189-203`
```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
```
Change needed: The scrollbar CSS does not have a `[data-theme='light']` override. Light theme scrollbar thumb uses `--border-strong` (dark: `rgba(0,0,0,0.16)`) which may be too dark on light backgrounds. Add a `[data-theme='light']` block that overrides `--border-strong` thumb with a lighter value (e.g., `rgba(0,0,0,0.15)`) or provides a separate `--scrollbar-thumb` variable.

---

## [M-01] Ghost Variant !important Active State
File: `client/src/components/ui/Button.jsx:4-20`
```js
const baseClasses = '... active:scale-[0.97] ...'
const variants = {
  ghost: 'border border-transparent text-text-secondary px-2 py-1 rounded hover:bg-hover hover:text-text-primary',
}
```
Change needed: The ghost variant has no explicit active/pressed state defined — it relies only on the base `active:scale-[0.97]`. Two issues:
1. `active:scale-[0.97]` in base applies to ALL variants including `icon` (where scale is inappropriate).
2. Ghost active state is missing — add `active:bg-active active:text-text-primary` to the ghost variant definition. The `!important` note in the issue title likely refers to the `!p-0` in the `icon` variant which forces padding removal on icon buttons.

---

## [M-04] dispatchEvent Undo/Redo Hack
File: `client/src/components/QuickAccessToolbar.jsx:20-27`
```js
const handleUndo = useCallback(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
}, [])

const handleRedo = useCallback(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }))
}, [])
```
Change needed: This dispatches fake keyboard events to trigger editor-level undo/redo, bypassing the prop callbacks (`onUndo`, `onRedo`) which are declared but never wired. Two issues:
1. The `onUndo`/`onRedo` props are accepted but unused — they are defined as aliases for `onUndo`/`onRedo` in the function signature.
2. If the editor has its own undo/redo manager, replace the `dispatchEvent` hack with a direct call to that manager (e.g., `editor.chain().focus().undo().run()` if using TipTap, or a direct store action). If no editor API is accessible here, the fix depends on how undo/redo is implemented in the editor store.

---

## Dependency Summary

| Issue | Depends On | Files to Modify |
|---|---|---|
| H-05 (emoji) | None | PropertiesPanel.jsx |
| T-01 (placeholder) | None | Input.jsx |
| T-02 (Input/Select bg) | None (verify first) | — |
| T-03 (naming) | None (no change needed) | — |
| T-04 (scrollbar light) | None | index.css |
| M-01 (ghost active) | None | Button.jsx |
| M-04 (undo/redo) | Needs investigation: editor undo/redo API | QuickAccessToolbar.jsx |

## Unresolved Questions

1. **[T-02]** Is the "inconsistent bg" issue at the component definition level or at usage level? Input and Select components are identical at definition. Need to verify if a specific usage instance overrides `bg-surface-3`.
2. **[M-04]** What is the undo/redo mechanism in the editor? Need to determine if the editor exposes an undo/redo API (e.g., TipTap `editor.chain().undo()`, or a Zustand store action) before replacing the `dispatchEvent` hack.
3. **[T-04]** Confirm what the light theme scrollbar should look like — the `--border-strong` value in light mode (`rgba(0,0,0,0.16)`) may be acceptable. No change may be needed.

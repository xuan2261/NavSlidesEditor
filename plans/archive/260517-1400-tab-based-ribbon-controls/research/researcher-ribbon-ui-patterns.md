# Research Report: Ribbon UI Patterns

**Date:** 2026-05-17
**Researcher:** researcher-ribbon

## 1. React Ribbon Component Architecture

**Recommendation: Radix UI Tabs + Tailwind styling (shadcn/ui pattern).**

- Use `activationMode="manual"` — user must click/Enter to activate tab, prevents accidental switches
- Store active tab in `ui-store.js` (`activeTab: 'home'`)
- Section separators: `<span className="mx-2 h-6 w-[1px] bg-border" />`
- No third-party ribbon library — heavy, commercial, clashes with Tailwind

## 2. ARIA Tablist/Tab/Tabpanel Pattern

Radix handles automatically. Key contract:
- `tablist` on container, `tab` on triggers, `tabpanel` on content
- Keyboard: Left/Right arrows, Home/End, Enter/Space
- Roving tabindex: active tab `tabindex="0"`, others `tabindex="-1"`
- Lazy rendering: Radix TabsContent does NOT render inactive panels by default

## 3. Responsive Ribbon Design

| Viewport | Behavior |
|----------|----------|
| >1024px | Full ribbon with labels + icons |
| 768-1024px | Icon-only tabs, reduced padding |
| <768px | Horizontal scroll, compact layout, 44px touch targets |

- Tab list: `overflow-x: auto; scrollbar-width: none`
- Do NOT collapse to hamburger menu — kills discoverability

## 4. Contextual Tab Pattern (Format Tab)

- Content changes based on selection type, not tab visibility
- "No selection" state: show muted placeholder, keep tab visible
- Reuse `ElementTypeProperties` router from PropertiesPanel

## 5. TipTap Selection Preservation

**Critical:** Every ribbon button affecting text must use `onMouseDown` with `preventDefault()`, NOT `onClick`.

Pattern (already in Toolbar.jsx:149-183):
1. `rememberSelection()` — save `{from, to}` before interaction
2. `getSelectionChain()` — restore focus + selection before command
3. `handleTextCommandMouseDown(command)` — `e.preventDefault()` stops focus theft

## 6. Shared Control Extraction

**Recommendation: Custom hooks + shared control components.**

- `useTextFormatting(editor)` — bold/italic/color state + actions
- `useElementFormatting(element, onUpdate)` — fill/stroke/opacity
- Shared components: `ColorButton`, `AlignmentGroup`, `FontSizeInput`, `BoldItalicUnderline`
- Why hooks over render props: composable, testable, no callback hell

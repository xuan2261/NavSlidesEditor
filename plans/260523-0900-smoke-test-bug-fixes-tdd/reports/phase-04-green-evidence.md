# Phase 04 — GREEN Evidence (I-001 Sticky Trash Sidebar)

Date: 2026-05-23

## Summary

I-001 fix applied in `client/src/pages/HomePage.jsx`. Trash entry now uses `position: sticky bottom-0` with a solid background and z-index, so it remains visible at any viewport height and regardless of how verbose the import-warning text becomes.

## Change Applied

`client/src/pages/HomePage.jsx`, lines 854-893 region:

- **Trash block** wrapped with `sticky bottom-0 bg-secondary z-10 px-3 mb-2 pt-2 border-t border-border/40` (previously `px-3 mb-2`).
- **Import progress / warnings block** dropped `mt-auto` and now flows in normal order beneath the Trash entry.

```jsx
<div className="sticky bottom-0 bg-secondary z-10 px-3 mb-2 pt-2 border-t border-border/40">
  <Button variant="ghost" ...>
    <Trash size={16} />
    <span>Trash</span>
    {trashItems.length > 0 && <span ...>{trashItems.length}</span>}
  </Button>
</div>

<div className="px-3 pb-2">
  {importProgress && ...}
  {importWarningSummary && ...}
</div>
```

### Theme-token deviation from plan

Plan suggested `bg-background`. That token is **not defined** in `client/tailwind.config.js` (no `background` key in `colors`). The sidebar `<nav>` itself uses `bg-secondary` (line 715). Used `bg-secondary` to visually blend the sticky Trash with the parent nav — preserves plan intent (solid background, no scroll-content bleed-through) without referencing a non-existent token.

## Parent scroll container check (Step 4.2)

`HomePage.jsx:715` — `<nav className="w-[var(--sidebar-width)] shrink-0 bg-secondary border-r border-border flex flex-col overflow-y-auto py-3">`. `overflow-y-auto` makes the nav a scroll container, which is required for `position: sticky` to bind. No edit needed.

## Lint

```
$ npm run lint
✖ 96 problems (0 errors, 96 warnings)
```

0 errors. All 96 warnings pre-existed (no-undef in legacy test polyfills, unused-imports in unrelated files). No new warnings introduced on `HomePage.jsx`.

## E2E Verification — Deferred to Phase 7

Per Phase 1 evidence, Playwright runs are batched in the Phase 7 regression sweep due to dev-server startup cost. The two I-001 cases (default viewport + 1280×480) are queued there:

```js
test('I-001: Trash entry visible in dashboard sidebar', ...)
test('I-001 small viewport: Trash entry still visible at 1280×480', ...)
```

Both will validate `await expect(trashBtn).toBeInViewport()` against the now-sticky element.

## Mechanical Reasoning

- `position: sticky bottom-0` pins to the bottom of the scroll container's viewport edge.
- Solid `bg-secondary` (matching the parent nav) means scrolling content does not show through.
- `z-10` puts Trash above any overflow shadows / scroll content.
- `border-t border-border/40` is a subtle visual divider from the scrolling region above.
- Import warnings, now without `mt-auto`, flow naturally below the sticky Trash — visible by scrolling within the nav.

## Files Modified

| Path | Change |
|---|---|
| `client/src/pages/HomePage.jsx` | Trash wrapper switched from `px-3 mb-2` to sticky variant; warnings dropped `mt-auto` |

## Next

Proceed to Phase 5: Verify I-003 Ctrl+K command palette wiring.

---
phase: 4
title: "Menu Modal Semantics"
status: pending
priority: P1
dependencies: [1, 2]
effort: "1-1.5 dev-days"
---

# Phase 4: Menu Modal Semantics

## Overview

Standardize the remaining menu/tab/table semantics verified in the report: File dropdown keyboard navigation and ShareModal tabs/table headers.

## Requirements

- Functional: File dropdown supports WAI-ARIA menu keyboard behavior for ArrowUp/Down, Home/End, Enter/Space, Escape. Arrow navigation wraps.
- Functional: menu opens with deterministic focus on first item when opened by keyboard.
- Functional: ShareModal tabs expose tablist/tab/tabpanel semantics and selected state.
- Functional: Share table headers use `scope="col"` and non-emoji accessible labels.
- Non-functional: preserve existing callbacks and data-testid selectors used by tests.

## Architecture

- Keep `RibbonFloatingOverlay` for positioning and outside-click close.
- Add local roving focus to `ribbon-file-dropdown-menu.jsx`, not a new global menu framework.
- Use array flattening for grouped menu items while keeping visual group headings.
- Either use Radix Tabs in `ShareModal` or implement a small ARIA tab pattern if dependency already exists. Radix Tabs is preferred because ribbon already uses it.
- Replace emoji labels with Lucide icons plus visible text or `sr-only` labels.
- Preserve ShareModal functional flows while changing semantics: loading shares, create link, copy link, delete link confirmation, and embed copy.

## Related Code Files

- Modify: `client/src/components/ribbon/ribbon-file-dropdown-menu.jsx`
- Modify: `client/src/components/ribbon/ribbon-floating-overlay.jsx` only if focus restore needs a prop
- Modify: `client/src/components/ShareModal.jsx`
- Modify/Create: `client/src/components/ribbon/ribbon-file-dropdown-menu.test.jsx`
- Modify/Create: `client/src/components/ShareModal.test.jsx`

## Implementation Steps

1. Write/confirm tests for File dropdown:
   - keyboard open focuses first item;
   - ArrowDown from the last item wraps to the first;
   - ArrowUp from the first item wraps to the last;
   - Home/End jump to first/last;
   - Escape closes and restores trigger focus;
   - Enter/Space activates exactly once, including repeat-key guard.
2. Implement item refs and active index in FileDropdown.
3. Keep group labels non-focusable with appropriate visual text only.
4. Write/confirm ShareModal tests for:
   - `role="tablist"`;
   - each tab has `role="tab"`, `aria-selected`, `aria-controls`;
   - panel has `role="tabpanel"`;
   - table headers have `scope="col"`;
   - protected column has readable label;
   - create/copy/delete/share-link flows still work.
5. Replace ShareModal emoji labels:
   - `Links` with `Link2` icon + text;
   - `Embed` with `Code`/`Copy` icon + text;
   - protected header with `Password protected`.
6. Run targeted tests.

## Success Criteria

- [ ] File menu is fully keyboard-operable.
- [ ] File menu ArrowUp/ArrowDown wrapping behavior is tested.
- [ ] File menu focus restore is deterministic.
- [ ] Share tabs are discoverable by role and selected state.
- [ ] Share table header semantics pass tests.
- [ ] No structural emoji remains in ShareModal controls/table headers.
- [ ] Existing share link create/copy/delete flows still pass.
- [ ] Embed copy flow still passes.

## Risk Assessment

- Risk: menu focus logic duplicates browser tab behavior. Mitigation: keep implementation scoped and covered by tests.
- Risk: Radix Tabs migration changes DOM and snapshots. Mitigation: favor role-based tests and preserve visible text.
- Risk: Escape listener conflicts between overlay and menu. Mitigation: centralize close path and restore focus once.

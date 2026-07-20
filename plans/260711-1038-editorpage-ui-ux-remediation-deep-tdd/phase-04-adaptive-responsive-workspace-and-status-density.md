---
phase: 4
title: "Adaptive Responsive Workspace And Status Density"
status: complete
priority: P1
effort: "3-4 dev-days"
dependencies: [3]
---

# Phase 4: Adaptive Responsive Workspace And Status Density

<!-- Updated: Validation Session 1 - confirmed editor >=768 and one tabbed right inspector -->

## Overview

Make the existing 768px tablet breakpoint usable. Preserve the below-768 guard, but replace fixed three-column pressure with adaptive docking/overlays and make the status bar degrade by information priority instead of clipping.

## Requirements

### Functional

- Below 768px: keep the explicit “tablet or desktop required” guard; hidden editor controls must not be focusable.
- At 768px: canvas receives primary width; side panels use rails/drawers and only one compact overlay can be open.
- At 1024px: one panel may dock while the secondary panel overlays or collapses.
- At 1280px and wider: navigator plus one right-side inspector host may dock.
- Properties and Design Ideas share one right inspector host with explicit tabs; they never consume two independent dock widths.
- Preserve explicit user panel preferences across viewport transitions.
- Preserve manual zoom; only auto-fit mode responds to panel geometry.
- Status bar keeps slide position, view and zoom controls visible; attribution hides first.
- Compact overlays act as modal interaction boundaries when they obscure the workspace: inert background, contained focus, Escape close, trigger restoration and global-shortcut suppression.

### Non-functional

- No presentation schema or persisted breakpoint state.
- Use actual editor container measurements and existing `ResizeObserver`.
- No document/workspace horizontal overflow.
- Panel open/close gives visible focus and Escape behavior.

## Architecture

```text
ui-store requested navigator/properties/design-ideas preferences
  -> responsive workspace controller
     -> effective tier: compact / standard / wide
     -> atomic effective docked/overlay/active-inspector state
     -> EditorShell slots
     -> SlideCanvas existing ResizeObserver

StatusBar measures its own container
  -> local priority tiers
  -> no dependency on the EditorShell provider
```

Requested preference and effective compact overlay state must remain separate. Resize effects must not overwrite user intent. `StatusBar` is a sibling of the routed editor in `MainLayout`; it must not consume an editor-local context.

## File Inventory

| Action | File | Planned impact |
|---|---|---:|
| Modify | Extracted `editor-shell.jsx` or EditorPage shell boundary | +30-50 LOC |
| Modify | `client/src/components/ribbon/ribbon-view-mode-controls-content.jsx` | +15-25 LOC; Phase 4 owns finalized panel command interface |
| Modify | `client/src/components/SlidePanel.jsx` | +5-15 LOC placement contract |
| Modify | `client/src/components/PropertiesPanel.jsx` | +5-15 LOC placement contract |
| Modify | `client/src/components/layout/StatusBar.jsx` | +25-40 LOC self-measured/CSS priority tiers |
| Modify | `client/src/components/layout/StatusBar.test.jsx` | +40-60 LOC |
| Create | `client/src/components/layout/responsive-editor-workspace-context.jsx` | 100-140 LOC |
| Create | Matching context test | 100-140 LOC |
| Create | `tests/e2e/responsive/editor-workspace-and-status-density.spec.js` and `status-bar-density.spec.js` | Split by responsibility; each below 200 LOC |
| Modify | `tests/e2e/pages/editor-page.js` | +20-35 LOC geometry helpers |
| Delete | None | Preserve store schema and guard |

## Interfaces To Protect

- `leftPanelOpen`, `rightPanelOpen` and all set/toggle actions.
- `showDesignIdeas` and its set/toggle actions.
- SlidePanel selection, reorder, batch and vertical-slide callbacks.
- PropertiesPanel two-argument targeted updates.
- SlideCanvas auto-fit/manual-mode behavior.
- StatusBar test IDs and view/present commands.
- Guard/desktop breakpoint contract at exactly 768px.

## Viewport Test Matrix

| Viewport | Initial state | Action | Expected |
|---|---|---|---|
| 1440×900 | Both requested | Load | Both docked; canvas remains primary |
| 1440×900 | Right closed | Resize to 1024 and back | Right remains requested closed |
| 1024×768 | Defaults | Load | One docked maximum; secondary available as overlay |
| 1024×768 | Element selected | Open properties | Overlay usable; canvas not permanently compressed |
| 1024×768 | Design Ideas requested after Properties | Switch inspector | One right inspector visible; both preferences retained |
| 768×1024 | Defaults | Load | Rails/overlays; canvas near full width |
| 768×600 | Navigator open | Select/duplicate | Existing actions work; overlay remains dismissible |
| 767×900 | Any | Load | Guard visible; editor surface inaccessible |
| All supported | Auto-fit | Toggle panel | Existing observer recalculates scale |
| All supported | Manual zoom | Toggle panel | Zoom value remains unchanged |
| 768/1024 | Compact overlay active | Press Delete/Ctrl+G behind overlay | Background editor command does not run |

## Acceptance Metrics

| Metric | 768 | 1024 | 1440 |
|---|---:|---:|---:|
| Document overflow | `scrollWidth <= innerWidth + 1` | Same | Same |
| Workspace overflow | `scrollWidth <= clientWidth + 1` | Same | Same |
| Canvas container width | ≥720px | ≥760px | ≥960px |
| Panel overlap when docked | 0px | 0px | 0px |
| Status overflow | `scrollWidth <= clientWidth + 1` | Same | Same |
| Critical status controls | Visible | Visible | Visible |
| Author attribution | Hidden | Hidden | Allowed |
| Active compact overlays | ≤1 | ≤1 | N/A |
| Docked right inspector hosts | 0 | ≤1 | ≤1 |

## Tests Before

1. Add rendered geometry tests at 767, 768, 1024 and 1440.
2. Add preference-preservation tests across resize transitions for navigator, properties and design ideas.
3. Add status-bar overflow and critical-control visibility assertions.
4. Add auto-fit versus manual-zoom panel-toggle assertions.
5. Capture current 768/1024 failures before implementation.

## Refactor

1. Introduce a responsive workspace controller/context with no document state.
2. Add a tabbed right inspector host for Properties and Design Ideas.
3. Apply compact, standard and wide panel placement in the extracted shell.
4. Route View-tab panel toggles through the finalized effective-state command interface; this file is not modified again in Phase 5.
5. Make obscuring compact overlays modal/inert and suppress background editor shortcuts.
6. Reorder StatusBar content by its own container width and remove clipping as a layout strategy.
7. Keep SlideCanvas sizing delegated to its existing observer.

## Tests After

- Focus enters opened overlay and returns to its trigger on close.
- Escape closes only the active compact overlay.
- Background canvas/ribbon controls are inert and global editor commands are suspended while an obscuring overlay is active.
- Resizing never opens a panel the user explicitly closed.
- Hidden guard/editor surfaces are not simultaneously focusable.
- No panel or status control requires horizontal scrolling.

## Implementation Steps

1. Write viewport RED tests and geometry helpers.
2. Implement tier derivation and preference separation.
3. Adapt shell panel placement.
4. Add overlay focus/escape contracts.
5. Refactor StatusBar priority tiers.
6. Verify auto-fit/manual zoom behavior.
7. Run responsive visual review without updating snapshots prematurely.
8. Run full phase gate.

## Regression Gate

```powershell
npx vitest run client/src/components/layout/StatusBar.test.jsx client/src/components/layout/responsive-editor-workspace-context.test.jsx client/src/pages/home-editor-responsive-source.test.js
npx playwright test tests/e2e/responsive/editor-workspace-and-status-density.spec.js tests/e2e/responsive/status-bar-density.spec.js tests/e2e/ribbon/header-responsive-pressure.spec.js --project=chromium
npm run lint
npm run test
npm run build
```

## Success Criteria

- [x] Editor is usable at exactly 768px and guarded below it.
- [x] Canvas is the primary workspace at every supported width.
- [x] Panel preferences survive compact/wide transitions.
- [x] Status bar does not clip critical controls.
- [x] No unintended horizontal overflow.
- [x] Auto-fit and manual zoom contracts remain correct.

## Completion Evidence

Completed 2026-07-13. Responsive workspace, inspector arbitration, small-screen guard, status-density, and zoom-mode contracts are implemented and verified by focused component/browser gates at the required widths.

## Risk Assessment

- **Preference loss:** separate requested and effective state.
- **Overlay collision:** enforce one compact overlay and one right inspector host.
- **Sibling context mismatch:** StatusBar owns local density measurement because it is outside the EditorPage subtree.
- **Zoom oscillation:** never add a second fit calculation.
- **Focus leakage:** test open, Escape and restore behavior.
- **Overfitting breakpoints:** use container width and acceptance metrics.

## Accessibility And Performance

Overlay panels need labelled regions, focus entry/restore, Escape dismissal and non-obscured controls. Resize handling must be observer-driven and debounced by browser layout, not window-loop polling.

## Rollback

Remove the responsive controller and restore current docked slot placement. Do not alter store persistence or document data.

## Next Steps

Phase 5 uses the resulting ribbon container width. Phase 7 relies on the supported tablet workspace.

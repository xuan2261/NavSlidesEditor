# Hard Validation + Debug Review Report

Date: 2026-05-17
Scope: `tab-based-ribbon-controls-implementation-plan.md` and phase files
Verdict: PASS WITH REQUIRED CORRECTIONS

## Findings

### H1. Ribbon integration was ambiguous
Current `EditorPage.jsx` mounts `EditorMenuBar` in header and `Toolbar` above `SlideCanvas`. A single `RibbonShell` mount cannot replace both cleanly. Fixed plan by requiring `RibbonHeaderBar` + `RibbonPanel` sharing `ui-store.activeTab`.

### H2. Package install target was underspecified
React dependencies live in `client/package.json`, not root `package.json`. Fixed plan to install `@radix-ui/react-tabs` with `npm install @radix-ui/react-tabs --workspace=client`.

### H3. Insert tab would regress existing entries
Current InsertMenu includes `Timeline` and optional `File Browser`; Phase 3 omitted them. Fixed Phase 3 requirements, implementation steps, and success criteria.

### H4. SVG upload assumption was wrong
Current SVG insertion uses `FileReader.readAsText()` and stores SVG content directly. Plan said SVG upload via multer endpoint. Fixed Phase 3 to preserve local text import.

### H5. Speaker Notes is not a view mode
`editor-store.viewMode` supports `normal | sorter`; current Speaker Notes action scrolls/focuses the notes textarea. Fixed Phase 5 to treat Speaker Notes as an action unless a real notes view is explicitly built.

### H6. Fragment animation type list is inconsistent in code
`common-element-controls.jsx` has 13 options including `strike`; `AnimationTimeline.jsx` has 12 and omits `strike`; neither has `zoom-out`. Fixed Phase 7 to centralize animation constants before ribbon UI.

### H7. E2E migration needs broader selector audit
Validation grep found toolbar/menu dependencies in page objects and specs beyond the short Phase 8 list, especially `.tour-step-toolbar`, `InsertMenuHelper`, and toolbar helper methods. Fixed Phase 8b notes.

## TDD Validation

The plan is TDD-shaped but needs one stronger rule during execution: every phase should first add or preserve regression tests against the old surface, then enable ribbon tests under `useRibbon=true`, then run build/test. Phase 8b is the only phase that should remove old tests/selectors after new ribbon selectors pass.

## Debug Notes

No runtime tests were executed because this was plan validation, not implementation. Evidence was collected from README, package manifests, current editor layout, stores, InsertMenu, EditorMenuBar, AnimationTimeline, and E2E selectors.

## Resolved Questions

- Phase 7 should not add `zoom-out`; keep the existing 13 supported options and centralize them.
- `Timeline` lives under Insert > Interactive.

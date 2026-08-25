---
title: "Phase 05: Semantic Control and Prompt Accessibility"
status: completed
---

# Phase 05: Semantic Control and Prompt Accessibility

## Goal

Give every editor control a programmatic name, deterministic focus/keyboard behavior, and shared safe URL entry without changing the established compact desktop visual language.

## Dependencies

- Phase 04 keyboard ownership and property fan-out.

## Canonical Files

- `client/src/components/PromptPopover.jsx`
- `client/src/pages/EditorPage.jsx`
- `client/src/components/editor-modals-secondary.jsx`
- `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- `client/src/components/PropertiesPanel.jsx`
- `client/src/components/properties/*.jsx`, including common, image, media, chart, code, shape/line, game, miscellaneous, table, and timeline controls
- `client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx`
- Shared UI primitives in `client/src/components/ui`
- `client/src/utils/url-safety.js`; recommended dependency-free shared policy under `shared/src`
- Existing accessibility and component tests

## Contracts

- PromptPopover is a real labelled dialog with labelled input, initial focus, Tab/Shift+Tab containment, scoped Escape, Enter submit, deterministic cancel, and focus restoration to the invoker.
- Replace the remaining `window.prompt('Link URL')` path with PromptPopover. Image/video/link URL entry uses one validator and exposes inline error text without closing on invalid input.
- Every input/select/range/color/checkbox/button has a unique accessible name from `label[for]`, wrapping label, `aria-label`, or `aria-labelledby`. Repeated series/timeline/table rows include stable row identity in their names.
- Tooltip/help text uses `aria-describedby` and stable IDs; tooltips are supplementary, never the only label.
- Decorative icon children remain `aria-hidden`; destructive icon-only buttons have explicit names.
- Presentation/media URL policies share scheme and injection rules. Reject control characters, attribute breakout, whitespace-obfuscated schemes, `javascript:`, `vbscript:`, HTML `data:`, and `file:`.

## RED

- [x] PromptPopover role/name/description, initial focus, tab loop, Escape/Enter, submit validation, cancel, and focus restoration tests.
- [x] Rich-text Link command opens the shared popover; no native prompt spy is called; invalid URL leaves TipTap state unchanged.
- [x] `getByRole`/`getByLabelText` tests cover common controls and each type-specific panel, including repeated timeline/chart/table controls.
- [x] URL policy parity tests run the same allow/deny corpus through client entry, shared renderer, rich-text export, and later action normalization.
- [x] Static source audit rejects native dialogs and invalid Tailwind `flex-shrink-0` usage; behavior/component test verifies fixed-left numeric input layout.
- [x] Screen-reader regression ensures helper text IDs are unique and correctly referenced.

## GREEN

- [x] Implement PromptPopover with a small focus-trap/restore hook or existing modal primitive; no new modal framework.
- [x] Add stable `id`/`htmlFor` and shared field primitives where repetition is exact; do not create a generic form DSL.
- [x] Migrate all URL prompt callsites to one controlled submission contract and shared URL normalizer.
- [x] Reconcile `shared/src/element-renderers.js` link sanitization with the client policy so allowed schemes and unsafe fallbacks are identical.
- [x] Replace invalid `flex-shrink-0` with accepted `shrink-0`/layout classes and prove the numeric field remains aligned.
- [x] Preserve existing visible labels, test IDs, mixed-selection state, and panel routing.

## REFACTOR

- [x] Remove native prompt code and duplicate URL validators after every caller migrates.
- [x] Consolidate only repeated label/help wiring into existing UI primitives.
- [x] Prefer DOM behavior tests over source-string assertions; retain audit tests only for architectural bans such as native dialogs.

## Focused Verification

```bash
npm test -- client/src/components/PromptPopover.test.jsx client/src/components/PropertiesPanel.test.jsx
npm test -- client/src/components/primary-interaction-semantics.test.jsx client/src/__tests__/ui-accessibility-findings-regression.test.js
npm test -- client/src/utils/url-safety.test.js client/src/utils/native-dialog-audit.test.js
```

Browser smoke: open Properties and Format for every canonical type, keyboard through all controls, exercise repeated rows, open/cancel/submit each prompt, and inspect accessible names with the browser accessibility tree.

## Success Criteria

- [x] No native `window.prompt/confirm/alert` remains in product UI paths.
- [x] All editable controls and destructive actions have unique accessible names.
- [x] Prompt focus is trapped/restored and Escape is scoped.
- [x] Unsafe URLs cannot enter rich text, media, shared HTML, or export paths.
- [x] Desktop compact layout and existing control semantics remain visually stable.

## Risks / Rollback

- Duplicate IDs in repeated controls can make tests pass for one row while assistive technology targets another. Generate IDs from element ID plus row/series/event identity.
- Global Escape handlers can close the wrong overlay. Stop propagation only within the active modal and restore prior focus safely if the invoker unmounted.
- Tightening URL policy may reject currently accepted relative media. Preserve proven relative/hash/http(s)/mailto/tel cases according to kind-specific tests.
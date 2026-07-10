---
phase: 5
title: "Modal Focus Trap Standardization"
status: pending
priority: P1
dependencies: [1, 4]
effort: "2-3 dev-days"
---

# Phase 5: Modal Focus Trap Standardization

## Overview

Standardize modal accessibility so dialogs trap focus, restore focus, announce labels, and close consistently without breaking complex editor modals.

## Requirements

- Functional: all true modal dialogs use `ModalShell` or a shared focus-scope primitive with equivalent behavior.
- Functional: Tab/Shift+Tab stay inside active modal; Escape closes the topmost intended layer; focus returns to opener.
- Functional: dialog has accessible name via `aria-labelledby` or `aria-label`.
- Non-functional: popovers/dropdowns that are not modal must not be forced into modal semantics.

## Architecture

Treat `ModalShell.jsx` as the default modal contract. For modals with custom two-pane or full-screen layout, extract/reuse focus trap logic while preserving layout. Build a modal inventory before migration to avoid accidental nested focus-scope regressions.

## Related Code Files

- Modify: `client/src/components/ui/ModalShell.jsx`
- Evaluate/migrate:
  - `client/src/components/AnalyticsModal.jsx`
  - `client/src/components/AnimationPreviewModal.jsx`
  - `client/src/components/LivePresentationModal.jsx`
  - `client/src/components/LatexEditorModal.jsx`
  - `client/src/components/HtmlEditorModal.jsx`
  - `client/src/components/GitHubPushModal.jsx`
  - `client/src/components/CSSEditorModal.jsx`
  - `client/src/components/CodeEditorModal.jsx`
  - `client/src/components/dashboard/TemplateGalleryPolished.jsx`
  - `client/src/components/dashboard/TemplatePreview.jsx`
  - `client/src/components/properties/game-properties-question-editor.jsx`
- Inventory must also search and classify every other modal-like component, including AI, Share, MediaLibrary, Sync, History, TemplatePicker, and STEM simulation modals if present.
- Tests: `client/src/components/ui/ModalShell.test.jsx`
- E2E: `tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`

## Implementation Steps

1. Use Phase 1 ModalShell tests as the behavioral contract.
2. Inventory modal-like components by searching all `role="dialog"`, `aria-modal="true"`, fixed overlay dialog patterns, and modal component filenames. Classify every result:
   - true modal, migrate to `ModalShell`
   - true modal, keep layout but use shared focus trap
   - already compliant, with evidence
   - non-modal popover/dropdown, leave out of scope
   - deferred, with explicit reason and follow-up owner
   Save this inventory table in implementation notes or the final implementation report so reviewers can audit coverage.
3. Strengthen `ModalShell`:
   - support initial focus target when needed
   - robust focus restoration when opener unmounts
   - stable Escape handling
   - optional `aria-describedby`
4. Migrate low-risk modals first: GitHub push, analytics, code/CSS/HTML/LaTeX editors if layout fits.
5. Migrate complex dashboard/template/game question modals carefully, preserving existing tests/selectors.
6. Ensure modal close buttons have explicit labels.
7. Add tests per migrated modal for role/name and focus behavior.
8. Run ModalShell/component tests and keyboard-only Playwright modal path.

## Success Criteria

- [ ] Every true modal has a focus trap and accessible name.
- [ ] Modal inventory covers every dialog-like component found by source search.
- [ ] Modal inventory classification table is saved in implementation notes or the final report.
- [ ] Focus returns to opener after close, or falls back safely if opener unmounted.
- [ ] Escape closes the correct active dialog only.
- [ ] Non-modal popovers are not mislabeled as modal dialogs.

## Risk Assessment

- Risk: nested controls like color pickers/dropdowns break inside traps.
  - Mitigation: test complex modal with nested focusable controls; support nested focus scopes only if needed.
- Risk: broad migration breaks snapshots/selectors.
  - Mitigation: migrate incrementally and preserve test IDs/public labels.

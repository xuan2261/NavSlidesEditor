---
phase: 7
title: "Modal Popover And Overlay QA"
status: completed
priority: P1
effort: "1.5 days"
dependencies: [1, 2, 4]
---

# Phase 7: Modal Popover And Overlay QA

## Overview

Verify every modal, popover, product tour, and overlay after Tailwind/refactor changes. This phase focuses on z-index, focus management, ESC/outside click behavior, form controls, scroll locking, and responsive layout.

## Requirements

- Overlays must open, render content, submit/cancel, and close predictably.
- Modal content must not be hidden behind app bars, side panels, canvas, or other overlays.
- Focus must move into modal on open and return to trigger on close when feasible.
- ESC and close buttons must not discard unsaved input without existing confirmation behavior.
- Forms must preserve validation and error states.

## Architecture

Overlay flow:

Trigger control -> local/global modal state -> overlay/backdrop -> form/editor content -> command/API call -> success/error -> close or persist state.

Popover flow must stay lightweight and not introduce global modal side effects.

## Related Code Files

- `client/src/components/AICopywriterModal.jsx`
- `client/src/components/AIGeneratorModal.jsx`
- `client/src/components/AITranslateModal.jsx`
- `client/src/components/AnalyticsModal.jsx`
- `client/src/components/CSSEditorModal.jsx`
- `client/src/components/CodeEditorModal.jsx`
- `client/src/components/GitHubPushModal.jsx`
- `client/src/components/HistoryModal.jsx`
- `client/src/components/HtmlEditorModal.jsx`
- `client/src/components/LatexEditorModal.jsx`
- `client/src/components/LivePresentationModal.jsx`
- `client/src/components/MediaLibraryModal.jsx`
- `client/src/components/ProductTour.jsx`
- `client/src/components/PromptPopover.jsx`
- `client/src/components/ShareModal.jsx`
- `client/src/components/SyncModal.jsx`
- `client/src/components/TemplatePickerModal.jsx`
- `client/src/components/ErrorBoundary.jsx`
- `client/src/components/ProductTour.test.js`
- `tests/e2e/ai.spec.js`
- `tests/e2e/media.spec.js`
- `tests/e2e/sharing.spec.js`
- `tests/e2e/templates.spec.js`
- `tests/e2e/version-history.spec.js`

## Implementation Steps

1. Build overlay inventory:
   - AI generation/copywriting/translate.
   - Code/HTML/CSS/Latex editors.
   - Live presentation/share/sync/GitHub/history.
   - Media library/template picker/product tour/prompt popover.
   - Error boundary fallback.
2. Verify open/close mechanics:
   - Button trigger.
   - Close button.
   - ESC.
   - Backdrop/outside click where intended.
   - Route change cleanup.
3. Validate forms:
   - Required fields.
   - Empty/error/loading/success states.
   - Long prompt/code/media URL input.
   - Submit disabled/loading states.
4. Validate stacking:
   - Modal over editor shell and canvas.
   - Popover over toolbar but below modal.
   - Product tour spotlight not covering required controls incorrectly.
5. Validate responsive layout:
   - Modal max-height and inner scroll.
   - Footer buttons remain reachable.
   - Long titles/actions wrap cleanly.
6. Add focused unit tests for ProductTour/prompt helper logic where behavior is pure.

## Verification & Tests

- `npx vitest run client/src/components/ProductTour.test.js`
- `npx playwright test tests/e2e/ai.spec.js`
- `npx playwright test tests/e2e/media.spec.js`
- `npx playwright test tests/e2e/sharing.spec.js`
- `npx playwright test tests/e2e/templates.spec.js`
- `npx playwright test tests/e2e/version-history.spec.js`
- Manual overlay matrix:
  - Open and close every modal.
  - ESC close behavior.
  - Backdrop click behavior.
  - Tab order/focus trap spot check.
  - Submit success/error state for API-backed modals.
  - Long content scroll and footer reachability.
- Viewport checks:
  - 1440x900 desktop.
  - 1024x768 tablet.
  - 390x844 mobile.
- Runtime checks:
  - No console errors on modal mount/unmount.
  - No body scroll lock stuck after close.
  - No background command fires while modal is focused.

## Success Criteria

- [ ] All overlay E2E/unit checks pass.
- [ ] Every modal/popover has manual or automated evidence.
- [ ] No overlay is clipped, hidden behind canvas, or impossible to close.
- [ ] Focus and scroll behavior return to normal after close.

## Risk Assessment

- Risk: z-index fixes become one-off and conflict later. Mitigation: centralize overlay layer classes/tokens.
- Risk: API-backed modal tests require network assumptions. Mitigation: test both mocked fixture path and local server path where existing tests support it.
- Risk: mobile modal footer becomes unreachable. Mitigation: explicit max-height/overflow checks.

## Security Considerations

- Prompt/code/html inputs must not render as executable app chrome.
- GitHub/share/sync modals must not expose tokens in UI, logs, screenshots, or reports.
- Error boundary must not display secrets from thrown errors.

## Todo List

- [ ] Overlay inventory complete.
- [ ] ProductTour unit test passes.
- [ ] Modal E2E group passes.
- [ ] Focus/scroll/z-index screenshots captured.

## Next Steps

Proceed to Phase 8 when all overlay layers are reliable.

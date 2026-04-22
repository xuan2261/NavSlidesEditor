---
phase: 7
title: 'Migrate Feature Modals'
status: completed
priority: P2
effort: '4h'
dependencies: [1, 6]
---

# Phase 7: Migrate Feature Modals

## Overview

Complete the migration of the modal system by refactoring all remaining feature modals (`ShareModal`, `MediaLibraryModal`, `CodeEditorModal`, `CSSEditorModal`, `HtmlEditorModal`, `LatexEditorModal`, `GitHubPushModal`, `SyncModal`, `HistoryModal`).

## Requirements

- Functional: Code editors (Monaco/CodeMirror) inside modals must resize correctly without breaking layout boundaries.
- Non-functional: Consistent headers and footers across all modals.

## Architecture

- Utilize the same Tailwind modal wrapper pattern established in Phase 6.

## Related Code Files

- Modify: `client/src/components/ShareModal.jsx`
- Modify: `client/src/components/MediaLibraryModal.jsx`
- Modify: `client/src/components/CodeEditorModal.jsx`
- Modify: `client/src/components/CSSEditorModal.jsx`
- Modify: `client/src/components/HtmlEditorModal.jsx`
- Modify: `client/src/components/LatexEditorModal.jsx`
- Modify: `client/src/components/GitHubPushModal.jsx`
- Modify: `client/src/components/SyncModal.jsx`
- Modify: `client/src/components/HistoryModal.jsx`

## Implementation Steps

1. Apply the Tailwind modal overlay and content wrapper classes to all 9 feature modals.
2. Refactor their inner content, especially the `MediaLibraryModal` image grid, to use Tailwind CSS Grid classes.
3. Verify that the code editors mount with correct height/width constraints (`h-[60vh] w-full` etc.).

## Verification & Testing

- **Test:** Verify media selection and editor interaction logic in Vitest.
- **Browser Subagent:** Trigger the `MediaLibraryModal` and `GitHubPushModal`. Take screenshots to verify the grid layout of the media library and the form layout of the push modal.

## Success Criteria

- [x] All Modals are 100% Tailwind-based.

## Risk Assessment

- **Risk:** High volume of files touched may introduce accidental logic deletions.
- **Mitigation:** Strictly limit changes to the `className` strings. Do not modify JSX structure or logic.

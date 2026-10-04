## TL;DR
**GO**: restore the missing closing `}` and proceed with identity propagation. **NO-GO for Phase04 acceptance**: the current EditorPage wiring leaves inherited games unresolved and shortcuts disabled.

## What to do
1. Append `}` after the final return in `client/src/pages/editor-page-helpers.js:14`. The function opened at line 9 remains unclosed; preserve the intended resolver and hidden-game filter.
2. Pass `presentation?.layoutMasters` as the fourth argument at `client/src/pages/EditorPage.jsx:577–581`. Currently omitted; restoring syntax alone will not enable inherited-game lookup.
3. Compute `effectiveSlideIdentity` for the **same source slide** used by the helper. Use horizontal index `currentVerticalIndex?.parent ?? currentSlideIndex` and vertical index `currentVerticalIndex ? currentVerticalIndex.child + 1 : 0`. This matches existing Present positioning (`EditorPage.jsx:440–443`) and generated child identity (`shared/src/htmlGenerator.js:353`).
4. Supply that identity as `effectiveSlideId` to `useEditorLiveSessionController`. The controller already accepts it and refuses shortcut dispatch without it (`client/src/hooks/editor-controller/use-editor-live-session-controller.js:113–124`). EditorPage currently omits it.

Both shared helpers are root-exported (`shared/src/index.js:130,147`); no replacement identity convention is needed.

## What to avoid
Do not use the parent’s identity for a child, pass `null` as the parent vertical coordinate, or use raw zero-based child ordinals. For slides without IDs, the canonical fallback is `position:horizontal:vertical` (`shared/src/education/effective-slide-identity.js:1–2`).

## Success metrics
After correction, verify inherited visible games, hidden-game exclusion, parent/child shortcut targeting, and positional fallback for slides without IDs. Native Try success alone does not establish these boundaries.

## Assumptions
**High confidence:** the inspected files are the intended correction target. Read-only counsel; no edits or verification commands performed.
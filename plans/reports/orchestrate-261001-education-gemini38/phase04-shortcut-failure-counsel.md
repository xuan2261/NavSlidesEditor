## TL;DR
**GO for deleting the two producer-only shortcut cases; NO-GO for Phase04 acceptance until behavioral gaps are covered.** Do not re-pin their payloads or remove `effectiveSlideId` to satisfy obsolete expectations.

## Reframed problem
Preserve keyboard-selected game behavior through canonical tuple routing—not the old event-object shape.

The cases exercise real keyboard/DOM events, rather than merely mocked dispatch, but stop at `CustomEvent.detail` (`editor-page-present-wiring.test.jsx:157–200`). Under the stated no-wiring-assertions policy, deletion is correct; their selection/subtype intent must survive as consumer-visible coverage.

## What to do
1. Delete those exact cases and the now-unused `seedWithMultipleGames`.
2. Retain generated-document admission, queue, disconnect, authority, and recovery cases.
3. Add missing behavioral coverage:
   - Selected visible game wins; hidden selected games are excluded.
   - Layout-inherited games resolve with effective IDs, including both hidden-override forms.
   - Active child never borrows a parent game when empty; absent active slide may use the parent.
   - Shortcuts address distinct inherited copies independently, including ID-less parent/child positional identities.
   - Missing or unknown shortcut tuples never dispatch through raw-element-ID fallback.

The helper resolves layouts and filters hidden games (`editor-page-helpers.js:9–14`); EditorPage supplies matching source identity (`EditorPage.jsx:577–600`); transport requires the tuple (`live-host-transport.js:44–51`).

## Risks / what to avoid
**No consumer regression is established by the reported failures.** They reject an added required field.

However, generated tests inject a default tuple directly (`education-live-document.js:39–44`), bypassing EditorPage selection and bridge production. Passing them alone cannot prove keyboard-to-presenter correctness. Descriptor coverage already establishes inherited/hidden generation, not editor selection.

## Narrowest remaining verification
After the cutover, run the original four-file set plus the newly rewritten `live-presenter-runtime.test.js` and affected selection coverage. Exercise the actual editor/popup: select the second game, press its subtype shortcut, and observe only its intended room change; repeat for an inherited vertical child.

## Assumptions / limits
Canonical tuple routing is required: **high confidence**. `artifact://1074:raw` was unavailable; failure counts are caller-reported. No edits or commands executed. This counsel is not model-family-independent.
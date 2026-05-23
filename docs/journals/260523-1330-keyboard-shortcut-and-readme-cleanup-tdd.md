# Keyboard Shortcut Wiring + README Element-Count Cleanup

Date: 2026-05-23
Plan: `plans/260523-1230-keyboard-shortcut-and-readme-cleanup-tdd/`
Status: Closed

## Context

Two follow-ups from `260523-0900-smoke-test-bug-fixes-tdd` phase-07-final-report: Q1 — eight editor-scope shortcuts silently no-oping; Q2 — README claiming "20 element types" when the canonical count is 19.

## Q1 — The Real Bug

Eight shortcuts (`Ctrl+M` insertSlide, `Ctrl+G` group, `Ctrl+Shift+G` ungroup, `Ctrl+]` bringForward, `Ctrl+[` sendBackward, `Ctrl+0` resetZoom, `Ctrl+=` zoomIn, `Ctrl+-` zoomOut) were registered in the shortcut registry and passed correctly by `EditorPage.jsx` — but `useKeyboard` never destructured the corresponding props (`onInsertSlide`, `onGroup`, etc.). The hook received them and silently dropped them on the floor.

Same bug class as I-003 (`Ctrl+K`) from the prior plan. The pattern: three lists in `use-keyboard.js` must stay in sync — the destructure block, the `createKeyboardHandler` callbacks bag, and the `useMemo` dep array. Miss one list and the shortcut exists everywhere except where it fires.

Fix in `client/src/hooks/use-keyboard.js`: added 8 entries to all three lists. Fix in `client/src/pages/EditorPage.jsx`: pulled `zoomIn`/`zoomOut`/`resetZoom` from `useEditorStore` (existing actions at `editor-store.js:72-75`, step 0.25, clamp 0.25–4), wired all 8 callbacks. `bringForward`/`sendBackward` guard `selectedElementIds.length === 1` to match existing single-element contract.

Also fixed 3 stale `console.log('[zoom] in/out/reset')` stubs in `EditorPage.jsx`'s command-palette commands array — they were calling `store.zoomIn()` etc. already, but the log lines were pre-refactor debris.

## Regression Guard (the lesson from last time)

`client/src/hooks/use-keyboard-contract.test.js` — registry-driven `test.each` contract. For every shortcut with `scopes.includes('editor') || scopes.includes('canvas')`, dispatches the chord via `parseChord` (inverse of `normalizeKey`) and asserts the `on<Id>` callback fires. 21 forwarded cases + 2 dedicated tests for `Delete`/`Escape` special paths.

RED state pre-fix: exactly 8 failures, one per missing wire. GREEN state post-fix: 21/21. Adding a new editor-scope shortcut to the registry without wiring `useKeyboard` now fails CI by construction. This is the structural fix the prior plan didn't have — I-003 was patched individually; this test makes the whole class impossible to miss.

## Q2 — README Drift

README line 36 said "20 element types." `Object.keys(ELEMENT_DEFAULTS).length` in `client/src/data/element-defaults.js` is 19. The prose enumeration inflated the count by listing `divider` (a `line` preset — the Insert button calls `addElement('line', {...preset})`, not a distinct type) and `inline math` (a TipTap text-formatting feature on `text` elements, not a type at all).

Fixed README line 36 to "19 element types," removed `divider` and `inline math` from the prose enumeration, added a footnote explaining why the Insert ribbon shows ~27 actions (shape sub-variants + 7 game variants all resolve to a single type). Same fix in `docs/project-overview-pdr.md`: corrected the line 23 enumeration AND removed the `divider` row from the 20-row element table at lines 46–69.

Guard: `client/src/data/element-defaults.test.js` (10 lines) pins `Object.keys(ELEMENT_DEFAULTS).length === 19`. Future additions to `element-defaults.js` that forget to update the README now fail this test.

## Judgment Call Worth Recording

Code-reviewer flagged README line 15 "inline math" as another false enumeration item to cut. Line 15 is the "Rich formatting" features bullet — it lists text-formatting capabilities of `text` elements (bold, italic, font size, inline math via KaTeX, etc.). It is NOT the element-type enumeration. Inline math IS a real, shipped capability.

Per `review-audit-self-decision.md` rules 2 and 3: traced the claim before applying the cut, walked the failure mode through the actual threat model (does this produce element-count drift?), confirmed it does not, documented the rationale. Reviewer accepted it.

The failure mode this protects against: an audit recommendation that looks correct in isolation but removes an accurate capability claim because it shares a name with a false type enumeration item one paragraph away. Cost of one sentence of pushback was zero. Cost of silent compliance would have been a misleading README.

## Deferred Follow-Up (Q1.D)

Same silent-drop bug class affects 4 presentation-scope annotation callbacks: `onPenTool`, `onLaserPointer`, `onHighlighterTool`, `onEraseAnnotations`. `EditorPage` passes them; `useKeyboard` doesn't destructure them; annotation shortcuts no-op during slideshows. Severity: moderate — annotation mode is broken silently for keyboard users. Not blocking editor work.

User decision: defer to a follow-up plan focused on extending the contract test to presentation-scope shortcuts. Tracking note in `plan.md` Q1.D. The contract test infrastructure built in this plan makes that follow-up straightforward — add a `scopes.includes('presentation')` filter and wire the four callbacks.

## Verification

- `npm run lint`: 0 errors, 96 pre-existing warnings (none introduced by this plan)
- `npm run test`: 151 test files, 1329 pass / 1 skipped
- `npm run build`: 15.37s, no errors
- Targeted `npx vitest run` on plan-touched files: 27/27 pass

## Commit

`b929cfad` — 21 files, per-file `git add`, conventional commits format.

## Unresolved Questions

- Q1.D: presentation-scope annotation shortcuts (`onPenTool`, etc.) still silently dropped — tracked, deferred.

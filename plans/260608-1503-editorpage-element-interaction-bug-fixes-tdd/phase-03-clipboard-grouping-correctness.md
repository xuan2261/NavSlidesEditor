---
phase: 3
title: "Clipboard & Grouping Correctness"
status: pending
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 3: Clipboard & Grouping Correctness

## Overview
Stop copy/paste/duplicate from merging copies into the source group, make
repeated paste cascade instead of overlap, and decide Ctrl+D clipboard behavior.
Implements the accepted **Option A**: copies stay grouped under a NEW groupId.

## Bugs Addressed
- **H5 (High)** — copy/paste/duplicate preserve source `groupId`, merging originals + copies into one indistinguishable group. `use-clipboard.js:20-23, 45, 75-86`. (Confirmed: repro tests `[bug:H5]` ×2.)
- **L1 (Low)** — repeated paste stacks all copies at the same `+20/+20` offset. `use-clipboard.js:143-153`. (Confirmed: repro `[bug:L1]`.)
- **L2 (Low)** — Ctrl+D clobbers the clipboard. `EditorPage.jsx:921-935`. (Flagged: possibly intentional — confirm before changing.)

## Requirements
- Functional: pasting/duplicating a group yields a SECOND independent group (new shared groupId), preserving intra-group structure. Copying 2 distinct groups at once keeps them as 2 groups (per-source remap, not one shared id). Repeated paste cascades offset (each paste offsets from the previous). Ctrl+D: decide whether it should leave the copy/cut clipboard intact.
- Non-functional: keep ID generation on `crypto.randomUUID()` (already collision-safe — do not regress).

## Architecture
Add a `groupId` remap **at paste/duplicate time** (not copy time, so each paste
makes a new group): build `Map<oldGroupId, newGroupId>` per operation; elements
without `groupId` stay ungrouped.

**RED-TEAM + USER-DECISION CORRECTIONS:**

- **Single-member group paste → DROP groupId (user decision 4):** only mint a new
  shared groupId when **≥2** pasted elements share the same source groupId. A lone
  survivor of a group gets `groupId: undefined` (a 1-element "group" is
  meaningless and shows a stray Group badge at `canvas-element-wrapper.jsx:230`).
  So the remap must first COUNT members per source groupId in the paste batch.
- **L1 cascade (BLOCKER):** `createPasteOperation` is a PURE function — calling it
  twice with identical args returns identical output, so a test asserting "2nd
  paste x ≠ 1st" against the pure fn is **unsatisfiable**. Fix: add a `pasteIndex`
  (or `pasteCount`) param → offset `20 * (pasteIndex + 1)`. Counter lives in
  editor-store (`pasteCount`), incremented per paste, RESET on copy/cut. Test the
  pure fn with `pasteIndex: 0` then `1`.
- **Locked member in group duplicate (user decision 2):** `createDuplicateOperation`
  currently ABORTS if ANY selected element is locked (`use-clipboard.js:71`).
  Change to **skip locked members, duplicate the rest** (consistent with
  `deleteSelectedElements`). Same for `performDuplicate` (`:173` already filters
  `!el.locked` — reconcile the two so the pure fn and hook agree).
- **Ctrl+D must NOT clobber clipboard (user decision 3):** remove the
  `setClipboard(clipboardData)` call from `handleDuplicate` (`EditorPage.jsx:931`).
  Ctrl+C → Ctrl+D → Ctrl+V must still paste the COPIED element.
- **Characterization audit (red-team M-c):** grep ALL `groupId` assertions in
  `client/src/**/__tests__/` (e.g. `editor-page-command-palette-actions.characterization.test.jsx`,
  `editor-page-element-ops.characterization.test.jsx`) and reconcile — not just
  the repro file.

```js
// remap at paste/dup time, group-aware (≥2 members → new group; lone → drop)
const counts = new Map()
for (const el of clipboardElements) if (el.groupId) counts.set(el.groupId, (counts.get(el.groupId)||0)+1)
const groupRemap = new Map()
const elements = clipboardElements.map((el) => {
  let groupId
  if (el.groupId && counts.get(el.groupId) >= 2) {
    if (!groupRemap.has(el.groupId)) groupRemap.set(el.groupId, crypto.randomUUID())
    groupId = groupRemap.get(el.groupId)
  } // else: undefined (lone survivor or never grouped)
  const off = 20 * (pasteIndex + 1)
  return { ...el, id: crypto.randomUUID(), groupId, x: (el.x||0)+off, y: (el.y||0)+off }
})
```

## Related Code Files
- Modify: `client/src/hooks/use-clipboard.js` (`createPasteOperation` 34-48, `createDuplicateOperation` 59-89, `performPaste` 143-153)
- Modify: `client/src/pages/EditorPage.jsx` (`handleDuplicate` 921-935 — only if L2 confirmed)
- Modify: `client/src/editor-interaction-bug-repro.test.js` (convert H5×2 + L1 tripwires to standard passing assertions once fixed)

## Implementation Steps (TDD)
1. **Fixture fix (red-team):** the current `[bug:H5]` repro uses a SINGLE element with `groupId:'G'` — can't express "both members share new id" nor catch the "two groups merged" defect. Rewrite with a 2-element grouped fixture (`a,b` both `groupId:'G1'`) plus a second group (`c,d` `groupId:'G2'`).
2. **Test (H5 — merge bug):** copy all of G1+G2, paste → assert (a) G1's two copies share ONE new id, (b) G2's two copies share ONE new id, (c) the two new ids DIFFER (not collapsed), (d) none equals 'G1'/'G2'. Assert `elements.length` first (defensive — avoid `undefined.groupId` TypeError masking a broken copy).
3. **Test (H5 — lone survivor, decision 4):** copy ONLY `a` (1 of 2 in G1), paste → assert copy's `groupId` is `undefined`.
4. Implement the group-aware remap (count ≥2 → new shared id; lone → drop). Run → H5 tests green.
5. **Test (L1, BLOCKER):** call `createPasteOperation({clipboardElements, pasteIndex:0})` then `pasteIndex:1` → assert offsets differ (40 vs 60). Also a hook-level test: `performPaste` twice → 2nd cascades.
6. Implement `pasteIndex`/`pasteCount` param + editor-store counter (reset on copy/cut). Run → green.
7. **Test (decision 2 — locked group dup):** duplicate a group with 1 locked + 1 free member → assert ONLY the free member is duplicated (not abort-all). 
8. Change `createDuplicateOperation:71` to skip locked, duplicate rest; reconcile with `performDuplicate:173`.
9. **Test (decision 3 — Ctrl+D clipboard):** Ctrl+C `a` → Ctrl+D `b` → assert clipboard still holds `a` (next paste pastes `a`, not `b`).
10. Remove `setClipboard` from `handleDuplicate` (`EditorPage.jsx:931`).
11. **Characterization audit:** grep all `groupId` assertions in `__tests__/`; reconcile any that assumed groupId preserved/dropped on paste/dup.
12. `npm run test` + `npm run lint`.

## Success Criteria
- [ ] H5 merge: 2 copied groups → 2 distinct new groupIds; members within a group share one id; ≠ source ids
- [ ] H5 lone survivor: single-member-of-group paste → groupId undefined (decision 4)
- [ ] L1: paste cascades via pasteIndex (pure fn + hook level); 3rd paste keeps cascading
- [ ] Locked group dup: free members duplicated, locked skipped (decision 2)
- [ ] Ctrl+D leaves copy/cut clipboard intact (decision 3)
- [ ] Characterization suites reconciled, not just repro file
- [ ] tripwires converted; lint clean

## Risk Assessment
- **Risk:** remap-per-element could split a group. **Mitigation:** Map keyed by old groupId + ≥2-count guard guarantees all members of one source group get one new id (or all dropped if lone).
- **Risk (BLOCKER):** L1 pure-fn test unsatisfiable. **Mitigation:** `pasteIndex` param — test the parameterized fn + hook-level cascade.
- **Risk:** changing `createDuplicateOperation` abort-all → skip-locked could surprise. **Mitigation:** matches delete precedent + user decision 2; covered by test.
- **Risk:** removing `setClipboard` from duplicate breaks a workflow relying on it. **Mitigation:** user decision 3 confirms; covered by test.

---
phase: 2
title: "Image loss fix (silent null in detectImage)"
status: pending
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2 — Image Loss Fix (Silent Null in detectImage)

8/27 images dropped on Bai_2_1, 5/31 on Bai_2_5. `detectImage` returns `null` when hinted MIME from PPTX `r:embed` disagrees with sniffed magic-bytes MIME. PPTX commonly stores stale or generic hints; trust the sniffer, log when both fail.

## Context Links

- Brainstorm: P0-B
- Source: `server/services/pptx-import/media.js:71`
- Golden master baseline: from Phase 1 — expect image element count snapshots to change after fix; re-baseline explicitly.

## Overview

- Priority: P1
- Brief: One-file behavior change. Replace silent `return null` with: trust sniffed MIME, ignore hint mismatch, attach a warning to the return value (`{ url, warning?: { code, ... } }`) only when sniffer also fails. Three callers in `mapper.js` push the warning to their existing local `warnings` arrays.

## Key Insights

- `detectImage` runs first in `persistImageBuffer` path (media.js:75). Failure here cascades to `mapImage` returning `null`, which `mapper.js` then converts to a `media-missing` placeholder. Three failure modes today:
  1. hinted MIME != sniffed MIME -> null (the bug)
  2. unrecognized format (WMF/EMF/SVG-in-fill) -> null (out of scope here; document gap)
  3. zero-byte buffer -> null (correct, keep)
- 30% image-loss rate on a real-world deck. The fix is single-function.

## File Inventory

| Path | Action | Est LOC delta |
|---|---|---|
| `server/services/pptx-import/media.js` | Modify | +15/-3 |
| `server/services/pptx-import/mapper.js` | Modify (3 callers at 239,450,479 — destructure result) | +6/-3 |
| `server/services/pptx-import/media.test.js` | Modify | +60 |
| `server/services/pptx-import/__snapshots__/mapper-golden-master.test.js.snap` | Re-baseline (auto) | varies |

## Test Scenario Matrix

| Existing test | Touched? | Notes |
|---|---|---|
| `media.test.js` (56 LOC) | Yes | Add 4 cases (mime mismatch trust, unrecognized log, zero-byte still null, all-png-magic happy path) |
| `mapper-golden-master.test.js` | Re-baseline | Image element count will increase; commit new snapshot |
| `pptx-import-e2e-flow.test.js` (217 LOC) | Verify still green | Should pass without changes |

New tests count: +4 cases in `media.test.js`.

## Function/Interface Checklist

- **Red-team verified:** `persistImageBuffer(buffer, hintedMime)` at `media.js:75` and `persistMediaBlob(zipEntry, ...)` at `media.js:93` do NOT accept a `context` parameter. The 3 callers in `mapper.js:239,450,479` don't pass one either. Plumbing a fresh `context` arg requires touching all callers + tests — out of scope for this single-file phase.
- Use RETURN-VALUE pattern instead: persist fns return `{ url, warning? }`; callers push `warning` (if present) to existing local warning lists already in scope.
- `detectImage(buffer, hintedMime)` (media.js:~38): change return contract.
  - Before: returns `{ mime, ext } | null` (null when mismatch).
  - After: returns `{ mime, ext, hintMismatch?: boolean } | null` (null only when sniffer fails entirely).
- `persistImageBuffer(buffer, hintedMime)` (media.js:~75): on `hintMismatch`, attach `warning` to return object; do NOT mutate any external state.
- New return shape: `{ url, warning?: { code, ...details } }`. Single-property `url` access at call sites becomes `result.url`; warning is opt-in per caller.

## Dependency Map

- Blocks: Phase 9 (acceptance gate measures image preservation)
- Blocked by: Phase 1 (snapshot baseline must exist before re-baselining)

## Tests Before (Characterization Gate)

- [ ] Confirm `npm test` green
- [ ] `npx vitest run server/services/pptx-import/media.test.js` — 56 LOC, green
- [ ] Add characterization test: feed PNG buffer with hinted `image/jpeg` -> assert current behavior (null) before fix
- [ ] Commit characterization test as baseline

## Refactor / Implement

- [ ] In `media.js:71`, replace:
  ```js
  if (hintedMime && detected && hintedMime !== detected.mime) return null
  ```
  with:
  ```js
  if (hintedMime && detected && hintedMime !== detected.mime) {
    return { ...detected, hintMismatch: true }
  }
  ```
- [ ] In `persistImageBuffer` (media.js:~75), after `detectImage`:
  ```js
  const warnings = []
  if (detected?.hintMismatch) {
    warnings.push({ code: 'image-mime-hint-mismatch', detected: detected.mime, hinted: hintedMime })
  }
  // ... persist logic ...
  return { url, warning: warnings[0] }  // single warning, opt-in
  ```
- [ ] In `persistImageBuffer` and `persistMediaBlob`: when `detected === null` (sniff actually failed), return `{ url: null, warning: { code: 'image-detect-failed', byteLength } }` instead of silent null.
- [ ] Update 3 callers in `mapper.js:239,450,479`: change `const url = await persistImageBuffer(...)` to `const result = await persistImageBuffer(...); if (result.warning) warnings.push(result.warning)`. The `warnings` array is already in scope at each call site (verify before edit).

## Tests After (New Unit Tests)

- [ ] `media.test.js` adds:
  - `it('trusts sniffed MIME when hint disagrees')`
  - `it('flags hintMismatch in returned object')`
  - `it('pushes warning when sniffer fails')`
  - `it('returns null for zero-byte buffer (regression)')`
- [ ] Re-run characterization test (now passing instead of failing-on-purpose); flip its assertion to the new behavior.

## Regression Gate

- [ ] `npm test` — full suite green
- [ ] `npm test -- --coverage` — thresholds preserved
- [ ] LOC budget: `media.js` <= 180 LOC (currently 129 -> ~141)
- [ ] `npm run test:corpus` — Bai_2_1 image count 19 -> closer to 27 (target >= 25); document delta in `corpus-baseline.json` and update baseline
- [ ] Re-baseline `mapper-golden-master.test.js` snapshots that include image elements

## Success Criteria

- Bai_2_1: image count restored from 19 to >= 25 (no longer 30% loss).
- Bai_2_5: image count restored from 26 to >= 29.
- Zero new test failures; baseline updated explicitly.

## Risk Assessment

- Risk: sniffed MIME is also wrong (corrupt image). Mitigation: warnings array surfaces this; user sees it in import dialog.
- Risk: snapshot churn cascades to many tests. Mitigation: only `_pptxImportMeta` and image-counting snapshots will change; review diff per snapshot.

## Rollback Plan

- Revert `media.js` to current state. Snapshots may need rolling back via `git checkout` on `__snapshots__/`.

## Unresolved Questions

1. Should `image-mime-hint-mismatch` warnings count against semantic fidelity score? Recommend: no, since image is preserved.
2. Unsupported formats (WMF/EMF/SVG inside fill) still null silently — separate fix scope, not in this phase.

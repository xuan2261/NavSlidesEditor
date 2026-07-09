---
phase: 5
title: "Geometry And Mixed Controls UX"
status: pending
priority: P2
effort: "0.5-0.75d"
dependencies: [1]
---

# Phase 5: Geometry And Mixed Controls UX

## Overview

Fix two CONFIRMED P2 UX defects: **callout default size vs MIN_SIZE** jump, and **mixed opacity slider** showing primary value while label shows "—".

## Requirements

### V5 Callout / MIN_SIZE

- Functional options (pick **Recommended: A**):
  - **A.** Raise callout defaults to `width: 40, height: 40` (≥ `MIN_SIZE`).
  - **B.** Lower MIN_SIZE for callout only (more complex resize path).
- Do not break icon/audio defaults.
- Properties panel W/H still floor via fan-out `MIN_SIZE` for multi-select; single callout at 40 never jumps on first nudge resize.

### V6 Mixed opacity

- When `mixed.opacity.isMixed`:
  - Label already "—" — keep.
  - Slider: use **indeterminate presentation** — empty/center value, or `value` not implying a real number; on first drag, write new opacity to all selected (existing fan-out OK).
- Practical approach matching other mixed number fields:
  - `value={mixed.opacity?.isMixed ? 50 : Math.round(...)}` is still misleading.
  - Better: when mixed, set `value={0}` or midpoint **and** `data-mixed="true"` already present; add `aria-valuetext="mixed"` and **do not** display numeric % in label (done).
  - **Recommended:** when mixed, omit controlled value flicker by using `defaultValue` uncontrolled until change — harder in React.
  - **Pragmatic recommended:** when mixed, show slider at `50` with `data-mixed="true"` AND hide percentage in label (already) + add helper text "Multiple values"; first `onChange` applies absolute opacity to all (current fan-out). Document as intentional.

**Stronger fix:** when mixed, render slider with `value={0}` and CSS half-fill via `data-mixed` styling already partially there — update tests in `missing-controls.test.jsx` / indeterminate tests.

## Related Code Files

- Modify: `client/src/data/element-defaults.js` (callout size)
- Modify: `client/src/data/element-defaults.test.js` if size asserted
- Modify: `client/src/components/properties/common-element-controls.jsx`
- Modify: `client/src/components/properties/missing-controls.test.jsx` and/or `indeterminate-multi-select.test.jsx`
- Optional: `client/src/components/canvas/use-canvas-resize-rotate.js` only if choosing MIN_SIZE exception (not recommended)

## TDD — Tests First (RED)

```js
// element-defaults.test.js
it('callout default width/height are >= MIN_SIZE (40)')

// missing-controls / common controls
it('marks opacity mixed and does not present a single authoritative percent label')
it('writing opacity from mixed selection fans out via onUpdate') // existing may pass
```

For callout create path:

```js
// element-factory smoke
it('createElement callout has width >= 40')
```

## Implementation Steps

1. Callout defaults → 40×40; update any snapshot expecting 36.
2. Opacity mixed: enhance label/aria; ensure slider `data-mixed` + optional visual class; avoid claiming false % in accessible name.
3. Green tests.
4. Confirm MIN_SIZE still 40 for resize math tests.

## Success Criteria

- [ ] New callout never smaller than MIN_SIZE
- [ ] Mixed opacity does not show a confident single % as the only cue
- [ ] Fan-out opacity still works
- [ ] Resize MIN_SIZE tests still pass

## VERIFY Gate

```bash
npx vitest run client/src/data/element-defaults.test.js
npx vitest run client/src/components/properties/missing-controls.test.jsx
npx vitest run client/src/components/properties/indeterminate-multi-select.test.jsx
npx vitest run client/src/components/canvas/canvas-geometry-ops.smoke.test.js
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Existing decks with 36 callouts | No migration required; only new defaults |
| Concurrent UI a11y plan edits wrapper | Phase 5 only touches defaults + properties panel |

## Risk: Low | Blast: Defaults + properties opacity only

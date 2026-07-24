---
title: "Local Evidence - Present Navigation"
date: 2026-05-23
status: local-pass-upstream-blocked
phase: 2
rowId: present-navigation
---

# Local Evidence - Present Navigation

## Scope Guard

This report is local regression evidence for the current repo only. It is not
upstream oracle evidence, does not prove upstream parity, and does not make the
matrix row release-ready.

The row remains `Blocked` until approved upstream automation passes, complete
manual oracle evidence is attached, or a signed row-level waiver is approved.

## Row

| Field | Value |
|---|---|
| Row id | `present-navigation` |
| Tier | `MVP P0` |
| Security invariant | `no` |
| Behavior contract | Start present mode and navigate slides with keyboard/API; presenter changes propagate to viewer state |
| Matrix path | `docs/upstream-parity-matrix.md` |

## Commands

```powershell
npx playwright test tests/e2e/live/present-mode-keyboard-navigation-presenter-to-viewer-sync.spec.js
npm test -- shared/tests/present-mode-section-styles.test.js
```

## Results

| Command | Exit code | Result | Duration |
|---|---:|---|---:|
| `npx playwright test tests/e2e/live/present-mode-keyboard-navigation-presenter-to-viewer-sync.spec.js` | `0` | `4 passed` | `14.1s` |
| `npm test -- shared/tests/present-mode-section-styles.test.js` | `0` | `9 passed` | `1.59s` |

## Covered Local Behaviors

- `ArrowRight` on presenter advances the viewer slide index.
- Presenter `Reveal.left()` sends viewer back to the previous slide.
- Presenter `Reveal.slide(0)` brings presenter and viewer back to the first
  slide.
- End-of-deck navigation lands on the last slide for the viewer.
- Present-mode section styles remain covered by shared HTML generation tests.

## Limitations

- No approved upstream runtime evidence was captured.
- No screenshot, video, or exported artifact from the approved upstream SHA is
  attached.
- Hidden-slide behavior and rapid navigation are not fully covered by this
  local slice.
- This result cannot be used as `Pass` evidence for upstream parity.

## Follow-Up Required

- Capture manual oracle evidence for `present-navigation`, or recover upstream
  automation for the approved SHA.
- Add or identify local coverage for hidden-slide and rapid-navigation edge
  cases before considering this row fully covered.
- Assign a reviewer for manual oracle evidence signoff.

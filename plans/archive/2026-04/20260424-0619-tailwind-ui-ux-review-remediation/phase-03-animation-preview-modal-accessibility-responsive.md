---
phase: 3
title: "Animation Preview Modal Accessibility Responsive"
status: complete
priority: P1
effort: "2h"
dependencies: [1, 2]
---

# Phase 03: Animation Preview Modal Accessibility Responsive

## Context Links

- `client/src/components/AnimationPreviewModal.jsx`
- `client/src/hooks/use-reveal-preview-frame.js`
- `tests/e2e/animation-preview.spec.js`

## Overview

Make Animation Preview a real accessible dialog and prevent playback controls from clipping at narrow widths.

## Requirements

- Functional: open, step, play, replay, and close by Escape/overlay/close button.
- Non-functional: no horizontal overflow at `390x844`; iframe preview behavior unchanged.

## Architecture

Keep modal local to `EditorPage`. Use React refs/effects for focus handling and keyboard close. Move controls into a wrap-safe footer.

## Related Code Files

- Modify: `client/src/components/AnimationPreviewModal.jsx`
- Modify: `client/src/components/AnimationPreviewModal.test.jsx`
- Create: `tests/e2e/animation-preview.spec.js`

## Implementation Steps

1. Add `role="dialog"`, `aria-modal`, labelled title, and close `aria-label`.
2. Add Escape handling and focus return.
3. Put controls in responsive wrap-safe footer.
4. Keep preview body scroll-safe and iframe visible.
5. Add E2E assertions for open, Escape close, and narrow overflow.

## Todo List

- [ ] Dialog semantics added.
- [ ] Keyboard close added.
- [ ] Focus return implemented.
- [ ] Controls do not clip at narrow viewport.

## Success Criteria

- [ ] SSR tests confirm semantics.
- [ ] Playwright confirms keyboard close and no horizontal overflow.
- [ ] Preview state still targets current slide only.

## Risk Assessment

Risk: focus return can fail if opener unmounts. Mitigation: guard `.focus()` and ignore stale elements.

## Security Considerations

No change to iframe sandboxing or generated preview HTML.

## Next Steps

Fix project export resilience.

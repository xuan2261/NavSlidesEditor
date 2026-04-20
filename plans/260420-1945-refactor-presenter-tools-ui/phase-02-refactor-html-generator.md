---
phase: 2
title: "Refactor HTML Generator"
status: pending
priority: P2
effort: "30m"
dependencies: [1]
---

# Phase 2: Refactor HTML Generator

## Overview
Remove the hardcoded `#fs-btn` Fullscreen button from `shared/src/htmlGenerator.js`. The HTML string and its associated CSS for the Fullscreen button will be moved and integrated into `shared/src/presenterTools.js` in Phase 3.

## Requirements
- Functional: The Fullscreen button must not be injected independently into the presentation DOM.
- Non-functional: Clean up the dead CSS styles associated with the detached button.

## Architecture
- `htmlGenerator.js` string templates for `generateRevealHTML`

## Related Code Files
- Modify: `shared/src/htmlGenerator.js`

## Implementation Steps
1. Open `shared/src/htmlGenerator.js`.
2. Locate the CSS block injecting styles for `#fs-btn` (lines ~135-142) and delete it.
3. Locate the HTML line rendering `<button id="fs-btn"...>&#x26F6; Fullscreen</button>` (line ~153) and delete it.

## Success Criteria
- [ ] No occurrences of `#fs-btn` CSS rules in `htmlGenerator.js`.
- [ ] No `<button id="fs-btn">` in the HTML body template in `htmlGenerator.js`.

## Risk Assessment
- Low. Fullscreen functionality is temporarily removed until Phase 3 puts it back in a better location.

# Phase 04 - Port Copy URL Context Menu

## Context Links

- [Plan](./plan.md)
- [Candidate Matrix](./reports/candidate-matrix.md)
- [Impact Report](../reports/researcher-260514-upstream-selective-port-impact.md)

## Overview

- Priority: P1
- Status: Complete
- Goal: port upstream `93816b88` concept: Copy URL action for image/video right-click context menu.

## Key Insights

- Local landing zone likely:
  - `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`
  - `client/src/components/SlideCanvas.jsx`
- This is the safest candidate because it is small and UI-local.
- Must avoid unsafe URL handling and clipboard failure regressions.

## Requirements

- Functional:
  - Right-click image/video element exposes Copy URL action when element has a usable URL/source.
  - Action copies normalized URL to clipboard.
  - Missing/unsupported URL does not crash UI.
- Non-functional:
  - Keep context menu dimensions stable.
  - Follow existing component patterns.
  - No schema change.

## Architecture

```text
Canvas selected element -> right-click context menu -> Copy URL action -> clipboard API
```

## Related Code Files

- Modify:
  - `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`
  - `client/src/components/SlideCanvas.jsx` if parent action wiring is needed
  - `tests/e2e/element-lifecycle.spec.js` or helper file if adding E2E coverage
- Create:
  - Focused unit/component test only if current test harness supports component-level context menu testing.
- Delete: none.

## Implementation Steps

1. Inspect upstream:
   ```powershell
   git show 93816b88 -- client/src/components client/src
   ```
2. Inspect local menu API:
   ```powershell
   rg -n "right-click|context|copy|duplicate|reset crop" client/src/components
   ```
3. Add action using existing button/menu pattern.
4. Use clipboard API defensively:
   - Check `navigator.clipboard?.writeText`.
   - Handle rejection with non-crashing UI behavior.
   - Do not transform `javascript:` or unsupported schemes into active links.
5. Add tests:
   - E2E creates image/video element or uses existing fixture.
   - Right-click opens menu.
   - Copy URL action becomes visible for media element.
   - Clipboard receives expected value where Playwright permissions allow.
6. Commit as a topic batch:
   ```powershell
   git add <files>
   git diff --cached --check
   git commit -m "feat(editor): add copy url context menu action"
   ```

## TDD / Verification

- Before implementation:
  ```powershell
  npm run test:e2e -- tests/e2e/element-lifecycle.spec.js
  ```
- After implementation:
  ```powershell
  npm run lint
  npm run build
  npm run test
  npm run test:e2e -- tests/e2e/element-lifecycle.spec.js
  npm run test:e2e -- tests/e2e/element-interactions.spec.js
  ```
- Manual:
  - Add image element.
  - Right-click image.
  - Copy URL.
  - Paste into text field/external clipboard check.
  - Repeat for missing URL and video URL if supported.

## Todo List

- [x] Inspect upstream commit `93816b88`.
- [x] Inspect local context menu wiring.
- [x] Add Copy URL action.
- [x] Add focused test coverage.
- [x] Run focused E2E before and after.
- [x] Run lint/build/unit.
- [x] Commit topic batch.

## Success Criteria

- Copy URL works for eligible media.
- Non-media and missing URL states remain stable.
- Tests pass.
- Commit is reversible.

## Risk Assessment

- Risk: clipboard API unavailable in test/browser context.
  - Mitigation: fallback UI no-op/error path; Playwright can grant permissions or mock clipboard.
- Risk: copying unsafe scheme.
  - Mitigation: copy only stored source string; do not execute or render it.

## Security Considerations

- Clipboard action must not fetch remote URL.
- Do not expose local filesystem paths beyond already visible element source.

## Next Steps

- Proceed to Phase 05 typography/export consistency.

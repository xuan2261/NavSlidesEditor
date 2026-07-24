---
status: completed
priority: P1
effort: 1.5d
---

# Phase 03 - Matrix Debt Batch A: Commands And File Menu

## Context Links

- Allowlist: `scripts/feature-inventory/coverage-gate-allowlist.json`
- Manifest: `scripts/feature-inventory/feature-manifest.json`
- Main editor: `client/src/pages/EditorPage.jsx`
- Ribbon/menu components: `client/src/components/ribbon/*`

## Overview

Close command and file-menu debts through real seams and focused tests: `command.insertLink`, `command.insertSlide`, `command.startSlideshow`, and `control.file.menu`.

## Key Insights

- Report says avoid broad full-page Playwright tests when unit/component seams are possible.
- Existing allowlist reasons point to inline closures and deep component tree issues.
- New editor logic should move into hooks/stores/helpers, not expand `EditorPage.jsx`.

## Requirements

- Functional: command handlers have stable behavior and tests with `[cap:<id>]` tags.
- Functional: start slideshow command performs real app behavior, not a stub.
- Functional: file menu opens/exposes expected commands through an isolated component test or smallest viable integration test.
- Non-functional: no file grows materially; extract small helper/hook if needed.

## Architecture

Target small seams:

```text
EditorPage.jsx
  -> use-editor-command-actions.js
  -> command palette definitions / ribbon callbacks

Ribbon file menu component
  -> component test with user-event
```

If a command already has a store action or hook, test that instead of creating a new abstraction.

## Related Code Files

| Action | Path | Notes |
|---|---|---|
| Modify | `client/src/pages/EditorPage.jsx` | Remove inline/stub command wiring only where necessary |
| Optional create | `client/src/hooks/use-editor-command-actions.js` | Shared command actions if no existing hook fits |
| Modify/create | `client/src/hooks/*.test.js` or `client/src/components/ribbon/__tests__/*.test.jsx` | `[cap:*]` coverage |
| Modify | `scripts/feature-inventory/coverage-gate-allowlist.json` | Remove resolved four entries |
| Generated | `docs/feature-coverage-matrix.md` | Via `npm run matrix` |

## TDD Plan

1. RED: add focused tests tagged `[cap:command.insertLink]`, `[cap:command.insertSlide]`, `[cap:command.startSlideshow]`, `[cap:control.file.menu]`.
2. GREEN: extract minimal command/action seams and wire `EditorPage` to them.
3. GREEN: implement real `startSlideshow` behavior consistent with existing present route/status bar logic.
4. GREEN: remove resolved allowlist entries.
5. REFACTOR: keep naming kebab-case and helper files focused.

## Tests For This Phase

| Capability | Preferred test layer | Expected assertion |
|---|---|---|
| `command.insertLink` | unit/component | invokes link insertion UI or TipTap link action with selected text |
| `command.insertSlide` | unit/component | opens layout/new-slide flow or calls slide creation handler |
| `command.startSlideshow` | unit/component/e2e smoke if needed | starts presentation from current slide through real navigation path |
| `control.file.menu` | component | File menu opens and exposes expected actions with roles/test ids |

## Verification Commands

```powershell
npx vitest run client/src/hooks client/src/components/ribbon/__tests__
npm run matrix:gate
npm run test:coverage
```

## Todo List

- [x] Identify existing command/action seam.
- [x] Add RED tests with four capability tags.
- [x] Implement smallest extraction/wiring.
- [x] Remove resolved allowlist entries.
- [x] Regenerate matrix and run gate.

## Success Criteria

- Four listed capabilities move from ALLOWED to PASS.
- `coverage-gate-allowlist.json` has at most 6 entries.
- No new brittle test depending on visual layout details.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Start slideshow behavior ambiguous | Medium | Reuse existing status bar/present handler semantics |
| Component test needs too much provider setup | Medium | Test action seam first; only mount UI where role contract matters |

## Security Considerations

- Insert-link behavior must preserve existing URL/content safety assumptions.
- File menu test must not trigger destructive real file/network operations.

## Next Steps

Proceed to Phase 4 after matrix gate shows the four command/menu debts removed.

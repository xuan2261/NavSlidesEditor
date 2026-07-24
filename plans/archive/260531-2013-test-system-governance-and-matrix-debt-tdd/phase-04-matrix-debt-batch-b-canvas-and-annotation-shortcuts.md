---
status: completed
priority: P1
effort: "1.5-2d"
---

# Phase 04 - Matrix Debt Batch B: Canvas And Annotation Shortcuts

## Context Links

- Canvas hooks: `client/src/hooks/use-canvas-pointer-interaction.js`, `client/src/components/canvas/*`
- Keyboard hook: `client/src/hooks/use-keyboard.js`
- Shortcut registry: `client/src/components/ribbon/default-keyboard-shortcut-definitions-registry.js`
- Annotation components/hooks: `client/src/hooks/use-annotation-sync.js`, live/presenter pages

## Overview

Close remaining allowlisted debts for `canvas.lock`, `canvas.move`, and annotation shortcuts: pen, highlighter, laser, erase.

## Key Insights

- Canvas movement should be tested at lowest stable layer, not through fragile drag pixels unless no pure seam exists.
- Annotation shortcut debts are wiring coverage, not external Socket.IO behavior.
- Keep present-mode and live-mode semantics intact.

## Requirements

- Functional: locked elements cannot move through the tested interaction path.
- Functional: move behavior applies expected delta and preserves other element fields.
- Functional: annotation shortcut callbacks dispatch correct tool modes.
- Non-functional: tests are deterministic under jsdom/happy-dom where possible.

## Architecture

Preferred seams:

```text
canvas geometry/action helper
  -> pure tests for lock/move rules

shortcut registry + useKeyboard
  -> callback forwarding tests for annotation tools
```

Only add Playwright if DOM pointer behavior itself is the only meaningful assertion.

## Related Code Files

| Action | Path | Notes |
|---|---|---|
| Modify/create | `client/src/components/canvas/*` or `client/src/hooks/use-canvas-*.js` | Small exported helper if needed |
| Modify/create | `client/src/components/canvas/*.test.js` or `client/src/hooks/*.test.js` | `[cap:canvas.lock]`, `[cap:canvas.move]` |
| Modify | `client/src/hooks/use-keyboard.js` or related test | Annotation shortcut callback coverage |
| Modify | `scripts/feature-inventory/coverage-gate-allowlist.json` | Remove resolved six entries |
| Generated | `docs/feature-coverage-matrix.md` | Via `npm run matrix` |

## TDD Plan

1. RED: add tests tagged `[cap:canvas.lock]` and `[cap:canvas.move]`.
2. RED: add shortcut tests tagged `[cap:shortcut.penTool]`, `[cap:shortcut.highlighterTool]`, `[cap:shortcut.laserPointer]`, `[cap:shortcut.eraseAnnotations]`.
3. GREEN: extract/call minimal helpers for canvas move/lock if existing code cannot be tested directly.
4. GREEN: wire annotation shortcut callback forwarding if missing.
5. GREEN: remove resolved allowlist entries.
6. REFACTOR: keep helper names domain-specific, no generic event framework.

## Tests For This Phase

| Capability | Preferred test layer | Expected assertion |
|---|---|---|
| `canvas.lock` | unit | locked element ignores move path / lock state honored |
| `canvas.move` | unit | element x/y changes by intended delta |
| `shortcut.penTool` | hook unit | keyboard chord calls pen handler |
| `shortcut.highlighterTool` | hook unit | keyboard chord calls highlighter handler |
| `shortcut.laserPointer` | hook unit | keyboard chord calls laser handler |
| `shortcut.eraseAnnotations` | hook unit | keyboard chord calls eraser/erase handler |

## Verification Commands

```powershell
npx vitest run client/src/hooks client/src/components/canvas
npm run matrix:gate
npm run test:coverage
```

## Todo List

- [x] Locate current move/lock handling path.
- [x] Add RED capability-tagged tests.
- [x] Extract minimal deterministic helper if needed.
- [x] Verify annotation shortcut forwarding.
- [x] Remove remaining allowlist entries that now pass.
- [x] Regenerate matrix and run coverage.

## Success Criteria

- Allowlist shrinks to 0, or any remaining entry has a new explicit blocker.
- Matrix gate passes with no new unallowlisted GAP/SKIP/TAGGED.
- No full-page brittle tests added for pure logic.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Canvas drag behavior depends on DOM geometry | Medium | Test pure geometry helper and keep one existing smoke for DOM |
| Annotation shortcuts differ between editor/presenter scopes | Medium | Document scope and test the registered callback layer |

## Security Considerations

- Annotation shortcut tests must not open live rooms or require tokens.
- Keep keyboard tests scoped to local callback behavior.

## Next Steps

Proceed to Phase 5 after the matrix allowlist is reduced and gates are green.

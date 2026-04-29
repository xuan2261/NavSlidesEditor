---
phase: 2
title: "Fix Editor Batch Actions And Find Replace"
status: completed
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Fix Editor Batch Actions And Find Replace

## Overview

Fix editor-local state bugs in slide batch duplicate/delete and find/replace empty replacement.

## Requirements

- Functional: multi-select duplicate/delete executes once against `prev` state; replace can delete text with `''`.
- Non-functional: helpers stay small and unit-testable.

## Related Code Files

- Modify: `client/src/hooks/use-slide-operations.js`, `client/src/components/SlidePanel.jsx`, `client/src/components/FindReplaceBar.jsx`, `tests/e2e/pages/EditorPage.js`
- Create: `client/src/hooks/slide-operation-helpers.js`, `client/src/components/find-replace-helpers.js`

## Implementation Steps

1. Add slide operation helpers for duplicate, delete, and clamp.
2. Refactor `useSlideOperations` to use helpers and expose batch actions.
3. Update `SlidePanel` batch footer to call batch actions instead of looping single callbacks.
4. Extract find/replace helper and remove `!replaceTerm` guards.
5. Update page object selector for the real `All` button.

## Success Criteria

- [x] Duplicate selected slides preserves order and selection.
- [x] Delete selected slides clamps active index.
- [x] Replace-all with empty string removes matches.
- [x] Unit and E2E regressions pass.

---
phase: 2
title: "Game Defaults Single Source"
status: completed
priority: P0
dependencies: [1]
---

# Phase 02: Game Defaults Single Source

## Overview

Remove duplicated game subtype defaults and stale comments by centralizing game base defaults and subtype defaults in one module.

## Requirements

- Functional: `createGameElement(gameType)` and `ELEMENT_DEFAULTS.game` must derive from the same game defaults object.
- Functional: all 10 game types must be represented: `name-picker`, `hot-potato`, `jeopardy`, `four-corners`, `relay-race`, `trivia-champ`, `scattergories`, `poll`, `word-cloud`, `matching`.
- Non-functional: defaults must remain JSON-serializable and safe for tests to deep-clone.
- Non-functional: created game elements must not share mutable nested arrays/objects with defaults or with each other.

## Architecture

Create or refactor a single source such as `client/src/constants/game-element-types-constants.js` exporting:

```js
export const GAME_BASE_DEFAULTS = { ... }
export const GAME_TYPE_DEFAULTS = { ... }
export function buildGameElementDefaults() { ... }
```

Then `ELEMENT_DEFAULTS.game` and `createGameElement()` both consume that source. `createGameElement()` continues to return flattened subtype defaults for existing runtime compatibility.

## Related Code Files

- Modify: `client/src/constants/game-element-types-constants.js`
- Modify: `client/src/data/element-defaults.js`
- Modify: `client/src/hooks/game-element-foundation.test.js`
- Modify: `client/src/components/properties/game-properties.test.jsx`

## TDD Steps

1. Add failing test that every `GAME_TYPES.all` key exists in `ELEMENT_DEFAULTS.game`.
2. Add failing test that `createGameElement(type)` equals base defaults plus `GAME_TYPE_DEFAULTS[type]` plus overrides.
3. Add failing test that comment/count drift cannot recur, for example `GAME_TYPES.all` length is 10 and no hardcoded "7 game types" comment remains where tested by source scan.
4. Add failing mutation-isolation tests proving nested arrays/objects are cloned per `createGameElement()` call.
5. Refactor constants into shared game default exports.
6. Update `ELEMENT_DEFAULTS.game` to consume shared exports.
7. Keep backwards-compatible flattened game element shape.

## Targeted Tests

```powershell
npx vitest run client/src/hooks/game-element-foundation.test.js
npx vitest run client/src/components/properties/game-properties.test.jsx
npx vitest run client/src/components/game-integration-tests.test.jsx
```

## Success Criteria

- [x] Only one authoritative game subtype defaults object exists.
- [x] `createGameElement()` behavior remains backward-compatible.
- [x] All 10 game types are covered by tests.
- [x] Mutating one created game element cannot mutate defaults or another created game element.
- [x] No stale "All 7 game types" assertion/comment survives.

## Risk Assessment

Risk: changing default object nesting may break existing game property panels. Mitigation: keep `createGameElement()` flattened output unchanged and test both nested defaults and flattened factory output.

# Phase 06 Game Element And Live-Only Policy

## Context Links

- `C:/Work/NavSlidesEditor/client/src/constants/game-element-types-constants.js`
- `C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-element-renderer.jsx`
- `C:/Work/NavSlidesEditor/server/services/game-socket-handler.js`
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`

## Overview

Priority: P1
Status: Completed
Goal: make game element matrix rows honest: editor controls and canvas render are first-class, live/socket behavior separate, export is static fallback unless explicitly changed.

## Key Insights

- `game` is one canonical element with 7 game subtypes.
- Full game protocol audit is bigger than element-control matrix.
- Shared HTML export currently renders a static game placeholder.
- PPTX export should warn/fallback, not silently drop.

## Requirements

Functional:
- Verify insert gallery exposes all 7 game types.
- Verify `GameProperties` writes at least one non-default persisted config path for each of the 7 subtypes.
- Verify canvas renderer shows expected game subtype preview.
- Verify shared HTML export static fallback includes only public title/type/static label fields.
- Verify fallback never serializes raw config, answer keys, scoring/admin/session fields, or player/admin controls.
- Verify PPTX fallback/warning contract.
- Do not mark live/player socket behavior beyond `partial` without minimum authorization boundary tests.

Non-functional:
- Do not redesign live game sockets.
- Do not make exported HTML interactive games unless explicitly planned.
- Keep game subtype tests representative, not exhaustive for every gameplay rule.
- Representative tests must still touch each subtype; untested subtype controls stay `partial`.

## Architecture

```text
Insert game gallery
  -> create game element
  -> GameProperties subtype fields
  -> canvas game renderer
  -> live/player routes and socket flow (separate)
  -> shared HTML static placeholder
  -> PPTX fallback/raster/placeholder
```

## Related Code Files

Tests:
- `C:/Work/NavSlidesEditor/client/src/hooks/game-element-foundation.test.js`
- `C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.test.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/canvas-game-element-renderer-phase-03.contract.test.jsx`
- `C:/Work/NavSlidesEditor/shared/tests/element-renderers.test.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-renderers.test.js`

Potential source:
- `C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-element-renderer.jsx`
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-renderers.js`

## Tests First

1. Unit: `GAME_TYPES.all` has 7 unique values and Insert gallery maps each to `onAddGame`.
2. RTL: `GameProperties` updates at least one stable non-default field per subtype.
3. Canvas contract: renderer does not crash on every subtype default config and renders the selected public subtype label.
4. Shared renderer: exported game placeholder includes title, `data-game-type`, and "Interactive game".
5. Security snapshot: exported placeholder excludes answer keys, scoring config, admin/session fields, and raw game config JSON.
6. PPTX export: unsupported game type produces user-visible warning/fallback, not empty slide.
7. Socket boundary smoke: player cannot invoke presenter/admin events for the same game row, or live socket behavior remains explicitly out-of-scope/partial with linked follow-up.

Commands:

```bash
npm run test -- client/src/hooks/game-element-foundation.test.js
npm run test -- client/src/components/canvas/element-renderers/canvas-game-element-renderer-phase-03.contract.test.jsx
npm run test -- shared/tests/element-renderers.test.js
```

## Implementation Steps

1. Add game matrix subsection with subtype rows.
2. Add Insert gallery and property write tests.
3. Add shared export fallback tests if missing.
4. Add export fallback whitelist/security tests.
5. Add PPTX fallback warning test.
6. Mark live/player socket behavior as `partial` and link to separate game protocol tests unless minimum authz smoke exists.

## Todo List

- [x] Game subtype insert tests.
- [x] GameProperties representative tests.
- [x] Per-subtype non-default persistence tests.
- [x] Canvas renderer all-subtype smoke.
- [x] Shared export fallback test.
- [x] Game fallback whitelist/no-leak test.
- [x] PPTX fallback warning test.
- [x] Matrix status update.

## Success Criteria

- No game element row says full export `works` when export is static fallback.
- Insert/control/render behavior is covered by tests.
- Game subtype rows are not marked `works` unless each subtype has at least one non-default persisted path.
- Static fallback contains no answer/admin/scoring/session data.
- Live-only behavior is clearly out of this matrix or marked partial.

## Risk Assessment

- Risk: game tests become huge.
  Mitigation: one stable non-default setting per subtype, not full gameplay.
- Risk: export expectations overpromise.
  Mitigation: state static fallback as product policy unless changed.

## Red Team Review Applied

- Finding 12: game coverage must touch each subtype and fallback output must be whitelist-only to avoid false `works` and answer/admin leaks.
- Finding 5 security overlap: live/player socket rows stay `partial` unless minimum authorization smoke tests exist.

## Security Considerations

- Game data is user-authored; escape fallback labels in shared HTML.
- Do not expose player/admin controls through exported static placeholders.
- Export fallback must not serialize raw game config, answer keys, scoring rules, admin/session identifiers, or live room metadata.

## Next Steps

Phase 07 turns export gaps into explicit policy and executable fallback contracts.

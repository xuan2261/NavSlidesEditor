---
phase: 2
title: "Remove Dead Present Wiring"
status: pending
priority: P1
effort: "0.5-1d"
dependencies: [1]
---

# Phase 2: Remove Dead Present Wiring

> **Red Team #3 (Critical) — applied.** Original premise ("every `presentation`/`presentation-game` callback is inert") is FALSE. `use-keyboard.js:42` activates `presentation-game`-scope shortcuts whenever `activeGameType` is truthy — **independent of `isPresenting`** (handler docstring `:13-15` documents this). EditorPage feeds `activeGameType={currentGameType}` (`:1152`), and `currentGameType` is non-null whenever a `game` element is on the current slide (`:1126-1129`). Existing test `game-presenter-keyboard-shortcut-handler.test.js:168-174` asserts `onGameHud` fires with `isPresenting:false, activeGameType:'jeopardy'`. So `G`→HUD / `L`→leaderboard are REACHABLE in the plain editor. Scope is now split: remove only the genuinely-dead `presentation`-scope wiring; KEEP all game-scope wiring + its overlays.

## Overview

Remove the unreachable in-editor **`presentation`-scope** present/annotation wiring from `EditorPage` (B/W screen, F5, arrows, pen/laser, end-slideshow, annotation tools). Present stays as the separate-tab flow (`presentInWindow`). **Keep all `presentation-game`-scope wiring** (`onGameHud`/`onGameLeaderboard` + `showGameHud`/`showGameLeaderboard` state + `GameHudOverlay`/`GameLeaderboardOverlay`) — it fires in the editor when a game element is on-slide. Shared overlay components are kept untouched regardless — `LiveViewPage`/`SpeakerViewPage` depend on them.

## Requirements

- Functional: no user-visible behavior loss. The removed `presentation`-scope paths never fired (gated on `isPresenting`, never true). **Game-HUD/leaderboard toggles (G/L) keep working in-editor.** Present button (`:1402`) still opens the reveal tab. Escape still deselects/stops editing.
- Non-functional: EditorPage drops ~40-50 LOC of dead state + JSX (revised down from ~75 — the game wiring that stays was previously counted as removable; see plan.md LOC note).

## Architecture

- **Scope resolution (corrected):** `use-keyboard.js:33-43` resolves the active scope. With `isPresenting` always false, the base scope is `editor`, so `presentation`-scope shortcuts (B/W/arrows/pen/laser/F5/end — registry scopes `['presentation']`) never fire → genuinely dead, removable. BUT line `:42` ORs in `presentation-game`-scope shortcuts whenever `activeGameType` is truthy → `onGameHud`/`onGameLeaderboard` ARE reachable. **Remove the `presentation`-scope set; keep the `presentation-game`-scope set.**
- **Dead (remove):** `isPresenting`/`setIsPresenting`, `overlayColor` (only set by unreachable `onBlackScreen`/`onWhiteScreen`), annotation state (`annotationTool`/`annotationColor`/`_annotationStrokes`), `BlackScreenOverlay` (`visible={overlayColor!==null}` always false), `AnnotationToolbar`, and the `presentation`-scope `useKeyboard` callbacks. `F5`→`onStartSlideshow` is `editor`-scope but only `console.log` stubs (`:1154-1160`) — remove the stub callbacks.
- **Reachable (KEEP):** `showGameHud`/`showGameLeaderboard` state (`:230-231`), `onGameHud`/`onGameLeaderboard` callbacks (`:1164,1173`), `GameHudOverlay` (`:1933`), `GameLeaderboardOverlay` (`:1940`), and `currentGameType` derivation (`:1126-1129`) — feeds both the game shortcuts AND the badge.
- Keep `BlackScreenOverlay`, `AnnotationToolbar`, `GameHudOverlay`, `GameLeaderboardOverlay` source files (Live/Speaker consumers verified at `LiveViewPage.jsx:306`, `SpeakerViewPage.jsx:250`). Only the orphan `presentation`-scope render+wiring in EditorPage is removed.
- The `game-active-indicator` badge (`:1923-1930`) is editor-useful (shows a game element exists on the slide) — **keep it**.

## Related Code Files

- Modify: `client/src/pages/EditorPage.jsx`
  - Remove state: `isPresenting`/`setIsPresenting` (`:227`), `overlayColor` (`:226`), `annotationTool`/`annotationColor`/`_annotationStrokes` (`:235-237`), `_activeGameType`/`_setActiveGameType` (`:232`, unused).
  - **KEEP state:** `showGameHud`/`showGameLeaderboard` (`:230-231`) — reachable via game-scope shortcuts.
  - Remove from `useKeyboard` call ONLY the `presentation`-scope + dead-stub callbacks: `isPresenting` (drop the prop; defaults false), `onStartSlideshow*`, `onSlide*` (arrows), `onBlackScreen`, `onWhiteScreen`, `onEndSlideshow`, `onTimer*`, `onPenTool`, `onLaserPointer`, `onHighlighterTool`, `onEraseAnnotations` (within `:1151-1195`).
  - **KEEP in `useKeyboard` call:** `activeGameType={currentGameType}`, `onGameHud`, `onGameLeaderboard`, and any `onGame*`/`onTeamSelect*` that are `presentation-game`-scope and render/affect editor state. Audit each game callback against the registry scope before deciding — only drop those that are pure `console.log` stubs with no editor effect.
  - Trim `onEscape` (`:1141-1149`) to drop the black/white-overlay + annotation branches; **keep** the game-HUD/leaderboard close branch (reachable), deselect, stop-edit, command-palette close.
  - Remove JSX: `BlackScreenOverlay` (`:1916`), `AnnotationToolbar` (`:1987`). **KEEP JSX:** `GameHudOverlay` (`:1933`), `GameLeaderboardOverlay` (`:1940`).
  - Keep: `onPresent` (`:1402`), `currentGameType` derivation (`:1126-1129`), `game-active-indicator` badge, `CommandPalette`.
- Read for context: `client/src/hooks/use-keyboard.js`, `client/src/utils/default-keyboard-shortcut-definitions-registry.js` (verify each shortcut's `scopes` before removing its callback), `client/src/components/canvas/game-presenter-keyboard-shortcut-handler.test.js` (existing reachability test — do not break it), `client/src/pages/LiveViewPage.jsx`, `client/src/pages/SpeakerViewPage.jsx`

## Implementation Steps

1. **Scope audit (do FIRST):** For every callback in the `useKeyboard` call, grep its shortcut `id` in `default-keyboard-shortcut-definitions-registry.js` and record its `scopes`. Build two lists: `presentation`-only (removable) vs contains-`presentation-game`/`editor`-with-effect (keep). This is the gate that prevents deleting reachable game wiring.
2. **RED (guard test) — render WITH a game element on the slide:** add `editor-page-present-wiring.test.jsx`. (a) Seed a slide WITHOUT a game element: assert `B`/`W` render no overlay and `F5` fires no slideshow (lock for the dead `presentation`-scope paths). (b) Seed a slide WITH a `game` element (so `activeGameType` is truthy): assert pressing `G` opens `GameHudOverlay` and `L` opens `GameLeaderboardOverlay` — this LOCKS the reachable behavior so the removal cannot delete it. Do NOT assert G/L are unreachable.
3. Grep-confirm no other EditorPage code reads the removed state (`setIsPresenting`, `overlayColor`, `annotationTool`). Confirm `showGameHud`/`showGameLeaderboard` ARE still read by the kept overlays before keeping.
4. Remove the dead state declarations, the `presentation`-scope/dead-stub `useKeyboard` props, the black/white + annotation `onEscape` branches, and the `BlackScreenOverlay` + `AnnotationToolbar` JSX blocks. Leave game wiring intact.
5. Verify `currentGameType` (`:1126-1129`) stays — needed by both kept game shortcuts and the badge. Remove `liveSocket` game-timer emit callbacks ONLY if their triggering shortcut was in the removable (`presentation`-only) list.
6. Run Phase 1 characterization suite + the new guard test → must stay GREEN (game G/L behavior preserved, dead paths gone).
7. **REFACTOR**: remove unused imports (`BlackScreenOverlay`, `AnnotationToolbar` only — `GameHudOverlay`/`GameLeaderboardOverlay` stay imported). Run `npm run lint`.

## Success Criteria

- [ ] Scope audit recorded: each removed callback proven `presentation`-only-scope; each kept game callback proven `presentation-game`-reachable.
- [ ] Guard test: dead `presentation`-scope paths (B/W/F5) render nothing; **game-scope G/L still open their overlays when a game element is present** (existing `game-presenter-keyboard-shortcut-handler.test.js` still passes).
- [ ] Phase 1 characterization suite stays GREEN.
- [ ] EditorPage LOC reduced by ~40-50 (revised from ≥60; game wiring stays); no unused imports (lint clean).
- [ ] Shared overlay components unchanged; `LiveViewPage`/`SpeakerViewPage` tests still pass.
- [ ] Present button still opens reveal tab (manual + existing e2e if present).

## Risk Assessment

- **Risk (Critical, now mitigated):** Deleting reachable game-scope wiring as if dead. **Mitigation:** mandatory scope audit (step 1) + RED guard test that renders with a game element and locks G/L behavior. Treat any in-editor game-HUD removal as a deliberate UX change requiring user sign-off, NOT a dead-code cleanup.
- **Risk:** A removed callback is actually shared with a live/game path. **Mitigation:** grep each removed symbol repo-wide before deleting; only `presentation`-scope EditorPage-local wiring is in scope.
- **Risk:** Removing `liveSocket` game-timer emits breaks a future live-game editor feature. **Mitigation:** remove only emits whose triggering shortcut was `presentation`-only; document in journal as intentionally removed, recoverable from git.

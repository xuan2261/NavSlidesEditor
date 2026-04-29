---
phase: 1
title: "Game Element Types Foundation"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Game Element Types Foundation

## Overview

Thêm `game` element type vào NavSlides system — định nghĩa schema data, defaults, position, type constants, và routing trong SlideCanvas.

## Requirements

- **Functional:** Element type `"game"` với `gameType` sub-types. Data model đầy đủ cho 7 game types.
- **Non-functional:** Backward compatible — không thay đổi các type hiện có.

## Architecture

```
ELEMENT_DEFAULTS.game = { ... }
DEFAULT_POSITIONS.game = { x: 160, y: 120 }
CanvasElement wrapper → game type → game-element-renderer.jsx
```

### Data Model

```javascript
// Base game element
{
  type: "game",
  gameType: "name-picker" | "hot-potato" | "jeopardy" | "four-corners" |
            "relay-race" | "trivia-champ" | "scattergories",
  width: 640,
  height: 480,
  zIndex: 5,

  // --- Name Picker ---
  items: ["HS1", "HS2", ...],
  pickerMode: "wheel" | "dice" | "button",
  wheelSegments: 8,
  wheelColors: ["#FF5722","#2196F3","#4CAF50","#FFC107","#9C27B0","#00BCD4","#FF9800","#795548"],
  diceCount: 2,
  weighted: false,
  excludeAfterPick: true,
  animationDuration: 2500,

  // --- Hot Potato ---
  title: "Hot Potato Quiz",
  questions: [{ id, question, options[], correctIndex, timeLimit, points }],
  currentQuestion: 0,
  allowLate: false,
  showLeaderboard: true,
  shuffleQuestions: false,

  // --- Jeopardy ---
  title: "Jeopardy",
  teams: [{ name, color }],
  categories: [{ name, questions[100|200|300|400|500] }],
  questions: { "cat-100": { question, answer, used } },
  dailyDouble: ["cat-300"],

  // --- Four Corners ---
  cornerCount: 4,
  eliminateMode: "wrong",
  showTimer: true,

  // --- Relay Race ---
  questionsPerRound: 4,
  shuffleTeams: true,
  passOnWrong: true,

  // --- Trivia Championship ---
  rounds: [{ name, questions[], mode }],
  lightningRound: { enabled, timePerQ },
  jackpotRound: { enabled, multiplier },

  // --- Scattergories ---
  timePerRound: 60,
  letterMode: "random",
  categories: [],
  scoring: "unique",

  // --- Common Display ---
  backgroundColor: "#1a1a2e",
  accentColor: "#6366f1",
  fontFamily: "sans-serif",
  showSoundEffects: true,
  gameStatus: "setup" | "running" | "finished",
}
```

## Related Code Files

- **Modify:** `client/src/data/element-defaults.js` — thêm `game` vào ELEMENT_DEFAULTS + DEFAULT_POSITIONS
- **Modify:** `client/src/components/canvas/element-renderers/registry.js` — thêm `game` renderer import
- **Modify:** `client/src/components/canvas/element-renderers/shape-element-renderer.jsx` — thêm `element.type === 'game'` placeholder
- **Modify:** `client/src/components/canvas/canvas-element-wrapper.jsx` — thêm rendering placeholder cho game type
- **Create:** `client/src/constants/game-types.js` — constants cho gameType values

## Implementation Steps

1. Tạo `client/src/constants/game-types.js` với:
   - `GAME_TYPES` enum
   - `DEFAULT_GAME_COLORS` palette
   - `QUESTION_DEFAULTS` factory function
   - `TEAM_DEFAULTS` factory function

2. Thêm vào `ELEMENT_DEFAULTS.game` base schema (name-picker là default)

3. Thêm `DEFAULT_POSITIONS.game`

4. Import `game-element-renderer` vào registry (file renderer tạm placeholder)

5. Thêm `element.type === 'game'` case trong `canvas-element-wrapper.jsx`

6. Verify: tạo 1 game element → hiện placeholder div trên canvas

## Success Criteria

- [ ] `ELEMENT_DEFAULTS.game` chứa đầy đủ schema cho tất cả 7 game types
- [ ] `DEFAULT_POSITIONS.game` có vị trí mặc định hợp lý
- [ ] Registry có `game` renderer registered
- [ ] `canvas-element-wrapper.jsx` render placeholder cho game type
- [ ] Element được tạo với `type: "game"` và hiển thị trên canvas

## Risk Assessment

- **Risk:** Schema phức tạp → khó maintain. **Mitigation:** Tách defaults riêng cho từng gameType, merge vào base khi tạo element.
- **Risk:** Conflicting properties giữa các game types. **Mitigation:** Dùng optional fields, validate at render time.

## Tests

```javascript
// phase-01-game-element-foundation.test.js
describe('Game Element Foundation', () => {
  test('ELEMENT_DEFAULTS.game has all 7 gameTypes', () => {
    const gameTypes = ['name-picker','hot-potato','jeopardy','four-corners',
                       'relay-race','trivia-champ','scattergories']
    gameTypes.forEach(gt => {
      const el = createGameElement(gt)
      expect(el.type).toBe('game')
      expect(el.gameType).toBe(gt)
    })
  })
  test('DEFAULT_POSITIONS.game exists', () => {
    expect(DEFAULT_POSITIONS.game).toBeDefined()
  })
  test('Name picker has wheel/dice/button modes', () => {
    const picker = createGameElement('name-picker')
    expect(['wheel','dice','button']).toContain(picker.pickerMode)
  })
})
```

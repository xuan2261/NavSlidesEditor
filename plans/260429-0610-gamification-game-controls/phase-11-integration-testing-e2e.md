---
phase: 11
title: "Integration Testing & E2E"
status: completed
priority: P1
effort: "4h"
dependencies: [7, 8, 9, 10]
---

# Phase 11: Integration Testing & E2E

## Overview

Kiểm thử end-to-end toàn bộ game flow: tạo game → GV start → HS join → play → end. Viết E2E tests với Playwright.

## Requirements

- **Functional:** Full game flow hoạt động từ đầu đến cuối.
- **Non-functional:** Tests cover happy path + error cases.

## Test Scenarios

### E2E: Name Picker

```
1. GV opens editor, adds Name Picker element
2. GV edits names: Alice, Bob, Charlie
3. GV sets pickerMode: wheel
4. GV starts presentation
5. GV clicks SPIN
6. Animation plays, winner displayed
7. Winner confirmed in result
```

### E2E: Hot Potato Quiz

```
1. GV adds Hot Potato element
2. GV adds 3 questions with answers
3. GV sets time limit: 15s
4. GV starts presentation
5. HS1 opens /player/:ids, enters name
6. HS2 opens /player/:ids, enters name
7. GV clicks START
8. Question appears on GV screen AND player devices
9. Timer counts down on all screens
10. HS1 submits answer (correct)
11. HS2 submits answer (wrong)
12. Results shown: HS1 +10, HS2 +0
13. GV clicks NEXT
14. Repeat for remaining questions
15. GV clicks END
16. Final leaderboard displayed
```

### E2E: Jeopardy

```
1. GV adds Jeopardy element
2. GV edits: 3 categories, fills questions
3. GV sets 2 teams: Đỏ, Xanh
4. GV starts presentation
5. GV clicks cell "Math-200"
6. Card flips, question revealed
7. GV clicks "Đỏ" (team selection)
8. Đỏ answers correctly
9. Đỏ score: +200
10. Cell shows "Đỏ" color
11. Repeat for remaining cells
12. GV clicks END
13. Final scores displayed
```

## Implementation Steps

1. **Unit Tests** cho từng phase (đã viết trong mỗi phase file)

2. **Integration Tests:**

   ```javascript
   // e2e/games/game-flow.spec.js
   describe('Hot Potato E2E', () => {
     test('full game flow: create → join → play → results', async ({ page }) => {
       // 1. Create presentation with game
       await page.goto('/editor/new')
       await page.click('[title="Insert Game"]')
       await page.click('text=Hot Potato Quiz')
       await page.click('text=Add Question')
       await page.fill('[data-testid="question-input"]', 'What is 2+2?')
       // ... setup questions

       // 2. Start presentation
       await page.click('text=Present')
       await page.click('text=Start Game')

       // 3. Player join
       const playerPage = await page.context().newPage()
       await playerPage.goto(`/player/...`)
       await playerPage.fill('[placeholder="Your name"]', 'Alice')
       await playerPage.click('text=Join')

       // 4. Answer question
       await expect(playerPage.locator('.question-text')).toBeVisible()
       await playerPage.click('text=B')

       // 5. Verify score
       await expect(playerPage.locator('.score')).toContainText('+10')
     })
   })
   ```

3. **Socket.IO Mock Tests:**

   ```javascript
   // server/tests/game-engine.test.js
   import { GameEngine } from '../services/game-engine'

   describe('Game Engine Integration', () => {
     test('multiple games run concurrently', () => {
       GameEngine.createRoom('game1', 'hot-potato', { questions: [] })
       GameEngine.createRoom('game2', 'jeopardy', { categories: [] })

       GameEngine.joinRoom('game1', 'socket1', 'Alice')
       GameEngine.joinRoom('game2', 'socket2', 'Bob')

       expect(GameEngine.getRoom('game1').players.size).toBe(1)
       expect(GameEngine.getRoom('game2').players.size).toBe(1)
     })
     test('game rooms are isolated', () => {
       GameEngine.submitAnswer('game1', 'socket1', 0, 5000)
       expect(GameEngine.getRoom('game2').players.values()[0].score).toBe(0)
     })
   })
   ```

4. **Performance Tests:**
   - 50 players join cùng lúc
   - Answer submission < 100ms latency
   - 25 Jeopardy questions load instantly

5. **Error Handling Tests:**
   - Player disconnect mid-game → remove from room
   - Invalid answer → reject gracefully
   - Duplicate name → append number
   - Game room not found → show error

## Success Criteria

- [ ] Name Picker E2E passes
- [ ] Hot Potato E2E passes (full flow)
- [ ] Jeopardy E2E passes (full flow)
- [ ] Four Corners E2E passes
- [ ] Relay Race E2E passes
- [ ] Trivia Championship E2E passes
- [ ] Scattergories E2E passes
- [ ] Player disconnect handled gracefully
- [ ] 50 concurrent players perform OK
- [ ] All unit tests green
- [ ] All E2E tests green
- [ ] No console errors during gameplay

## Risk Assessment

- **Risk:** Socket.IO test environment setup phức tạp. **Mitigation:** Dùng `socket.io-client` mock server trong tests.
- **Risk:** E2E flakiness với animations. **Mitigation:** Use `waitForSelector` thay vì sleep.

## Files Summary

- **Create:** `tests/e2e/games/game-flow.spec.js`
- **Create:** `server/tests/game-engine.test.js`
- **Modify:** Thêm tests vào existing test suites

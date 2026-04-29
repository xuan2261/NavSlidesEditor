---
phase: 2
title: "Game Backend Engine"
status: completed
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Game Backend Engine

## Overview

Xây dựng Socket.IO game engine và REST API endpoints cho tất cả 7 game types. Mở rộng infrastructure `/live` hiện có.

## Requirements

- **Functional:** Game rooms, player join/leave, answer submission, scoring, leaderboard, random picker, game state sync.
- **Non-functional:** Reuse Socket.IO setup, không conflict với live presentation rooms.

## Architecture

```
server/
├── index.js                        ← thêm /api/games routes
├── services/
│   └── game-engine.js              ← game room management
└── routes/
    └── games.js                    ← REST API handlers
```

### Socket.IO Events

```javascript
// Client → Server
socket.emit('game-join', { roomId, playerName, playerId? })
socket.emit('game-answer', { roomId, questionId, answer, timeSpent })
socket.emit('game-random', { roomId, action: 'spin' | 'roll' | 'pick' })
socket.emit('game-next', { roomId, questionId? })
socket.emit('game-end', { roomId })
socket.emit('game-leave', { roomId })

// Server → Client
socket.on('game-player-joined', ({ players }) {})
socket.on('game-answer-result', ({ playerId, correct, points }) {})
socket.on('game-random-result', ({ winner, index }) {})
socket.on('game-leaderboard', ({ scores }) {})
socket.on('game-question', ({ question, timeLimit, questionNumber }) {})
socket.on('game-ended', ({ finalScores, winner }) {})
socket.on('game-error', ({ message }) {})
```

### REST API Endpoints

```
POST /api/games/:gameId/join     → Tạo/lấy game session
POST /api/games/:gameId/answer   → Nộp đáp án (REST fallback)
GET  /api/games/:gameId/leaderboard
POST /api/games/:gameId/next    → GV: next question
POST /api/games/:gameId/random   → GV: trigger random
POST /api/games/:gameId/end      → GV: end game
GET  /api/games/:gameId/state    → Get current game state
DELETE /api/games/:gameId        → Cleanup game session
```

### Game Room State

```javascript
{
  gameId: string,          // slideId + elementId
  gameType: string,
  status: 'waiting' | 'active' | 'finished',
  players: Map<socketId, { name, score, answers[] }>,
  currentQuestion: number,
  questions: [],
  teams: [],
  createdAt: timestamp,
  presenterSocketId: string,
}
```

## Related Code Files

- **Create:** `server/services/game-engine.js` — GameEngine class (singleton), quản lý rooms
- **Create:** `server/routes/games.js` — REST API handlers
- **Modify:** `server/index.js` — thêm Socket.IO handlers + REST routes

## Implementation Steps

1. Tạo `server/services/game-engine.js`:
   - `GameEngine` singleton class
   - `createRoom(gameId, gameType, options)` — tạo room mới
   - `joinRoom(gameId, socketId, playerName)` — player join
   - `submitAnswer(gameId, socketId, answer)` — nộp đáp án
   - `triggerRandom(gameId)` — random picker
   - `nextQuestion(gameId)` — GV next question
   - `endGame(gameId)` — kết thúc game
   - `getLeaderboard(gameId)` — lấy bảng điểm
   - `cleanup(gameId)` — dọn room

2. Wire Socket.IO events trong `server/index.js`:
   - Thêm `game-join`, `game-answer`, `game-random`, `game-next`, `game-end` handlers
   - Mỗi handler trỏ đến `GameEngine` methods

3. Thêm REST routes trong `server/index.js`:
   - Mount `/api/games` router
   - Implement 7 endpoints

4. Integration: game rooms reuse existing Socket.IO connection (không tạo connection mới)

## Success Criteria

- [ ] Socket.IO `game-join` → player appears in room
- [ ] Socket.IO `game-answer` → score updates, leaderboard broadcast
- [ ] Socket.IO `game-random` → returns random winner index
- [ ] REST `/api/games/:id/leaderboard` → returns correct scores
- [ ] Game room cleanup sau khi end + 5 phút
- [ ] Nhiều games đồng thời không conflict

## Risk Assessment

- **Risk:** Socket.IO event name collision với live presentation. **Mitigation:** Dùng namespace `/games` riêng hoặc prefix `game-` events rõ ràng.
- **Risk:** Memory leak từ orphaned rooms. **Mitigation:** TTL-based cleanup (5 phút sau khi game end).

## Tests

```javascript
// phase-02-game-backend.test.js
describe('Game Engine', () => {
  test('createRoom returns valid room state', () => {
    const room = GameEngine.createRoom('slide1-el1', 'hot-potato', { questions: [] })
    expect(room.status).toBe('waiting')
    expect(room.gameType).toBe('hot-potato')
  })
  test('joinRoom adds player to room', () => {
    GameEngine.createRoom('slide1-el1', 'hot-potato', {})
    const result = GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
    expect(result.players.size).toBe(1)
  })
  test('submitAnswer calculates correct score', () => {
    const room = GameEngine.createRoom('slide1-el1', 'hot-potato', {
      questions: [{ id: 'q1', correctIndex: 0, points: 10 }]
    })
    room.currentQuestion = 0
    const result = GameEngine.submitAnswer('slide1-el1', 'socket-1', 0, 5000)
    expect(result.correct).toBe(true)
    expect(result.points).toBe(10)
  })
  test('triggerRandom returns valid index within range', () => {
    const room = GameEngine.createRoom('slide1-el1', 'name-picker', {
      items: ['A','B','C'], excludeAfterPick: false
    })
    const winner = GameEngine.triggerRandom('slide1-el1')
    expect([0,1,2]).toContain(winner)
  })
  test('excludeAfterPick removes item from pool', () => {
    const room = GameEngine.createRoom('slide1-el1', 'name-picker', {
      items: ['A','B','C'], excludeAfterPick: true
    })
    const w1 = GameEngine.triggerRandom('slide1-el1')
    const w2 = GameEngine.triggerRandom('slide1-el1')
    expect(w1).not.toBe(w2)
    expect(room.items.length).toBe(1)
  })
  test('endGame sets status to finished', () => {
    GameEngine.createRoom('slide1-el1', 'hot-potato', {})
    const result = GameEngine.endGame('slide1-el1')
    expect(result.status).toBe('finished')
  })
})
```

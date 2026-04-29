---
phase: 6
title: "Player UI & Join Flow"
status: completed
priority: P1
effort: "3h"
dependencies: [2]
---

# Phase 6: Player UI & Join Flow

## Overview

Xây dựng trang `PlayerJoinPage.jsx` — trang đơn giản để HS join game bằng mã/phòng, nhập tên, và participate trong game.

## Requirements

- **Functional:** HS mở URL → nhập mã game → nhập tên → tham gia. Real-time answer submission + score display.
- **Non-functional:** Responsive, mobile-first, không cần đăng nhập.

## Architecture

```
client/src/pages/
├── PlayerJoinPage.jsx    ← Entry point: /player/:slideId/:elementId
│     ├── JoinForm        ← Mã phòng + tên
│     ├── WaitingRoom     ← Đợi GV start
│     └── GamePlayer      ← Active game participation
│           ├── QuestionCard   ← Câu hỏi + options
│           ├── AnswerInput   ← Chọn đáp án
│           ├── TimerDisplay  ← Countdown
│           └── PlayerScore    ← Điểm cá nhân
│
client/src/components/player/
├── player-question-card.jsx
├── player-answer-button.jsx
├── player-timer.jsx
└── player-leaderboard.jsx
```

### URL Structure

```
/player/:presentationId/:slideId/:elementId
```

### Join Flow

```
1. HS opens URL
   ↓
2. Show: Game Code + Name Input
   ↓
3. HS enters name → Submit
   ↓
4. Socket.IO: emit 'game-join'
   ↓
5. Server: add to room, broadcast 'game-player-joined'
   ↓
6. Show: Waiting screen (players list)
   ↓
7. GV starts game → broadcast 'game-question'
   ↓
8. HS sees question + timer → selects answer
   ↓
9. Socket.IO: emit 'game-answer'
   ↓
10. GV ends → broadcast 'game-ended'
   ↓
11. Show: Final results
```

### Player UI States

| State | Display |
|---|---|
| `joining` | Form: tên + mã |
| `waiting` | "Waiting for teacher to start..." + player count |
| `question` | Question card + options + timer |
| `answered` | "Answer submitted!" |
| `result` | Correct/incorrect + points earned |
| `finished` | Final leaderboard + rank |

## Related Code Files

- **Create:** `client/src/pages/PlayerJoinPage.jsx`
- **Create:** `client/src/components/player/player-question-card.jsx`
- **Create:** `client/src/components/player/player-timer.jsx`
- **Create:** `client/src/hooks/use-game-player.js` — player-side Socket.IO
- **Modify:** `client/src/App.jsx` — thêm route `/player/:...`

## Implementation Steps

1. Tạo `use-game-player.js` hook:
   - Connect Socket.IO (reuse existing connection)
   - Join game room
   - Listen for `game-question`, `game-answer-result`, `game-leaderboard`, `game-ended`
   - Emit `game-answer` on submit
   - Return: `{ gameState, submitAnswer, myScore, myRank }`

2. Tạo `PlayerJoinPage.jsx`:

   ```jsx
   export default function PlayerJoinPage() {
     const { presentationId, slideId, elementId } = useParams()
     const { gameState, submitAnswer } = useGamePlayer({ presentationId, slideId, elementId })

     if (gameState.status === 'joining') return <JoinForm onJoin={...} />
     if (gameState.status === 'waiting') return <WaitingRoom players={...} />
     if (gameState.status === 'question') return (
       <>
         <TimerDisplay timeLeft={...} />
         <QuestionCard question={...} onSelect={submitAnswer} />
       </>
     )
     if (gameState.status === 'finished') return <FinalResults scores={...} />
   }
   ```

3. Tạo `JoinForm` component:
   - Hidden game code (from URL) + visible name input
   - Submit → connect socket + join room
   - Error handling: tên trùng, phòng đầy, không tồn tại

4. Tạo `QuestionCard`:
   - Question text display
   - 2-4 answer options (buttons)
   - Disabled state sau khi submit
   - Animation: card flip khi có câu mới

5. Tạo `TimerDisplay`:
   - SVG circular countdown
   - Color change khi <5s (đỏ)
   - Pulse animation khi hết giờ

6. Add route trong `App.jsx`:
   ```jsx
   <Route path="/player/:presentationId/:slideId/:elementId" element={<PlayerJoinPage />} />
   ```

7. QR code generation cho game URL (dùng existing `qrcode` element type):
   - Game element properties → auto-generate QR khi trình chiếu
   - Display trong game overlay

## Success Criteria

- [ ] Player join page loads với URL params
- [ ] Name input + submit → Socket.IO join
- [ ] Waiting room hiện player count real-time
- [ ] Question + options hiển thị correct
- [ ] Timer countdown updates real-time
- [ ] Submit answer → visual feedback (disabled, checkmark)
- [ ] Correct/incorrect result shown
- [ ] Final leaderboard hiện rank
- [ ] Mobile responsive layout
- [ ] Multiple players join cùng lúc

## Risk Assessment

- **Risk:** Player page chưa có auth. **Mitigation:** Game join chỉ cần tên, không cần login. GV control room.
- **Risk:** Socket.IO disconnect giữa chừng. **Mitigation:** Auto-reconnect, show "reconnecting" state.

## Tests

```javascript
// phase-06-player-ui.test.jsx
describe('Player Join Page', () => {
  test('renders join form initially', () => {
    render(<PlayerJoinPage />)
    expect(screen.getByPlaceholderText(/enter your name/i)).toBeInTheDocument()
  })
  test('submit name triggers socket join', () => {
    render(<PlayerJoinPage />)
    fireEvent.change(screen.getByPlaceholderText(/enter your name/i), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByText(/join game/i))
    expect(mockSocket.emit).toHaveBeenCalledWith('game-join', expect.objectContaining({ playerName: 'Alice' }))
  })
  test('shows waiting room after join', () => {
    render(<PlayerJoinPage />)
    fireEvent.submit(screen.getByForm())
    expect(screen.getByText(/waiting for teacher/i)).toBeInTheDocument()
  })
  test('displays question when received', () => {
    mockSocket.emit('game-question', { question: 'What is 2+2?', options: ['3','4','5','6'], timeLimit: 30 })
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
  })
  test('options are clickable', () => {
    mockSocket.emit('game-question', { question: '...', options: ['A','B','C','D'] })
    fireEvent.click(screen.getByText('B'))
    expect(mockSocket.emit).toHaveBeenCalledWith('game-answer', expect.objectContaining({ answer: 1 }))
  })
  test('timer shows countdown', () => {
    mockSocket.emit('game-question', { timeLimit: 30 })
    expect(screen.getByText('30')).toBeInTheDocument()
  })
  test('shows final results when game ends', () => {
    mockSocket.emit('game-ended', { scores: [{ name:'Alice', score:100 }] })
    expect(screen.getByText('Game Over!')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})
```

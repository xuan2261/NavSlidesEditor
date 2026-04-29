---
phase: 10
title: "Additional Games (Four Corners, Relay Race, Trivia Championship, Scattergories)"
status: completed
priority: P2
effort: "6h"
dependencies: [2, 3, 4, 5, 6]
---

# Phase 10: Additional Games

## Overview

Hoàn thiện 4 game còn lại: Four Corners, Relay Race, Trivia Championship, Scattergories.

## 10.1 Four Corners

**Mô tả:** HS di chuyển đến 1 trong 4 góc phòng. GV đặt câu hỏi. Học sinh ở góc sai → loại/bị trừ điểm.

```jsx
export function FourCornersRenderer({ element, isPresenting }) {
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [players, setPlayers] = useState({}) // corner -> [player names]

  return (
    <div className="four-corners">
      <CornerDisplay corner={1} players={players[1]} />
      <CornerDisplay corner={2} players={players[2]} />
      <CornerDisplay corner={3} players={players[3]} />
      <CornerDisplay corner={4} players={players[4]} />
      <QuestionOverlay question={currentQuestion} correctCorner={element.questions[0]?.corner} />
    </div>
  )
}
```

**Rules:**
- 4 góc với icon/label (A/B/C/D hoặc biểu tượng)
- HS chọn góc trên thiết bị → hiện trên màn hình chiếu
- Timer → reveal correct answer
- Sai → -points hoặc eliminated

### 10.2 Relay Race

**Mô tả:** Mỗi đội xếp hàng. Người đầu trả lời câu hỏi → đúng → người tiếp theo. Sai → đội khác có cơ hội.

```jsx
export function RelayRaceRenderer({ element }) {
  const [currentPlayer, setCurrentPlayer] = useState({ team: 0, position: 0 })
  const [lanes, setLanes] = useState([...element.teams])

  return (
    <div className="relay-race">
      {lanes.map((team, i) => (
        <RelayLane key={i} team={team} currentPos={currentPlayer.team === i ? currentPlayer.position : null} />
      ))}
      <QuestionStation question={currentQuestion} onCorrect={advance} />
    </div>
  )
}
```

**Rules:**
- Team lanes top-to-bottom
- Each question answered → advance one position
- Wrong → pass to other team
- First team with all positions crossed wins

### 10.3 Trivia Championship

**Mô tả:** 3 vòng: Individual → Team → Buzzer. Điểm tích lũy xuyên suốt.

```jsx
export function TriviaChampRenderer({ element }) {
  const [currentRound, setCurrentRound] = useState(0)
  const [scores, setScores] = useState({})

  return (
    <div className="trivia-champ">
      <RoundTabs rounds={element.rounds} active={currentRound} onSelect={setCurrentRound} />
      <RoundContent round={element.rounds[currentRound]} scores={scores} />
      <LightningRound visible={element.lightningRound?.enabled && currentRound === 2} />
      <JackpotRound visible={element.jackpotRound?.enabled} />
    </div>
  )
}
```

**Rules:**
- Round 1: Individual — 10 câu, mỗi câu 10s
- Round 2: Team — 10 câu, thảo luận 30s
- Round 3: Buzzer — 10 câu, ai bấm nhanh hơn
- Lightning: 10 câu, 10s, điểm ×3
- Jackpot: 1 câu cuối, điểm ×5

### 10.4 Scattergories

**Mô tả:** Chọn ngẫu nhiên 1 chữ cái. 60 giây viết từ thuộc mỗi danh mục, bắt đầu bằng chữ cái đó.

```jsx
export function ScattergoriesRenderer({ element }) {
  const [letter, setLetter] = useState(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [answers, setAnswers] = useState({})

  return (
    <div className="scattergories">
      <LetterDisplay letter={letter} onSpin={() => spin()} />
      <CategoryGrid categories={element.categories} answers={answers} />
      <TimerBar timeLeft={timeLeft} />
      <ScoringOverlay visible={timeLeft === 0} answers={answers} />
    </div>
  )
}
```

**Rules:**
- Spin wheel → random letter
- 60 giây countdown
- Mỗi danh mục: 1 từ duy nhất, bắt đầu bằng letter
- Scoring: điểm nếu từ không trùng ai khác ("unique")
- All teams → so sánh → điểm

## Related Code Files

- **Modify:** `client/src/components/canvas/element-renderers/game-element-renderer.jsx` — thêm 4 renderers
- **Modify:** `client/src/components/properties/game-properties.jsx` — thêm tabs cho từng game
- **Modify:** `server/services/game-engine.js` — thêm handlers cho 4 games

## Implementation Steps

1. **Four Corners:**
   - Render 4 corner boxes với CSS positioning
   - Player assignment: real-time update từ Socket.IO
   - Correct answer reveal + elimination animation
   - Scoring: correct = +10, wrong = -5

2. **Relay Race:**
   - Team lane visualization
   - Position indicator (chạy/người đánh dấu)
   - Question + answer validation
   - PassOnWrong: chuyển quyền cho đội khác

3. **Trivia Championship:**
   - Round navigation tabs
   - Lightning: 10 câu × 10s auto-advance
   - Buzzer: click button → first wins
   - Jackpot: single high-value question

4. **Scattergories:**
   - Letter spinner (SVG wheel)
   - Category grid với input fields
   - Timer bar (progress)
   - Unique scoring algorithm

5. **Properties panel:**
   - Four Corners: corner count, question-corner mapping
   - Relay Race: questions per round, team count
   - Trivia: rounds config, lightning/jackpot toggle
   - Scattergories: categories list, time, scoring mode

## Success Criteria

- [ ] Four Corners: 4 corners displayed, players shown per corner
- [ ] Four Corners: correct corner revealed, wrong eliminated
- [ ] Relay Race: team lanes with position indicators
- [ ] Relay Race: passOnWrong works correctly
- [ ] Trivia: 3 rounds with different modes
- [ ] Trivia: Lightning round ×3 multiplier works
- [ ] Trivia: Buzzer mode — first click wins
- [ ] Scattergories: letter spinner works
- [ ] Scattergories: 60s timer counts down
- [ ] Scattergories: unique scoring applied

## Tests

```javascript
// phase-10-additional-games.test.js
describe('Four Corners', () => {
  test('renders 4 corner regions', () => {
    render(<FourCornersRenderer element={el} />)
    expect(screen.getAllByTestId('corner')).toHaveLength(4)
  })
  test('correct corner shows green', () => {
    render(<FourCornersRenderer element={el} />)
    fireEvent.click(screen.getByText('Submit'))
    expect(screen.getByTestId('corner-2')).toHaveClass('bg-green-500')
  })
})

describe('Relay Race', () => {
  test('renders team lanes', () => {
    render(<RelayRaceRenderer element={el} />)
    expect(screen.getAllByTestId('relay-lane')).toHaveLength(2)
  })
  test('correct answer advances position', () => {
    const result = advanceRelay(relayState, 'team-a', true)
    expect(result.currentPosition).toBe(2)
  })
})

describe('Trivia Championship', () => {
  test('renders round tabs', () => {
    render(<TriviaChampRenderer element={el} />)
    expect(screen.getByText('Vòng 1')).toBeInTheDocument()
  })
  test('buzzer awards to first clicker', () => {
    const result = processBuzzer(['alice', 'bob'], 'alice')
    expect(result.winner).toBe('alice')
  })
})

describe('Scattergories', () => {
  test('spins to random letter', () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const letter = spinLetter()
    expect(letters).toContain(letter)
  })
  test('unique scoring awards non-duplicate answers', () => {
    const answers = { teamA: ['Apple'], teamB: ['Apple'], teamC: ['Ant'] }
    const scores = calcScattergoriesScores(answers, 'A')
    expect(scores.teamA).toBe(0)   // duplicate
    expect(scores.teamB).toBe(0)   // duplicate
    expect(scores.teamC).toBe(10)  // unique
  })
})
```

---
phase: 8
title: "Hot Potato Quiz Game"
status: completed
priority: P1
effort: "5h"
dependencies: [2, 3, 4, 5, 6]
---

# Phase 8: Hot Potato Quiz Game

## Overview

Hoàn thiện Hot Potato Quiz — quiz real-time với timer, answer submission, leaderboard, scoring. GV điều khiển trên canvas, HS trả lời trên thiết bị riêng.

## Requirements

- **Functional:** Question cards, circular timer, answer buttons, score tracking, leaderboard overlay, speed bonus.
- **Non-functional:** < 100ms answer submission latency.

## Architecture

```
HotPotatoRenderer (presentation mode)
├── QuestionHeader        ← Q number + title
├── TimerCircle           ← SVG countdown
├── OptionsGrid           ← A/B/C/D buttons
├── LeaderboardMini       ← Top 3 scores
└── GameControlsGV        ← Next/End (GV only)

PlayerJoinPage (HS side)
├── QuestionCard          ← Question + options
├── PlayerTimer           ← Countdown
└── AnswerStatus         ← Submitted feedback
```

### Scoring Formula

```
baseScore = question.points || 10
speedBonus = Math.floor((timeLeft / timeLimit) * 5)  // up to +5
totalScore = baseScore + speedBonus
```

### Question Flow

```
1. GV clicks "Start" → broadcast 'game-question' { question, timeLimit, questionNumber }
2. Timer starts (30s countdown)
3. HS see question → submit answer
4. Server: validate answer, calculate score, broadcast result
5. HS: see correct/wrong + points earned
6. Repeat steps 1-5 for next question
7. GV clicks "End" → broadcast 'game-ended' + final leaderboard
```

## Implementation Steps

1. **HotPotatoRenderer** — presentation mode:

   ```jsx
   export function HotPotatoRenderer({ element, isPresenting }) {
     const { gameState, startGame, nextQuestion, endGame } = useGameSocket(element)

     if (!isPresenting || gameState.status === 'setup') {
       return <HotPotatoPreview element={element} />
     }

     return (
       <div className="hot-potato">
         <QuestionHeader qNum={gameState.currentQuestion + 1} total={element.questions.length} />
         <TimerCircle timeLeft={gameState.timeLeft} timeLimit={gameState.timeLimit} />
         <OptionsGrid options={gameState.currentQuestion?.options} onSelect={gameState.submitAnswer} />
         <LeaderboardMini scores={gameState.leaderboard} />
         <GameControlsGV isGV={true} onNext={nextQuestion} onEnd={endGame} />
       </div>
     )
   }
   ```

2. **TimerCircle** — SVG circular countdown:
   - `circumference = 2 * π * radius`
   - `dashoffset = circumference * (1 - timeLeft / timeLimit)`
   - Color: green → yellow → red (thresholds)

3. **OptionsGrid** — answer buttons:
   - 4 options (A/B/C/D) grid layout
   - Hover: scale up + glow
   - Selected: border highlight
   - Correct (after reveal): green
   - Wrong (after reveal): red

4. **LeaderboardMini** — sidebar:
   - Top 3 scores
   - Current player highlight
   - Score increment animation (+10!)

5. **Game Engine integration** — Phase 2:
   - `game-question`: server chọn question, broadcast
   - `game-answer`: server validate, calculate score, emit result
   - Auto-advance: nếu tất cả đã trả lời HOẶC hết giờ

6. **Speed Bonus display:**
   - Show "+10" → "+15" (với speed bonus) animation

7. **Properties panel updates** — Phase 4:
   - Question editor với options
   - Time limit slider (5-120s)
   - Allow late toggle
   - Points per question

8. **Player UI** — Phase 6:
   - Real-time question display
   - Answer submission
   - Result feedback

## Success Criteria

- [ ] Question displays on both GV canvas and player devices simultaneously
- [ ] Timer counts down on all screens (sync)
- [ ] HS can submit answers within time limit
- [ ] Correct/incorrect revealed after time or all answered
- [ ] Score updates real-time on leaderboard
- [ ] Speed bonus calculated and displayed
- [ ] GV can navigate next/previous question
- [ ] Game end shows final leaderboard
- [ ] Questions can be shuffled

## Tests

```javascript
// phase-08-hot-potato.test.js
describe('Hot Potato Quiz', () => {
  test('timer counts down correctly', async () => {
    render(<TimerCircle timeLeft={10} timeLimit={30} />)
    const circle = screen.getByTestId('timer-circle')
    expect(circle.style.strokeDashoffset).toBeCloseTo(circumference * 0.67, 1)
  })
  test('timer color changes when low', () => {
    render(<TimerCircle timeLeft={3} timeLimit={30} />)
    expect(screen.getByTestId('timer-circle')).toHaveClass('text-red-500')
  })
  test('submit answer emits socket event', () => {
    render(<HotPotatoPlayerUI question={q} />)
    fireEvent.click(screen.getByText('B'))
    expect(mockSocket.emit).toHaveBeenCalledWith('game-answer',
      expect.objectContaining({ answer: 1 }))
  })
  test('correct answer shows green', async () => {
    mockSocket.emit('game-answer-result', { correct: true, points: 15 })
    render(<PlayerJoinPage />)
    expect(await screen.findByText(/correct/i)).toBeInTheDocument()
    expect(screen.getByText('+15')).toBeInTheDocument()
  })
  test('late submission rejected when allowLate=false', () => {
    const result = GameEngine.submitAnswer('room1', 'socket1', 0, 60000, { allowLate: false })
    expect(result.accepted).toBe(false)
  })
  test('speed bonus calculated correctly', () => {
    const bonus = calcSpeedBonus(20, 30, 5)
    expect(bonus).toBe(3) // (20/30) * 5 ≈ 3
  })
  test('shuffle randomizes question order', () => {
    const el = { questions: [{id:'1'},{id:'2'},{id:'3'}], shuffleQuestions: true }
    const shuffled = shuffleQuestions(el.questions)
    expect(shuffled.length).toBe(3)
    expect(shuffled.map(q => q.id)).not.toEqual(['1','2','3']) // statistically unlikely
  })
})
```

---
phase: 9
title: "Jeopardy Board Game"
status: completed
priority: P2
effort: "5h"
dependencies: [2, 3, 4, 5, 6]
---

# Phase 9: Jeopardy Board Game

## Overview

Hoàn thiện Jeopardy Board — bảng 5×5 với 5 chủ đề, 5 mức điểm, Daily Double, team scores, flip animation.

## Requirements

- **Functional:** Board grid, card flip, team selection, question reveal, scoring, Daily Double.
- **Non-functional:** Smooth card animations, clear team color distinction.

## Architecture

### Board Layout

```
┌─────────────┬────────┬────────┬────────┬────────┐
│   History   │  Math  │ Science│  Art   │  Tech  │  ← Categories
├─────────────┼────────┼────────┼────────┼────────┤
│  100  [✓]  │  100   │  100   │  100   │  100   │
├─────────────┼────────┼────────┼────────┼────────┤
│  200  [✓]  │  200   │  200   │  200   │  200   │
├─────────────┼────────┼────────┼────────┼────────┤
│  300  [✓]  │  300   │  300   │  300   │  300   │
├─────────────┼────────┼────────┼────────┼────────┤
│  400       │  400   │  400   │  400   │  400   │  ← Daily Double
├─────────────┼────────┼────────┼────────┼────────┤
│  500  [✓]  │  500   │  500   │  500   │  500   │
└─────────────┴────────┴────────┴────────┴────────┘

Scores:  Đội A: 1200    Đội B: 800
```

### Jeopardy Game States

```
board → question_reveal → team_select → answering → result → board
```

## Implementation Steps

1. **JeopardyRenderer** — main component:

   ```jsx
   export function JeopardyRenderer({ element, isPresenting }) {
     const [selectedCell, setSelectedCell] = useState(null)
     const [activeTeam, setActiveTeam] = useState(null)
     const [showQuestion, setShowQuestion] = useState(false)

     if (showQuestion) {
       return (
         <JeopardyQuestion
           question={selectedCell}
           activeTeam={activeTeam}
           onAnswer={(correct) => handleAnswer(correct)}
           onClose={() => setShowQuestion(false)}
         />
       )
     }

     return (
       <div className="jeopardy-board">
         <CategoryHeader categories={element.categories} />
         <BoardGrid
           questions={element.questions}
           onCellClick={handleCellClick}
         />
         <TeamScores teams={element.teams} scores={scores} />
       </div>
     )
   }
   ```

2. **BoardGrid** — SVG/CSS grid layout:
   - 6 columns (1 category + 5 points rows)
   - Each cell: background color by team who answered (hoặc neutral)
   - `✓` overlay cho used questions
   - Flip animation: `transform: rotateY(180deg)`

3. **CategoryHeader** — horizontal bar:
   - Sticky top
   - Truncate long names
   - Total score per category shown on hover

4. **Daily Double**:
   - Yellow/gold border styling
   - Before question: team wager modal
   - Wager: 0 → max(team score, configured max)
   - Multiply winnings by wager

5. **Question Card**:
   - Full-screen modal với card flip
   - Timer: configurable (15-60s)
   - Audio: Jeopardy theme music (optional)

6. **Team Selection**:
   - 2-4 team buttons
   - Click → selected team must answer
   - Correct: +points, Wrong: -points (hoặc pass)

7. **Game Engine** — Phase 2:
   - `jeopardy-select`: team chọn câu
   - `jeopardy-answer`: team trả lời
   - `jeopardy-wager`: Daily Double wager

8. **Properties Panel** — Phase 4:
   - Category editor (add/remove/rename)
   - Question editor per cell
   - Daily Double selector
   - Team editor (name + color)

9. **Player UI** — Phase 6:
   - GV displays question → players see on their devices
   - "Buzz" button cho physical buzzer (team rep bấm)

## Success Criteria

- [ ] Board renders 5×5 grid with categories
- [ ] Card flips on cell click
- [ ] Team scores update correctly (+/- points)
- [ ] Used questions show ✓ and are non-clickable
- [ ] Daily Double shows wager modal
- [ ] Wrong answer deducts points
- [ ] Timer works per question
- [ ] All 25 questions can be played
- [ ] Final scores displayed at end

## Tests

```javascript
// phase-09-jeopardy.test.js
describe('Jeopardy Board', () => {
  test('renders correct number of cells', () => {
    const el = createJeopardyElement(5, 5)
    render(<JeopardyRenderer element={el} />)
    expect(screen.getAllByTestId('board-cell')).toHaveLength(25)
  })
  test('used cell is non-clickable', () => {
    const el = { ...jeopardyEl, questions: { 'cat0-100': { used: true } } }
    render(<JeopardyRenderer element={el} />)
    const cell = screen.getByTestId('cell-cat0-100')
    fireEvent.click(cell)
    expect(screen.queryByTestId('question-modal')).not.toBeInTheDocument()
  })
  test('correct answer adds points to team', () => {
    const scores = { 'team-a': 0, 'team-b': 0 }
    const result = JeopardyEngine.scoreAnswer(scores, 'team-a', 'cat0-100', true, 100)
    expect(result['team-a']).toBe(100)
  })
  test('wrong answer deducts points', () => {
    const scores = { 'team-a': 300, 'team-b': 200 }
    const result = JeopardyEngine.scoreAnswer(scores, 'team-a', 'cat0-100', false, 100)
    expect(result['team-a']).toBe(200)
  })
  test('daily double multiplies by wager', () => {
    const result = JeopardyEngine.scoreDailyDouble(scores, 'team-a', true, 500, 200)
    expect(result['team-a']).toBe(700) // 200 + (200*2.5)
  })
  test('all questions used triggers game end', () => {
    const questions = Object.fromEntries(
      Array.from({length:25}, (_,i) => [`q${i}`, { used: true }])
    )
    expect(JeopardyEngine.checkGameEnd(questions)).toBe(true)
  })
})
```

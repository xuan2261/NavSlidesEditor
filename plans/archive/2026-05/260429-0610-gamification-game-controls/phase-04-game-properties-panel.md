---
phase: 4
title: "Game Properties Panel"
status: completed
priority: P1
effort: "4h"
dependencies: [1, 3]
---

# Phase 4: Game Properties Panel

## Overview

Xây dựng `game-properties.jsx` — properties panel cho game elements với 3 tabs: Content, Display, Scoring. Quản lý câu hỏi, tên HS/đội, cấu hình hiển thị.

## Requirements

- **Functional:** CRUD cho questions, teams, players. Cấu hình timer, điểm, màu sắc, animation.
- **Non-functional:** Tab-based layout, consistent với existing properties panels.

## Architecture

```
client/src/components/properties/
└── game-properties.jsx        ← Main panel (~400 LOC)
      ├── GameTypeSelector      ← Dropdown chọn gameType
      ├── ContentTab
      │     ├── QuestionList   ← Add/edit/delete/reorder questions
      │     ├── NameListEditor ← Edit danh sách tên HS
      │     ├── TeamEditor     ← Quản lý đội chơi
      │     └── TimerConfig    ← Cấu hình thời gian
      ├── DisplayTab
      │     ├── ColorScheme    ← Màu nền, màu accent
      │     ├── FontPicker     ← Font family
      │     └── AnimationToggle ← Sound, confetti
      └── ScoringTab
            ├── PointsConfig   ← Điểm theo độ khó
            ├── ScoringMode    ← unique vs all
            └── LeaderboardSettings
```

### Panel Layout

```
┌─ Game Settings ─────────────────────────────┐
│  Game Type: [Name Picker ▼]  [Delete Game] │
│  ─────────────────────────────────────────  │
│  [Content]  [Display]  [Scoring]            │
│  ─────────────────────────────────────────  │
│                                              │
│  Tab Content:                                │
│    ┌─ Questions ────────────────────────┐   │
│    │ + Add Question                      │   │
│    │ ┌──────────────────────────────┐    │   │
│    │ │ Q1: What is 2+2?            [Edit][X]│   │
│    │ │ A: 3  B: 4  C: 5  D: 6     │    │   │
│    │ └──────────────────────────────┘    │   │
│    │ ┌──────────────────────────────┐    │   │
│    │ │ Q2: ...                     │    │   │
│    │ └──────────────────────────────┘    │   │
│    └──────────────────────────────────────┘   │
│                                              │
│    ┌─ Player/Team Names ─────────────────┐   │
│    │ [  ] + Add Name                     │   │
│    │ Alice, Bob, Charlie, Diana, Eve     │   │
│    └──────────────────────────────────────┘   │
│                                              │
│  Tab Display:                                │
│    Background: [Color Picker]                │
│    Accent: [Color Picker]                   │
│    Font: [Dropdown]                         │
│    [✓] Sound effects                        │
│    [✓] Confetti animation                   │
│    [✓] Show timer                           │
│                                              │
│  Tab Scoring:                                │
│    Points per correct: [10]                  │
│    [✓] Show leaderboard                     │
│    [✓] Bonus for speed                     │
│    Leaderboard: [Top 5 ▼]                    │
└──────────────────────────────────────────────┘
```

## Related Code Files

- **Create:** `client/src/components/properties/game-properties.jsx`
- **Create:** `client/src/components/properties/game-properties-question-editor.jsx`
- **Modify:** `client/src/components/properties/misc-properties.jsx` — route `type === 'game'` → game-properties
- **Modify:** `client/src/components/EditorMenuBar.jsx` — thêm game props

## Implementation Steps

1. Tạo `game-properties.jsx`:
   - Props: `element`, `onUpdate`, `onDelete`
   - State: `activeTab`, `editingQuestionId`
   - Tabs: Content / Display / Scoring

2. Implement `ContentTab`:
   - `QuestionList`: Sortable list (drag to reorder). Add/Edit/Delete buttons. Inline edit form.
   - `NameListEditor`: Textarea với comma-separated names → parse thành array. Quick add button.
   - `TeamEditor`: Add team, pick color, rename. Min 2 teams.
   - `TimerConfig`: Time limit per question (slider 5-120s)

3. Implement `DisplayTab`:
   - `ColorScheme`: Background color picker + Accent color picker
   - `AnimationToggle`: Checkboxes cho sound effects, confetti, show timer

4. Implement `ScoringTab`:
   - `PointsConfig`: Points per correct answer. Bonus multiplier.
   - `LeaderboardSettings`: Show top N, hide/show scores

5. Tạo `game-properties-question-editor.jsx` — modal/inline form cho question CRUD:
   - Question text (textarea)
   - Options (4 inputs)
   - Correct answer (radio)
   - Time limit (number)
   - Points (number)

6. Update `misc-properties.jsx` để route `element.type === 'game'` → GameProperties

7. Verify integration: chọn game element → properties panel hiện đúng

## Success Criteria

- [ ] Game type selector đổi được gameType → defaults cập nhật
- [ ] Question list: add/edit/delete/reorder questions hoạt động
- [ ] Name list editor: parse comma-separated → hiển thị đúng
- [ ] Team editor: add/remove team, đổi màu
- [ ] Display tab: đổi màu → preview cập nhật real-time
- [ ] Scoring tab: cấu hình điểm → reflects in game logic
- [ ] On update: gọi `onUpdate` với merged changes

## Risk Assessment

- **Risk:** Properties panel quá phức tạp cho 7 game types. **Mitigation:** Dùng conditional rendering theo `gameType`, mỗi tab chỉ hiện fields liên quan.
- **Risk:** Re-render loop khi update element. **Mitigation:** Immutable update pattern.

## Tests

```javascript
// phase-04-game-properties.test.jsx
describe('Game Properties Panel', () => {
  test('renders game type selector', () => {
    render(<GameProperties element={el} onUpdate={fn} onDelete={fn} />)
    expect(screen.getByLabelText(/game type/i)).toBeInTheDocument()
  })
  test('adds question via Content tab', () => {
    const updates = []
    render(<GameProperties element={el} onUpdate={(u) => updates.push(u)} onDelete={fn} />)
    fireEvent.click(screen.getByText('+ Add Question'))
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'New Q?' } })
    expect(updates).toContainEqual(expect.objectContaining({
      questions: expect.arrayContaining([expect.objectContaining({ question: 'New Q?' })])
    }))
  })
  test('removes question', () => {
    const el = { ...baseEl, questions: [{ id:'q1', question:'Test', options:['A'], correctIndex:0 }] }
    const updates = []
    render(<GameProperties element={el} onUpdate={(u) => updates.push(u)} onDelete={fn} />)
    fireEvent.click(screen.getByTestId('delete-question-q1'))
    expect(updates[0].questions).toHaveLength(0)
  })
  test('changes gameType updates defaults', () => {
    const updates = []
    render(<GameProperties element={el} onUpdate={(u) => updates.push(u)} onDelete={fn} />)
    fireEvent.change(screen.getByLabelText(/game type/i), { target: { value: 'jeopardy' } })
    expect(updates[0].gameType).toBe('jeopardy')
    expect(updates[0].teams).toHaveLength(2) // Jeopardy defaults to 2 teams
  })
  test('Display tab color change triggers update', () => {
    const updates = []
    render(<GameProperties element={el} onUpdate={(u) => updates.push(u)} onDelete={fn} />)
    fireEvent.click(screen.getByText('Display'))
    // color picker interaction
    expect(updates.length).toBeGreaterThan(0)
  })
})
```

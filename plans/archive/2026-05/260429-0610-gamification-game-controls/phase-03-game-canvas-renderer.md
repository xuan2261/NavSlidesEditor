---
phase: 3
title: "Game Canvas Renderer"
status: completed
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 3: Game Canvas Renderer

## Overview

Xây dựng `game-element-renderer.jsx` — SVG-based renderer cho game elements trên canvas. Hỗ trợ edit mode (preview) và presentation mode (live game).

## Requirements

- **Functional:** Render game elements với 2 states: edit (preview) và presentation (live). SVG animations cho wheel spin, dice roll.
- **Non-functional:** Lazy render — chỉ load game canvas khi element visible.

## Architecture

```
client/src/components/canvas/element-renderers/
└── game-element-renderer.jsx     ← Main renderer (800+ LOC)

  ├── GameRendererFactory          ← Chọn renderer theo gameType
  │     ├── NamePickerRenderer    ← SVG wheel + dice + button
  │     ├── HotPotatoRenderer     ← Question card + timer + options
  │     ├── JeopardyRenderer      ← 5×5 board grid
  │     ├── FourCornersRenderer   ← Corner icons + timer
  │     ├── RelayRaceRenderer     ← Team lanes + progress
  │     ├── TriviaChampRenderer   ← Round tabs + buzzer UI
  │     └── ScattergoriesRenderer← Category grid + letter display
  │
  └── SharedComponents
        ├── WheelCanvas           ← SVG pie wheel với spin animation
        ├── DiceCanvas            ← 3D dice rolling animation
        ├── TimerCircle           ← Circular countdown timer
        ├── LeaderboardOverlay    ← Scoreboard overlay
        └── GameControls          ← Start/Stop/Next buttons
```

### Edit Mode (Preview)

- Hiển thị game board tĩnh với placeholder content
- Label `[Game: Name Picker]` hiện trên element
- Click → mở properties panel
- Border/selection handles hoạt động bình thường

### Presentation Mode (Live)

- Khi `game.gameStatus === 'running'` → full interactive game UI
- Socket.IO connected → real-time updates
- HS devices → player join → answers reflected
- GV controls (Start/Next/End) visible trên overlay

### Wheel Animation (CSS + JS)

```css
.wheel-spin {
  animation: wheel-spin 2.5s cubic-bezier(0.17, 0.67, 0.12, 0.99) forwards;
}
@keyframes wheel-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(2880deg); }
}
```

## Related Code Files

- **Create:** `client/src/components/canvas/element-renderers/game-element-renderer.jsx`
- **Modify:** `client/src/components/canvas/element-renderers/registry.js` — import game renderer
- **Create:** `client/src/hooks/use-game-socket.js` — Socket.IO connection cho game

## Implementation Steps

1. Tạo `game-element-renderer.jsx` với factory pattern:

   ```jsx
   export function GameElementRenderer({ element, isSelected, isDragging, isPresenting }) {
     switch (element.gameType) {
       case 'name-picker': return <NamePickerRenderer ... />
       case 'hot-potato': return <HotPotatoRenderer ... />
       case 'jeopardy': return <JeopardyRenderer ... />
       // ...
     }
   }
   ```

2. Implement `NamePickerRenderer`:
   - SVG pie chart cho wheel mode (path segments)
   - CSS spin animation với easing
   - Dice SVG cho dice mode
   - Big button cho button mode
   - Confetti effect khi chọn xong

3. Implement `HotPotatoRenderer`:
   - Question card với options A/B/C/D
   - Circular timer (SVG stroke-dashoffset countdown)
   - Player list sidebar
   - Submit animation

4. Implement `JeopardyRenderer`:
   - Grid layout 5×5 (categories × points)
   - Card flip animation khi chọn câu
   - Team score display

5. Implement remaining 4 renderers (FourCorners, RelayRace, TriviaChamp, Scattergories)

6. Implement shared `LeaderboardOverlay` component

7. Create `use-game-socket.js` hook cho Socket.IO integration

8. Update registry.js import

## Success Criteria

- [ ] Name picker wheel renders with 8+ segments, animates on spin
- [ ] Dice renders with 3D appearance, animates rolling
- [ ] Hot potato shows question + 4 options + timer
- [ ] Jeopardy board shows 5×5 grid
- [ ] Leaderboard overlay displays scores real-time
- [ ] Edit mode shows preview placeholder
- [ ] Presentation mode activates live game UI

## Risk Assessment

- **Risk:** SVG animations phức tạp → lag. **Mitigation:** Dùng CSS transforms, GPU-accelerated. Avoid re-renders during animation.
- **Risk:** Game renderer quá lớn (>200 LOC). **Mitigation:** Tách từng renderer thành file riêng nếu vượt limit.

## Tests

```javascript
// phase-03-game-renderer.test.jsx
import { render, screen } from '@testing-library/react'
import { GameElementRenderer } from './game-element-renderer'

describe('Game Element Renderer', () => {
  test('renders name-picker wheel with segments', () => {
    const el = { type:'game', gameType:'name-picker', items:['A','B','C'], pickerMode:'wheel', ... }
    render(<GameElementRenderer element={el} />)
    expect(screen.getByTestId('game-wheel')).toBeInTheDocument()
  })
  test('renders hot-potato question card', () => {
    const el = { type:'game', gameType:'hot-potato', questions:[{question:'What?',options:['A','B']}], ... }
    render(<GameElementRenderer element={el} />)
    expect(screen.getByText('What?')).toBeInTheDocument()
  })
  test('renders jeopardy board grid', () => {
    const el = { type:'game', gameType:'jeopardy', categories:[{name:'Math',questions:[100]}], ... }
    render(<GameElementRenderer element={el} />)
    expect(screen.getByText('Math')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })
  test('shows edit mode placeholder', () => {
    const el = { type:'game', gameType:'hot-potato', gameStatus:'setup' }
    render(<GameElementRenderer element={el} isPresenting={false} />)
    expect(screen.getByText(/Game: Hot Potato/i)).toBeInTheDocument()
  })
  test('hides controls when not presenting', () => {
    const el = { type:'game', gameType:'name-picker', gameStatus:'setup' }
    render(<GameElementRenderer element={el} isPresenting={false} />)
    expect(screen.queryByText('SPIN')).not.toBeInTheDocument()
  })
})
```

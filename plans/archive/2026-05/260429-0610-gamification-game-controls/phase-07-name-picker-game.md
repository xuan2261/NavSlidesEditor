---
phase: 7
title: "Name Picker Game (Wheel + Dice + Button)"
status: completed
priority: P1
effort: "4h"
dependencies: [2, 3, 4, 5, 6]
---

# Phase 7: Name Picker Game (Wheel + Dice + Button)

## Overview

Hoàn thiện Name Picker — vòng quay tên, xúc xắc, bấm nút. Render đẹp + Socket.IO integration + full game loop.

## Requirements

- **Functional:** 3 modes (wheel/dice/button), spin/roll/pick animations, exclusion, confetti winner.
- **Non-functional:** GPU-accelerated animations, responsive.

## Architecture

### Wheel Mode

```
WheelCanvas
├── SVG pie chart (8 segments)
├── CSS spin animation (easeOutQuint)
├── Pointer arrow (top)
├── Confetti particles (winner)
└── Winner display overlay
```

### Dice Mode

```
DiceCanvas
├── 2-3 dice SVGs
├── CSS roll animation (rotate3d)
├── Sum display
└── Selected student highlight
```

### Button Mode

```
ButtonCanvas
├── Giant button (click to random)
├── Ripple effect on click
├── Quick pick animation
└── Winner display
```

## Implementation Steps

1. **NamePickerRenderer** (trong `game-element-renderer.jsx`):
   - Props: `element, onRandomResult, isPresenting`
   - State: `spinning, selectedIndex, winner`
   - Render theo `pickerMode`

2. **Wheel Canvas:**
   - SVG `path` segments từ polar coordinates
   - CSS `@keyframes wheel-spin` với `cubic-bezier(0.17, 0.67, 0.12, 0.99)`
   - Random target angle: `(Math.random() * 360) + 2880` (8+ spins)
   - `winnerIndex = Math.floor((360 - (angle % 360)) / segmentAngle)`
   - Confetti: 50 particles, fall animation 2s

3. **Dice Canvas:**
   - SVG dice faces (pip patterns)
   - CSS `rotateX/Y/Z` keyframes for roll effect
   - `Math.floor(Math.random() * 6) + 1` per die
   - Sum → map to student index

4. **Button Canvas:**
   - Full-size button với gradient
   - `onClick` → immediate random pick
   - Scale + ripple animation

5. **Socket.IO integration:**
   - GV clicks "SPIN" → emit `game-random`
   - Server returns winner index
   - Animate → show winner
   - If `excludeAfterPick`: mark as excluded

6. **Update game-properties.jsx** cho name-picker specific fields:
   - Items list editor (textarea/comma-separated)
   - Picker mode selector
   - Wheel segment count (4-20)
   - Exclude toggle
   - Animation duration slider

7. **Player join page:** Name picker không cần player page (GV điều khiển)

## Success Criteria

- [ ] Wheel spins with smooth animation, lands on correct segment
- [ ] Dice rolls with 3D rotation effect, shows correct face
- [ ] Button shows ripple + pick animation
- [ ] Winner name highlighted + confetti effect
- [ ] `excludeAfterPick` removes picked name from pool
- [ ] Properties panel allows editing names list
- [ ] Multiple rounds work correctly

## Tests

```javascript
// phase-07-name-picker.test.js
describe('Name Picker Game', () => {
  test('wheel renders correct number of segments', () => {
    const el = { ...pickerEl, items: ['A','B','C','D'], wheelSegments: 4 }
    render(<NamePickerRenderer element={el} />)
    const paths = screen.getAllByTestId('wheel-segment')
    expect(paths).toHaveLength(4)
  })
  test('spin animation selects one item', () => {
    const el = { ...pickerEl, items: ['A','B','C'], pickerMode: 'wheel' }
    const result = simulateSpin(el)
    expect(['A','B','C']).toContain(result)
  })
  test('dice shows valid face values', () => {
    const el = { ...pickerEl, diceCount: 2 }
    const { faces } = simulateRoll(el)
    faces.forEach(f => expect([1,2,3,4,5,6]).toContain(f))
  })
  test('excludeAfterPick removes from pool', () => {
    const pool = ['A','B','C']
    const pick = randomPick(pool, true)
    expect(pick).not.toBeNull()
    expect(pool).toHaveLength(2)
  })
  test('confetti triggers on winner', () => {
    render(<NamePickerRenderer element={pickerEl} isPresenting={true} />)
    fireEvent.click(screen.getByText('SPIN'))
    await waitFor(() => {
      expect(screen.getByTestId('confetti-canvas')).toBeInTheDocument()
    })
  })
})
```

---
phase: 5
title: "Toolbar Integration"
status: completed
priority: P1
effort: "2h"
dependencies: [1, 4]
---

# Phase 5: Toolbar Integration

## Overview

Thêm nút "Insert Game" vào Toolbar và menu, cho phép GV thêm game element vào slide qua dropdown selector.

## Requirements

- **Functional:** Toolbar button → dropdown game type selector → tạo game element với defaults phù hợp.
- **Non-functional:** Consistent với existing InsertMenu pattern.

## Architecture

```
Toolbar.jsx
└── InsertMenu
      └── "Insert Game" dropdown item
            └── GameTypeSubMenu (7 options)
                  ├── 🌀 Name Picker
                  ├── 🔥 Hot Potato Quiz
                  ├── 📺 Jeopardy
                  ├── 🗺️ Four Corners
                  ├── 🏃 Relay Race
                  ├── 🏆 Trivia Championship
                  └── 📝 Scattergories
```

### Insert Menu Flow

1. GV click "Insert" hoặc button game
2. Menu dropdown hiện game types
3. Click game type → gọi `onAddGame(gameType)`
4. Element tạo với `createElement('game', gameType)`
5. Element defaults merge theo gameType

## Related Code Files

- **Modify:** `client/src/components/Toolbar.jsx` — thêm Game icon + handler
- **Modify:** `client/src/components/InsertMenu.jsx` — thêm game types section
- **Modify:** `client/src/pages/EditorPage.jsx` — thêm `onAddGame` handler

## Implementation Steps

1. Thêm Game icon vào Toolbar imports (từ lucide-react):
   ```javascript
   import { Gamepad2, Shuffle } from 'lucide-react'
   ```

2. Thêm `onAddGame` vào Toolbar props

3. Trong Toolbar, thêm game button sau Shape menu:
   ```jsx
   <button onClick={() => setShowGameMenu(!showGameMenu)} title="Insert Game">
     <Gamepad2 size={20} />
   </button>
   ```

4. Trong InsertMenu, thêm section "Games":
   - Sortable heading: "── Games ──"
   - 7 menu items với icons và labels
   - Each item → gọi `onAddGame(gameType)`

5. Implement `createGameElement(gameType)` helper:
   ```javascript
   import { ELEMENT_DEFAULTS } from '../data/element-defaults'
   export function createGameElement(gameType) {
     return {
       id: generateId(),
       type: 'game',
       gameType,
       ...ELEMENT_DEFAULTS.game,
       // Merge gameType-specific defaults
       ...getGameTypeDefaults(gameType),
     }
   }
   ```

6. Wire vào EditorPage: `onAddGame={addGameElement}`

7. Update SlideCanvas/SlidePanel để hiển thị game element thumbnails

## Success Criteria

- [ ] Toolbar có Gamepad2 icon button
- [ ] Click button → dropdown hiện 7 game types
- [ ] Chọn game type → tạo element với đúng defaults
- [ ] Element xuất hiện trên canvas
- [ ] Slide panel thumbnail hiển thị game element
- [ ] Keyboard shortcut: `G` → mở game menu

## Risk Assessment

- **Risk:** Toolbar quá đông → confusion. **Mitigation:** Đặt dưới Shape menu, collapsible.
- **Risk:** Conflicting shortcut `G`. **Mitigation:** Check existing shortcuts trước khi assign.

## Tests

```javascript
// phase-05-toolbar-integration.test.jsx
describe('Toolbar Game Integration', () => {
  test('InsertMenu shows game types', () => {
    render(<InsertMenu onAddGame={fn} onAddText={fn} ... />)
    fireEvent.click(screen.getByText('Insert'))
    expect(screen.getByText('Name Picker')).toBeInTheDocument()
    expect(screen.getByText('Hot Potato Quiz')).toBeInTheDocument()
    expect(screen.getByText('Jeopardy')).toBeInTheDocument()
  })
  test('selecting game type calls onAddGame', () => {
    const handler = jest.fn()
    render(<InsertMenu onAddGame={handler} ... />)
    fireEvent.click(screen.getByText('Insert'))
    fireEvent.click(screen.getByText('Name Picker'))
    expect(handler).toHaveBeenCalledWith('name-picker')
  })
  test('createGameElement generates valid element', () => {
    const el = createGameElement('jeopardy')
    expect(el.type).toBe('game')
    expect(el.gameType).toBe('jeopardy')
    expect(el.teams).toHaveLength(2)
    expect(el.categories).toBeDefined()
  })
  test('createGameElement defaults match ELEMENT_DEFAULTS', () => {
    const el = createGameElement('hot-potato')
    expect(el.width).toBe(ELEMENT_DEFAULTS.game.width)
    expect(el.zIndex).toBe(ELEMENT_DEFAULTS.game.zIndex)
  })
})
```

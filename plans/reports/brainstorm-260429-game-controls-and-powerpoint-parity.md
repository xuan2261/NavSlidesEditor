# Brainstorm Report: Game Controls & PowerPoint-Style Controls Parity

**Type:** brainstorm
**Date:** 2026-04-29
**Slug:** game-controls-and-powerpoint-parity

---

## Tóm tắt yêu cầu

- **Mục tiêu:** Phân tích controls hiện có, đề xuất controls mới để đạt full PowerPoint parity + touch support
- **Phạm vi game controls:** Chỉ active khi `isPresenting === true`
- **Ưu tiên touch:** Rất cần cho tablet/surface
- **Mức độ:** Mức 1+2+3+4 (toàn bộ)

---

## Hiện trạng

### Game Controls đã có (11 phases)

| Game | Control hiện tại | Thiếu |
|---|---|---|
| Name Picker | SPIN/ROLL/PICK button | Keyboard shortcut, touch drag-to-spin |
| Hot Potato | START button | Timer `Space`, buzzer sound |
| Jeopardy | Click cell | `R` reveal, `L` leaderboard, `1-4` team |
| Four Corners | Corner vote, countdown | Timer `+/-`, phase advance |
| Relay Race | Next button | Auto-advance, skip team |
| Trivia Champ | Buzzer, round tabs | `R` reveal, sound feedback |
| Scattergories | Letter wheel, timer | Timer adjust, reveal all |

### Keyboard shortcuts hiện có (registry): 10 shortcuts

`Ctrl+C/X/V/D`, `Ctrl+Z/Y`, `Ctrl+A`, `Ctrl+F`, `Delete`, `Escape`
`Ctrl+B/I/U` (TipTap internal)

### Thiếu hoàn toàn

- `F5`/`Shift+F5` — Start slideshow
- Arrow keys cho slideshow navigation
- `B`/`W` — Black/white screen
- Mọi game presenter keyboard shortcut
- Touch gestures
- Zoom shortcuts

---

## Đề xuất: Controls mới cần thêm

### Nhóm 1: Slideshow Controls (PowerPoint parity)

| Shortcut | Action | Mode | Priority |
|---|---|---|---|
| `F5` | Start presentation from slide 1 | Editor (idle) | Must |
| `Shift+F5` | Start from current slide | Editor | Must |
| `→` / `Space` / `N` | Next slide | Present mode | Must |
| `←` / `Backspace` / `P` | Previous slide | Present mode | Must |
| `B` / `.` | Black screen overlay | Present mode | Should |
| `W` | White screen overlay | Present mode | Should |
| `Home` | Go to first slide | Present mode | Should |
| `End` | Go to last slide | Present mode | Should |
| `Esc` | End slideshow | Present mode | Must |
| `Ctrl+Home` | First slide (edit) | Editor | Could |
| `Ctrl+End` | Last slide (edit) | Editor | Could |

### Nhóm 2: Game Presenter Controls (active khi `isPresenting`)

| Shortcut | Action | Game | Priority |
|---|---|---|---|
| `G` | Toggle game HUD overlay | All | Must |
| `Space` | Start/stop timer | Hot Potato, Jeopardy, Four Corners, Trivia, Scattergories | Must |
| `Enter` | Next game phase / next question | All | Must |
| `R` | Reveal answer | Jeopardy, Trivia, Hot Potato | Must |
| `L` | Toggle leaderboard overlay | All | Must |
| `1` / `2` / `3` / `4` | Quick select team/player | Jeopardy, Relay Race, Trivia | Should |
| `+` / `-` | Adjust timer ±10s | All timed games | Should |
| `P` | Pause/resume game | All | Should |
| `Tab` | Cycle through players/teams | All team games | Could |
| `Escape` | Exit game mode | All | Must |
| `B` | Trigger buzzer (wrong answer) | Hot Potato, Trivia | Could |
| `T` | Show timer overlay | All | Could |

**Name Picker riêng:**
| Shortcut | Action |
|---|---|
| `Space` | Start/stop spin |
| `R` | Re-spin (reset + spin again) |
| `E` | Edit participant list |
| `A` | Add participant |
| `X` | Remove last participant |

### Nhóm 3: Editor Enhancements

| Shortcut | Action | Priority |
|---|---|---|
| `Ctrl+M` | Insert new slide | Must |
| `Ctrl+G` | Group selected elements | Should |
| `Ctrl+Shift+G` | Ungroup | Should |
| `Ctrl+]` | Bring forward (z-index +1) | Should |
| `Ctrl+[` | Send backward (z-index -1) | Should |
| `Tab` | Cycle next element | Should |
| `Shift+Tab` | Cycle previous element | Should |
| `Ctrl+Shift+C` | Copy formatting | Could |
| `Ctrl+Shift+V` | Paste formatting | Could |
| `Ctrl+0` | Reset zoom to 100% | Should |
| `Ctrl++` | Zoom in | Should |
| `Ctrl+-` | Zoom out | Should |
| `Ctrl+Shift+L` | Set bullet list | Could |
| `Alt+F9` | Toggle rulers | Could |

### Nhóm 4: Touch & Modern Controls

#### Canvas Gestures
| Gesture | Action | Mode |
|---|---|---|
| Tap | Select element | Editor |
| Double-tap | Edit text / activate element | Editor |
| Long-press | Context menu | Editor |
| Drag | Move element | Editor |
| Two-finger pinch | Zoom canvas | Editor |
| Two-finger pan | Pan canvas | Editor |
| Swipe left/right | Previous/next slide | Present mode |
| Swipe down | Exit presentation | Present mode |

#### Game Touch Controls
| Gesture | Game | Action |
|---|---|---|
| **Drag-to-spin wheel** | Name Picker (wheel) | Touch spin bằng cách vuốt ngón tay quay |
| Tap wheel segment | Name Picker (wheel) | Chọn trực tiếp segment |
| Drag dice | Name Picker (dice) | Rubix-cube style swipe |
| Tap player area | Four Corners | Bỏ phiếu góc |
| Pinch to zoom | All | Zoom vào board |

#### Presentation Touch Zones
| Zone | Action |
|---|---|
| Left third tap | Previous slide |
| Right third tap | Next slide |
| Center tap | Toggle controls overlay |
| Two-finger tap | Black screen |
| Swipe up | Slide overview grid |
| Double-tap | Fit to screen |

#### Command Palette
| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open command palette (search all actions) |

#### Annotation Tools (Presenter)
| Shortcut | Action |
|---|---|
| `Ctrl+P` | Toggle pen tool |
| `Ctrl+I` | Toggle laser pointer |
| `E` | Erase all annotations |
| `Y` | Toggle yellow highlighter |

#### Presenter View
- Speaker notes panel
- Timer/countdown display
- Next slide preview
- Slide number indicator

---

## Kiến trúc đề xuất

### 1. Extended Shortcut Registry

Mở rộng `default-keyboard-shortcut-definitions-registry.js` thêm:

```js
// Slideshow shortcuts
{ id: 'startSlideshow', shortcut: 'F5', scopes: ['editor'] },
{ id: 'startSlideshowCurrent', shortcut: 'Shift+F5', scopes: ['editor'] },
{ id: 'blackScreen', shortcut: 'B', scopes: ['presentation'] },
{ id: 'whiteScreen', shortcut: 'W', scopes: ['presentation'] },
{ id: 'slideNext', shortcut: 'ArrowRight', scopes: ['presentation'] },
{ id: 'slidePrev', shortcut: 'ArrowLeft', scopes: ['presentation'] },
{ id: 'slideFirst', shortcut: 'Home', scopes: ['presentation'] },
{ id: 'slideLast', shortcut: 'End', scopes: ['presentation'] },
{ id: 'endSlideshow', shortcut: 'Escape', scopes: ['presentation'] },

// Game presenter shortcuts
{ id: 'gameHud', shortcut: 'G', scopes: ['presentation-game'] },
{ id: 'gameTimer', shortcut: 'Space', scopes: ['presentation-game'] },
{ id: 'gameNext', shortcut: 'Enter', scopes: ['presentation-game'] },
{ id: 'gameReveal', shortcut: 'R', scopes: ['presentation-game'] },
{ id: 'gameLeaderboard', shortcut: 'L', scopes: ['presentation-game'] },
{ id: 'gamePause', shortcut: 'P', scopes: ['presentation-game'] },
{ id: 'timerAdd', shortcut: '+', scopes: ['presentation-game'] },
{ id: 'timerSub', shortcut: '-', scopes: ['presentation-game'] },
{ id: 'teamSelect1', shortcut: '1', scopes: ['presentation-game'] },
{ id: 'teamSelect2', shortcut: '2', scopes: ['presentation-game'] },
{ id: 'teamSelect3', shortcut: '3', scopes: ['presentation-game'] },
{ id: 'teamSelect4', shortcut: '4', scopes: ['presentation-game'] },

// Editor shortcuts
{ id: 'insertSlide', shortcut: 'Ctrl+M', scopes: ['editor'] },
{ id: 'group', shortcut: 'Ctrl+G', scopes: ['editor'] },
{ id: 'ungroup', shortcut: 'Ctrl+Shift+G', scopes: ['editor'] },
{ id: 'bringForward', shortcut: 'Ctrl+]', scopes: ['editor'] },
{ id: 'sendBackward', shortcut: 'Ctrl+[', scopes: ['editor'] },
{ id: 'cycleNext', shortcut: 'Tab', scopes: ['editor'] },
{ id: 'cyclePrev', shortcut: 'Shift+Tab', scopes: ['editor'] },
{ id: 'resetZoom', shortcut: 'Ctrl+0', scopes: ['editor'] },
{ id: 'zoomIn', shortcut: 'Ctrl+=', scopes: ['editor'] },
{ id: 'zoomOut', shortcut: 'Ctrl+-', scopes: ['editor'] },
{ id: 'commandPalette', shortcut: 'Ctrl+K', scopes: ['editor'] },

// Annotation
{ id: 'penTool', shortcut: 'Ctrl+P', scopes: ['presentation'] },
{ id: 'laserPointer', shortcut: 'Ctrl+I', scopes: ['presentation'] },
{ id: 'eraseAnnotations', shortcut: 'E', scopes: ['presentation'] },
```

### 2. Scope System

Mở rộng scope của `use-keyboard.js`:

```
editor         → EditorPage (default, all edit actions)
presentation   → Present mode (slideshow controls)
presentation-game → Present + game element selected (game controls)
```

- Khi `isPresenting === true`: activate scope `presentation`
- Khi `isPresenting === true` + game element active: activate `presentation-game`
- Khi `isPresenting !== true`: activate scope `editor`

### 3. Touch Gesture Layer

Tách riêng touch handling vào `use-touch-gestures.js`:

- Canvas touch → element selection, drag, pinch/zoom
- Presentation touch → slide navigation, overlay toggle
- Game touch → wheel spin, corner tap, buzzer

---

## Thứ tự triển khai đề xuất

### Phase 1: Slideshow Controls (Mức 1)
1. Thêm `F5`/`Shift+F5` → start presentation
2. Thêm `←/→` arrow keys trong present mode
3. Thêm `Esc` để end presentation
4. Thêm `B`/`W` black/white screen
5. Thêm `Home`/`End`

### Phase 2: Game Presenter Shortcuts (Mức 2)
1. Mở rộng scope system để nhận biết `presentation-game`
2. Thêm `Space`/`Enter`/`G`/`R`/`L`/`P`/`1-4`/`+/-`
3. Wiring các shortcuts → game component actions
4. Wiring `Escape` → exit game mode

### Phase 3: Editor Enhancements (Mức 3)
1. Thêm `Ctrl+M` → new slide
2. Thêm `Ctrl+G`/`Ctrl+Shift+G` → group/ungroup
3. Thêm `Ctrl+]/[` → z-index reorder
4. Thêm `Tab`/`Shift+Tab` → cycle selection
5. Thêm `Ctrl+0/+/-` → zoom

### Phase 4: Touch & Modern (Mức 4)
1. Canvas touch gestures (tap, drag, pinch)
2. Presentation swipe navigation
3. Name Picker touch spin
4. Command palette `Ctrl+K`
5. Annotation tools (pen, laser pointer)
6. Presenter timer view

---

## Trade-offs & Rủi ro

| Decision | Trade-off |
|---|---|
| Global `G` shortcut cho game HUD | Có thể conflict với `Ctrl+G` (group) nếu scope không đúng — cần scope rõ ràng |
| `Space` cho game timer | Conflict tiềm năng với `Space` trong text editing — chỉ active khi present |
| Touch spin cho Name Picker | Wheel vẫn cần hoạt động với button cho keyboard users |
| `Ctrl+I` cho laser pointer | Conflict với TipTap Italic shortcut — cần override TipTap khi present |
| 60+ shortcuts mới | Phải có shortcut reference/help panel để user discover |

---

## Decisions Confirmed

- **Triển khai:** Review plan trước, chưa implement ngay
- **Annotations:** **CÓ** — Pen tool, laser pointer, eraser cho presenter mode
- **Phạm vi:** Tất cả 4 phases đầy đủ (Slideshow + Game + Editor + Touch/Modern + Annotations)

## Unresolved Questions

1. **Shortcut conflict:** `Ctrl+I` hiện dùng cho TipTap Italic. Dùng cho laser pointer khi present sẽ conflict. Cần ưu tiên: TipTap khi edit text, laser khi present?
2. **Touch spin physics:** Drag-to-spin cho Name Picker wheel cần physics engine (momentum, deceleration) — có thể phức tạp hơn dự kiến.
3. **Command palette scope:** `Ctrl+K` mở palette ở chế độ nào? Editor only hay cả present mode?
4. **Annotation data model:** annotations vẽ lên slide có được lưu vào presentation JSON không, hay chỉ tạm thời trong session?
5. **Presenter timer:** Timer hiển thị trong presenter view có cần sync với server (Socket.IO) không, hay chỉ local?

---

## Sources

- NavSlidesEditor codebase: `client/src/utils/default-keyboard-shortcut-definitions-registry.js`, `client/src/hooks/use-keyboard.js`, `client/src/constants/game-element-types-constants.js`, `client/src/hooks/use-game-socket.js`, `client/src/components/canvas/element-renderers/game-element-renderer.jsx`
- Microsoft PowerPoint keyboard shortcuts reference
- Kahoot!, Quizizz, Jeopardy Labs game control patterns
- Canva, Google Slides modern presentation features

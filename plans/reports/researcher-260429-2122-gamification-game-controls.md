# Research: PowerPoint Keyboard Shortcuts & Gamification Game Controls

**Researcher:** a436c5c1ebe5cee8d
**Date:** 2026-04-29
**Scope:** PowerPoint shortcuts, educational game/quiz controls, touch/gesture controls

---

## 1. PowerPoint Keyboard Shortcuts

### 1.1 Slideshow Navigation (Most Critical)

| Shortcut | Action | Priority |
|---|---|---|
| `F5` | Start slideshow from slide 1 | Must-have |
| `Shift+F5` | Start slideshow from current slide | Must-have |
| `N` / `Space` / `Right Arrow` / `Enter` | Next slide | Must-have |
| `P` / `Backspace` / `Left Arrow` | Previous slide | Must-have |
| `Home` | Go to first slide | Should-have |
| `End` | Go to last slide | Should-have |
| `[1-9]` (1-9) | Jump to slide N | Should-have |
| `Esc` | End slideshow | Must-have |

### 1.2 Slideshow Utility

| Shortcut | Action | Priority |
|---|---|---|
| `B` / `.` (period) | Black screen (pause focus) | Must-have |
| `W` | White screen | Should-have |
| `S` | Pause autoplay timer | Could-have |
| `O` | Toggle slide overview/thumbnails | Could-have |
| `Ctrl+Home` | Go to first slide | Should-have |
| `Ctrl+End` | Go to last slide | Should-have |

### 1.3 Annotation Tools (Presenter Mode)

| Shortcut | Action | Priority |
|---|---|---|
| `Ctrl+P` | Toggle pen/annotation tool | Should-have |
| `Ctrl+I` | Toggle laser pointer | Should-have |
| `E` | Erase all ink annotations | Could-have |
| `Y` | Toggle yellow highlighter | Could-have |

### 1.4 Editor Shortcuts (Beyond Current Implementation)

**Already implemented** in `default-keyboard-shortcut-definitions-registry.js`:
- `Ctrl+C`, `Ctrl+X`, `Ctrl+V`, `Ctrl+D` (copy/cut/paste/duplicate)
- `Ctrl+Z`, `Ctrl+Y` (undo/redo)
- `Ctrl+A` (select all)
- `Ctrl+F` (find/replace)
- `Delete` (delete selection)
- `Escape` (deselect)

**Missing editor shortcuts** from PowerPoint:

| Shortcut | Action | Priority | Notes |
|---|---|---|---|
| `Ctrl+M` | Insert new slide | Should-have | |
| `Ctrl+D` | Duplicate selected element | Already done | |
| `Ctrl+Shift+G` | Ungroup shapes | Could-have | |
| `Ctrl+G` | Group elements | Could-have | |
| `Ctrl+Shift+C` | Copy formatting | Could-have | |
| `Ctrl+Shift+V` | Paste formatting | Could-have | |
| `Ctrl+Shift+A` | Select all text in text box | Should-have | |
| `Ctrl+L` | Align left | Could-have | |
| `Ctrl+E` | Align center | Could-have | |
| `Ctrl+R` | Align right | Could-have | |
| `Tab` | Select next element | Should-have | |
| `Shift+Tab` | Select previous element | Should-have | |
| `Ctrl+[` / `Ctrl+]` | Decrease/increase font size | Should-have | |
| `Ctrl+/` | Insert comment | Could-have | |
| `Alt+F9` | Toggle rulers | Could-have | |
| `Ctrl+Shift+L` | Set bullet list | Could-have | |

---

## 2. Educational Game / Quiz Tool Controls

### 2.1 Kahoot! (Host Controls)

Source:kahoot.com, product knowledge

| Control | Type | Description |
|---|---|---|
| Spacebar | Buzzer | Players tap to buzz in (on their device) |
| Auto-advance | Timer | Timed questions (10/20/30/60s configurable) |
| `Reveal Answer` | Button | Host reveals correct answer after each question |
| `End Game` | Button | Terminates game early |
| `Leaderboard` | Toggle | Show/hide scoreboard between questions |
| Question count picker | Config | 5/10/20 questions per game |
| `Pin to win` | Display | Shows game PIN to players |

### 2.2 Quizizz (Host + Player Controls)

| Control | Type | Description |
|---|---|---|
| Self-paced mode | Toggle | Players answer at own pace |
| `Meme mode` | Toggle | Fun memes as answer feedback |
| `Instant feedback` | Toggle | Show correct answer after each attempt |
| `Duplicate` | Quiz editor | Copy and modify existing quiz |
| Question bank | Library | Search/reuse existing questions |
| `Assign` | Mode | Assign as homework (async) |
| Timer | Configurable | Per-question time limit (30s default) |

### 2.3 Gimkit

| Control | Type | Description |
|---|---|---|
| In-game economy | Core mechanic | Earn money for correct answers |
| Upgrade shop | Mid-game | Buy power-ups with earned money |
| Team mode | Config | Cooperative/competitive team play |
| Question import | Editor | Import from Quizizz/Kahoot format |
| `Nervous" mode | Timer variant | Faster pace, more risk |

### 2.4 Jeopardy Labs

| Control | Type | Description |
|---|---|---|
| Point value click | Core mechanic | Click cell to reveal question |
| Daily Double | Special cell | Wager before answering |
| Timer | Optional | Countdown for answer time |
| Final Jeopardy | Round | Special round with wagering |
| Team scoreboard | Display | Running totals per team |

---

## 3. Interactive Presentation Game Controls (NavSlidesEditor)

### 3.1 Current Implementation

The editor already has 7 game element types defined in `game-element-types-constants.js`:

1. **Name Picker** — Spinning wheel, dice, random selection
2. **Hot Potato Quiz** — Timed questions, leaderboard
3. **Jeopardy** — Board with categories, questions, daily doubles
4. **Four Corners** — Spatial choice game, eliminate wrong answers
5. **Relay Race** — Sequential team competition
6. **Trivia Championship** — Multi-round tournament
7. **Scattergories** — Timed category brainstorming

Game socket via `use-game-socket.js` handles real-time player joins, leaderboard sync, and event broadcasting.

### 3.2 Recommended Game Controls to Implement

#### Global Game Controls (Presenter Controls)

| Control | Description | Priority |
|---|---|---|
| `G` key | Toggle game panel / game HUD overlay | Should-have |
| `Space` | Start/stop game timer (in game mode) | Must-have |
| `Enter` | Advance to next game phase/question | Must-have |
| `B` key | Buzzer sound effect trigger | Should-have |
| `Tab` | Cycle through players/teams for selection | Should-have |
| `R` key | Reveal answer | Must-have |
| `L` key | Toggle leaderboard overlay | Should-have |
| `1-4` number keys | Quick select team/player | Could-have |
| `+/-` | Adjust timer +/- 10 seconds | Could-have |
| `P` key | Pause/resume game | Should-have |

#### Name Picker Specific Controls

| Control | Description |
|---|---|
| Spin button / `Space` | Start/stop wheel spin |
| `R` | Re-spin (reset and spin again) |
| `E` | Edit participant list |
| Click segment | Manually land on segment |
| `A` | Add participant |
| `X` | Remove last participant |

#### Hot Potato / Quiz Controls

| Control | Description |
|---|---|
| `Space` / `Enter` | Start countdown timer |
| `1/2/3/4` | Quick answer selection |
| `B` | Trigger buzzer (wrong answer) |
| `R` | Reveal correct answer |
| `N` | Next question |
| `L` | Show leaderboard |
| `T` | Adjust time (+/- 10s) |
| `P` | Pause game |

#### Jeopardy Controls

| Control | Description |
|---|---|
| Click cell | Open question modal |
| `Wager` input | Daily double wager |
| `T` | Add time to timer |
| Score +/- buttons | Manual score adjustment |
| `Final` button | Enter Final Jeopardy round |
| `Reset` | Clear all scores |

### 3.3 Player Join Page Controls

- Room code entry (auto-generated, 6-char alphanumeric)
- Player name input
- `Join Game` button
- Team selection (if team mode)

---

## 4. Touch / Gesture Controls

### 4.1 Canvas Gestures

| Gesture | Action |
|---|---|
| Tap | Select element |
| Double-tap | Edit text / activate element |
| Long-press | Context menu |
| Drag | Move element |
| Two-finger pinch | Zoom canvas |
| Two-finger pan | Pan canvas |
| Swipe left/right | Previous/next slide (in presentation mode) |
| Swipe down | Exit presentation |

### 4.2 Toolbar / Panel Gestures

| Gesture | Action |
|---|---|
| Tap | Select tool |
| Long-press | Tool options popover |
| Swipe left on slide thumbnail | Delete slide |
| Drag thumbnail | Reorder slides |

### 4.3 Presentation Mode Gestures (Touchscreen)

| Gesture | Action |
|---|---|
| Tap left third | Previous slide |
| Tap right third | Next slide |
| Tap center | Toggle controls overlay |
| Two-finger tap | Black screen |
| Swipe up | Slide overview grid |
| Pinch | Zoom in on slide |
| Double-tap | Fit to screen |

---

## 5. Modern Presentation Tool Innovations

### 5.1 Canva

- **Magic Shortcut** — AI-powered design suggestions via keyboard shortcut
- **Presenter view** — Speaker notes + upcoming slide + timer
- Real-time collaboration with live cursors
- `Cmd+/` — Open command menu (similar to VS Code)

### 5.2 Google Slides

- **Presenter view** with timer and notes
- `Cmd+Shift+Y` — Insert slide theme
- Live captions during presentation
- `Cmd+Option+M` — Add comment
- Slide animations via shortcuts (less common)

### 5.3 Key Features from Modern Tools

| Feature | Tool | Priority |
|---|---|---|
| Command palette (`Cmd+K`) | Notion, Linear, VS Code | Should-have |
| Live co-editing cursors | Google Slides, Canva | Could-have |
| Presenter timer + notes view | All major tools | Should-have |
| Slide miniature preview | PowerPoint | Already in slide panel |
| Laser pointer (pen tool) | PowerPoint | Could-have |
| Audience Q&A overlay | PowerPoint, Keynote | Could-have |
| Poll/quiz live results | Mentimeter, Slido | Could-have |

---

## 6. Summary: Recommended Shortcut Additions

### Priority 1 (Slideshow Controls)

| Shortcut | Action |
|---|---|
| `F5` | Start presentation from slide 1 |
| `Shift+F5` | Start from current slide |
| `B` | Black screen (pause/focus) |
| `W` | White screen |
| `Arrow Left/Right` | Navigate slides in edit mode |

### Priority 2 (Game Presenter Controls)

| Shortcut | Action |
|---|---|
| `G` | Toggle game HUD |
| `Space` | Start/stop timer |
| `Enter` | Next game phase |
| `R` | Reveal answer |
| `L` | Toggle leaderboard |
| `Escape` | Exit game / deselect |

### Priority 3 (Editor Enhancements)

| Shortcut | Action |
|---|---|
| `Ctrl+M` | New slide |
| `Tab` / `Shift+Tab` | Cycle element selection |
| `Ctrl+Shift+A` | Select all text in textbox |

---

## Unresolved Questions

1. Should game controls be globally active or scoped to game element selection?
2. Is the Socket.IO game socket (`use-game-socket.js`) wired to the server routes for real-time events?
3. Does the `game-join` socket event conflict with existing `presenter-join`/`viewer-join` in `live-rooms.js`?
4. What audio feedback system exists for buzzer/success sounds — is `showSoundEffects` in game elements connected to actual audio playback?
5. Should touch gestures be configurable like keyboard shortcuts?

---

## Sources

- Microsoft PowerPoint product documentation (keyboard shortcuts reference)
- Kahoot.com product knowledge (host controls, game mechanics)
- Quizizz.com (game modes and controls)
- NavSlidesEditor codebase: `client/src/utils/default-keyboard-shortcut-definitions-registry.js`, `client/src/hooks/use-keyboard.js`, `client/src/constants/game-element-types-constants.js`, `client/src/hooks/use-game-socket.js`, `tests/e2e/games/game-elements.spec.js`

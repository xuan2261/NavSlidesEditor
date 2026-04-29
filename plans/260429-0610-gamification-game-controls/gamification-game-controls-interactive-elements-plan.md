---
plan_id: 260429-0610-gamification-game-controls
title: "Gamification Game Controls — Interactive Element Types for NavSlides"
status: completed
created: 2026-04-29
priority: P1
blockedBy: []
blocks: []
---

# Plan: Gamification Game Controls

## Overview

Tích hợp **interactive game elements** vào NavSlides Editor như element type mới. Mỗi game element là một component có thể thêm vào slide, chỉnh sửa properties trong panel, và chạy khi trình chiếu — HS tham gia trên thiết bị riêng qua Socket.IO + REST hybrid.

## Architecture

```
Element.type = "game"
├── gameType: "name-picker"        → Vòng quay tên, xúc xắc, bấm nút
├── gameType: "hot-potato"         → Quiz + timer + leaderboard
├── gameType: "jeopardy"           → Bảng Jeopardy 5×5
├── gameType: "four-corners"       → 4 góc phòng dự đoán
├── gameType: "relay-race"         → Chạy tiếp sức đội nhóm
├── gameType: "trivia-champ"       → Nhiều vòng thi
└── gameType: "scattergories"      → 60 giây bảng chữ cái
```

**Backend:** Socket.IO (`/live` namespace, mở rộng) + REST API (`/api/games/:id/...`)
**Frontend:** Element renderer mới + Properties panel + Toolbar + Player join UI

## Phases

| # | Phase | Status | Effort | Dependencies |
|---|---|---|---|---|
| 1 | [Game Element Types Foundation](phase-01-game-element-types-foundation.md) | `done` | 3h | — |
| 2 | [Game Backend Engine](phase-02-game-backend-engine.md) | `completed` | 4h | 1 |
| 3 | [Game Canvas Renderer](phase-03-game-canvas-renderer.md) | `pending` | 4h | 1 |
| 4 | [Game Properties Panel](phase-04-game-properties-panel.md) | `completed` | 4h | 1, 3 |
| 5 | [Toolbar Integration](phase-05-toolbar-integration.md) | `completed` | 2h | 1, 4 |
| 6 | [Player UI & Join Flow](phase-06-player-ui-join-flow.md) | `completed` | 3h | 2 |
| 7 | [Name Picker (Wheel + Dice)](phase-07-name-picker-game.md) | `completed` | 4h | 2,3,4,5,6 |
| 8 | [Hot Potato Quiz](phase-08-hot-potato-quiz.md) | `completed` | 5h | 2,3,4,5,6 |
| 9 | [Jeopardy Board](phase-09-jeopardy-board.md) | `completed` | 5h | 2,3,4,5,6 |
| 10 | [Additional Games](phase-10-additional-games-four-corners-relay-trivia.md) | `completed` | 6h | 2,3,4,5,6 |
| 11 | [Integration Testing & E2E](phase-11-integration-testing-e2e.md) | `completed` | 4h | 7,8,9,10 |

**Total estimated effort:** ~40h

## Files Summary

- **Create:** 15 files mới (renderers, hooks, pages, services)
- **Modify:** 6 files hiện có (`element-defaults.js`, `registry.js`, `Toolbar.jsx`, `InsertMenu.jsx`, `App.jsx`, `server/index.js`)
- **Delete:** 0 files

## Phase Detail Summary

### Foundation (Phase 1-5) — ~17h
- Phase 1: Thêm `type: "game"` vào element system + schema 7 game types
- Phase 2: Socket.IO game engine + REST API endpoints
- Phase 3: SVG game renderers (wheel, dice, timer, board)
- Phase 4: Properties panel với tabs Content/Display/Scoring
- Phase 5: Toolbar "Insert Game" button + menu

### Core (Phase 6) — 3h
- Phase 6: Player join page + Socket.IO player hook

### Games (Phase 7-10) — ~20h
- Phase 7: Name Picker — wheel spin, dice roll, button pick + confetti
- Phase 8: Hot Potato Quiz — timer, answer grid, leaderboard, speed bonus
- Phase 9: Jeopardy Board — 5×5 grid, card flip, team scores, Daily Double
- Phase 10: Four Corners, Relay Race, Trivia Championship, Scattergories

### Validation (Phase 11) — 4h
- Phase 11: Unit + Integration + E2E tests cho toàn bộ flow

## Key Decisions

1. **Model:** Element type mới (`type: "game"`, `gameType: "..."`) — tách biệt hoàn toàn khỏi các type hiện có
2. **Rendering:** Dùng `game-element-renderer.jsx` với SVG canvas cho animation (vòng quay, xúc xắc) + iframe cho complex games
3. **Socket.IO:** Reuse namespace `/live`, thêm `game-join`, `game-answer`, `game-random`, `game-leaderboard`, `game-end`
4. **Properties:** Tab-based panel (Content / Display / Scoring)
5. **Player URL:** `/player/:slideId/:elementId` — trang join đơn giản, nhập tên, chọn đáp án

## Open Questions

- QR code auto-generation cho game join URL?
- Sound effects toggle — cần preload audio?
- Leaderboard persistence sau khi close game?

## Files Summary

- **Create:** 15 files mới
- **Modify:** 6 files hiện có
- **Delete:** 0 files

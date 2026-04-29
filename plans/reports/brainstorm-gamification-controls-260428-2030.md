# Brainstorm Report: Game Controls — Interactive Elements cho NavSlides Editor

**Ngày:** 2026-04-28
**Tác giả:** Brainstormer Agent
**Scope:** Thiết kế kiến trúc game controls như element type mới cho NavSlides Editor

---

## 1. Problem Statement

Giáo viên muốn tích hợp trò chơi kiểm tra bài cũ (quiz games) TRỰC TIẾP vào presentation đang trình chiếu, không cần rời sang app khác. Học sinh tham gia trên thiết bị riêng (điện thoai/máy tính). Mỗi trò chơi cần là một **element type** có thể thêm vào slide, chỉnh sửa properties, và chạy khi trình chiếu.

## 2. Requirements Summary

- **Dạng:** Element type mới (giống shape, text, image trong `element-defaults.js`)
- **Tương tác HS:** Hybrid — GV điều khiển trên máy + HS trả lời trên thiết bị riêng
- **Cơ chế backend:** Kết hợp Socket.IO (real-time: đếm ngược, leaderboard, random) + REST API (nộp câu trả lời)
- **Properties panel:** Đầy đủ — danh sách tên, câu hỏi & đáp án, cấu hình hiển thị
- **Đối tượng:** THPT & Đại học (quiz nhiều hơn, thi đấu đội nhóm)

## 3. Kiến Trúc Đề Xuất

### 3.1 Element Type System

Thêm `game-element` như một element type mới trong NavSlides:

```
Element.type = "game"
Sub-types:
  - "name-picker"      → Vòng quay tên, xúc xắc, bấm nút
  - "quiz-interactive" → Kahoot-style, Jeopardy, Hot Potato
  - "team-competition"  → Relay Race, Scavenger Hunt, Trivia Champ
  - "randomizer"       → Simple random picker (vòng quay đơn giản)
```

**File cần modify:**
- `client/src/data/element-defaults.js` — thêm game element types
- `client/src/components/SlideCanvas.jsx` — render game elements
- `client/src/components/properties/` — thêm game-properties.jsx
- `client/src/components/Toolbar.jsx` — thêm button "Insert Game"

### 3.2 Socket.IO Integration (reuse existing infrastructure)

Dùng lại Socket.IO namespace `/live` đã có trong `server/index.js`:

```
Socket events for games:
  - 'game-join'        → HS join game room (room = slide ID + element ID)
  - 'game-answer'      → HS submit answer
  - 'game-random'      → GV trigger random
  - 'game-leaderboard' → broadcast score
  - 'game-end'         → GV end game, show results
```

### 3.3 REST API Endpoints

```
POST /api/games/:elementId/submit   → Nộp câu trả lời
GET  /api/games/:elementId/results → Lấy kết quả
GET  /api/games/:elementId/leaderboard → Bảng xếp hạng
POST /api/games/:elementId/next   → GV next question
POST /api/games/:elementId/random  → GV trigger random picker
```

## 4. Các Game Elements Chi Tiết

### 4.1 Name Picker Wheel (Randomizer)
**Sub-type:** `name-picker`
**Mô tả:** Vòng quay tên ngẫu nhiên hoặc tung xúc xắc

**Properties:**
```javascript
{
  type: "game",
  gameType: "name-picker",
  items: ["Tên HS 1", "Tên HS 2", ...],  // danh sách tên
  pickerMode: "wheel" | "dice" | "button",
  wheelSegments: 8,         // số ô trên vòng quay
  wheelColors: [...],       // mảng màu
  diceCount: 2,             // số xúc xắc (1-3)
  weighted: false,          // có trọng số không
  excludeAfterPick: true,  // loại trừ sau khi chọn
  animationDuration: 2000, // ms
}
```

**Player count:** 1 player (GV điều khiển)
**HS interaction:** Xem kết quả trên màn hình chiếu

### 4.2 Hot Potato Quiz
**Sub-type:** `quiz-interactive`
**Mô tả:** Câu hỏi + đếm ngược + HS submit đáp án

**Properties:**
```javascript
{
  type: "game",
  gameType: "hot-potato",
  title: "Hot Potato Quiz",
  questions: [
    {
      id: "q1",
      question: "Câu hỏi 1?",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      timeLimit: 30,  // giây
      points: 10,
    },
    ...
  ],
  currentQuestion: 0,
  allowLate: false,
  showLeaderboard: true,
  shuffleQuestions: false,
}
```

**Player count:** Nhiều player (HS join qua mã game)
**HS interaction:** Mở URL → nhập tên → chọn đáp án trong thời gian giới hạn

### 4.3 Jeopardy Board
**Sub-type:** `team-competition`
**Mô tả:** Bảng Jeopardy với 5 chủ đề × 5 mức điểm

**Properties:**
```javascript
{
  type: "game",
  gameType: "jeopardy",
  title: "Jeopardy",
  teams: [
    { name: "Đội A", color: "#FF5722" },
    { name: "Đội B", color: "#2196F3" },
  ],
  categories: [
    { name: "Lịch Sử", questions: [100, 200, 300, 400, 500] },
    { name: "Toán", questions: [100, 200, 300, 400, 500] },
    ...
  ],
  questions: {
    "history-100": { question: "...", answer: "...", used: false },
    ...
  },
  dailyDouble: ["history-300", "math-400"],  // random hoặc chỉ định
}
```

### 4.4 Four Corners
**Sub-type:** `team-competition`
**Mô tả:** HS di chuyển đến 4 góc phòng theo dự đoán

**Properties:**
```javascript
{
  type: "game",
  gameType: "four-corners",
  cornerCount: 4,
  questions: [...],
  eliminateMode: "wrong" | "timeout",
  showTimer: true,
}
```

### 4.5 Relay Race
**Sub-type:** `team-competition`
**Mô tả:** Thi đấu đội nhóm, mỗi người trả lời 1 câu

**Properties:**
```javascript
{
  type: "game",
  gameType: "relay-race",
  teams: [...],
  questionsPerRound: 4,  // = số người mỗi đội
  shuffleTeams: true,
  passOnWrong: true,  // sai thì chuyển người tiếp
}
```

### 4.6 Trivia Championship
**Sub-type:** `quiz-interactive`
**Mô tả:** Nhiều vòng thi — cá nhân → đội → buzzer

**Properties:**
```javascript
{
  type: "game",
  gameType: "trivia-champ",
  rounds: [
    { name: "Vòng 1: Cá nhân", questions: [...], mode: "individual" },
    { name: "Vòng 2: Đội nhóm", questions: [...], mode: "team" },
    { name: "Vòng 3: Buzzer", questions: [...], mode: "buzzer" },
  ],
  lightningRound: { enabled: true, timePerQ: 10 },
  jackpotRound: { enabled: true, multiplier: 5 },
}
```

### 4.7 Scattergories
**Sub-type:** `team-competition`
**Mô tả:** 60 giây liệt kê từ theo bảng chữ cái

**Properties:**
```javascript
{
  type: "game",
  gameType: "scattergories",
  teams: [...],
  timePerRound: 60,
  letterMode: "random" | "sequential",
  categories: ["Con vật", "Đồ ăn", "Quốc gia", ...],
  scoring: "unique" | "all",  // chỉ điểm từ không trùng / tất cả đều điểm
}
```

## 5. Properties Panel Design

Mỗi game element cần một properties panel riêng. Cấu trúc:

```
┌─ Game Settings ─────────────────────┐
│  Game Type: [Dropdown]              │
│  ─────────────────────────────────  │
│  [Tab: Content]   [Tab: Display]    │
│  ─────────────────────────────────  │
│  Content Tab:                        │
│    • Questions list (add/edit/del)  │
│    • Name/Team list                 │
│    • Timer settings                 │
│  Display Tab:                       │
│    • Colors, fonts, animations       │
│    • Show/hide leaderboard          │
│    • Sound effects toggle           │
└─────────────────────────────────────┘
```

## 6. Rendering & Playback Flow

### Editor Mode:
1. GV thêm element "Game" từ Toolbar
2. Chọn game type → hiện properties panel
3. Nhập nội dung (câu hỏi, tên, cấu hình)
4. Preview trực tiếp trên slide

### Presentation Mode:
1. GV click vào game element → khởi động game
2. Màn hình chiếu hiện game UI (vòng quay, câu hỏi, leaderboard)
3. HS mở URL / scan QR → join room (slide ID + element ID)
4. HS trả lời trên thiết bị → real-time feedback trên màn hình chiếu
5. GV kết thúc → hiện kết quả cuối

## 7. Suggested Implementation Priority

| Ưu tiên | Element | Lý do |
|---|---|---|
| 1 | **Name Picker Wheel** | Đơn giản nhất, ít tương tác HS, reuse nhiều nhất |
| 2 | **Hot Potato Quiz** | Core mechanic — câu hỏi + timer + leaderboard |
| 3 | **Jeopardy Board** | Phổ biến nhất trong THPT |
| 4 | **Four Corners** | Không cần thiết bị cho HS (giới hạn) |
| 5 | **Relay Race** | Thi đấu đội nhóm |
| 6 | **Trivia Championship** | Nhiều vòng phức tạp |
| 7 | **Scattergories** | Từ vựng chuyên sâu |

## 8. Risks & Open Questions

- **Security:** Dữ liệu HS (tên, điểm) — cần xử lý GDPR/PIPL nếu triển khai rộng
- **Offline:** Không có internet — các game không cần thiết bị HS hoạt động được
- **Scale:** Socket.IO room management — nếu nhiều lớp cùng lúc, cần unique room ID
- **Offline game mode:** Nên có chế độ "GV điều khiển hoàn toàn" — không cần HS join, HS trả lời miệng
- **Performance:** Game elements render trên slide canvas — cần lazy load game UI

---

**Status:** DONE

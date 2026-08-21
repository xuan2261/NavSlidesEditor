# Frontend + shared code review

Ngày: 2026-08-20  
Scope: `client/src/**`, `shared/src/**`, tests liên quan; review-only.  
Trust model: không coi trusted author HTML/CSS/JS là XSS.

## Kết luận nhanh

- Critical: 0
- High: 1
- Medium: 5
- Low: 1
- Verification đã chạy: `npx eslint client/src shared/src` (0 errors, 3 warnings); 6 test files chọn lọc, 33/33 tests pass.
- Test pass hiện tại không phủ các integration/race/accessibility gaps dưới đây.

## High

### H1 — Game presenter shortcuts bị đứt wiring và có thể throw runtime

- Impact: các shortcut như next phase, pause, team select gọi `undefined`; thao tác game presenter không chạy, có thể ném `TypeError` trong key handler.
- Evidence: `use-editor-live-session-controller.js:107-119` tạo `emitGameShortcutAction`, nhưng object return tại `:121-130` không chứa nó. `EditorPage.jsx:489-497` vẫn destructure field này và truyền tại `:528-537`. Consumer gọi trực tiếp tại `use-editor-keyboard-controller.js:83,106,133`.
- Test gap: `use-editor-keyboard-controller.test.js:12` inject mock emitter, nên chỉ test consumer và bỏ qua producer-to-consumer wiring.
- Verification suggestion: thêm integration test render `EditorPage`/controller thật, kích shortcut game active; assert local `CustomEvent` và popup bridge nhận message, không có exception.

## Medium

### M1 — “Default Preferences” được lưu nhưng không áp dụng khi tạo deck

- Impact: user lưu `defaultTheme`/`defaultTransition` thành công nhưng New Presentation vẫn luôn mở `black`/`slide`; setting user-visible hiện là inert configuration.
- Evidence: Settings load/save các field tại `SettingsPage.jsx:87-105,197-207` và UI chỉnh tại `:553-579`. Home form lại hard-code `black`/`slide` tại `HomePage.jsx:278-283`, reset cùng giá trị tại `:355` và `:543`, rồi gửi nguyên form tại `:345-353`.
- Verification suggestion: lưu default `white` + `fade`, quay Home, mở New Presentation; assert select values và payload create dùng defaults. Thêm test Settings→Home data flow.

### M2 — Timeout cũ có thể dừng polling Reveal của iframe mới

- Impact: preview/live/speaker iframe đổi `htmlContent` hoặc `frameKey` nhanh có thể mất Reveal initialization, nhất là resource load chậm; preview đứng hoặc không sync slide.
- Evidence: mỗi load tạo interval vào shared ref tại `use-reveal-preview-frame.js:23-54`; timeout không được lưu/cleanup tại `:56-61` và sau 15s clear bất kỳ interval đang nằm trong ref. Effect cleanup `:64-69` chỉ clear interval, không cancel timeout cũ.
- Verification suggestion: fake timers; load frame A, đổi sang B trước 15s, cho A timeout fire trong lúc B chưa ready; assert B interval vẫn tồn tại và B có thể set `deckRef`.

### M3 — Marketplace fetch lỗi bị hiển thị vĩnh viễn như đang loading

- Impact: network/server error không có error message hay Retry; user thấy “Loading templates...” vô hạn và không phân biệt được outage với tải chậm.
- Evidence: fetch chỉ `.catch(console.error)` tại `HomePage.jsx:819-823`; state rỗng luôn render “Loading templates...” tại `:1460-1467`.
- Verification suggestion: mock `getMarketplaceTemplates` reject; assert alert + Retry button, retry success thay thế error bằng cards.

### M4 — Dashboard thumbnail dùng một full Reveal iframe cho mỗi card

- Impact: thư viện nhiều deck gây CPU/memory/network tăng theo số card đã scroll qua; mỗi iframe tải full present HTML/runtime và mỗi card có riêng `ResizeObserver`.
- Evidence: `SlideThumbnail.jsx:8-18` tạo observer/card; `:26-40` mount iframe 1920×1080 tới `/present`. Home map toàn bộ list trong grid/list tại `HomePage.jsx:1589` và `:1658`.
- Verification suggestion: profile dashboard với 50/200 decks, đo iframe count, heap, scripting và request count sau scroll; đặt budget. Cân nhắc server/static thumbnail hoặc virtualization/unmount ngoài viewport.

### M5 — Nhiều primary interactions là click-only `div`

- Impact: keyboard-only và assistive-tech users không thể insert media, chọn slides để insert, hoặc vận hành Jeopardy bằng các control chính.
- Evidence: media card chỉ có `onClick` tại `MediaLibraryModal.jsx:287-294`; slide selector chỉ có `onClick` tại `TemplatePreview.jsx:152-160`; Jeopardy cells, reveal card và team selector dùng `div onClick` tại `game-element-renderer.jsx:821-824,964-965,1152-1155`, không `role`, `tabIndex`, Enter/Space handler.
- Test gap: `MediaLibraryModal.test.jsx:24-43` chỉ đếm items/load-more; không tab/activate card. Accessibility regression test hiện chỉ kiểm responsive source contract (`ui-accessibility-findings-regression.test.js:33-39`).
- Verification suggestion: đổi interactive surface sang `<button>` hoặc semantic equivalent; thêm `userEvent.tab()` + Enter/Space và axe checks cho cả ba flows.

## Low

### L1 — Base theme catalogs đã drift giữa các UI

- Impact: `blood` có trong presets/editor nhưng không chọn được ở Home/Settings; `sky` có ở Home/Settings nhưng biến mất khỏi Design ribbon. Duplicated catalogs tiếp tục dễ drift.
- Evidence: `HomePage.jsx:46-58` và `SettingsPage.jsx:30-42` có `sky`, thiếu `blood`; `design-tab-content.jsx:22-25` có `blood`, thiếu `sky`; shared preset map dùng `blood` tại `shared/src/theme-presets.js:158,184`.
- Verification suggestion: export một shared `REVEAL_THEMES` constant; contract test mọi theme preset và mọi selector dùng cùng set/order.

## Hypotheses

- Không có; các finding trên đều có static evidence trực tiếp. Runtime severity của M2/M4 nên đo bằng tests/profile đề xuất.

## Unresolved questions

- `Default Preferences` có chủ đích áp dụng cho New Presentation hay chỉ là server-side metadata? UI label hiện ngụ ý hành vi thứ nhất.

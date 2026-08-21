# Production-readiness review: frontend + shared

Ngày: 2026-08-20  
Scope: `client/src/**`, `shared/src/**`, dependency graph liên quan; review-only.  
Trust model: trusted author HTML/CSS/JS không bị coi là blocking XSS.

## Kết luận

- Critical: 0
- High: 2
- Medium: 4
- Low: 1
- Researcher candidates: xác nhận H1, M1, M2, M3, phần concrete của M5, L1; bác M4 vì thiếu measurement.

## Critical

Không có.

## High

### H1 — TipTap đang chạy peer graph hỗn hợp v2/v3 và bị npm đánh dấu `invalid`

- Evidence: `client/package.json:13-14,16-27` khóa toàn bộ editor stack ở `^2.6.6`, riêng `@tiptap/extension-highlight` tại `:15` là `^3.20.4`. Lockfile hoist `@tiptap/core@3.20.4` vào `client/node_modules` (`package-lock.json:91-101`) cho Highlight v3 (`:131-140`), trong khi `@tiptap/react@2.27.2` yêu cầu core/pm v2 (`:294-314`) và StarterKit vẫn v2 (`:3442-3468`). App ghép chúng trong cùng editor tại `client/src/hooks/editor-controller/use-editor-rich-text-controller.js:2-15,77-97`.
- Failure scenario: strict peer validation/clean dependency reconciliation có thể chặn install; còn install hiện tại nạp v2 React/extensions qua core/pm v3 không được support. Rich-text editing phụ thuộc kết quả hoist và có thể đổi hành vi khi npm dedupe/update.
- Verification: `npm ls @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-text-style @tiptap/pm --all` exit 1, báo `@tiptap/core@3.20.4` và `@tiptap/pm@3.20.4` `invalid` so với peer `^2.7.0`.
- Vì sao tests miss: build/component tests không validate peer-major graph; không có dependency contract test yêu cầu mọi `@tiptap/*` cùng major.
- Minimal verification sau fix: align toàn bộ TipTap về một major, clean install, chạy lệnh `npm ls` trên phải exit 0; mount editor thật và exercise highlight/color/table commands.

### H2 — Game presenter shortcuts destructure một callback không được return, rồi gọi như function

- Evidence: `client/src/hooks/editor-controller/use-editor-live-session-controller.js:107-119` tạo `emitGameShortcutAction`, nhưng return object `:121-130` bỏ field này. `client/src/pages/EditorPage.jsx:488-502` nhận `undefined`, rồi truyền xuống tại `:528-537`. Consumer gọi không guard ở `client/src/hooks/editor-controller/use-editor-keyboard-controller.js:83,106,133`.
- Failure scenario: deck có active game; nhấn Enter/Space/P/1-4 hoặc action tương ứng gọi `undefined(...)`, ném `TypeError`; event local và popup message không được gửi.
- Vì sao tests miss: unit test `client/src/hooks/editor-controller/use-editor-keyboard-controller.test.js:5-13` inject `vi.fn()`. Tuy nhiên integration regression test đã tồn tại tại `client/src/pages/__tests__/editor-page-present-wiring.test.jsx:157-200`; selected test set của researcher không chạy file này. Vì vậy bác claim “thiếu integration test”; thực tế verification selection đã bỏ sót test đáng lẽ fail.
- Minimal verification: return callback; chạy riêng `editor-page-present-wiring.test.jsx` và assert Enter/R không throw, event detail đúng, popup bridge nhận scoped message.

## Medium

### M1 — “Default Preferences” được lưu nhưng không dùng khi tạo presentation

- Evidence: Settings load/save `defaultTheme`/`defaultTransition` tại `client/src/pages/SettingsPage.jsx:57-67,87-105,197-213`, UI gọi rõ “Default” tại `:546-589`. Home không fetch settings, khởi tạo/reset form cố định `black`/`slide` tại `client/src/pages/HomePage.jsx:278-283,345-356`, rồi gửi nguyên payload.
- Failure scenario: user lưu `white` + `fade`, tạo deck mới vẫn nhận `black` + `slide`; cấu hình user-visible là inert.
- Vì sao tests miss: không có test frontend nào tham chiếu `defaultTheme`/`defaultTransition`; server tests chỉ chứng minh persistence.
- Minimal verification: save defaults, remount Home, mở New Presentation; assert form và POST payload dùng defaults.

### M2 — Timeout của iframe cũ có thể clear Reveal polling interval của iframe mới

- Evidence: `client/src/hooks/use-reveal-preview-frame.js:27-54` ghi interval mới vào shared ref. Timeout tại `:56-61` không được giữ/cleanup và sau 15 giây clear bất kỳ interval nào đang nằm trong ref. Effect cleanup `:64-69` chỉ clear interval hiện tại, không cancel timeout cũ.
- Failure scenario: frame A load, rồi `htmlContent/frameKey` đổi sang B trước timeout A; B vẫn chờ Reveal khi timeout A fire, nên interval B bị dừng và `deckRef` không bao giờ khởi tạo.
- Vì sao tests miss: Live/Speaker/Animation tests mock hook; không có test trực tiếp cho hook hoặc fake-timer reload race.
- Minimal verification: fake timers, load A rồi B, fire timeout A trong lúc B chưa ready; assert B polling tiếp tục và eventually set `deckRef`.

### M3 — Primary click targets không keyboard-accessible

- Evidence: media item là `div onClick` tại `client/src/components/MediaLibraryModal.jsx:287-294`; slide-selection card là `div onClick` tại `client/src/components/dashboard/TemplatePreview.jsx:152-160`; Jeopardy board cell/team row là `div onClick` tại `client/src/components/canvas/element-renderers/game-element-renderer.jsx:821-824,1152-1155`. Không có button semantics, `tabIndex`, Enter/Space handler.
- Failure scenario: keyboard-only user không thể chọn media, chọn subset slides để insert, hoặc chọn Jeopardy cell/team từ các surface chính.
- Vì sao tests miss: Media test chỉ count pagination (`MediaLibraryModal.test.jsx:24-43`); Template test dùng “Select All” rồi Insert (`TemplateGallery.test.jsx:109-138`); game tests chỉ render HTML, không tab/activate controls.
- Minimal verification: dùng native `<button>`/checkbox semantics; test `userEvent.tab()` + Enter/Space và accessible name/state.

### M4 — Marketplace request failure được hiển thị vô hạn như “Loading templates...”

- Evidence: request chỉ `.catch(console.error)` tại `client/src/pages/HomePage.jsx:819-823`; empty array luôn render loading tại `:1460-1467`. Không có loading/error state riêng hoặc Retry.
- Failure scenario: API/network reject; user thấy loading vĩnh viễn. Effect không tự retry vì dependency `templates.length` vẫn là 0; chỉ view toggle/remount mới kích lại.
- Vì sao tests miss: test chỉ source-match empty search text; không mock marketplace rejection.
- Minimal verification: reject request; assert alert + Retry; retry resolve thì cards thay error.

## Low

### L1 — Reveal theme catalogs drift giữa creation/settings và editor

- Evidence: Home/Settings có `sky` nhưng không `blood` (`client/src/pages/HomePage.jsx:46-58`, `client/src/pages/SettingsPage.jsx:30-42`); Design tab có `blood` nhưng không `sky` (`client/src/components/ribbon/design-tab-content.jsx:22-25`). Shared mapping support cả hai (`shared/src/theme-presets.js:174-187`).
- Failure scenario: không thể chọn `blood` khi tạo/default; deck `sky` không thể chọn lại từ Design gallery.
- Vì sao tests miss: không có contract test so sánh catalogs.
- Minimal verification: dùng một shared constant; assert mọi selector cùng set supported themes.

## Claim bị bác / giảm mức

- Bác researcher M4 “mỗi thumbnail iframe gây production performance bug” ở mức finding: source đúng là render một lazy iframe/card (`client/src/components/SlideThumbnail.jsx:20-40`) nhưng `loading="lazy"` hạn chế eager load; chưa có profile 50/200 decks, memory/request budget hoặc user-visible failure. Giữ như capacity hypothesis, không phải verified defect.
- Giảm phạm vi researcher M5: flip-card `div` tại game renderer không được dùng làm evidence chính vì đã có nút “Reveal Answer” keyboard-accessible ngay bên dưới; finding chỉ giữ các surface không có equivalent rõ ràng.

## Verification caveat

- Sau khi `npm ls` xác nhận TipTap invalid, lệnh `npm ci --dry-run --ignore-scripts` trên Windows vẫn thử reconcile `node_modules`, gặp `EPERM` ở Rolldown và để install tree thiếu `pathe`/package metadata. Không có tracked source/config bị sửa.
- Theo chỉ đạo controller: dừng toàn bộ npm/install/test; không khôi phục `node_modules`. Mọi test attempt sau thời điểm này không hợp lệ. Báo cáo dựa trên static trace, lockfile, `npm ls` evidence, và test source đã đọc.

## Unresolved questions

- Không có câu hỏi scope. Cần restore dependencies ngoài review này trước khi chạy verification suite.

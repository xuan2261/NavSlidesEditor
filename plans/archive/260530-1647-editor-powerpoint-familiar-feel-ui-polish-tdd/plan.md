---
title: "EditorPage PowerPoint familiar-feel UI polish (TDD)"
status: completed
created: 2026-05-30
mode: deep
approach: tdd
source_report: plans/reports/brainstorm-powerpoint-familiar-feel-260530-1620-editor-ui-polish-report.md
blockedBy: []
blocks: []
---

# EditorPage PowerPoint familiar-feel UI polish (TDD)

Đóng 4 gap "familiar-feel" PowerPoint 365 trên nền ribbon hiện có, GIỮ brand dark/terracotta.
Approach A (polish tại chỗ), KHÔNG rewrite. Mỗi phase tests-first.

**Input:** `plans/reports/brainstorm-powerpoint-familiar-feel-260530-1620-editor-ui-polish-report.md`
**Quyết định user đã chốt:** auto-active Format lần đầu (tôn trọng manual leave) · view switcher Normal+Sorter+Present · accent một-màu-brand đổi nhãn theo type.

## Phát hiện scout bổ sung (ngoài report — đã verify)

- `StatusBar` render ở `client/src/components/layout/MainLayout.jsx:11` (toàn cục, dưới `<Outlet/>`), KHÔNG trong EditorPage. Đọc `zoom` từ `ui-store`.
- `currentSlideIndex` là `useState` cục bộ trong `EditorPage.jsx:141` → StatusBar không đọc được → "Slide X/Y" phải bắc cầu qua `ui-store`.
- `viewMode` đã có trong `editor-store.js:62` (`'normal'|'sorter'`, toàn cục) + `SlideSorterView.jsx` render thật theo `viewMode` (EditorPage `:1221,:1324`, Ctrl+Shift+S `:796`) → Normal/Sorter dùng ngay (KHÔNG dead-state). Present gọi `presentInWindow(presentation)` (1 tham số, `shared/src/htmlGenerator.js:625`).
- `RibbonHeaderBar`/`TabBar` KHÔNG nhận `selectedElement` qua props → Format-tab động phải đọc context từ `ui-store` (tránh prop drilling).
- Hệ quả: status bar toàn cục → cluster editor (slide pos + view switcher + Present) phải gate theo `slideTotal>0` để không hiện trên HomePage.

## Red-team đã chạy (2 reviewer độc lập) — fix đã áp vào phase files

| # | Sev | Phát hiện | Fix |
|---|-----|-----------|-----|
| R1 | BLOCKER | Radix `Tabs.Root value='format'` HIỆN panel format dù không có trigger → flash khi reload localStorage='format' + no selection | Phase 1: `effectiveTab` guard trong RibbonPanel (không dựa effect async) |
| R2 | BLOCKER | "New Slide" KHÔNG có handler trong Insert ribbon (sống ở SlidePanel/Ctrl+M) | Phase 3: bỏ New Slide khỏi big-button; chỉ Text Box + Picture |
| R3 | MAJOR | `setPresentHandler` nếu copy function-idiom của ui-store → tự gọi handler lúc đăng ký → mở present window khi mount | Phase 2: implement THUẦN `set({presentHandler:fn})` + test "đăng ký không tự gọi" |
| R4 | MAJOR | `ribbon-ui-consistency.test.jsx:14,38` assert clipboard toàn h-7 + Paste-không-cao-hơn → big-button Paste phá; plan bỏ sót | Phase 3: thêm file vào scope, cập nhật 2 assertion (đảo có chủ đích) |
| R5 | MINOR | Picture nên dùng `onAddImageUpload` (upload), không `onAddImage` (URL prompt) | Phase 3: chốt `onAddImageUpload` |
| R6 | MINOR | Test "accent class" vô nghĩa (border brand active đã có sẵn mọi tab) | Phase 1: bỏ assert class, phân biệt Format = nhãn động |
| — | BÁC | R2-F4 nghi Sorter dead-state | `SlideSorterView.jsx` tồn tại + render thật → giữ nguyên |

## Test sẽ chuyển đỏ (đã tính tới trong phase tương ứng)

| Test file | Test | Phase xử lý |
|---|---|---|
| `ribbon-shell-tab-navigation-and-rendering.test.jsx` | "renders 7 tab triggers", "renders all tab labels" | 1 (6/7 động) |
| `StatusBar.test.jsx` | "selecting from dropdown..." (`statusbar-zoom-select`) | 2 (slider) |
| `ribbon-ui-consistency.test.jsx` | clipboard h-7 (:14), Paste-không-cao-hơn (:38) | 3 (cập nhật) |
| `ribbon-tabs-config.test.js` | — KHÔNG phá (config giữ 7 phần tử) | — |

## Phases

| # | Phase | Status | Priority | Touchpoints chính |
|---|-------|--------|----------|-------------------|
| 1 | [Format Tab động (nhãn + accent + ẩn/hiện)](phase-01-format-tab-dynamic.md) | pending | P1 | ui-store, tab-bar, ribbon-panel (effectiveTab), ribbon-tabs-config, EditorPage |
| 2 | [Status bar kiểu PowerPoint (slider/slide-pos/view)](phase-02-status-bar-powerpoint.md) | pending | P1 | StatusBar, ui-store, editor-store, EditorPage |
| 3 | [Big-button hierarchy](phase-03-big-button-hierarchy.md) | pending | P2 | ribbon-big-button (mới), home-tab, insert-panel, clipboard-buttons |
| 4 | [Chrome polish + docs](phase-04-chrome-polish-and-docs.md) | pending | P2 | tab-bar CSS, ribbon-panel, design-guidelines, README |

Thứ tự thực thi tuần tự 1→4 (phase sau phụ thuộc context store/UX phase trước).

## Key dependencies

- Phase 2 dùng cùng `ui-store` mà Phase 1 mở rộng (cùng file → tránh xung đột: Phase 1 thêm nhóm `formatContext`, Phase 2 thêm nhóm `slidePosition`/`presentHandler`).
- Phase 3 độc lập logic nhưng phải vừa 80px contract (Phase 4 chốt lại chrome).
- Phase 4 cập nhật docs phản ánh 1–3 → chạy CUỐI.

## Cross-plan awareness

- `plans/260529-2256-editorpage-hardening-refactor-tdd/` đụng `EditorPage.jsx` nặng. Phase 1/2 thêm useEffect nhỏ vào EditorPage → rủi ro merge thấp nhưng cần rebase nếu plan kia còn mở.
- `260522-1527-powerpoint-classic-ribbon-alignment-tdd` đã định nghĩa "80px command area" contract → Phase 3/4 PHẢI tôn trọng, không phá.

## Global success criteria

- `npm run lint && npm run build` sạch.
- `npm run test` pass (gồm test mới + test cập nhật cho dropdown→slider, 7→động số tab).
- `npm run test:e2e` ribbon/status pass.
- Brand dark/terracotta giữ nguyên; default theme không đổi.

## Out of scope (YAGNI)

Backstage toàn màn · Designer/Design Ideas · Slide Sorter/Reading view MỚI · đổi default sang light · multi-color accent palette mới.

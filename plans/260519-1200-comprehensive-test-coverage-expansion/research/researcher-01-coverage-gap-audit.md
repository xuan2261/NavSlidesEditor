# Coverage Gap Audit — NavSlides Editor (2026-05-19)

> Source: `researcher` agent + e2e baseline run. Inventory verified by Glob/Grep on actual files; findings are pre-Phase-0 stabilization.

## 1. Inventory tóm tắt

| Loại test | Tool | Files | Ghi chú |
|---|---|---|---|
| Unit (server routes) | Vitest | 12 | presentations, share, templates, ai, upload-dedup, pptx-import, pptx-export, marketplace, live-rest, api-surface, games-engine, socket-handler |
| Unit (server services) | Vitest | 13 | pptx-import/* (8 files), ai-provider, ai-endpoint-guard, live-rooms, socket-handler, worker-runner |
| Unit (shared) | Vitest | 7 | htmlGenerator, element-renderers, shapeUtils, pptx-utils, bug-fixes, parallax-integration, present-mode-section-styles |
| Unit (client) | Vitest | 100+ | hooks, utils, components, ribbon audit, stores |
| E2E | Playwright | 32 specs (~4638 LOC) | tests/e2e/*.spec.js + tests/e2e/games/*.spec.js |
| Load | k6 | 2 | api-load.js (có threshold), websocket-load.js (chưa threshold rõ) |
| PPTX corpus | Node script | 1 | semantic + roundtrip fidelity |

Tổng vitest: **146 files, 1239 tests, all pass** (baseline 2026-05-18 22:35). Vitest config KHÔNG có coverage provider. Playwright chỉ chạy chromium, không có firefox/webkit/mobile project, không cấu hình `toHaveScreenshot` baseline rộng (chỉ 1 spec visual-regression).

## 2. Feature → Existing Coverage Matrix

### Group 1: Editing core
- ✅ Group/ungroup, rotation, rulers, find&replace, undo/redo, clipboard, footer modes
- 🟡 Multi-select (chỉ tested gián tiếp), align/distribute (chỉ left + H), auto-save retry
- ❌ Smart guides snapping, command palette (Ctrl+K), touch gestures, translucent presenter UI, onboarding tour, copy URL right-click

### Group 2: Element types (20 loại)
- ✅ Full e2e: text, HTML embed, SVG, timeline
- 🟡 Insert tested nhưng property/render not verified: image (crop/filter/round), shape (chỉ rect/star), code (theme/lang switch), LaTeX/TikZ (render), markdown (render), chart (per type), video (trim/speed), audio (playback), table (drag-resize), QR (content), icon (picker), callout (style), drawing (strokes), line/arrow (style), game (leaderboard/scoring e2e)
- ❌ Inline math e2e, divider e2e

### Group 3: Slides
- ✅ Footer modes, page numbers
- 🟡 Layouts (chỉ Two Column), templates (gallery only), background gradient, fragments (timeline open only)
- ❌ Hidden slides, fragment step-through trong present, global settings (auto-slide/loop/nav), background image, 7 layouts còn lại

### Group 4: Live presentation
- ✅ Room creation, presenter token, remote nav (h+v), speaker thumbnails
- 🟡 Speaker timer
- ❌ Annotation tools (pen/laser/highlighter/eraser sync + persistence), B/W screen, live timer e2e, present-mode keyboard nav (F5/Home/End/arrows)

### Group 5: Game mode
- ✅ Player join validation
- 🟡 Insert + render
- ❌ Leaderboard display e2e, scoring flow, presenter shortcuts (G/Space/Enter/R/L/P/+/−/1-4), game socket e2e

### Group 6: AI tools
- 🟡 Copywriter (mocked only), slide generator (modal open/close), translate (modal open/close), Unsplash (mocked)
- ❌ Giphy search, real AI flow, translate apply, slide generator outline → slides

### Group 7: Themes & Templates
- ✅ Custom user templates, dark/light editor toggle
- ❌ 11 reveal themes apply, 6 transitions switch, 6 design themes

### Group 8: Export & Sharing
- ✅ Present mode, export HTML CDN, shareable links, version history snapshot CRUD
- 🟡 PPTX export (unit only, no e2e download), GitHub push (modal only)
- ❌ Offline HTML export, PDF export, .navslides archive export+import roundtrip, Markdown import, share password protection

### Group 9: Cloud sync
- 🟡 rclone validation (api-surface)
- ❌ Sync execution e2e (single + all)

### Group 10: Version history
- ✅ API CRUD
- 🟡 UI modal restore via UI

## 3. Gaps theo độ ưu tiên

### P0 — Critical, customer-facing, không cover
1. **Annotation tools sync + persistence** (live presentation)
2. **Export PDF** (zero test)
3. **Export PPTX e2e** (unit only)
4. **Shareable links với password** (security)
5. **Fragment step-through** trong present mode
6. **Hidden slides** rendering
7. **Onboarding tour Joyride** (suppressed but never run)

### P1 — Important, partial cover
1. Reveal theme & transition switching e2e
2. Image crop/filter/round corners
3. Video/audio trim & speed
4. Markdown import
5. .navslides archive roundtrip
6. Command palette (Ctrl+K)
7. Zustand stores unit tests (editor/presentation/ui — currently zero)
8. Many client hooks (use-keyboard, use-clipboard, use-live-presentation, use-annotation-sync, use-live-timer-sync)
9. Offline HTML export
10. Live timer + B/W screen

### P2 — Nice-to-have
1. Touch gestures (mobile viewport)
2. Smart guides
3. Right-click copy URL
4. Translucent presenter UI
5. Per-element-type property panel coverage (every modal/control)
6. 11 reveal themes individual visual diff
7. Game presenter shortcut suite
8. Fragment timeline editor full flow

## 4. Existing test debt

- `ModalShell.test.jsx` xuất hiện cảnh báo `useLayoutEffect SSR` (jsdom render). Không fail, nhưng noise.
- `pdf-import.test.js` log "Failed to upload PDF" trong stderr (expected nhưng noise).
- Vitest `fileParallelism: false` → chạy chậm (325s cho 146 files). Cân nhắc bật parallel sau khi audit không-shared-state.
- E2E retries=1 dev và 2 CI, workers=4 dev. Đã hợp lý nhưng test timeout 30s/60s; với spec quá tải (live, ribbon-layout) có thể tăng nhưng nên fix root cause.
- Naming inconsistency: nhiều test file có tên rất dài (`shortcut-storage-unit-tests-for-load-save-reset.test.js`, `slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js`). Convention OK theo CLAUDE.md (kebab-case, descriptive).
- Page Object `EditorPage.js` đang ~565 LOC → vi phạm rule 200 LOC. Cần split.
- Không có `coverage` script trong package.json. Cần thêm `@vitest/coverage-v8` + threshold.
- Không có visual regression baseline directory (`__screenshots__` hoặc tương tự) ngoài 1 spec.

## 5. CI / Tooling gaps

- **Playwright config**: chỉ 1 project chromium → thiếu firefox/webkit/mobile.
- **Coverage threshold KHÔNG enforce** trong vitest.
- **GitHub Actions** chưa kiểm tra (cần verify `.github/workflows/*`).
- **k6 thresholds** chỉ có `http_req_duration{p(95)<500}` ở api-load (chưa verify ws-load).
- **Pre-commit hook** không thấy chạy lint+test (đọc `.husky` hoặc `package.json scripts`).

## 6. Đề xuất kiến trúc

### Page Object pattern hiện có
- `tests/e2e/pages/EditorPage.js` (565 LOC, vi phạm rule 200)
- `HomePage.js`, `ExplorePage.js`, `SettingsPage.js`, `SlidePanelHelper.js`, `RibbonInsertHelper.js`, `PropertiesPanelHelper.js`, `CanvasHelper.js`

### Đề xuất thêm POM
- `LivePresentationPage.js` (presenter, viewer, remote, speaker views)
- `GamePlayerPage.js` (player join + scoring UI)
- `ExportFlowHelper.js` (download interception PDF/PPTX/.navslides)
- `ShareModalHelper.js` (link, password, expiry)
- `AnnotationToolsHelper.js` (pen, laser, highlighter, eraser)
- `TemplatesGalleryHelper.js`
- `RibbonHelper.js` (tab + control selector helpers — hiện nằm rải rác trong EditorPage)

### Fixtures hiện có
- `testPresentation` (auto-create + auto-cleanup)

### Đề xuất thêm fixtures
- `presentationWithElements` (seed elements via API)
- `presentationWithSlides(n, layouts[])`
- `liveRoom` (auto-create + cleanup room)
- `shareLink` (create token + revoke after)
- `gameRoom`
- `mockedAIRoutes` (tự động mock /api/ai/* responses)

### Visual regression layout
- `tests/e2e/__screenshots__/{spec}/{test-name}-{viewport}-chromium.png`
- Threshold: `maxDiffPixelRatio: 0.01`, `threshold: 0.2`
- Update flow: `npx playwright test --update-snapshots`
- Cần baseline cho: editor canvas (3 viewports), present mode (1 slide layout), share view, speaker view, ribbon (each tab).

## 7. Open questions cho user

1. Có cần multi-browser (firefox/webkit) hay giữ chromium-only để giảm CI time?
2. Visual regression: pixel-diff strict hay perceptual? Có CI runner ổn định để baseline reproducible không?
3. Coverage threshold target: 80% statements/branches hay set lower (60%) để khả thi trong 1 sprint?
4. AI test: tiếp tục mock-only hay thêm contract test với fake provider (Pollyjs/MSW)?
5. Game mode: ưu tiên test 7 game types riêng từng cái hay smoke 1-2 type?
6. PDF export e2e: có ổn nếu chỉ verify response headers + size > 0, hay cần parse PDF content?
7. Onboarding tour: skip via localStorage flag (như hiện tại) hay viết riêng spec để xác nhận tour chạy đúng cho first-time user?

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Inventory + matrix + 7 P0/10 P1/8 P2 gaps đã liệt kê. Chính e2e baseline phát lộ 35 failing tests (xem report kế bên) — phải xử lý trước khi mở rộng.
**Concerns/Blockers:** 35 e2e failures trong baseline. Đa số liên quan đến ribbon UI thay đổi sau v1.9.0; cần Phase 0 stabilize trước khi đầu tư thêm spec mới (otherwise new tests sẽ build trên unstable foundation).

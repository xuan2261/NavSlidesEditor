# NavSlides Editor — Báo cáo Code Review Toàn Monorepo (Tổng hợp)

- Ngày: 2026-06-11
- Chế độ: codebase scan, **report-only** (không sửa code)
- Phạm vi: client / server / shared / electron — trọng tâm chức năng, pipeline, workflow của UI, elements, controls
- Phương pháp: 6 `code-reviewer` song song theo domain; lead verify trực tiếp các Critical blast-radius cao
- Security model: HTML/CSS/JS do tác giả tạo là **trusted** (theo README) — không flag là XSS. Chỉ flag khi vượt biên trust (upload/import untrusted, share link, cross-session).

## Tổng quan mức độ

| Vùng | Critical | High/Important | Medium | Low |
|------|:--:|:--:|:--:|:--:|
| R1 Element render pipeline | 0 | 4 | 0 | 4 |
| R2 Editor UI + controls | 0 | 4 | 0 | 8 |
| R3 Export pipeline (PPTX/PDF/HTML) | 0 | 4 | 4 | 3 |
| R4 Live + Game realtime | 1 | 5 | 3 | 3 |
| R5 Server REST + storage | 1 | 5 | 6 | 4 |
| R6 PPTX import + Electron | 2 | 3 | 4 | 3 |
| **Tổng** | **4** | **25** | **17** | **25** |

Báo cáo chi tiết từng vùng:
- `from-code-reviewer-element-pipeline-260611-0826-element-render-fidelity-report.md`
- `from-code-reviewer-editor-ui-260611-0826-controls-state-workflow-report.md`
- `from-code-reviewer-export-260611-0826-pptx-pdf-html-fidelity-report.md`
- `from-code-reviewer-realtime-260611-0826-live-game-socket-report.md`
- `from-code-reviewer-server-260611-0826-rest-storage-trust-boundary-report.md`
- `from-code-reviewer-import-electron-260611-0826-pptx-import-desktop-report.md`

---

## CRITICAL (4) — chặn land

### C1 — Game mode hỏng end-to-end *(verified trực tiếp)*
- Client nối namespace mặc định: `io({ path:'/ws' })` — `client/src/hooks/use-game-socket.js:27`, `use-game-player.js:64`
- Server gắn handler trên namespace `/games`: `io.of('/games')` — `server/services/game-socket-handler.js:9`
- → Mọi event game rơi vào namespace không listener, bị nuốt im lặng.
- Cộng thêm sai tên field: client gửi `{roomId, playerName, role}` (`use-game-socket.js:33`), server đọc `{gameId, ...}` (`game-socket-handler.js:15`) → fail guard `if(!gameId)` ngay cả khi đúng namespace.
- Unit test pass vì gọi thẳng `GameEngine`, không qua socket.
- **Fix:** thống nhất namespace (client nối `/games` hoặc server dùng default) + đồng bộ tên field client↔server.

### C2 — Deck đã xóa vẫn phục vụ công khai qua share link *(verified trực tiếp)*
- `DELETE /:id` chỉ set `deletedAt` (soft delete); revoke share-token chỉ chạy khi xóa vĩnh viễn.
- `renderShareView` (`server/index.js:153-173`), `GET /:id` (`presentations.js:249-258`), explore fork (`explore.js:63-66`) đều **không guard `deletedAt`**.
- → Deck trong thùng rác vẫn render trên `/share/:token`, vẫn đọc/fork được.
- **Fix:** thêm guard `deletedAt` ở mọi đường đọc/serve/fork; hoặc suspend share token khi soft-delete.

### C3 — XSS nguồn-gốc qua markdown import (untrusted)
- `client/src/utils/markdown-import.js:110-116`: href bắt bằng regex nội suy thẳng vào `<a href="...">` không escape `"`.
- `url-safety.js:3` `isSafeHref` trả `true` ngay cho href bắt đầu `/ # ./ ..` không kiểm nội dung.
- Payload verify: `[t](/x"><img src=x onerror=alert(1)>)` thoát attribute, bơm `<img onerror>` vào `element.content` được **persist**.
- Editor preview có `sanitizeRichTextHtml` chặn → defense-in-depth vỡ (HTML độc lưu từ gốc). Khai thác thực tế phụ thuộc có consumer nào render `content` mà không sanitize.
- **Fix:** escape attribute href; siết `isSafeHref` kiểm nội dung; sanitize tại điểm import.

### C4 — Bypass ngân sách zip-bomb khi import PPTX (untrusted)
- `server/services/pptx-import/pptx-guards.js:19-21,67-70`: ngân sách giải nén tính từ `_data.uncompressedSize` **do archive tự khai báo**, không verify với inflation thực tế.
- Kèm `media.js:97-99,131-134`: `entry.async('nodebuffer')` materialize toàn bộ buffer **trước** khi guard 200MB chạy; không có trần tích lũy.
- → File <100MB trên đĩa có thể phình bộ nhớ → OOM/DoS (server cũng nhúng trong Electron).
- **Fix:** đo kích thước inflate thực tế theo stream với trần cứng + trần tích lũy; check trước khi materialize.

---

## IMPORTANT / HIGH (25) — nên xử lý trước release

### Element render pipeline (R1) — editor↔export divergence
- **I-R1.1** 7 shape vẽ sai trên canvas: `shape-element-renderer.jsx:90-165` chỉ handle rect/circle/triangle/diamond/arrow/star, else→`<rect>`; export `shapeUtils.js:126-187` handle thêm hexagon/pentagon/cloud/cylinder/parallelogram/trapezoid/bracket. Chèn hexagon → hiện chữ nhật khi sửa nhưng đúng khi present. WYSIWYG vỡ.
- **I-R1.2** Sentinel `'auto'` không resolve ở nhiều JSX renderer editor (`icon`/`line`/`drawing`/`callout`/`timeline`/text): `stroke="auto"`/`fill="auto"`/`color:auto` invalid → element mới vô hình/sai màu khi sửa, theme không áp dụng trong editor. (shape+table đã đúng.)
- **I-R1.3** Ảnh sự kiện timeline bị bỏ khi export: editor vẽ `<image href>` (`timeline-element.jsx:130-155`), `renderTimeline` (`element-renderers.js:590-609`) không emit image → mất ảnh khi present/PDF/share.
- **I-R1.4** Element `game` bị drop im lặng khi export: không có entry trong `RENDERERS` (`element-renderers.js:654-673`), `renderElement` trả `''` → vùng trống, không placeholder.

### Editor UI + controls (R2)
- **I-R2.1** Find&Replace bỏ qua vertical child slides: chỉ duyệt `slide.elements`, không `slide.children[].elements` (`FindReplaceBar.jsx:34-52`, `find-replace-helpers.js:118-144`) → Replace All thay thiếu.
- **I-R2.2** Nút arrange ribbon chỉ move primary khi multi-select (`EditorPage.jsx:1450-1453`) trong khi phím tắt dùng cả selection (`:839`) → z-order qua UI trông như hỏng.
- **I-R2.3** Cap redo 20 vs undo 50; comment sai (`EditorPage.jsx:935` `slice(-19)`) → sau >20 undo, redo bị rớt.
- **I-R2.4** Ribbon Format X/Y/W/H/Rotation không có trạng thái mixed (chỉ Opacity có) (`ribbon-format-tab-...controls.jsx:248-302`) → multi-select hiện giá trị primary như chung, sửa nhầm reshape tất cả.

### Export pipeline (R3)
- **I-R3.1** Route raster client-facing không try/catch theo từng element (`pptx-exporter.js:124-137`, gọi từ `exportPptx.js:45`): 1 embed lỗi/chậm → route 500 → cả PPTX thất bại, bỏ mọi raster hợp lệ. Bản resilient (`server-raster.js:182-196`) lại không phải bản nối client.
- **I-R3.2** Server bỏ opacity ảnh khi export (`server-basic-renderers.js:42-98`) trong khi client áp transparency → ảnh bán trong suốt thành đục.
- **I-R3.3** `timeline`/`game` không nằm switch rasterizable (`server-fallback.js:49-71`); server strict mode **throw** → sập cả deck export.
- **I-R3.4** Hai engine raster server lệch hành vi, bản tệ hơn đang phục vụ client (no per-element isolation, origin check `startsWith` ngây thơ, `installVendorRoute` return sớm khi `!baseUrl` để lọt request mạng). Nên hợp nhất về `getServerRasters`.

### Live + Game realtime (R4)
- **I-R4.1** Annotation không clear/re-sync khi đổi slide (`LiveViewPage.jsx:18,89`; `annotations:sync` chỉ bắn lúc join `socket-handler.js:159`) → stroke slide cũ tràn sang, slide khác không hiện. Vi phạm "persist per slide".
- **I-R4.2** Live room rò rỉ bộ nhớ: presenter đóng tab → `leaveRoom` chỉ set `presenterId=null` (`live-rooms.js:97`), room tồn tại mãi. Game có TTL, live không.
- **I-R4.3** Submit answer lặp lại → gian lận điểm: `submitAnswer` (`game-room-manager...:52`) không chặn trả lời trùng, cộng điểm+speed bonus mỗi lần emit.
- **I-R4.4** Game room waiting/active bị bỏ rơi rò rỉ: cleanup TTL chỉ arm trong `endGame` (`:109`); leave/disconnect không lên lịch dọn khi room rỗng.
- **I-R4.5** Event presenter-only của game không kiểm quyền: `game-next/end/random` (`game-socket-handler.js:63,77,96`) cho bất kỳ socket gọi (live có `canControlRoom`, game không).

### Server REST + storage (R5)
- **I-R5.1** Read+write không atomic trên share tokens (`share.js:50-92,103-119`) dùng `read`+`write` thay vì `withShareTokens` → race lost-update, revoke có thể tái xuất hiện. Cùng pattern ở templates.js, save-as-template, explore fork, history restore.
- **I-R5.2** Settings PUT shallow-merge làm mất AI apiKey (`settings.js:24-46`): gửi `{ai:{...}}` thiếu apiKey → xóa key đã lưu. Không có Zod.
- **I-R5.3** History restore ghi đè deck hiện tại, không snapshot trước (`history.js:58-77`) → restore nhầm không cứu được.
- **I-R5.4** `POST /api/explore/:token/fork` (`explore.js:45-82`): write phía server không auth, không cap size, fork cả deck đã xóa.
- **I-R5.5** SSRF guard TOCTOU (`ai-endpoint-guard.js:47-84`): resolve host rồi fetch re-resolve (DNS rebinding); allowlist bỏ qua mọi IP check. Chỉ provider `custom` được guard.

### PPTX import + Electron (R6)
- **I-R6.1** Background slide không gate allowlist: `slide.fill.value.src` đưa thẳng vào element (`mapper/map-presentation.js:123-130`), `htmlGenerator.js:402-404` phát không escape → attribute breakout + fetch host xa.
- **I-R6.2** Inflate media trước khi check size (`media.js:97-99,131-134`) — xem C4 (vector OOM thực tế).
- **I-R6.3** `worker-runner.js:17-34`: worker fork resolve qua NODE_PATH + bật `ELECTRON_RUN_AS_NODE` vô điều kiện; rủi ro biên trust khi đóng gói Electron (env không từ request → mức thấp hơn).

---

## MEDIUM (17) — tóm tắt
- **R3:** mỗi element miss lại launch Chromium mới (N lần); launch fail trả 500 chung; `rasterCache` global race; offline HTML không inline ảnh CDN ngoài.
- **R4:** mỗi element game mở socket riêng (connection storm), random index lệch winner, timer không re-arm sau reconnect.
- **R5:** history snapshot tăng vô hạn; rclone stderr leak ra client; `raster-elements` DoS không validate; github path interpolation; media.js sync fs + DELETE key mismatch → orphaned records; routes echo raw `err.message`.
- **R6:** IDOR job routes (`pptx-import-job-manager` không owner/auth); href hậu xử lý dead/redundant; `runImport` fire-and-forget; merge cell `vMerge/hMerge` cần verify fixture.

## LOW (25) — gộp trong báo cáo từng vùng
Line w/h âm, inline CSS replace lần đầu, cache key SHA1 mỗi lần, dedupe selection, late setState sau unmount, SVG upload skip magic-byte, bcrypt 500 khi token no-password, v.v.

---

## Điểm tốt (calibration — đừng "sửa")
- Storage primitive vững: per-file promise-lock + atomic temp+rename + Windows retry. (Lỗi R5 là route *bỏ qua* helper này, không phải bản thân storage.)
- Live trust boundary chặt: token join, `canControlRoom` cho navigate/laser/annotation.
- PPTX import: magic-byte check, file-type cross-check chống polyglot, output filename UUID (không path traversal), parser chạy worker có timeout+SIGKILL.
- Electron preload tối giản, contextIsolation bật.
- PDF aspect ratio, `@page size px`, fragment expansion, font scale `*0.75`, path-traversal `normalizeServerImageSource` — đều đúng.
- Editor: clipboard UUID/cascade/group-remap, align/distribute lọc locked + rotated AABB, keyboard guard khi đang gõ.

---

## Câu hỏi chưa giải quyết (quyết định ưu tiên)
1. **Deploy multi-user sau proxy có được hỗ trợ không?** Nếu có → C2 + I-R5.4 (fork không auth) leo thang nghiêm trọng.
2. **Game đi qua namespace `/ws` mặc định hay `/games`?** Chốt trước khi fix C1.
3. **Có consumer nào render `element.content` mà KHÔNG sanitize không?** Quyết định C3 có khai thác thực tế ngoài defense-in-depth.
4. **`timeline`/`game` có cần export thật, hay placeholder tĩnh chấp nhận được?** Quyết định hướng fix I-R1.3/I-R1.4/I-R3.3.
5. **Soft-delete có nên suspend share link không?** Quyết định hướng fix C2.
6. **Settings PUT là deep-merge hay full-replace?** Quyết định hướng fix I-R5.2.
7. **Các JSX renderer raw-color (I-R1.2) là cố ý hay sót khi migrate `resolveColorField`?**

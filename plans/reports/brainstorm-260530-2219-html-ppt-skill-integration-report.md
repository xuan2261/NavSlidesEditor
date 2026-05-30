# Brainstorm — Tích hợp html-ppt-skill vào NavSlides Editor

> Date: 2026-05-30 22:19 · Scope: theme/design-token + layout + canvas FX + design-ideas engine · Approach: native adapt · Size: large (multi-phase, `/ck:plan --deep --tdd`)
> Source repo: https://github.com/lewislulu/html-ppt-skill (MIT, author: lewis)

---

## 1. Problem statement

Người dùng muốn tăng cường khả năng/tính năng của NavSlides bằng cách mượn ý tưởng & tài sản từ `html-ppt-skill`, tham chiếu pattern "PowerPoint Design styles". Cụ thể 4 hạng mục:

1. Theme & design-token (36 theme token-driven của html-ppt)
2. Layout mới (31 single-page layout)
3. Canvas FX animations (20 module canvas + 27 CSS)
4. Design Ideas engine (kiểu PowerPoint Designer: gợi ý layout/theme theo nội dung)

Hướng kỹ thuật đã chốt: **native adapt** — dịch tài sản sang đúng mô hình NavSlides (element-JSON + reveal.js + Zustand), KHÔNG nhúng HTML hạng hai.

## 2. Khác biệt kiến trúc cốt lõi (must-know)

| | NavSlides | html-ppt-skill |
|---|---|---|
| Slide | element-JSON, tọa độ tuyệt đối (x/y/w/h) | HTML semantic viết tay |
| Render | reveal.js qua `shared/src/htmlGenerator.js` | static HTML, runtime tự code |
| Theme | swap CSS link reveal.js; typography bị **neutralize** để khớp editor (`htmlGenerator.js:181-197`) | token-driven, đổi 1 CSS custom-property reflow cả deck |
| Màu sắc | **hard-code vào element** (`fill`, `textColor`, inline style trong `content`) | element tham chiếu `var(--accent)` |
| Animation | đã có anime.js + three.js + kinetic-text + fragment | 27 CSS + 20 canvas FX |

**Hệ quả:** không bê nguyên file HTML. Port = dịch *dữ liệu* (palette, typography, layout coords, thuật toán FX). Thách thức lớn nhất: NavSlides bake màu vào element ⇒ token theming cần lớp resolve mới + tương thích ngược.

## 3. Touchpoints (file sẽ chạm)

- `shared/src/htmlGenerator.js` — inject CSS custom-properties vào output; giữ pixel-match.
- `shared/src/element-renderers.js` — renderer respect token khi color = `auto`.
- `client/src/data/element-defaults.js` — default dùng sentinel `auto`.
- `client/src/data/slide-templates.js` — thêm layout mới (đang 20 template).
- `client/src/components/ribbon/design-tab-content.jsx` — Theme gallery (đang 11 theme + size/bg).
- `shared/src/types/presentation.js` — thêm field `designTokens`, `background.type='fx'`.
- `client/src/components/SlideCanvas` (+ background layer) — render FX live preview.
- AI endpoints (`server/routes/ai.js`) — optional cho design-ideas.

## 4. Phương án đề xuất (5 phase)

### Phase 0 — Design Token Layer (nền tảng, blast radius cao)
- Thêm `presentation.designTokens` + `slide.designTokens` (override): `{ colors:{bg,surface,accent,accent2,text,muted}, fonts:{heading,body}, radius, spacingScale }`.
- Inject thành CSS custom-properties (`--ns-accent`…) tại: (a) root canvas editor, (b) `htmlGenerator` output → đảm bảo editor ≡ present ≡ export.
- **Sentinel `auto`**: element color = `'auto'` ⇒ resolve `var(--ns-…)`. Mọi hex cũ giữ nguyên (backward-compat tuyệt đối).
- Golden test: presentation cũ render byte-identical sau khi thêm layer.

### Phase 1 — Theme Gallery expansion
- Dịch palette + typography của 36 theme html-ppt → token preset (chỉ giá trị, attribute MIT).
- Mở rộng 6 preset design hiện có → ~40; picker hiện live preview token.
- Action "Apply theme to all slides" (qua history ⇒ undo được).

### Phase 2 — Layout library expansion
- Dịch ~15-20 layout html-ppt → element-JSON template: KPI grid, timeline, roadmap, mindmap, gantt, big-quote, agenda/TOC, code-diff, arch-diagram, comparison nâng cao.
- Category mới trong TemplatePicker. Layout dùng color `auto` ⇒ ăn theme.

### Phase 3 — Background Canvas FX
- `slide.background.type = 'fx'` + `background.fx = { name, params }`.
- Port ~8-10 module canvas (matrix-rain, particle-burst, constellation, gradient-blob, knowledge-graph, starfield…) → `shared/src/fx/`.
- Render: editor (live, có thể pause) + htmlGenerator (present/export). Tôn trọng `prefers-reduced-motion`; off khi export PDF tĩnh.

### Phase 4 — Design Ideas engine (PowerPoint Designer-style)
- Phân tích slide hiện tại (số element, type, độ dài text, có ảnh không).
- Gợi ý 3-5 phương án: re-layout (reposition vào layout phù hợp) + theme pairing. Side panel thumbnail, click để apply.
- Heuristic rule trước; AI-assist optional (đã có AI endpoint). Apply qua history ⇒ undo.

## 5. Pros / Cons từng phase

| Phase | Pros | Cons / Risk |
|---|---|---|
| 0 Token | nền cho mọi phase; theme thật sự đổi màu | blast radius lớn (mọi renderer); rủi ro vỡ export fidelity |
| 1 Theme | ROI cao, người dùng thấy ngay | phụ thuộc Phase 0 |
| 2 Layout | độc lập, giá trị rõ, rủi ro thấp | tốn công chỉnh coords cho canvas 960×540 |
| 3 FX | wow-factor, điểm khác biệt | perf, reduced-motion, có thể trùng cảm giác three.js |
| 4 Ideas | tính năng "đắt giá" nhất, giống PPT | tham vọng; heuristic dễ cho gợi ý kém nếu thiếu tinh chỉnh |

## 6. Recommended build order

`Phase 0 → 1 → 2` (song song được 2 với 0/1 vì layout độc lập) `→ 3 → 4`.
Phase 0 là gate cứng cho 1 & 4. Phase 2 & 3 có thể chen sớm vì ít phụ thuộc.

## 7. Success metrics

- Phase 0: 100% presentation cũ render không đổi (golden test pass); đổi token → editor & export đồng bộ.
- Phase 1: ≥ 35 theme preset; chuyển theme < 200ms, không reload.
- Phase 2: ≥ 15 layout mới; chèn → khớp lưới 960×540, ăn theme.
- Phase 3: ≥ 8 FX; 60fps trên slide đơn; tự tắt khi reduced-motion.
- Phase 4: gợi ý ≥ 3 phương án/slide; apply + undo sạch.

## 8. Risks & mitigation

- **Export fidelity vỡ** → golden snapshot test editor-vs-htmlGenerator mỗi phase.
- **Backward-compat màu** → sentinel `auto`, không đụng hex cũ; migration không bắt buộc.
- **FX perf** → cap fps, pause khi không active, honor reduced-motion.
- **Re-layout phá nội dung** → mọi apply đi qua history (undo 50-step sẵn có).
- **License** → MIT, giữ attribution lewislulu trong NOTICE/doc.

## 9. Out of scope (vòng này)

- Không bỏ reveal.js, không viết runtime present riêng.
- Không nhúng slide HTML hạng hai.
- Không migrate hex cũ sang token tự động (chỉ áp cho element `auto`).
- Presenter-mode magnetic-card UI (NavSlides đã có speaker view).

## 10. Resolved & unresolved questions

**Resolved**
- ✅ Theme presets nằm ở **2 bề mặt**: (a) `PRESET_THEMES` @ `client/src/pages/HomePage.jsx:51` — deck-starter (reveal theme + transition + thumbnail, ~8 entry); (b) `ThemeGallery` @ `design-tab-content.jsx:14` — live-switch 11 reveal theme. README drift tên ("Minimal Dark/Academic/Neon") nhưng cơ chế là 2 chỗ này. Phase 1 chạm cả hai.

**Unresolved (cần chốt khi planning)**
1. ⏳ Token theming: migrate hex→auto cho built-in template cũ — **để planner phân tích trade-off rồi quyết** (mặc định nghiêng: chỉ áp template/element mới, backward-compat tuyệt đối; migrate là action opt-in nếu planner thấy đáng).

**Resolved (vòng hỏi #2)**
2. ✅ Design-ideas Phase 4: **heuristic-only trước** (đếm element/type/độ dài text/có ảnh → gợi ý). Không phụ thuộc AI key; AI-assist để vòng sau.
3. ✅ Background FX: **bật cả live broadcast**. Vì live view dùng chính htmlGenerator output ⇒ mỗi viewer render canvas cục bộ (không stream video). Bắt buộc: honor `prefers-reduced-motion` per-client + toggle tắt FX cho thiết bị yếu. Risk Phase 3 tăng nhẹ (CPU viewer) — mitigation đã có trong §8.

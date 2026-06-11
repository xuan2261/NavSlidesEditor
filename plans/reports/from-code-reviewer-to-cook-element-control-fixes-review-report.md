# Review: Element/Control Functional Fixes (TDD) — 6 phases

Reviewer: code-reviewer | Date: 2026-06-11 | Scope: uncommitted working tree on `master`

## Verdict: FIX-FIRST (1 High functional bug), phần còn lại SHIP được

Đa số invariant đạt. Có 1 lỗi chức năng High làm hỏng đúng cái mà Phase 2 định sửa (video src unify), và 2 gap parity Medium ở reveal export. Bảo mật SVG allowlist kín. Opacity single-apply đúng. 3-way merge resolver parity đúng. Write-path indeterminate không đổi.

---

## High

### H1 — Video `src` unify chưa trọn: stale `videoUrl` che edit qua field `src`
File: `client/src/utils/migrate-video-src.js`, `client/src/components/canvas/canvas-element-wrapper.jsx:212`, `shared/src/element-renderers.js:362`

`migrateVideoSrc` chỉ copy `videoUrl → src` khi `src` rỗng, và **không xóa** `videoUrl`. Cả hai renderer vẫn ưu tiên `videoUrl || src` (canvas:212, reveal:362; test `shared/tests/element-renderers.test.js:179` còn khóa cứng "prefers videoUrl over src").

Hệ quả cho deck cũ có `videoUrl`:
- Sau migrate: `src = videoUrl(cũ)`, `videoUrl` vẫn còn nguyên.
- Panel giờ chỉ còn 1 field ghi `src` (field `videoUrl` đã gỡ). User sửa URL → `src = mới`, `videoUrl = cũ`.
- Renderer đọc `videoUrl || src` → trả **giá trị cũ**. Edit bị nuốt im lặng.

Đây chính là defect P0-VIDEO-SRC ban đầu, chỉ còn half-fixed. Blast radius: mọi presentation legacy từng set `videoUrl` (đúng nhánh back-compat mà plan muốn giữ). Video mới tạo (chỉ có `src`) không dính.

Fix đề xuất (chọn 1):
1. `migrateVideoSrc`: với video element, copy vào `src` nếu rỗng **rồi luôn xóa `videoUrl`** (kể cả khi `src` đã có) → renderer `videoUrl||src` tự fallback sang `src`. Đơn giản, không đổi renderer/test.
2. Hoặc đổi cả 2 renderer sang `src || videoUrl` — nhưng phải sửa test đang khóa thứ tự ưu tiên, blast rộng hơn.

Khuyến nghị phương án 1.

---

## Medium

### M1 — Reveal table bỏ `headerTextColor` và table-level `borderStyle` (canvas honor, export rớt)
File: `shared/src/element-renderers.js:388-451` vs canvas `table-element-renderer.jsx:40,48`

Control mới Phase 4 ghi `element.headerTextColor` và `element.borderStyle`. Canvas đọc cả hai. Reveal table renderer:
- Header text dùng chung `textColor` (không có nhánh `isHeader ? headerTextColor`).
- Border style chỉ đọc per-cell `border.style` (default `solid`); không đọc `element.borderStyle` cấp bảng.

→ Trên share-link / PDF print, đổi màu chữ header và kiểu viền bảng bị mất. Không phải inherent limit (HTML/CSS thừa sức), nên là dead-on-export một phần. pptx cũng không map (`export-pptx-basic-renderers.js` không có `headerTextColor`/`borderStyle`) — nhưng pptx table có thể coi là giới hạn riêng; reveal thì nên parity.

Đề xuất: reveal `renderTable` thêm `headerTextColor` (như canvas line 110) và dùng `safeBorderStyle(border.style ?? el.borderStyle)` cho default. Bổ sung test ở `shared/tests`.

### M2 — Thiếu test parity reveal cho `headerTextColor`/`borderStyle`
`shared/tests/*` không có assertion nào cho 2 key này (grep trống). Kết hợp M1, nghĩa là export-path của 2 control này hoàn toàn không được test. Thêm test khi sửa M1.

---

## Low

### L1 — `safeOverrideColor` (SVG) lặp gần như y hệt `safeCssColor` (shared)
File: `svg-element-renderer.jsx:6` vs `shared/src/element-renderers.js:64`. Hai allowlist color gần trùng (SVG bản thêm `none`/`currentColor`, bỏ `var()`). Không phải lỗi, nhưng là DRY drift — cân nhắc gom về một helper shared nếu đụng lại. Giữ nguyên cũng chấp nhận được (KISS, client không nên phụ thuộc var token server-side).

### L2 — Generic panel opacity vs ribbon opacity có thể đồng hiện
`common-element-controls.jsx` thêm opacity slider cho non-shape/line, đồng thời ribbon Format tab cũng có opacity. Không double-apply (cùng ghi key `opacity`), nhưng user thấy 2 control opacity cho cùng element ở 2 surface. Chủ đích (panel vs ribbon là 2 vùng khác nhau) nên chỉ ghi nhận, không phải lỗi.

---

## Xác nhận các invariant trọng yếu (PASS)

- **Opacity single-apply**: `renderShape` đã bỏ re-apply; `buildBaseStyle` emit 1 lần cho mọi type; canvas `ShapeRenderer` bỏ `opacity` ở div, chuyển sang content-layer ở wrapper. Không còn double 0.25 (0.5×0.5). PASS.
- **Opacity trên content-layer, không lên chrome**: `canvas-element-wrapper.jsx` bọc `<div data-element-content style={contentLayerStyle}>` quanh content; handles/badges nằm NGOÀI div này. PASS.
- **Image flip trên `<img>` không lên wrapper**: canvas set `transform: scaleX/Y(-1)` trên `<img>`; reveal cũng emit `flipStyle` trên `<img>` (compose với rotation ở wrapper, không cancel). PASS.
- **pptx image opacity → transparency**: `addImageElement` set `transparency = round((1-opacity)*100)`. PASS.
- **code borderRadius**: `codeBlockStyle.borderRadius = element.borderRadius || 0`. PASS.
- **line không có Fill control ở ribbon**: gate `element.type !== 'line'` quanh RibbonSection "Fill". PASS.
- **markdown textColor/fontSize ở canvas + reveal (srcdoc + forPrint)**: canvas renderer + reveal cả 2 nhánh dùng `safeCssColor(el.textColor)` + `mdFont`. PASS. (Lưu ý: reveal nội suy color vào CSS qua `safeCssColor` allowlist → không injection; fontSize ép `Number()` → an toàn.)
- **3-way merge resolver parity**: `resolveMergedCells` ở `shared/src/table-merge-resolver.js`, được canvas + reveal + pptx import qua `revealjs-shared`/require. Logic 3 nơi giờ identical (canvas + pptx đã xóa bản copy cục bộ). PASS.
- **Indeterminate write-path bất biến**: `computeMixedValues` thuần read-side; field nhấp mixed chỉ đổi `value/placeholder` hiển thị, `onChange`/`onUpdate` không đổi. Single-select (ids.length<=1) không bao giờ mixed (guard `selected.length > 1`). PASS — test `indeterminate-multi-select.test.jsx:79` chứng minh edit-on-mixed vẫn ghi.
- **Ribbon opacity-indeterminate wired tới production**: EditorPage:1439-1440 truyền `elements` + `selectedElementIds` vào RibbonPanel → `{...props}` xuống FormatTabContent. Không dead. PASS.
- **SVG override allowlist airtight**: `safeOverrideColor` chỉ trả khi khớp regex hex/rgb/hsl hoặc keyword cố định — không nhánh nào cho phép ký tự `"` → không thể breakout attribute trước `sanitizeSvgContent`. Test injection `red" onload=` bị reject. PASS.
- **Generic panel opacity gated non-shape/line**: `element.type !== 'shape' && !== 'line'` → không trùng control với ShapeProperties. PASS.
- **migrateVideoSrc chạy on-load**: `EditorPage.jsx:141` trong `migrateSlide`, map per-element trước history snapshot. PASS (nhưng xem H1 về việc không xóa videoUrl).
- **Dead control check**: areaFill/stacked (chart canvas:5-7 + reveal:243-279), filterSaturate (canvas + reveal:166), connectorOffset (`timeline-element-utils.js:71`), table borderStyle canvas (đọc `element.borderStyle`, sửa hardcode 'solid' cũ), headerTextColor canvas:40 — tất cả được renderer đọc. PASS, **trừ** headerTextColor/borderStyle ở reveal (xem M1).

## Public contract / blast-radius

- `shared/src/index.js` chỉ THÊM export `resolveMergedCells` (spread `...tableMergeResolver`). Không đổi/xóa export cũ → an toàn cho cả client build và server runtime.
- `shared/src/element-renderers.js`: chữ ký hàm render nội bộ không đổi; chỉ thêm style. Không rủi ro contract.
- PropertiesPanel thread props mới với default an toàn (`slide?.elements || []`, `selectedElementIds || []`); `ShapeProperties`/`CommonElementControls` đều `|| []` guard → render single-select/no-prop không vỡ.
- Chữ ký `FormatTabContent` thêm 2 param optional; các test gọi không truyền vẫn chạy (đã guard `|| []`).

## Unresolved questions

1. H1: chấp nhận đổi `migrateVideoSrc` để xóa `videoUrl` không? (làm test `prefers videoUrl over src` ở `element-renderers.test.js:179` mất ý nghĩa — có thể cần đổi test đó thành "fallback to videoUrl when src empty").
2. M1: `headerTextColor`/table `borderStyle` có nằm trong scope export-fidelity Phase 5 không, hay cố ý chỉ canvas? Nếu cố ý, nên ghi vào `docs/export-fidelity-and-limits.md` mục "dropped on export" thay vì để âm thầm.
3. pptx table có chủ đích bỏ `headerTextColor`/`borderStyle` (giới hạn format) hay là gap chưa làm?

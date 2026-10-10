---
phase: 2
title: 'Điều khiển editor, đa lựa chọn và kiểm toán 19 loại'
status: completed
priority: P2
dependencies: [1]
---

Status completed chỉ ghi qualified historical checkpoint; không phải current-source acceptance hoặc implementation đã merge vào main. Xem [handoff](../handoffs/education-pause-20261004.md) khi resume.

# Phase 02 — Editor controls

## Execution progress

Controls/all19 acceptance đã có qualified checkpoint trước đây; [root progress](./plan.md#execution-progress) dẫn tới assessment và actual receipts, tách khỏi historical baseline. Checklist giữ nguyên. Planning context và các pre-implementation unchecked assertions bên dưới không phải current progress; checkpoint này không qualify standalone games, subsequent source changes hoặc release.

## Goal

Sửa hành vi điều khiển đã xác nhận, giữ nguyên 19 canonical element types và chứng minh dữ liệu đi từ control tới lưu, undo và HTML thật.
Không dựng lại Shape label/fontSize/textColor hay TipTap fontFamily/lineHeight đã có; không mở rộng field ownership chỉ vì renderer đọc một field.

## Context/evidence

- Chuỗi Format thực tế: `client/src/components/editor/editor-ribbon.jsx:24-38` truyền selection, `updateSelectedElements` và `alignElements`; Format tại `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx:352-380` hiện gửi tọa độ primary.
- Controller tại `client/src/hooks/editor-controller/use-editor-selection-controller.js:43-57` gọi fanout với primary là ID cuối; `client/src/utils/element-update-fanout.js:82-92` áp dụng x/y bằng delta, không phải đặt mọi x/y cùng giá trị.
- `client/src/hooks/use-slide-operations.js:204-261` đã align các visual rotated AABB theo bounds selection, bỏ locked và không tự align khi còn dưới hai phần tử.
- `client/src/data/element-defaults.js:16-40` thiếu longDescription; control hiện ghi tại `client/src/components/properties/image-properties.jsx:123-129`; renderer tạo description tại `shared/src/element-renderers.js:278-300`.
- Shape label/size/color hiện tồn tại tại `client/src/components/properties/shape-properties.jsx:247-292`; Insert gallery tại `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:554-556` chỉ thêm shape, không đổi shape được chọn.
- Opacity đã có data-mixed và ký hiệu mixed tại `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx:333-347`; phải tái hiện tương tác sai trước khi sửa, không coi scout cũ là lỗi hiện hành.
- TipTap fontFamily đã gọi command tại `client/src/components/ribbon/controls/ribbon-text-formatting-controls.jsx:59-61`; lineHeight đọc paragraph/heading tại `client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.jsx:79-83`.

## Deep scout gate

- Trước implementation, glob lại mọi path bảng dưới và grep symbol/caller; cập nhật receipts file:line vì siblings có thể đã nối chokepoints.
- Đọc `CLAUDE.md`, `docs/code-standards.md`, các test hiện hữu và `reports/execution-contracts.md`; không suy diễn từ test tên hoặc snapshot wording.
- Chạy giao diện editor với selection a=(100,50,200,100), b=(400,100,100,100), c=(250,200,80,60); ghi JSON trước/sau Format left/center/right và Home align.
- Ghi nhận x/y nhập tay vẫn giữ khoảng cách; Format left hiện dịch cả nhóm theo primary, còn Home left đưa mỗi visual left về 100.
- Tìm tất cả write path của shape trên Insert/Format/Properties trước khi thêm kind editor; nếu đã có edit-selected-kind thì tái sử dụng, không tạo path thứ hai.
- Kiểm tra locked/group/master/vertical effective slide và lifetime selection refs trước khi nối align; không thêm state shared process.

## Requirements

- Một phần tử align theo cạnh/tâm slide với slideWidth thực; từ hai phần tử tự do trở lên dùng bounds selection và rotated geometry hiện hữu.
- Selection mixed hiển thị indeterminate đúng, nhưng thao tác apply vẫn fanout theo quyền field; non-owning types không nhận field subtype.
- Image longDescription áp dụng cho legacy images thiếu field; decorative xóa alt/description; locked image không bị sửa.
- Audio source UX phân biệt video/audio và sửa được src có tác dụng phát; không chỉ test placeholder chữ.
- Shape kind editor chỉ dành shape, giữ id, x/y, width/height, rotation, fill/stroke, text/textHtml/fontSize/textColor và line connector semantics.
- Audit toàn bộ 19 types dưới đây; phát hiện field thực sự mất qua control/save/render phải xử lý trong slice này, không thêm mặc định renderer-internal.

## Architecture/contracts

Dữ liệu vào là effective authoring slide + selection IDs + partial control update; controller kiểm tra lock rồi fanout theo defaults, store ghi một transaction và history lưu một undo unit.
Alignment multi đi trực tiếp operation geometry hiện hữu, không fanout delta một lần nữa; alignment single giữ slide-edge contract, x/y numeric edit vẫn delta contract.
TipTap giữ rich content/marks/paragraph attrs trong content, không chuyển sang top-level fontFamily/lineHeight gây hai nguồn chân lý.
Integration owner nối defaults, ribbon routing và PropertiesPanel tuần tự; worker chỉ tạo control module mới và test, không cùng lúc ghi những chokepoints đó.

## File inventory

| Đường dẫn đầy đủ                                                                                                        | Thao tác/trạng thái             | Owner, kích thước và tác động test                                           |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx      | MODIFY, đã có                   | Integration owner; giữ monolith không tăng logic, tách control mới <200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/editor/editor-ribbon.jsx                                                  | MODIFY khi cần, đã có           | Integration owner; giữ caller align hiện hữu.                                |
| C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-panel.jsx                                                   | MODIFY khi cần, đã có           | Integration owner; truyền props, không đổi routing không liên quan.          |
| C:/Work/NavSlidesEditor/client/src/hooks/use-slide-operations.js                                                        | MODIFY chỉ lỗi tái hiện, đã có  | Integration owner; reuse visual bounds, không viết alignment thứ hai.        |
| C:/Work/NavSlidesEditor/client/src/hooks/editor-controller/use-editor-selection-controller.js                           | MODIFY chỉ lỗi tái hiện, đã có  | Integration owner; history/lock/effective-slide proof.                       |
| C:/Work/NavSlidesEditor/client/src/utils/element-update-fanout.js                                                       | MODIFY chỉ lỗi ownership, đã có | Integration owner; regression image/mixed/locked.                            |
| C:/Work/NavSlidesEditor/client/src/data/element-defaults.js                                                             | MODIFY, đã có                   | Integration owner; chỉ thêm field authorable được chứng minh.                |
| C:/Work/NavSlidesEditor/client/src/components/properties/shape-properties.jsx                                           | MODIFY, đã có                   | Integration owner; giữ controls hiện có, split mới <200 LOC.                 |
| C:/Work/NavSlidesEditor/client/src/components/properties/shape-kind-control.jsx                                         | CREATE, đề xuất                 | Editor worker; selector reuse vocabulary, <200 LOC.                          |
| C:/Work/NavSlidesEditor/client/src/components/properties/image-properties.jsx                                           | MODIFY chỉ lỗi tái hiện, đã có  | Integration owner; không nhân đôi description controls.                      |
| C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx | MODIFY, đã có                   | Thay test dispatch/wording bằng store geometry behavior.                     |
| C:/Work/NavSlidesEditor/client/src/utils/element-update-fanout.test.js                                                  | MODIFY, đã có                   | Image legacy fanout và type ownership.                                       |
| C:/Work/NavSlidesEditor/client/src/components/properties/indeterminate-multi-select.test.jsx                            | MODIFY, đã có                   | Mixed selection write-through và shape retention.                            |
| C:/Work/NavSlidesEditor/client/src/components/properties/editor-controls-behavior.test.jsx                              | CREATE, đề xuất                 | UI + real state transactions; bounded focused test.                          |
| C:/Work/NavSlidesEditor/tests/e2e/editor-controls-audit.spec.js                                                         | CREATE, đề xuất                 | 19-type persistence/render journeys, ≤200 LOC mỗi spec.                      |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md                                                                 | MODIFY sau smoke, đã có         | Integration owner; kết quả observed, không claim game phase05 đã xong.       |
| C:/Work/NavSlidesEditor/docs/project-changelog.md                                                                       | MODIFY sau smoke, đã có         | Integration owner; ghi lỗi/hành vi thật được sửa.                            |

## All19 field audit

Mỗi dòng phải trace control write → defaults/owner hoặc rich content → save/reload → canvas → generated Present/export; ghi field không áp dụng rõ ràng.

| Canonical type, evidence defaults                        | Fields/hành vi cần chứng minh                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| text — `client/src/data/element-defaults.js:8-15`        | content, fontSize/textColor; TipTap fontFamily/lineHeight/marks không mất sau undo/save.                     |
| image — `client/src/data/element-defaults.js:16-40`      | src, alt/decorative/longDescription, fit/filter/flip/border/citation; mixed legacy fanout.                   |
| shape — `client/src/data/element-defaults.js:41-54`      | kind, fill/stroke/radius, text/textHtml/size/color và geometry giữ nguyên khi đổi kind.                      |
| code — `client/src/data/element-defaults.js:55-65`       | content/language/fontSize, walkthroughSteps/defaultStepIndex, borderRadius.                                  |
| latex — `client/src/data/element-defaults.js:66-78`      | content/size/color; equation hoặc TikZ render không mất.                                                     |
| html — `client/src/data/element-defaults.js:79-94`       | content và frame preview/export; security cutover phase14 không thuộc chỉnh control này.                     |
| markdown — `client/src/data/element-defaults.js:95-103`  | content/size/color; edit/render paragraph, link, code.                                                       |
| chart — `client/src/data/element-defaults.js:104-117`    | type/data/areaFill/stacked/legendPosition/axisTitles; actual plotted values.                                 |
| video — `client/src/data/element-defaults.js:118-133`    | src/controls/autoplay/loop/muted/fit/poster/start/end/rate/tracks; transcript metadata thực sự authorable.   |
| audio — `client/src/data/element-defaults.js:134-144`    | src/controls/autoplay/loop/muted/tracks; audioDescription/transcript nếu control ghi.                        |
| table — `client/src/data/element-defaults.js:145-179`    | data/header/padding/border/text/cellStyles/mergedCells/rowHeights/colWidths.                                 |
| icon — `client/src/data/element-defaults.js:180-187`     | iconName/iconColor/iconStrokeWidth, rendered icon đúng.                                                      |
| callout — `client/src/data/element-defaults.js:188-196`  | number/background/textColor/fontSize, actual badge.                                                          |
| qrcode — `client/src/data/element-defaults.js:197-205`   | qrData/colors/errorLevel, code xuất đúng data.                                                               |
| drawing — `client/src/data/element-defaults.js:206-213`  | paths/strokeColor/strokeWidth, giữ vector/path khi save.                                                     |
| line — `client/src/data/element-defaults.js:214-230`     | endpoints/control point/stroke/arrows/dash/connections; không hiện shape-kind/fill.                          |
| svg — `client/src/data/element-defaults.js:231-239`      | content/fillOverride/strokeOverride, safe geometry.                                                          |
| timeline — `client/src/data/element-defaults.js:240-255` | dates/tickSpacing/colors/fontSize/events/items, legacy dates không mất.                                      |
| game — `client/src/data/element-defaults.js:256`         | selection geometry/style/nested config; complete authoring và runtime thuộc03/05, canonical type không tăng. |

## Tests Before — RED scenarios

1. Tái hiện Format a/b/c bằng editor/controller thật: left trước sửa vẫn lệch visual left; ghi kết quả, không bịa RED từ scout.
2. Viết failing case cho longDescription của hai legacy images + một text + một locked image; assert persisted values và description DOM, không chỉ callback.
3. Viết failing case shape kind nếu thiếu path; đổi rect→hexagon phải đổi SVG geometry mà text/style/position không đổi.
4. Kiểm tra opacity/lock/source mixed có thực sự sai; nếu đã đúng, giữ passing regression và không sửa chỉ để có RED.
5. Audio test dùng resource fixture thật, sửa source và reload kiểm tra audio currentSrc/control state; không assert wording.
6. Fixture all19 thực thi authored fields, save/reload/undo; xóa wording/source-text tests cũ trong các test đã chạm thay vì re-pin.

## Numbered implementation steps

1. Ghi baseline geometry, lock behavior, effective master/child selection và field ownership receipts trước sửa.
2. Nối Format multi align vào operation đang được Home dùng; mapping center sang center-h, không sửa x/y nhập tay.
3. Giữ single align theo slide width; test khác resolution, rotated element và off-canvas hợp lệ theo contract hiện hữu.
4. Thêm longDescription vào image defaults qua integration owner, không vào COMMON_KEYS; kiểm tra decorative transaction và mixed heterogeneous selection.
5. Sửa mixed contextual controls chỉ khi tái hiện thiếu indeterminate/apply behavior; reuse computeMixedValues, không copy helper.
6. Chỉnh source control audio/video để affordance đúng và src update còn hoạt động; giữ URL safety/media normalization.
7. Nếu gate xác nhận thiếu, thêm shape-kind-control dùng gallery vocabulary; integration owner nối vào ShapeProperties, không thêm label controls mới.
8. Hoàn thành audit19, sửa từng write-path bị rơi có receipt; chạy actual generated document smoke rồi mới cập nhật hai docs.

## Refactor

Tách mới theo một control/cohesive concern <200 LOC; giữ shared behavior under shared/ khi dùng cả renderer/server, không di chuyển code không liên quan.
Không mở broad field allowlist, không đổi shape enum thứ hai, không thêm compatibility alias hoặc text style state song song TipTap.

## Tests After — GREEN

Chạy lại đúng failing scenarios và existing alignment deep tests; chứng minh một undo khôi phục toàn selection, redo/save/reload giữ kết quả.
Kiểm tra description liên kết đúng image, decorative không đọc mô tả; media thật phát được và shape rendered geometry đúng.

## Behavior matrix

| Mức      | Scenario                                    | Unit / integration / E2E evidence                               |
| -------- | ------------------------------------------- | --------------------------------------------------------------- |
| critical | Multi visual bounds và locked groups        | Fanout invariants + controller/store + editor coordinates/undo. |
| high     | Image ownership, shape kind/style retention | State transition + generated DOM + save/reload.                 |
| high     | Mixed opacity/lock và audio edit            | Real apply state + playable media surface.                      |
| medium   | All19 fields, TipTap marks, 320/768/desktop | Parameterized persistence + generated Present + keyboard/touch. |

## Executable focused commands

Các file CREATE phải được viết trước khi chạy; các lệnh sau dành execution, không chạy lúc viết plan.

```powershell
npx vitest run client/src/utils/element-update-fanout.test.js client/src/hooks/use-slide-operations-align-group-distribute.deep.test.js client/src/components/properties/editor-controls-behavior.test.jsx
npx vitest run client/src/components/properties/indeterminate-multi-select.test.jsx client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'; npx playwright test tests/e2e/editor-controls-audit.spec.js --project=chromium --workers=1
```

Playwright tự khởi động dev server theo `playwright.config.js:120-136`; không chạy build/lint/project-wide suite tại phase này.

## ACTUAL browser smoke journey

Tạo deck all19 bằng fixture sản phẩm, sửa control, đa chọn align và description, undo/redo, save/reload; mở Present và Preview URL thật, không chỉ React render.
Đổi shape kind rồi xem label trong generated HTML; nghe audio fixture sau đổi src; mở hosted share và portable HTML để kiểm tra field rendering hiện có, ghi giới hạn tương tác game chưa thuộc phase02.
Lặp tại 320/768/desktop, Enter/Space và touch; console không có lỗi do control mới, ghi screenshot và JSON geometry receipts sau tương tác.

## Success criteria + unchecked actionable checklist

- [x] Multi left/center/right có visual edges đúng bounds; single có slide-edge đúng resolution; x/y edit vẫn delta và một undo trả đúng cả selection.
- [x] Legacy image description fanout đúng chỉ images không locked; decorative clear và generated aria-describedby hoạt động.
- [x] Audio đổi src phát được sau reload; mixed apply không ghi field sai type.
- [x] Shape kind chỉnh được nếu thiếu path, geometry đổi nhưng labels/TipTap/style không mất; line không bị chuyển loại.
- [x] All19 audit có control/save/render/export receipts và không tạo canonical discriminator thứ20.
- [x] Focused GREEN + actual browser receipts tồn tại; docs/changelog chỉ cập nhật sau smoke thành công.

## Security/risks and failure protocol

High: alignment fanout hai lần (likelihood cao × impact cao); mitigation gọi geometry operation trực tiếp và assert tọa độ store, không assert callback.
High: defaults ownership rò field giữa types (vừa × cao); mitigation heterogeneous selection và locked/group negative cases.
Medium: stale scout hoặc mixed opacity đã sửa (cao × vừa); re-scout và giữ behavior đúng, không tái sửa wording.
Rollback: phục hồi riêng control/defaults transaction từ checkpoint trước phase, giữ deck JSON backup; không downgrade rich content hay delete dữ liệu người dùng.
Nếu RED không tái hiện, ghi evidence và xác định behavior contract đúng; nếu GREEN/smoke sai, dừng dependent cutover, sửa cùng scope, không suppress lỗi và không báo hoàn tất.
Unchecked facts: shape-kind path cần fresh exhaustive grep; all19 dynamic field coverage và generated portable render phải được thực thi, hiện chưa có smoke receipts.

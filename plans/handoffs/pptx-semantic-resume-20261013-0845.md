# HANDOFF: Tiếp tục Import PPTX semantic sau phiên OmO bị đầy context

## Mission and current status

Mục tiêu người dùng: “tôi muốn chức năng PPT Import chạy hoàn thiện, khi import vào tool thì tất cả thành phần giữ nguyên bố cục và có thể chỉnh sửa”. Chấp thuận thực thi: “chấp nhận, thực hiện dùng /ak-cook --advice --tdd để thực hiện plan hay kế hoạch đi”. Đây là tiếp tục triển khai kế hoạch đã duyệt, không phải lập lại kế hoạch hay chỉ rà soát.

Kế hoạch có 25 task triển khai và F1–F4. Checklist hiện đánh dấu task 1–10 hoàn tất, task 11 đang làm, 12–25 và F1–F4 chưa hoàn tất: **10/29 mục**, không phải phần trăm chất lượng sản phẩm. Các task đã hoàn tất được ghi nhận từ kế hoạch và phiên trước, không được chạy nghiệm thu lại trong lượt bàn giao này.

**Điểm tiếp tục chính xác:** task 11 đã tiến xa hơn summary phục hồi và đầu execution ledger. Connector importer, validation/render, atomic detach/reattach và inspector đều đã có mã. Có receipt GREEN cho UI/regression 628 test / 31 file. Chưa tìm thấy bằng chứng connector đã được nghiệm thu trên ứng dụng thật sau thay đổi cuối; build/lint cuối được khởi chạy nhưng không thấy kết quả trả về trong transcript. Không triển khai lại connector từ đầu và không chờ subagent cũ.

## Scope and guardrails

Workspace: `C:/Work/NavSlidesEditor`.

In scope: tiếp tục toàn bộ `.omo/plans/pptx-layout-and-semantic-editability.md`, trước mắt hoàn tất task 11 theo acceptance thật, rồi các dependency-ready task còn lại và F1–F4.

Constraints:
- Giữ TDD và advice theo yêu cầu đã duyệt. Đọc skill phù hợp của runtime; nếu adviser không khả dụng, nói rõ, không giả kết quả tư vấn.
- Original/source definitions bất biến; chỉnh sửa đặt trên occurrence overrides, không dùng renderer cache làm nguồn dữ liệu.
- Giữ source identity, slide/relationship placement, semantic schema, legacy compatibility và native-export gates fail-closed.
- Sửa được trong NavSlides không đồng nghĩa native edited-PPTX đã qualified. Không tự nâng adapterQualified/transactionEligible/level4Promoted.
- Không whole-slide rasterization, overlay giả chỉnh sửa, tự giảm scope, hạ ngưỡng fidelity hoặc dùng screenshot NavSlides làm native golden.
- Không thêm paid SDK, cloud service hay production office engine. OLE/ActiveX/3D payload editing, macro execution và native edited-PPTX expansion ngoài phạm vi đã duyệt.
- Không staging, commit, push, PR, release, reset/clean/discard hoặc xóa thay đổi ngoài nhiệm vụ. Không xóa writer.lock hoặc kill process chỉ vì cổng bận; phải xác minh ownership và trạng thái.

## Current state

Snapshot khảo sát: 2026-10-13, khoảng 08:45 giờ máy.

Branch: `main`.
HEAD: `f9ed27b299e800ba2d222c77e73f89c06ea8b111`.
Working tree: `git status --short` trả 333 entry trước khi tạo file bàn giao này; gồm cả việc ngoài nhiệm vụ. Đây là số entry Git, không phải số file riêng của PPTX.
Intentional local modifications: có công việc đang dở trong scope; ownership của toàn bộ 333 entry không được phân loại, mặc định bảo toàn.

Changed files liên quan đã được transcript ghi nhận, danh sách giới hạn:
- `client/src/components/canvas/canvas-element-wrapper.jsx`
- `client/src/components/canvas/element-renderers/shape-element-renderer.jsx`
- `client/src/components/slide-panel/slide-thumbnail-preview.jsx`
- `client/src/stores/editor-store.js`

Untracked files liên quan, danh sách giới hạn; không coi untracked là file rác:
- `server/services/pptx-import/semantic-projector.js`
- `shared/src/pptx-semantic-connectors.js`
- `shared/src/pptx-semantic-document.js`
- `shared/src/pptx-semantic-render-tree.js`
- `shared/src/pptx-projection-operation.js`
- `shared/src/pptx-geometry-document.js`
- `shared/src/pptx-geometry-svg.js`
- `client/src/components/properties/connector-properties.jsx`
- `client/src/components/properties/geometry-properties.jsx`
- `client/src/components/canvas/element-renderers/geometry-point-handles.jsx`
- `client/src/utils/pptx-semantic-geometry-bridge.js`
- `tests/pptx-semantic/`

Phiên nguồn OmO: `Rà soát chức năng Import PPTX`, ID `01a12d8d-9e98-7639-ac3f-f09d25ae15f9`. Phiên fork phục hồi: `01a132de-fd17-79e9-a128-eb8c64ae504a`. Session mới không cần tải lại JSONL gần 30 MB; file này và nguồn trên đĩa là điểm bắt đầu.

Không kế thừa browser handle, eval kernel, monitor IDs hoặc trạng thái process của session cũ. Ledger ghi subagent connector đã trả code và parent đã nhận lại ownership. Worktree cô lập trước đó thất bại do Windows path length; không mặc định thử lại cùng đường dẫn hay đổi cấu hình hệ thống.

## Decisions and rationale

- Nguồn connector lưu scoped endpoint `{shapeId,index,targetDefinitionId,componentId}`; occurrence lưu `connectorBindings.start/end = {targetInstanceId,index} | null`. Tách danh tính nguồn bất biến khỏi attachment đang chỉnh.
- Import hai lượt để giải quyết forward references theo slide và relationship chain; không tìm native ID toàn cục hoặc suy đoán đối tượng gần nhất.
- Endpoint được suy ra qua `inverse(world(connector)) * world(target) * connectionSite`; target di chuyển không gây cascade ghi lại source hoặc các instance không liên quan.
- Attached point không được sửa thành no-op: phải explicit atomic detach trước. Detach giữ vị trí local đã resolve và xóa binding trong cùng thao tác undo; reattach đổi binding và qua model validation.
- Implementation ban đầu chỉ nhận straight route đã chứng minh. Reject route chưa hỗ trợ là biện pháp an toàn tạm thời, không được biến thành cắt bỏ scope task 11.
- Point-edit mode tách khỏi resize/rotate; bound endpoint controls readonly. Các thay đổi này đã có, đọc trước khi sửa.

## Work performed

Trong session nguồn:
- Task 1–10: corpus/inventory, semantic definitions/instances, affine math, text/style contracts, import projection, nested groups, rich-text bridge, persistence và separation giữa NavSlides editing/native export được checklist chấp nhận.
- Task 11: geometry/formulas/presets/custom paths, collapsed-axis offsets, native RGB/EMU paint, custom dash/cap/round join, explicit point mode và save/history/reopen trên synthetic scenes.
- Connector: source-forward import, scoped refs, validateConnectorBindings/deriveConnectorGeometry, render integration, atomic operation guards, inspector detach/target/site, bound-point readonly đã được triển khai.
- Cuối phiên khởi chạy regression/build/lint cho connector UI. Sau đó bị compaction chặn; hành động cuối đọc vị trí writer lock để chuẩn bị fresh-server QA, chưa phải QA hoàn tất.

Trong lượt bàn giao này chỉ đọc transcript visible content, kế hoạch, source/UI và receipt; chạy Git read-only probes; không chỉnh implementation hoặc chạy tiếp tác vụ dự án. `watzup-scan.cjs --json` timeout sau 60 giây; dùng Git probes và kế hoạch trực tiếp thay thế, không tuyên bố full scanner hoàn tất. Không fetch remote.

0 redactions applied; không đưa credentials, hidden reasoning hoặc raw transcript vào artifact.

## Verification

Các kết quả dưới đây là **receipt lịch sử đọc được**, không phải tests vừa chạy lại trên working tree hiện tại:

| Check | Nguồn / invocation lịch sử | Outcome |
| --- | --- | --- |
| Connector source/schema/render | `task-11-connector-integration-green.json` | success, 121/121 tests, 4 actual files |
| Atomic detach/reattach | `task-11-connector-operation-green.json` | success, 82/82 tests, 5 actual files |
| Connector inspector + related semantic regression | `task-11-connector-ui-green.json` | success, 628/628 tests, 31 actual files |
| Earlier geometry point-mode regression | `task-11-point-mode-editor-qa.json` và monitor notifications | 635 tests/30 files; build exit 0; lint 0 errors/1 warning |
| Earlier real editor point mode | `task-11-point-mode-editor-qa.json` | pointer edit, PUT200, Undo/Redo, reopen; source definitions/transform giữ nguyên |
| Source/reducer lint trước connector UI | monitor notifications trong phiên gốc | exit 0 |
| Build/lint sau connector UI | phiên gốc khởi chạy bash_240/bash_241 | chưa tìm thấy completion receipt; phải xác minh mới |

Các con số 635 và 628 thuộc lượt/suite khác nhau; không cộng, không dùng chênh lệch để kết luận mất test hay coverage đạt toàn bộ.

Invocation regression cuối phiên sử dụng Vitest với filters `tests/pptx-semantic`, `client/src/components/canvas/element-renderers/shape-element-renderer.test.jsx`, `client/src/components/slide-panel/slide-thumbnail-preview.test.jsx`, `--maxWorkers=4` và JSON output. Chạy thông qua Node sau khi bỏ `NODE_OPTIONS` khỏi môi trường child theo cách đã dùng trong dự án. Giữ receipt lịch sử; receipt mới dùng tên riêng.

Not run trong lượt bàn giao:
- Không chạy tests/build/lint lại: nhiệm vụ là tra cứu và chuẩn bị tiếp tục; không đánh đồng receipt cũ với fresh verification.
- Không khởi động/restart server hay browser QA; ownership/process sống hiện tại chưa xác minh.
- Chưa chứng minh connector qua upload thực, actual pointer/keyboard edits, save/reopen/history và native oracle.
- Synthetic source-projector/API/editor receipts không thay thế dashboard-upload qualification hay full native corpus fidelity.

## Open risks and blockers

- Type: risk. Owner: successor. Execution ledger và recovered summary lạc hậu: ghi pending cho công việc đã có GREEN; đọc latest receipts/source trước, sau đó cập nhật ledger.
- Type: risk. Owner: successor. Connector end-to-end UI/save/history/reopen chưa có receipt; hoàn tất unit tests không đủ đóng task 11.
- Type: risk. Owner: successor. Build/lint sau connector UI chưa có kết quả đã quan sát. Warning trước đó: media useEffect thiếu `element` dependency trong canvas-element-wrapper; không che warning hay mặc định đổ cho thay đổi mới.
- Type: risk. Owner: successor. QA server cũ có thể giữ modules cũ và writer lock. Bootstrap dùng data/uploads riêng trong evidence; xác minh trước khi khởi động. Không đụng dữ liệu thật để cứu QA.
- Type: risk. Owner: successor. Task 11 còn arrow profiles/preset dash/other joins/effects/inheritance, explicit extent editing, path text và affine/reflection/nonuniform ink qualification theo plan; mobile/light pointer QA chưa chấp nhận.
- Type: risk. Owner: successor. Tasks 12–25 và F1–F4 còn mở. Không tuyên bố “PPTX hoàn thiện” chỉ từ connector hay một nhóm test xanh.
- Type: risk. Owner: successor. Native reference/font/runtime prerequisites chưa được kiểm tra mới. Nếu thiếu, báo đúng qualification blocker; không hạ threshold hoặc tự tạo golden từ output đang kiểm tra.

## Exact next actions

1. **First safe step** — đọc root project instructions, file này, plan và khoảng 100 dòng đầu execution ledger; kiểm tra branch/HEAD/dirty state mới. Đọc ba connector GREEN receipts và các source liên quan; sửa hiểu biết stale “connector còn chưa triển khai”, không sửa code chỉ để đồng bộ với ghi chú cũ.
2. Khởi tạo tracker đủ 29 mục từ approved plan; giữ 1–10 hoàn tất theo bằng chứng kế thừa, task 11 đang làm. Đối chiếu source/tests hiện tại với receipts, chạy focused checks phù hợp và build/lint để lấy bằng chứng fresh cho connector UI; không chờ monitor hoặc subagent ID của phiên cũ.
3. Xác minh ownership/process/storage của QA server. Đọc `.omo/evidence/pptx-semantic/start-isolated-app-qa.cjs`; nếu cần fresh server chỉ restart process thuộc nhiệm vụ và giữ dữ liệu QA an toàn. Không xóa lock hoặc kill PID chưa xác minh.
4. Tạo/đọc actual source connector fixture theo case forward connector trong `geometry-import.test.js`, rồi kiểm tra ứng dụng thật: bound controls bị khóa; detach giữ vị trí; sửa endpoint; reattach target/site; target move và grouped/reflected transform; invalid/missing/cross-placement targets; save/reopen và Undo/Redo. Xác nhận source definitions/Original không đổi, không ảnh hưởng occurrence khác. Đăng ký chờ save response trước thao tác. Ghi receipt và ảnh mới.
5. Nếu có lỗi, dùng TDD và advice sửa root cause trong phạm vi. Kiểm kê rồi thực hiện các acceptance còn thiếu của task 11; không đánh dấu done chỉ vì connector pass. Đọc đầy đủ yêu cầu task 11 trong plan trước khi đóng.
6. Cập nhật execution ledger và plan bằng checkpoint gọn, có evidence và trạng thái rõ; tiếp tục task 12–25 theo dependency matrix, rồi F1–F4. Giữ đầy đủ scope đã duyệt và final approval gate của plan.
7. Giữ context gọn: đọc ranges/structured JSON summaries, không dump JSONL hoặc full test output. Ghi checkpoint trước compact; session mới không phụ thuộc transient handles. Chỉ hỏi người dùng khi có quyết định thực sự cần họ, không xin duyệt lại kế hoạch đã duyệt.

## Source pointers

- `.omo/plans/pptx-layout-and-semantic-editability.md` — scope, 29 mục và acceptance authority.
- `.omo/drafts/pptx-semantic-execution.md` — checkpoint lịch sử; phần đầu stale so với connector receipts.
- `.omo/evidence/pptx-semantic/task-11-connector-integration-green.json`
- `.omo/evidence/pptx-semantic/task-11-connector-operation-green.json`
- `.omo/evidence/pptx-semantic/task-11-connector-ui-green.json`
- `.omo/evidence/pptx-semantic/task-11-point-mode-editor-qa.json`
- `.omo/evidence/pptx-semantic/task-11-native-outline-editor-qa.json`
- `.omo/evidence/pptx-semantic/task-11-native-dash-editor-qa.json`
- `.omo/evidence/pptx-semantic/start-isolated-app-qa.cjs`
- `.omo/evidence/pptx-semantic/seed-zero-geometry-qa.cjs` — fixture cũ, không mặc định đã hỗ trợ connector.
- `tests/pptx-semantic/geometry-import.test.js`
- `tests/pptx-semantic/semantic-connectors.test.js`
- `tests/pptx-semantic/connector-properties.test.jsx`
- `server/services/pptx-import/semantic-projector.js`
- `shared/src/pptx-semantic-connectors.js`
- `shared/src/pptx-semantic-document.js`
- `shared/src/pptx-semantic-render-tree.js`
- `shared/src/pptx-projection-operation.js`
- `client/src/components/properties/connector-properties.jsx`
- `client/src/components/properties/geometry-properties.jsx`
- `client/src/components/canvas/element-renderers/geometry-point-handles.jsx`
- `docs/pptx-visual-evidence-runbook.md` — native qualification workflow.

Khi thật sự cần tra transcript gốc, dùng `%USERPROFILE%/.omo/agent/sessions/--C--Work-NavSlidesEditor--/2026-10-12T00-40-18-328Z_01a12d8d-9e98-7639-ac3f-f09d25ae15f9.jsonl`, lọc entry có liên quan và chỉ visible text/tool outcomes; không đưa nguyên file vào context.

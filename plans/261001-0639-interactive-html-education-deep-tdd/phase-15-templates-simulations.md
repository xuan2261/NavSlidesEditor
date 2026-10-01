---
phase: 15
title: "Thư viện block, native quiz và sáu mô phỏng có thể tái sử dụng"
status: pending
priority: P2
dependencies: [5, 6, 8, 9, 10, 11, 14]
---

# Phase 15 — Templates và simulations

## Goal
Giáo viên tìm, xem trước và chèn block native vào slide đang chọn; năm quiz builtin và sáu simulation giữ nội dung bài học, chạy được trong sandbox và file portable.
Cung cấp ví dụ dùng ngay cho cả 19 game subtypes, không xây widget framework hoặc chuyển arbitrary user HTML thành quiz bằng regex.

## Context/evidence
- Hợp đồng giới hạn migration và physics tại `reports/execution-contracts.md:17,24-26`; phases trước cung cấp native schema/runtime/actions và portable closure.
- Builtin source được đọc tại `server/routes/marketplace.js:9-26`; search/category route là `:93-122`, detail route là `:130-134`.
- Năm record cố định: `server/data/built-in-templates.json:26268,26349,26414,26479,26544`; giữ ID/template title/slide title/lesson meaning.
- Path bug đã xác nhận tại `scripts/add-quizzes.js:4`: __dirname là scripts, thiếu `..`; `:1124-1139` ghi cả danh sách quizzes có sim/viz, không chỉ năm quiz.
- `scripts/upgrade-interactive-templates.js:1843-1871` tìm theo title substring, upgrade, backup timestamp rồi ghi toàn file; cần contract theo ID và repeatability.
- Sáu nguồn có ID: `sim-logic-gates` tại JSON `:26117`; `sim-rlc-response` `:22007`; `sim-pid-tuning` `:22579`; `sim-bode-plot` `:23188`; `sim-3phase` `:23751`; `sim-gear-train` `:24332`.
- Không nhầm `sim-pid-controller` tại JSON `:25594` với sim-pid-tuning; không rewrite simulation ngoài sáu nguồn đã chốt.
- Existing insertion dùng factories → appendElement → mapActiveSlide tại `client/src/hooks/use-element-creation.js:66-85`; không tạo mutation path riêng.
- Clipboard đã remap connector IDs nhưng cần chung reference contract phase07: `client/src/hooks/use-clipboard.js:54-89,105-150`.
- External provider preset hiện online-only: `client/src/utils/stem-embed-presets.js:47-65`; không hứa đóng gói PhET/GeoGebra/Desmos/Falstad như sáu builtin local.

## Deep scout gate
- Re-glob/re-grep mọi source/test path, đọc five quiz scripts và JSON đầy đủ để lập bảng prompt/options/answer/feedback trước sau.
- Đọc HTML từng simulation trong sáu records; phân biệt main simulator, additional lesson slides và upgrader-generated variant trước chọn preset.
- Trace library insertion từ Insert đến active top-level/vertical/master effective authoring target và history transaction; list callers file:line.
- Re-scout phase07 clone/remap helper đã giao; reuse chính helper đó, không tự clone bằng JSON stringify rồi mất references.
- Xác minh title matching của upgrader có ambiguity/colorScheme assumptions; no title-only mutation sau cutover.
- Xác nhận locale mechanism/focus trap/current catalog APIs; không đoán tên registry được phase03 tạo, ghi citation sau scout.
- Integration owner giữ Insert/factory/registry/export/package chokepoints; domain writer chỉ tạo preset modules trước checkpoint tuần tự.

## Requirements
Năm known builtin IDs chuyển native quiz; prompt, đáp án, thứ tự và giải thích phải có nội dung thực, không chỉ đổi type rồi bỏ payload.
Question kinds: multiple-choice → single-choice, true-false → true-false, fill-blank → fill-blank, ordering → ordering, matching → matching trong `gameType:'quiz'`.
Existing game subtype matching vẫn tồn tại; matching question kind không tạo canonical type mới hoặc alias xóa subtype cũ.
Library là catalog preset của element factories, hỗ trợ search/category localized preview; không duplicate GAME_TYPES/defaults/evaluator/widget engine.
Clone tạo element/group/question/item IDs độc lập và remap owned internal refs/actions/connectors; external refs phải theo contract phase07, không trỏ nhầm bản gốc.
Insert một block/multi-element preset là một undo transaction, vào active authoring target, không ghi đè slide content hoặc đổi selection ngoài block mới.
Có ví dụ hoàn chỉnh cho name-picker, hot-potato, jeopardy, four-corners, relay-race, trivia-champ, scattergories, poll, word-cloud, matching và chín subtype mới.
Sáu simulation giữ behavior physics hiện có; bundle static assets/dynamic manifest và local controls, không viết physics engine mới hay mở sandbox permissions.
Migration chỉ checked-in builtin dataset/explicit isolated fixture; không đọc/ghi user presentations, user templates, uploads hoặc tự upgrade khi mở deck.

## Architecture/contracts
Data flow: shared preset metadata + native configs → localized filtered catalog → inert preview → clone/remap → existing factories/history → saved deck → shared runtime/portable export.
Catalog entries chứa stable preset ID, labels vi/en, category/tags, config/element bundle và capability metadata lấy từ registry; preview không khởi chạy game scoring/socket.
Native quiz migration mapping dùng content đã kiểm tra của đúng năm ID, bảo toàn non-game lesson elements; không parse arbitrary HTML để suy đoán đáp án.
Simulation presets tái sử dụng source HTML đã audited, đặt asset dependency declarations theo phase14; script nội bộ vẫn nằm trong sandbox allow-scripts.
Theo `research/sandbox-offline-research.md:32-43`, network là capability riêng: sandbox không chặn exfiltration; local presets có per-embed CSP, hosted dependencies có compatibility feedback. Inline packaged JS/CSS thay blanket data: script/blob stylesheet vì Electron CSP không cho hai kiểu đó.
Upgrader đọc explicit `--input`/`--output` fixture hoặc checked-in builtin target, validate hoàn chỉnh rồi backup trước publish; các flags này là interface đề xuất cần thêm.
Repeated run giữ semantic payload và stable IDs; no timestamp/random changes trong config đã up-to-date, backup filename độc nhất không ghi đè backup trước.
Backup/atomic publish chỉ trong phạm vi file được chọn; lỗi schema/resource/missing ID trả exit nonzero và không ghi target một phần.
Không scan server/data/presentations*.json hoặc storage user templates; server cache TTL `marketplace.js:11-24` phải được kiểm tra khi fixture restart, không gọi cache green giả.

## File inventory
CREATE là proposed, không phải đường dẫn hiện có; từng production module mới <200 LOC, shared preset/clone contracts dưới shared/.
| Full path | Operation / trạng thái | Owner, kích thước và test impact |
|---|---|---|
| C:/Work/NavSlidesEditor/shared/src/education/presets/catalog.js | CREATE / proposed | Library owner; metadata aggregation <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/presets/existing-games.js | CREATE / proposed | Library owner; 10 native examples <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/presets/learning-games.js | CREATE / proposed | Library owner; quiz/memory/flashcards/sorting <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/presets/utility-word-games.js | CREATE / proposed | Library owner; wheel/countdown/scoreboard/crossword/search <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/presets/simulations.js | CREATE / proposed | Simulation owner; metadata/asset declarations <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/presets/known-quiz-migration.js | CREATE / proposed | Migration owner; exact-ID transforms <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/presets/simulation-sources/logic-gate.html | CREATE / proposed | LogicGate asset; preserve existing physics |
| C:/Work/NavSlidesEditor/shared/src/education/presets/simulation-sources/rlc-frequency.html | CREATE / proposed | RLC asset; preserve existing physics |
| C:/Work/NavSlidesEditor/shared/src/education/presets/simulation-sources/pid-controller.html | CREATE / proposed | PID asset; preserve existing physics |
| C:/Work/NavSlidesEditor/shared/src/education/presets/simulation-sources/bode-plot.html | CREATE / proposed | Bode asset; preserve existing physics |
| C:/Work/NavSlidesEditor/shared/src/education/presets/simulation-sources/three-phase-power.html | CREATE / proposed | 3phase asset; preserve existing physics |
| C:/Work/NavSlidesEditor/shared/src/education/presets/simulation-sources/gear-train.html | CREATE / proposed | Gear asset; preserve existing physics |
| C:/Work/NavSlidesEditor/client/src/components/education/block-library-dialog.jsx | CREATE / proposed | UI owner; search/category/focus/inert preview <200 LOC |
| C:/Work/NavSlidesEditor/client/src/hooks/use-block-library.js | CREATE / proposed | UI owner; existing insertion/history adapter <200 LOC |
| C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx | MODIFY / known | Integration owner; discoverable Library entry |
| C:/Work/NavSlidesEditor/client/src/hooks/use-element-creation.js | MODIFY / known | Integration owner; reuse append/mapActiveSlide |
| C:/Work/NavSlidesEditor/server/data/built-in-templates.json | MODIFY / known | Migration owner; five quiz records + six preset metadata only |
| C:/Work/NavSlidesEditor/scripts/add-quizzes.js | MODIFY / known | Migration owner; fix verified path, native five IDs |
| C:/Work/NavSlidesEditor/scripts/upgrade-interactive-templates.js | MODIFY / known | Migration owner; bounded IDs, fixture flags, backup |
| C:/Work/NavSlidesEditor/scripts/template-preset-publication.js | CREATE / proposed | Migration owner; isolated validate/backup/atomic write <200 LOC |
| C:/Work/NavSlidesEditor/shared/tests/education-preset-clone.test.js | CREATE / proposed | Behavioral refs/independent edits, use phase07 helper |
| C:/Work/NavSlidesEditor/scripts/template-native-migration.test.js | CREATE / proposed | Spawn actual scripts against temp fixture |
| C:/Work/NavSlidesEditor/tests/e2e/games/education-block-library.spec.js | CREATE / proposed | Search/preview/undo/save/native runtime |
| C:/Work/NavSlidesEditor/tests/e2e/export/education-simulations-file.spec.js | CREATE / proposed | Six local simulation controls in actual file |
| C:/Work/NavSlidesEditor/docs/export-fidelity-and-limits.md | MODIFY / known | Sau smoke: local simulation vs online provider |
| C:/Work/NavSlidesEditor/docs/project-changelog.md | MODIFY / known | Sau smoke: observed migration/library evidence |

## Tests Before — RED scenarios
1. Search bằng label vi/en và category đưa đúng preset; empty result không mất focus; preview không score/submit hoặc mở socket.
2. Insert cùng preset hai lần, sửa question/weight/team của bản A không đổi B/catalog; show/action/connector refs trỏ đúng clone.
3. Insert vào vertical child/master, Undo xóa cả bundle, Redo khôi phục đúng IDs/references; save/reload giữ native payload.
4. Migrate năm IDs giữ exact prompt/option meaning, correct answers, feedback và slide titles; trả lời đúng/sai chứng minh mapping, không snapshot text/source.
5. Run scripts hai lần trên fixture; non-target quiz/sim/viz/user-owned sentinel không đổi, backup trước mỗi publish đọc phục hồi được, missing target không partial-write.
6. Sáu controls sandbox/portable thực sự đổi output theo physics baseline; không coi screenshot không trắng là đủ.
RED chưa thực thi trong planning; tạo targeted tests trước implementation, lưu failure quan sát ở đúng fixture.

## Implementation steps
1. Tạo isolated fixture và proposed tests; lập expected semantic mapping từ năm JSON records và baseline controls của sáu simulations.
2. Thêm catalog examples qua registry/default contracts; tạo valid layout cho crossword, seeded bounded grid cho word-search và quiz đủ bảy kinds.
3. Tách source simulation theo sáu filenames ở inventory; đóng dependency manifest, giữ physics/lesson content và không đổi arbitrary deck HTML.
4. Tạo migration exact-ID và publication helper; sửa add-quizzes path; cắt known quiz HTML builders obsolete nhưng bảo toàn sim/viz ngoài scope.
5. Đổi upgrader title matching sang validated ID mapping, hỗ trợ explicit fixture flags; missing/ambiguous incompatible target fail actionable trước publish.
6. Tạo Library dialog với localized labels/search/categories, inert previews và explicit Try; reuse clone/remap/history từ phase07, không tạo duplicate widget state.
7. Integration owner nối Library vào Insert/factory tuần tự; chạy native/preset scripts, generated Present/Share và file smoke trước cập nhật docs.

## Refactor
Delete only five obsolete HTML quiz generators sau native cutover; không xóa các unrelated simulation/viz entries được add-quizzes hiện sở hữu.
Không duplicate game labels/evaluator; catalog consumes shared registry. Dùng existing dialog/focus/selection patterns, không sửa template storage API khi chưa cần.
Tháo throwaway migration scaffolds; giữ deterministic consumer-visible regression và isolated fixture scripts dùng cho release.

## Tests After — GREEN và behavior matrix
| Mức | Hành vi | Unit / integration / E2E proof |
|---|---|---|
| Critical | Five native quiz mappings giữ answer semantics | Config normalization + actual correct/incorrect submission |
| Critical | Migration không chạm user/non-target data, backup phục hồi | Actual child-process script, temp directories, two runs |
| High | Clone references, history, vertical/master targeting | Shared helper transitions + editor save/undo/reload |
| High | 19 ready examples hoạt động trên runtime chung | Valid configs + Try/Present/Share/file completion/reset |
| High | Six simulations local physics preserved | Baseline input-output pairs + frame/browser canvas/output |
| Medium | Search/category/locale/preview keyboard | Actual Library surface tại 320/768/desktop |

## Executable focused commands
Các new tests/flags dưới đây là proposed; tạo test files và script flag implementation trước khi chạy từ repository root.
```powershell
npx vitest run shared/tests/education-preset-clone.test.js scripts/template-native-migration.test.js
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/games/education-block-library.spec.js tests/e2e/export/education-simulations-file.spec.js --project=chromium --workers=1
node scripts/add-quizzes.js --input .playwright/education-templates/builtins.json --output .playwright/education-templates/builtins.json
node scripts/upgrade-interactive-templates.js --input .playwright/education-templates/builtins.json --output .playwright/education-templates/builtins.json
```
Test setup tạo fixture path bằng copy baseline trước lệnh, scripts chạy hai lần và verify backup semantic restore; tuyệt đối không trỏ user-owned data.

## ACTUAL browser smoke journey
Mở Library từ Insert, tìm tiếng Việt/English, chọn category, preview rồi chèn quiz + scoreboard + simulation; đóng/mở dialog bằng keyboard, save/reload/undo/redo.
Chạy cùng block ở Try, generated Present và hosted Share; Download qua phase14, mở actual file:// trong context mới với mọi HTTP(S) aborted và socket observer.
LogicGate: đổi hai inputs/gate, kiểm output theo truth table; RLC: đổi R/L/C/f, kiểm resonance/impedance thay đổi theo existing formula, không invent numerical solver.
PID: đổi Kp/Ki/Kd, chạy/reset và kiểm response trace/metrics khác đúng baseline; Bode: đổi authored transfer function, kiểm magnitude/phase và invalid-input feedback hiện có.
3phase: đổi amplitude/speed, pause/resume/reset, kiểm phase/line-value relation; Gear: đổi teeth/RPM, kiểm ratio/output RPM/moment theo simulator hiện tại.
Lặp hai simulations cùng slide để phát hiện ID/global collision; nhìn local controls ở 320/768/desktop, dùng frame-scoped locators thay global DOM selectors.

## Success criteria + unchecked actionable checklist
- [ ] Five known builtin IDs tạo native quiz, giữ lesson content và grading đúng; arbitrary/user-owned HTML không đổi.
- [ ] 19 examples có config hợp lệ, authorable và hoàn tất/reset trong Try/Present/Share/portable theo capability registry.
- [ ] Search/category/locale/preview hoạt động; insert/clone/remap/save/reload/Undo/Redo không sửa preset nguồn hoặc block khác.
- [ ] Six local simulations đổi output đúng baseline trong sandbox allow-scripts và file:// network aborted; online providers không giả portable.
- [ ] Hai scripts chạy lặp trên fixture không nhân bản slides/config IDs, giữ non-targets và backup restore được; docs chỉ cập nhật sau smoke.

## Security/risks and failure protocol
High (vừa × cao): migrate nhầm user deck hoặc title substring; exact builtin-ID allowlist, explicit target fixture và assertion non-target unchanged.
High (cao × cao): question HTML có answer semantics khó suy diễn; đọc manual mapping, real answer evaluation; không dùng regex bulk conversion.
High (vừa × cao): opaque sandbox hoặc file asset break simulation; sửa declared assets theo phase14, không mở permissions hoặc thay physics đơn giản hơn.
Rollback: phục hồi exact builtin JSON backup và catalog/runtime checkpoint cùng nhau; user decks không cần downgrade vì chưa có automatic migration. Deck mới có native config cần runtime cùng schema, không dùng bản cũ thiếu subtype để mở/sửa.
Stop approval khi nội dung/physics/backup mismatch; giữ failing fixture và owner file:line, sửa trong phase này trước phase16. Unchecked: exact metrics/selectors từng main simulation và existing history helper name phải re-scout khi code trước đó đã land.

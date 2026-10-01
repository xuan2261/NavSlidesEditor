---
phase: 10
title: "Ghép cặp, phân loại và sắp xếp bằng thao tác đa phương thức"
status: pending
priority: P1
dependencies: [3, 4, 5, 6]
---

# Phase 10 — Drag/drop không phụ thuộc thiết bị

## Goal
Matching chạy local thực sự; sorting phân loại vào bucket; ordering của quiz dùng cùng evaluator phase 06. Người học hoàn thành bằng pointer, touch, click-place hoặc keyboard, kể cả trong generated Present và file HTML.

## Context/evidence
- `client/src/constants/game-element-types-constants.js:134-142` lưu Matching bằng `promptId/targetId`; `resolveGameConfig` tại `:149-161` hợp nhất nested config. Không đổi discriminator `matching`.
- `client/src/pages/game-player-join-page.jsx:229-246` đã có click-select/place; `:289-295` gửi toàn bộ cặp qua `onSubmit`, nhưng đây là learner live, không phải local Present.
- `client/src/components/canvas/element-renderers/game-renderers/matching.jsx:17-25,60-75` mở host socket và start/reveal; không có local assignment reducer.
- `server/services/game-socket-handler.js:418-441` nhận `game-matching-submit` rồi emit accepted/results; manager `:414-442` kiểm tra membership và uniqueness bằng IDs.
- `shared/src/element-renderers.js:951-975` hiện export placeholder; phase 04 phải đã thay bằng mount thật trước khi thực thi phase này.
- `CLAUDE.md:171-174` yêu cầu module nhỏ và shared logic trong shared; `docs/code-standards.md:30-43` quy định selectors/fixtures và không sleep cứng.

## Deep scout gate
- [ ] Scout mới xác nhận các citations trên, nhánh generated-document, registry phase 03 và presenter phase 04 đang được dùng thực tế.
- [ ] Đọc file phase 06 đã tạo trước khi sửa `quiz-answer-controls.js`; trace ordering/matching payload tới evaluator, không dựng evaluator thứ hai.
- [ ] Liệt kê pointer handlers và Reveal touch/key navigation đang hoạt động; tái hiện swipe trên game trước khi thay gesture policy.
- [ ] Kiểm tra mọi mount có instance/generation riêng; cùng game được duplicate không chia sẻ mapping hoặc điểm.
- [ ] Kiểm tra authoring sorting, buckets/items/answerKey/attemptLimit phase 03; ghi thiếu sót vào gate rồi hoàn thiện tại checkpoint, không giảm scope.

## Requirements
- Giữ 19 canonical element types và 19 game subtypes cuối kế hoạch; sorting là `type:'game',gameType:'sorting'`, ordering là question kind của quiz.
- Matching dùng bijection `promptId -> targetId`; một target không được gán hai prompt. Đổi assignment giải phóng target cũ một cách atomic.
- Sorting dùng `{itemId,bucketId}`; nhiều item được nằm cùng bucket, unknown IDs bị từ chối. Reorder labels không đổi đáp án.
- Ordering dùng permutation đủ các stable item IDs; thêm/xóa/reorder authoring không lấy display index làm identity.
- Wrong feedback không khóa vô hạn; retry theo attemptLimit, sửa đáp án được, submit lặp không cộng lại điểm. Reset trả puzzle về đầu và xóa feedback/pending selection.
- Local không mở socket; Matching live giữ event names, pair fields và reveal semantics hiện có, không tự đánh điểm khi mất kết nối.
- Pointer Events + capture; keyboard/click là đường hoàn thành đầy đủ, không dùng HTML5 drag/drop làm cách duy nhất.

## Architecture/contracts
- Data flow: persisted config phase 03 → normalizer → local assignment/order state → typed answer phase 06 → evaluator/session → feedback/score → DOM presenter phase 04.
- Proposed command `assign({generation,itemId,targetId})` hoặc `move({generation,itemId,beforeId})` chỉ cập nhật runtime, không ghi presentation JSON.
- Local Matching và sorting trả typed stable-ID answer; quiz ordering/matching đi thẳng session/evaluator phase 06. Exact-match thưởng một lần cho mỗi câu; không tự thêm partial-credit policy.
- Quiz matching canonical `{pairs:[{leftId,rightId}]}` và ordering `{itemIds}` đi vào sole matcher phase 03 `evaluateAnswer(question,answer)->{valid,correct,error}`; quiz-session phase 06 áp points/attempts. Local Matching chuyển stable prompt/target IDs sang input chuẩn ở boundary, live wire vẫn giữ promptId/targetId; sorting many-to-one có classifier riêng, không ép vào bijection.
- Matching chỉ MODIFY canonical proposed outputs phase 05 `shared/src/education/games/matching.js` và `browser/games/matching.js`, không CREATE presenter thứ hai. Dependency 05 là blocker bắt buộc vì có actual file ownership; integration owner nối sequentially. Shared assignment-state extract phần assignment để Matching module consume, không giữ reducer cũ song song.
- Gesture controller chỉ biết source/target IDs và callback commit; không biết answerKey, socket hoặc điểm. Reducer kiểm tra validity trước khi commit.
- Pointerdown trên handle chọn item; capture cùng pointerId; pointermove hiển thị ghost; pointerup hit-test target bằng bounds và commit tối đa một lần.
- Capture không dùng `event.target` làm drop target. `pointercancel`, lost capture, Escape, slide leave, reset và destroy đều hủy gesture/ghost, không submit.
- `touch-action:none` chỉ trên draggable handle; game boundary chặn gesture đang drag khỏi Reveal; vùng đọc/scroll và slide navigation ngoài game vẫn hoạt động.
- Click chọn nguồn rồi chọn nơi đặt; Enter/Space tương đương click, arrows đổi focus, ordering có Move up/down; Escape hủy và trả focus về source.
- Dùng Reveal `keyboardCondition` scoped/chained theo asset hiện tại `shared/src/reveal-runtime-assets.js:3` (6.0.2); button/select/Space trong game không điều hướng slide, ngoài game giữ condition cũ. Native child control sở hữu click của nó; không xử lý lại cả keydown và synthesized click, không để action delegation phase 07 hijack submit.
- Live presenter nhận transport phase 04; learner live reuse controller khi phase 13 nối. Phase này không thay server engine/protocol.
- Hide/show giữ progress; slide leave hủy drag nhưng không xóa assignment. Reset tăng generation để callback pointer/feedback cũ không tác động instance mới.

## File inventory
Tất cả đường dẫn CREATE dưới đây là đề xuất, không phải file đang tồn tại; file nhận từ dependency phải được re-scout trước khi MODIFY. Mỗi production module mới dưới 200 LOC.

| Full path | Action / fact | Ownership, size và test impact |
| --- | --- | --- |
| C:/Work/NavSlidesEditor/shared/src/education/assignment-state.js | CREATE / proposed | Domain; bijection/buckets reducer; <200 LOC; unit invariants |
| C:/Work/NavSlidesEditor/shared/src/education/sorting-config.js | CREATE / proposed | Domain; config normalization/evaluation; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/drag-controller.js | CREATE / proposed | Domain; pointer capture/cancel; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/assignment-controls.js | CREATE / proposed | Domain; click/keyboard IDs; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/games/matching.js | MODIFY / proposed phase 05 output | Integration owner serial; consume shared assignment state/sole matcher; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/matching.js | MODIFY / proposed phase 05 output | Integration owner serial; existing click/tap/keyboard thêm drag; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/sorting-presenter.js | CREATE / proposed | Domain; bucket DOM; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/quiz-answer-controls.js | MODIFY / proposed phase 06 output | Integration owner; augment drag, retain typed keyboard path; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/answer-evaluator.js | REUSE / proposed phase 03 output | Sole typed matcher; no duplicate quiz evaluator |
| C:/Work/NavSlidesEditor/shared/src/education/quiz-session.js | REUSE / proposed phase 06 output | Attempts/generation/once-only score |
| C:/Work/NavSlidesEditor/shared/src/education/browser/mount.js | MODIFY / proposed phase 04 output | Integration owner; connect presenters serially; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime.css | MODIFY / proposed phase 04 output | Integration owner; handles/drop targets/focus, no app Tailwind dependency |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx | MODIFY / known :9-20,416-436 | Integration owner; route complete authoring only if phase 03 gate reveals gap; do not grow monolith |
| C:/Work/NavSlidesEditor/shared/tests/education/assignment-state.test.js | CREATE / proposed | Deterministic reducer/score contract tests |
| C:/Work/NavSlidesEditor/client/src/components/education/assignment-interaction.test.js | CREATE / proposed | jsdom real DOM events/capture seam; consumer behavior |
| C:/Work/NavSlidesEditor/tests/e2e/games/education-drag-drop.spec.js | CREATE / proposed | Generated HTML + touch/keyboard; <=200 LOC |
| C:/Work/NavSlidesEditor/tests/e2e/games/education-drag-drop-file.spec.js | CREATE / proposed | Direct file smoke; <=200 LOC |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md | MODIFY / known | Integration owner, only after successful implementation smoke |
| C:/Work/NavSlidesEditor/docs/project-changelog.md | MODIFY / known | Integration owner, only after observed smoke |

## Tests Before — RED scenarios
Đây là yêu cầu test-first, không phải kết quả RED đã chạy. Tạo proposed test files trước khi gọi commands.
- Bijection: gán prompt A sang target B đã dùng phải bị từ chối, giữ mapping cũ và hướng dẫn giải phóng target trước; không implicit swap hoặc để hai nguồn chung target.
- Sorting: phân loại sai, sửa sang đúng, submit hai lần; score tăng đúng một lần; bucket nhiều items không bị cấm nhầm như Matching.
- Ordering: labels trùng nhau, display bị shuffle; evaluator vẫn chấm đúng theo IDs; missing/duplicate/unknown ID bị từ chối.
- Pointer: drop ngoài board/cancel/capture lost/slide leave/reset giữa drag không đổi answer, không cộng điểm, không swipe slide.
- Keyboard/click: hoàn thành cả ba bài không drag; thay mapping, clear selection, announce lỗi và sửa được tại focus hiện hành.
- Generation: giữ callback feedback/pointerup cũ, reset rồi gọi callback; state mới giữ nguyên, saved deck không đổi.
- Native activation: Space trên button/select, tap source/target và action wrapper chứa controls tạo đúng một assignment/submit; Tab/arrow ngoài game vẫn điều hướng theo Reveal contract.
- Live preservation: chạy existing Matching accepted/reveal/rejoin journey; không đổi `{promptId,targetId}` thành display indices.

## Implementation steps
1. Tạo RED tests với fixture IDs/labels trùng nhau; lưu scenario thất bại thực tế. Nếu dependency thiếu thì dừng tại gate, không chấp nhận test không tìm thấy module làm bằng chứng tính năng.
2. Viết assignment-state reducer bất biến; mapping validity/tổng điểm độc lập DOM; sorting dùng config phase 03 và không sửa saved data.
3. Viết drag-controller có capture/cancel đầy đủ, hit-testing target sau khi bỏ ghost; chỉ commit lúc drop hợp lệ, không commit cả pointerup và click giả sau drag.
4. Viết assignment-controls dùng native button/focus và instructions/aria-live; khôi phục focus sau DOM update và expose Move up/down cho ordering.
5. Lắp matching/sorting presenters; submit/retry/reset cùng runtime-session generation. Feedback âm thanh/reduced-motion dùng capability đã có, không thêm global timers.
6. Integration owner nối mount, stylesheet và quiz-answer-controls sequentially; không để domain agent sửa registry/export/property chokepoints đồng thời.
7. Exercise generated Present, preview/share và direct generated file; đến phase 14 mới ký portable Download closure cuối cùng, nhưng không bỏ smoke file tại phase này.
8. Sau smoke thành công mới cập nhật docs/changelog: modes hỗ trợ, keyboard path, local answer-key visibility và receipt links.

## Refactor
Giữ một assignment implementation cho local Matching và quiz matching; khác biệt scoring do session/evaluator sở hữu. Xóa gesture state/duplicate local reducers được thay thế sau khi xác nhận toàn bộ consumers mới; không xóa learner Matching live ở phase 10 vì phase 13 còn sở hữu cutover đó.

## Tests After — GREEN
Chạy lại đúng RED cases; kiểm tra saved JSON trước/sau play/reset bằng behavioral roundtrip, không so source text. Existing live Matching tests tiếp tục xanh; pointer và click không sinh double activation.

## Behavior matrix
| Mức | Scenario | Kết quả quan sát |
| --- | --- | --- |
| Critical | Correct + duplicate + reset + stale callback | Điểm đúng một lần, generation mới sạch |
| High | Matching bijection / sorting many-to-one | State hợp lệ đúng từng game, IDs ổn định |
| High | Touch drag cạnh slide / cancel | Đặt đúng hoặc không đổi; slide không tự chuyển |
| High | Tab + Enter/Space + Move up/down | Hoàn thành cùng đáp án/score như pointer |
| Medium | 320/768/desktop, labels dài, reduced motion | Controls targetable, feedback không che bài |

## Executable focused commands
Chỉ dùng khi thực thi; không chạy build/test/lint trong lượt lập kế hoạch. Test CREATE trước; phase 04 runtime artifact phải được integration owner chuẩn bị. Specs tự tạo touch context để không phụ thuộc `tablet-touch` testMatch.
```powershell
npx vitest run shared/tests/education/assignment-state.test.js client/src/components/education/assignment-interaction.test.js
npx vitest run server/services/game-matching-reveal-persistence.test.js server/services/game-socket-end-to-end.test.js
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/games/education-drag-drop.spec.js tests/e2e/games/education-drag-drop-file.spec.js --project=chromium --workers=1
```

## ACTUAL browser smoke journey
Tạo deck bằng `testPresentation` fixture theo `tests/e2e/fixtures/test-fixtures.js:41-54,80-95`; author đủ Matching/sorting/quiz ordering → save/reload → undo/duplicate → Try → mở `/api/presentations/{id}/present` thật → làm sai/sửa/submit/reset. Touch context kéo qua cạnh game, kiểm tra Reveal slide index không đổi; keyboard context hoàn thành không chuột. Publish current-phase JS/CSS theo contract04 rồi tạo file từ chính artifact đó, mở `file://` bằng browser với HTTP/WS bị chặn và làm lại cả ba game; nhận xét thiếu portable closure là blocker phase14, không gắn nhãn Download hoàn chỉnh.

## Success criteria + unchecked actionable checklist
- [ ] Cả ba bài hoàn thành bằng pointer/touch/click/keyboard với cùng kết quả, không HTML5-only và không xung đột Reveal.
- [ ] Wrong/retry/reset/duplicate/stale generation được quan sát và không thay saved deck hoặc cộng điểm lặp.
- [ ] Live Matching accepted/reveal/reconnect giữ IDs và server result; local không phát HTTP/WS.
- [ ] Generated localhost và file thực tế có receipt; docs chỉ đổi sau smoke; không còn reducer mới vượt 199 LOC.

## Security/risks and failure protocol
High (likelihood cao × impact cao): touch capture và Reveal cùng điều hướng; giảm bằng ownership gesture vùng game, capture/cancel và smoke thật. High (vừa × cao): index-based migration làm chấm sai khi shuffle; giảm bằng IDs/duplicate-label tests. High (vừa × cao): callback sau reset ghi vào session khác; generation gate bắt buộc. Medium (vừa × vừa): offline keys có thể đọc được; công khai local boundary, không tuyên bố bí mật. Rollback: hoàn nguyên checkpoint phase 10 cùng registration/style của nó, giữ config IDs đã lưu và dependency runtime; không xóa dữ liệu sorting/quiz của người dùng. Khi RED/GREEN/smoke sai, lưu payload, viewport, generation và trace; dừng bước tích hợp gây lỗi, sửa root cause rồi chạy đúng scenario, không disable gesture hoặc che lỗi để đạt gate.

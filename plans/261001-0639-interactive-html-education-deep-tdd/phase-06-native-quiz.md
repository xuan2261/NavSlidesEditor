---
phase: 6
title: "Quiz native với bảy loại câu hỏi và chấm điểm dùng chung"
status: pending
priority: P1
dependencies: [3, 4]
---

# Phase 06 — Native quiz

## Goal
Tác giả tạo, sửa và chơi được `type:'game', gameType:'quiz'` trên Try, HTML Present và HTML độc lập, với cùng evaluator cho server phase 12.
Không thêm canonical element; giữ 19 canonical types và catalog cuối cùng gồm 19 game subtypes theo execution-contracts.

## Context/evidence
- `C:/Work/NavSlidesEditor/client/src/constants/game-element-types-constants.js:149-160,207-229` hợp nhất legacy/nested config rồi factory lưu config dưới discriminator; giữ cơ chế nested này.
- `C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx:145-159` modal lưu câu bằng ID; danh sách `:255-275` chưa có reorder và chỉ đọc `question`.
- `C:/Work/NavSlidesEditor/client/src/components/properties/game-properties-question-editor.jsx:63-77` hiện chỉ validate lựa chọn/correctIndex; không suy diễn đây là editor bảy loại.
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js:956-1004` hiện tạo placeholder; `C:/Work/NavSlidesEditor/server/routes/presentations-extras.js:97-116` thực sự gọi generator rồi trả HTML, không mount React.
- `C:/Work/NavSlidesEditor/server/services/game-room-manager-singleton-service.js:587-609` kiểm session/question trước chấm; `C:/Work/NavSlidesEditor/server/services/game-socket-handler.js:13-25,233-284` redaction hiện tại và payload index-only phải cutover ở phase 12.
- `C:/Work/NavSlidesEditor/shared/src/content-safety.js:36-50` là media safety boundary; question image/alt và hotspot phải dùng boundary này và asset manifest/offline closure, không URL/event HTML tùy ý.
- Đọc lại GameFixScout, ServerGameScout, PresentRuntimeScout cùng execution-contracts; báo cáo cũ không thay thế scout code mới.

## Deep scout gate
- Trước code, glob/grep lại các file và symbol trên, đọc phase 03/04 đã triển khai, xác nhận question-schema, mount lifecycle và game registry thật.
- Trace Insert → nested patch → save/reload/undo → generator → mount; liệt kê từng caller đang sử dụng correctIndex trước migration, không viết “update all”.
- Kiểm lifetime: config thuộc deck lưu; quiz-session thuộc `(mount, effectiveSlideId, elementId, generation)`, không thuộc module singleton hay Zustand deck.
- Nếu schema phase 03 thiếu kind/ID/media invariant, integration owner sửa chính schema đó trước RED; không tạo normalizer câu hỏi thứ hai.

## Requirements
- Bảy kind canonical: `single-choice`, `multi-choice`, `true-false`, `fill-blank`, `ordering`, `matching`, `image-hotspot`; tên UI không thay đổi discriminator.
- Sửa được prompt, media URL/upload và alt, options/items/pairs/regions, answerKey, points, timeLimit, feedback và settings toàn quiz.
- Thêm/xóa/reorder câu hỏi và option giữ nguyên ID cùng answer references; undo/reload/duplicate không làm đổi nghĩa đáp án.
- Chấm exact-match; mỗi câu tối đa một lần cộng điểm, retry đúng attemptLimit, không nhận speed bonus của Hot Potato.
- Local offline có answerKey đọc được trong tài liệu; công khai giới hạn này. Live participant chỉ có projection redacted, không tự chấm hay fallback local khi disconnect.

## Architecture/contracts
- Config canonical: `{type:'game',gameType:'quiz',quiz:{title,questions,attemptLimit,shuffleQuestions,feedbackMode,showScore}}`; defaults dùng catalog phase 03, attemptLimit mặc định 1, hữu hạn integer 1..10.
- `feedbackMode:'immediate'|'after-question'`; immediate báo đúng/sai sau attempt, nhưng explanation/key chỉ reveal sau câu kết thúc; after-question giữ feedback đến terminal.
- Câu canonical: `{id,kind,prompt,media?,points,timeLimit,options?,answerKey,feedback:{correct,incorrect,explanation}}`; media `{src,alt}`; points integer 1..1000, timeLimit integer 5..300 giây theo boundary hiện có.
- Hiện rõ timeLimit và đường điều chỉnh timer trong authoring/local controls; không tự coi competitive live được miễn SC 2.2.1, không claim WCAG timing compliance khi chưa xác minh chính sách giới hạn theo contract.
- Options lựa chọn/ordering là `[{id,text,media?}]`; true-false dùng hai ID ổn định `true`/`false`, không lưu đáp án theo vị trí hiển thị.
- Matching dùng `options:{left:[{id,text,media?}],right:[{id,text,media?}]}`; các ID độc nhất trong từng phía, mapping one-to-one đầy đủ.
- Envelope submit: `{generation,questionId,attemptId,answer}`; server phase 12 bổ sung room/player/session authority, không tin thời gian client.
- Payload/key single-choice: answer `{optionId}`, key `{optionId}`; true-false: answer `{value:boolean}`, key `{value:boolean}`.
- Payload/key multi-choice: answer `{optionIds:[id]}`, key `{optionIds:[id]}`; so sánh tập chính xác, duplicate/unknown ID là invalid, không partial credit.
- Fill-blank: answer `{text}`, key `{accepted:[string],caseSensitive:boolean}`; trim + NFC rồi optional lowercase, không bỏ dấu, không regex; bound text theo question-schema.
- Ordering: answer `{itemIds:[id]}`, key `{itemIds:[id]}`; exact permutation, không thiếu/lặp/ID lạ, thứ tự so sánh theo ID.
- Matching: answer `{pairs:[{leftId,rightId}]}`, key cùng shape; so sánh mapping không phụ thuộc thứ tự payload, uniqueness cả hai phía bắt buộc.
- Hotspot options là mọi vùng có thể chọn `[{id,text}]`; key `{regions:[{id,shape:'rect',x,y,width,height}|{id,shape:'circle',cx,cy,r}]}` chứa vùng đúng.
- Mọi rect/circle nằm trọn miền 0..1; coordinate finite, kích thước dương; rect biên inclusive, circle dùng khoảng cách bình phương ≤ r².
- Hotspot answer `{mode:'point',x,y}` hoặc `{mode:'region',regionId}`; region mode dùng menu văn bản/bàn phím tương đương, đúng khi ID thuộc key.
- Pointer quy đổi theo vùng ảnh thực sau object-fit/letterbox, không theo wrapper; điểm ngoài ảnh invalid, resize không đổi nghĩa answer.
- Reuse sole matcher proposed phase 03 `evaluateAnswer(question,answer) -> {valid,correct,error}` từ answer-evaluator.js; quiz-session áp points khi correct, invalid không tiêu attempt, wrong hợp lệ tiêu một attempt và cho 0 điểm; không CREATE quiz-evaluator hoặc shim thứ hai.
- Quiz-session nhận attempt mới khi câu active trước deadline; duplicate attempt trả kết quả đã nhận, reuse ID với payload khác bị reject; terminal/expired không chấm thêm.
- Đúng hoặc hết attempts/deadline kết thúc câu; score award chỉ lần đúng đầu tiên. Reset tăng generation, xóa attempt/feedback/timer, callback generation cũ không tác động.
- Quiz projection composes question-public-projection03 allowlist/validation with session attempts and controlled terminal feedback. No answerKey/accepted/nested correctness/private feedback before policy permits it; accepted result selects its own feedbackMode message, explanation/key only terminal/reveal. Audience documents use public validation, never the full private-config normalizer.
- Data flow: config đã normalize → DOM controls → structured answer → evaluator/session local hoặc transport live → result/feedback/score → DOM textContent; không ghi runtime state vào deck.
- Phase 12 import evaluator/projection này; phase 13 dùng cùng payload controls. Phase 10 bổ sung drag/drop cho ordering/matching, giữ click/keyboard của phase này.
- Đọc research/learning-accessibility-research.md; integration owner dùng scoped/chained keyboardCondition với Reveal 6.0.2 (`C:/Work/NavSlidesEditor/shared/src/reveal-runtime-assets.js:3`), giữ deck navigation ngoài playable root; native radio/select/button không bị Space/arrows đổi slide.
- Một form submit handler; nút phụ type=button, selection không tự submit; action delegation không bắt controls bên trong quiz. Role=status có trước input, polite text feedback, không aria-invalid cho đáp án sai hợp lệ.

## File inventory
| Full path | Action / evidence | Ownership, size và test impact |
| --- | --- | --- |
| C:/Work/NavSlidesEditor/shared/src/education/quiz-config.js | CREATE proposed | Quiz settings/composition, dùng question-schema phase 03; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/answer-evaluator.js | REUSE proposed phase 03 | Sole matcher bảy kind, phase 05/06/12 cùng import; không duplicate |
| C:/Work/NavSlidesEditor/shared/src/education/quiz-session.js | CREATE proposed | Attempts/generation/score reducer; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/quiz-public-projection.js | CREATE proposed | Compose public question boundary03 + controlled attempts/terminal reveal; no duplicated allowlist; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/question-public-projection.js | REUSE proposed phase 03 | Sole canonical public question validator/allowlist for local-vs-live document boundary |
| C:/Work/NavSlidesEditor/shared/src/education/browser/quiz-presenter.js | CREATE proposed | DOM presenter chung, lifecycle phase 04; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/quiz-answer-controls.js | CREATE proposed | Choice/text/order/matching controls; <200 LOC mỗi file split |
| C:/Work/NavSlidesEditor/shared/src/education/browser/quiz-hotspot-controls.js | CREATE proposed | Image coordinate + keyboard alternative; <200 LOC |
| C:/Work/NavSlidesEditor/client/src/components/properties/quiz-properties.jsx | CREATE proposed | Settings/list/reorder, nested patches; <200 LOC |
| C:/Work/NavSlidesEditor/client/src/components/properties/quiz-question-editor.jsx | CREATE proposed | Modal chung; split kind-fields nếu vượt <200 LOC |
| C:/Work/NavSlidesEditor/client/src/components/properties/quiz-question-kind-fields.jsx | CREATE proposed | Form kind-specific, không chứa grading; <200 LOC mỗi split |
| C:/Work/NavSlidesEditor/shared/tests/education/quiz-grading.test.js | CREATE proposed | Bảy typed answers qua session thật → points/attempt outcomes, không test forwarding |
| C:/Work/NavSlidesEditor/shared/tests/education/quiz-session.test.js | CREATE proposed | Retry/deadline/dedup/reset/projection |
| C:/Work/NavSlidesEditor/client/src/components/properties/quiz-properties.test.jsx | CREATE proposed | Sửa/reorder/media/settings không mất IDs |
| C:/Work/NavSlidesEditor/tests/e2e/games/native-quiz.spec.js | CREATE proposed | UI → generated Present/Share và keyboard/touch; ≤200 LOC |
| C:/Work/NavSlidesEditor/tests/e2e/games/native-quiz-file.spec.js | CREATE proposed | File artifact thật, data-image, block HTTP/WS; ≤200 LOC |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx | MODIFY known :27,145 | Integration owner nối panel mới, không domain sửa monolith |
| C:/Work/NavSlidesEditor/shared/src/element-renderers.js | MODIFY known :956,1036 | Integration owner nối interactive/public snapshot serial |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime-entry.js | MODIFY proposed phase 04 | Integration owner import presenter khi prerequisite tồn tại |
| C:/Work/NavSlidesEditor/shared/src/education/question-schema.js | MODIFY proposed phase 03 | Integration owner hoàn tất shape ở scout gate nếu cần |
| C:/Work/NavSlidesEditor/docs/project-changelog.md | MODIFY known | Chỉ sau implementation smoke; không sửa khi lập plan |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md | GENERATED known | Không hand-edit; phase 16 regenerate từ fresh receipts, game scope không nằm editor-core |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/feature-manifest.json | MODIFY known :125 | Integration owner khai báo proposed game.quiz capability/test tags serial |

## Tests Before — RED
Chưa chạy RED trong lượt lập plan; executor tạo các test proposed trước code và ghi failure receipt có assertion hành vi.
- Bảy payload: đúng/sai/invalid, Unicode dạng decomposed, tập lựa chọn thiếu/thừa, permutation lặp, matching trùng rightId, hotspot biên/NaN/letterbox.
- Submit sai rồi đúng trong retry; duplicate chính nó; hai attempt đúng khác ID; submit sau deadline/reset; tổng điểm không vượt points mỗi câu.
- Reorder câu/options rồi save/reload/undo: answer vẫn theo IDs; media alt còn; sửa feedback không xóa settings khác.
- Public projection serialize/parse không chứa private key hoặc explanation nested; local HTML vẫn chơi được bằng key nhúng, không giả bảo mật offline.
- Generated document hiện chưa có quiz playable: test thao tác Submit và thấy score/feedback thật phải fail vì missing behavior, không vì wording placeholder.

## Implementation steps
1. Khóa fixture đủ bảy loại bằng schema/evaluateAnswer phase 03; viết RED quiz grading/session/projection với clock deterministic và JSON roundtrip thực, missing-import không tính behavioral RED.
2. Implement quiz config và điểm/attempt composition trong quiz-session, import sole matcher phase 03; migrate known correctIndex ở normalization boundary rồi liệt kê/cutover caller thực, không evaluator shim.
3. Implement session reducer, unique attempts, deadline và generation; dùng deadline-clock phase 04 thay decrement interval.
4. Tạo DOM controls accessible; ordering bằng Move up/down, matching bằng select/place, hotspot có region selector và hỗ trợ touch.
5. Tạo panel authoring và modal kind-specific; add/delete/reorder chỉ đổi sequence, không regenerate existing IDs; lỗi schema chỉ rõ trường sai.
6. Integration owner nối catalog/schema/panel/runtime-entry/render snapshot tuần tự; static PPTX/PDF hiển thị câu thực nhưng không default reveal answerKey.
7. Chạy focused GREEN và smoke dưới đây; cập nhật docs/changelog sau bằng chứng, chuyển evaluator/public projection cho phase 12, không claim live đã hoàn tất.
Sau smoke, cập nhật changelog và manifest/test tags proposed `[cap:game.quiz]`; gửi receipts cho phase 16. `C:/Work/NavSlidesEditor/scripts/feature-inventory/build-matrix.mjs:145,188-191` sinh matrix editor-core, không hand-edit hay gán game capability thành editor-core để che gap.

## Refactor
Shared thuần không import React/window; UI không copy grading. Tách controls theo kind nếu size vượt 199 LOC, không tạo engine generic.
Xóa assertion placeholder/source-wording liên quan sau cutover; giữ regression dựa trên score/transitions, không re-pin implementation text.

## Tests After — GREEN
Giữ failing-before/passing-after receipts cho chấm điểm, retry và HTML thật; test fakes chỉ clock/random/isolated transport, không mock implementation.
Test end-to-end live authority với real Socket.IO nằm phase 12/13; phase này kiểm redaction function và live presenter không nhận key/không local-score khi transport thiếu.

## Behavior matrix
| Mức | Unit | Integration | Browser/acceptance |
| --- | --- | --- | --- |
| Critical | Exact grading + dedup + generation | Session với evaluator/projection thật | Submit/retry/reset trên generated HTML cho bảy kind |
| High | Media bounds + region geometry + IDs | Form → normalized saved config → render | 320/768/desktop, keyboard, touch, letterbox hotspot |
| Medium | Feedback timing + shuffle permutation | Static public snapshot không lộ key | Reduced-motion; exit/return giữ tiến độ và pause local timer |

## Focused commands
Chạy tại `C:/Work/NavSlidesEditor` khi triển khai; các test dưới đây là proposed, phải CREATE trước khi chạy. Không chạy build/lint/suite toàn repo ở phase này.
```powershell
npx vitest run shared/tests/education/quiz-grading.test.js shared/tests/education/quiz-session.test.js client/src/components/properties/quiz-properties.test.jsx
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/games/native-quiz.spec.js tests/e2e/games/native-quiz-file.spec.js --project=chromium --workers=1
```
Playwright config thật `C:/Work/NavSlidesEditor/playwright.config.js:120-136` khởi động localhost riêng; publish current-phase JS/CSS bằng `npm run vendor` theo contract04 trước smoke, không tái dùng bundle prerequisite cũ.

## ACTUAL browser smoke journey
Tạo deck riêng bằng testPresentation fixture `C:/Work/NavSlidesEditor/tests/e2e/fixtures/test-fixtures.js:148-152`; tác giả nhập đủ bảy loại bằng panel thật, save/reload, undo reorder, duplicate.
Mở Try và `/api/presentations/:id/present`, làm đúng/sai/retry, kiểm tổng điểm và Reset; mở hosted Share và lặp đường tương tác, không chỉ mount React.
Download HTML với ảnh data đã self-contained theo closure phase 04, mở file:// bằng context mới, chặn toàn bộ HTTP/WS và chơi đủ bảy kind; network record không có dependency chạy lại.
Dùng context hasTouch ở 320/768 và desktop; Tab/Enter/Space/arrows không đổi slide/fragment trong quiz, Tab thoát rồi navigation ngoài root vẫn chạy; click/tap chọn item rồi đặt vị trí/đích phải hoàn thành ordering/matching không kéo, keyboard riêng cũng hoàn thành.
Kiểm accessibility tree/AT đọc label và feedback, focus không bị lấy để thông báo; reduced-motion không trì hoãn kết quả, controls đạt 24×24 CSS px hoặc equivalent hợp lệ sau Reveal scale.
Ảnh uploads/remote recursive closure đầy đủ được gate phase 14; lỗi tài nguyên phải báo rõ, không đánh dấu file smoke thành công nếu ảnh thiếu.

## Success criteria + unchecked actionable checklist
- [ ] Bảy kind có một câu đúng, một sai, một invalid với kết quả/score như contract và evidence receipt thực.
- [ ] Reorder/save/reload/undo/duplicate giữ IDs, đáp án, ảnh/alt và toàn bộ editable settings.
- [ ] Attempts/deadline/reset generation không cộng điểm hai lần và không giữ callback cũ.
- [ ] Try/Present/Share/file:// chạy evaluator chung, đủ keyboard/touch và không cần network local.
- [ ] Projection redacted không có key nested; docs nói rõ key offline visible và live proof thuộc phase 12/13.
- [ ] New production files <200 LOC; integrating owner hoàn tất serial chokepoints trước bàn giao.

## Security/risks and failure protocol
High = khả năng cao × tác động cao: key leak do nested feedback; mitigate allowlist projection + serialized payload tests, phase 12 wire receipts bắt buộc.
High = trung bình × cao: grading/index drift khi reorder; mitigate stable IDs + original-deck roundtrip; không sửa triệu chứng bằng khóa reorder.
High = trung bình × cao: hotspot letterbox hoặc timer stale; mitigate geometry browser proof và generation cleanup, không tin client elapsed.
Rollback chỉ revert modules/integration của phase này sau snapshot deck; giữ canonical saved config không destructive rewrite, ngừng rollout quiz nếu proof thất bại, không thay bằng placeholder.
Failure protocol: dừng checkpoint gây lỗi, ghi fixture/expected/observed và dependency; re-scout implementation drift rồi sửa root cause, chạy lại targeted proof, không approve khi local/live/file boundary sai.
Unchecked facts khi lập plan: tên proposed modules chưa tồn tại; vendor output/lifecycle phase 04 và server live projection phase 12 cần verify lúc triển khai, không có RED/GREEN hoặc browser receipt hiện tại.

---
phase: 3
title: "Registry/schema chung và authoring đầy đủ mười game hiện có"
status: completed
priority: P1
dependencies: [1]
---

Status completed chỉ ghi qualified historical checkpoint; không phải current-source acceptance hoặc implementation đã merge vào main. Xem [handoff](../handoffs/education-pause-20261004.md) khi resume.

# Phase 03 — Schemas and authoring

## Goal
Một catalog dùng chung điều khiển schema/defaults/capabilities; giáo viên cấu hình được toàn bộ mười game hiện có, dữ liệu cũ được chuẩn hóa không mất nội dung và runtime state không lọt vào save.
Giữ 19 canonical types; thêm chín discriminator game subtype theo hợp đồng, đạt đúng 19 game subtypes, không thêm element quiz riêng.

## Context/evidence
- Catalog/defaults/factory hiện ở `client/src/constants/game-element-types-constants.js:6-18,44-143,149-230`; flat legacy được đọc trước nested, nested thắng tại149-161.
- Defaults hiện có gameStatus/currentQuestion/team.score tại `client/src/constants/game-element-types-constants.js:54,81,189-198`; đây là điểm phải tách runtime, không tiếp tục persist tiến trình.
- Capability bảng tại `client/src/components/properties/game-properties.jsx:9-19` thiếu authoring Jeopardy questions, Four Corners questions, Relay teams/questions, Trivia rounds và Scatter categories/teams.
- Question modal hiện lưu question/options/correctIndex tại `client/src/components/properties/game-properties-question-editor.jsx:57-77`; list update theo ID tại `client/src/components/properties/game-properties.jsx:148-159`.
- Jeopardy lookup tại `client/src/components/canvas/element-renderers/game-renderers/jeopardy-shared.js:5-22` dùng categories[].questions và dailyDouble cell keys; không tạo schema board thứ hai.
- Load migration tại `client/src/utils/editor-presentation-migration.js:25-40,81-87` chuẩn hóa nested config; bootstrap whitelist tại `server/services/presenter-game-bootstrap.js:3-27,43-54` hiện không truyền hết authored settings.
- API element schema tại `server/middleware/schemas.js:6-44` có legacy divider và plugin extension; canonical19 không đếm enum passthrough hoặc bỏ compatibility divider vô cớ.
- Baseline server evaluator reads correctIndex at `server/services/game-room-manager-singleton-service.js:597-645`. Phase03 atomically migrates existing room grading/public projections and shipped readers with writable canonical persistence; phase12 owns new typed-live round/session authority, not repair of an interim broken reader.

## Deep scout gate
- Re-glob tất cả inventory, grep lại registry imports, save/load consumers và question reads; đọc test hành vi hiện hữu trước sửa.
- Trace từng authoring control tới nested field, rồi save API/load migration/preview; ghi field mà default có nhưng control không ghi được.
- Kiểm tra lifetime factory defaults, team counter và cloned objects: factory phải tạo independent config, không chia mutation giữa decks/tabs.
- Tái hiện saved legacy flat/nested payload thật cho mười game; chọn cases nested/flat xung đột, categories reorder, duplicate IDs và transient scores.
- Fresh scout mọi caller trước xóa/re-export; lấy count thực tế, không nói chung chung update all callers.

## Requirements
- Canonical question là `{id,kind,prompt,media?,points,timeLimit,options?,answerKey,feedback:{correct,incorrect,explanation}}`; option/item IDs ổn định, không dùng vị trí hiển thị làm đáp án.
- Kinds: single-choice, multi-choice, true-false, fill-blank, ordering, matching, image-hotspot; exact-match là mặc định, retry theo authored attempt limit, không áp dụng Hot Potato bonus cho mọi quiz.
- Media gồm URL an toàn/alt và tài nguyên ảnh; hotspot rect/circle normalized0..1 có lựa chọn text/keyboard; fill-blank trim/NFC, tùy chọn insensitive, giữ dấu mặc định.
- Authoring hỗ trợ thêm/sửa/xóa/reorder câu hỏi/options, chọn correctness, points/time/feedback và images; chọn đáp án đúng phải còn đúng sau reorder hoặc xóa option khác.
- Picker item `{id,label,weight}` có positive finite numeric weight; legacy string thành weight1, weighted false lấy đều, weighted true lấy theo cumulative weights.
- Persist config + stable IDs; không persist answers/progress/currentQuestion/remainingTime/exclusions/reveals/scores/gameStatus, không lén sửa JSON deck khi Try.
- Catalog khai báo local/live honestly; existing live transport không tự nhận game mới chưa có server protocol. Phases12/13 hoàn thiện live Four Corners/Relay/Trivia/Scatter/typed quiz.

## Architecture/contracts
Editor controls → shared normalization/schema → nested subtype config → serialized deck; runtime phase04 tạo state riêng từ config, không nhận mutable store object.
Shared modules CommonJS/pure theo shared package; browser/editor consume cùng schema, không đưa React/Zod/server state vào runtime pure modules.
Registry chứa metadata/labels/config schema/default capabilities; presenter composition thuộc04/05 và domain phases, không đặt DOM functions trong schema catalog.
Migration chỉ ở boundary: legacy question/options/correctIndex chuyển canonical IDs/answerKey, legacy nested thắng flat; output clean, không duplicate evaluator/shim exports.
Shared matcher CREATE answer-evaluator.js expose `evaluateAnswer(question,answer) -> {valid,correct,error}` cho cả7 kinds; không trả points hoặc giữ attempts. Phase05/06/12 consume trực tiếp; quiz-session06 compose score/retry, HotPotato05 giữ bonus riêng.
Public question boundary03 is `question-public-projection.js`: `projectPublicQuestion(question)` + `validatePublicQuestion(value)` use an explicit allowlist, including stable option IDs/media and no answerKey/private feedback. Quiz projection06 composes this boundary with attempts/terminal reveal; it does not duplicate the basic question allowlist.
Khóa exact payload thống nhất03/05/06/12: single-choice answer/key `{optionId}`; multi-choice `{optionIds}` unique known IDs; true-false `{value:boolean}`. Choice/ordering options `[{id,text,media?}]`, question/option media `{src,alt}`; invalid shape/reference khác wrong answer.
Fill-blank answer `{text}`, answerKey `{accepted:[string],caseSensitive:boolean}`; trim+Unicode NFC, dấu significant mặc định. Ordering answer/key `{itemIds}`, sequence stable IDs exact-match; multi-choice exact set, không partial credit.
Matching answer/key `{pairs:[{leftId,rightId}]}`, options `{left:[{id,text,media?}],right:[{id,text,media?}]}`; unique known IDs, one-to-one mapping, display reorder không đổi key.
Image-hotspot options `[{id,text}]` là neutral labels của mọi candidate region; private key `{regions:[{id,shape:'rect',x,y,width,height}|{id,shape:'circle',cx,cy,r}]}` liệt kê correct regions, coordinates0..1 và full region bounded. Answer `{mode:'point',x,y}` hoặc `{mode:'region',regionId}` đi cùng matcher, không có alternate accepted shape/shim.
Canonical config becomes writable ONLY in the SAME03 checkpoint as room normalization/grading, socket hydration/results, REST and shipped learner/inert-preview reader migration. Existing Hot Potato answerIndex is a deliberate wire boundary: validate range and map the current canonical option order to optionId before sole evaluateAnswer; never persist correctIndex or grade against it. Public payload uses canonical id/kind/prompt/options[{id,text,media?}]; own terminal result uses stable selected/correct option IDs under explicit reveal policy, not legacy question-field/option-string aliases.12/13 later expand envelopes/new-game authority, not this existing-reader cutover.
Integration owner sở hữu constants/defaults/schema/Insert/GameProperties/PropertiesPanel/bootstrap connectors; worker chỉ thêm module, owner nối tuần tự sau RED.

## File inventory
| Đường dẫn đầy đủ | Thao tác/trạng thái | Owner/kích thước/test impact |
| --- | --- | --- |
| C:/Work/NavSlidesEditor/shared/src/education/game-registry.js | CREATE, đề xuất | Schema worker; metadata19/capabilities, <200 LOC. |
| C:/Work/NavSlidesEditor/shared/src/education/game-defaults.js | CREATE, đề xuất | Schema worker; defaults mới independent, <200 LOC; tách tiếp theo concern nếu cần. |
| C:/Work/NavSlidesEditor/shared/src/education/game-schema.js | CREATE, đề xuất | Schema worker; subtype validation/projection, <200 LOC. |
| C:/Work/NavSlidesEditor/shared/src/education/question-schema.js | CREATE, đề xuất | Schema worker; canonical validation + legacy question boundary, <200 LOC. |
| C:/Work/NavSlidesEditor/shared/src/education/answer-evaluator.js | CREATE, đề xuất | Schema worker; pure seven-kind matcher, <200 LOC, không score/attempt state. |
| C:/Work/NavSlidesEditor/shared/src/education/question-public-projection.js | CREATE, đề xuất | Shared owner03; canonical public validator/allowlist, reused by04/06/12; <200 LOC. |
| C:/Work/NavSlidesEditor/shared/src/education/normalize-game-config.js | CREATE, đề xuất | Schema worker; nested precedence/persist projection, <200 LOC. |
| C:/Work/NavSlidesEditor/shared/src/education/weighted-picker.js | CREATE, đề xuất | Schema worker; deterministic pure sampler, <200 LOC; phase08 reuse không cần05. |
| C:/Work/NavSlidesEditor/client/src/constants/game-element-types-constants.js | MODIFY, đã có | Integration owner; remove duplicate metadata/defaults, giữ factory public contract nếu caller còn dùng. |
| C:/Work/NavSlidesEditor/client/src/data/element-defaults.js | MODIFY, đã có | Integration owner; subtype composition, không đổi canonical19. |
| C:/Work/NavSlidesEditor/client/src/utils/editor-presentation-migration.js | MODIFY, đã có | Integration owner; normalize read, strip transient fields only known game scope. |
| C:/Work/NavSlidesEditor/server/middleware/schemas.js | MODIFY, đã có | Integration owner; validate game nested config, preserve plugins/divider compatibility. |
| C:/Work/NavSlidesEditor/server/services/presenter-game-bootstrap.js | MODIFY, đã có | Integration owner; registry capabilities/options, giữ authorization và unsupported rejection. |
| C:/Work/NavSlidesEditor/server/services/game-room-manager-singleton-service.js | MODIFY, đã có | Integration owner03; preserve canonical option IDs in normalization and grade via sole matcher now, keeping current Hot Potato points/bonus. |
| C:/Work/NavSlidesEditor/server/services/game-socket-handler.js | MODIFY, đã có | Integration owner03; public question/hydration/results migrate with writable canonical config. |
| C:/Work/NavSlidesEditor/server/routes/games-rest-api-handler.js | MODIFY, đã có | Integration owner03; same bounded answerIndex-to-optionId boundary, no persisted/evaluator correctIndex. |
| C:/Work/NavSlidesEditor/client/src/hooks/use-game-player.js | MODIFY, đã có | Integration owner03; canonical public prompt/options/IDs and controlled result validation. |
| C:/Work/NavSlidesEditor/client/src/pages/game-player-join-page.jsx | MODIFY, đã có | Integration owner03; QuestionCard/ResultCard consume canonical question/option identities. |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/hot-potato.jsx | MODIFY, đã có | Retained inert preview reads normalized prompt/media, no question.question fallback. |
| C:/Work/NavSlidesEditor/server/services/game-canonical-question-socket.test.js | CREATE, đề xuất | Existing live canonical grading/reorder/reconnect and public secrecy; real sockets, no forwarding assertions. |
| C:/Work/NavSlidesEditor/tests/e2e/live/canonical-existing-quiz.spec.js | CREATE, đề xuất | Real saved legacy/migrated deck → existing generated host/learner → correctness/score/receipt before03 approval. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx | MODIFY, đã có | Integration owner; orchestrator split dưới200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-properties-question-editor.jsx | MODIFY, đã có | Integration owner; shell nhỏ, canonical controls split dưới200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-authoring-fields.jsx | CREATE, đề xuất | Editor worker; shared list/number/media controls, <200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-authoring-picker.jsx | CREATE, đề xuất | Editor worker; weights/modes/exclude, <200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-authoring-jeopardy.jsx | CREATE, đề xuất | Editor worker; board/category/cell/daily-double authoring, <200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-authoring-team-rounds.jsx | CREATE, đề xuất | Editor worker; Four Corners/Relay/Trivia/Scatter, split nếu≥200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-authoring-responses.jsx | CREATE, đề xuất | Editor worker; Poll/Word Cloud/Matching settings, <200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-question-fields.jsx | CREATE, đề xuất | Editor worker; prompt/media/feedback/options correctness, split theo kind dưới200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-display-fields.jsx | CREATE, đề xuất | Editor worker; colors/timers/confetti, <200 LOC. |
| C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx | MODIFY, đã có | Integration owner; catalog labels không sao chép allowlist. |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/shared.jsx | MODIFY, đã có | Integration owner; bỏ label table trùng, lazy play cleanup thuộc05. |
| C:/Work/NavSlidesEditor/shared/tests/education-authoring-schema.test.js | CREATE, đề xuất | Semantic validation/migration/isolation, focused test. |
| C:/Work/NavSlidesEditor/shared/tests/answer-evaluator.test.js | CREATE, đề xuất | Seven kinds correct/wrong/invalid, stable reorder/NFC/hotspot boundaries. |
| C:/Work/NavSlidesEditor/shared/tests/weighted-picker.test.js | CREATE, đề xuất | Boundary outcomes, deterministic random, không thống kê flaky. |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-authoring-behavior.test.jsx | CREATE, đề xuất | Real form/store/save transitions, focused split tests khi cần. |
| C:/Work/NavSlidesEditor/tests/e2e/games/game-authoring-persistence.spec.js | CREATE, đề xuất | Mười subtype edit/save/reload/undo, ≤200 LOC. |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md | MODIFY sau smoke, đã có | Integration owner; authorable fields vs runtime capabilities. |
| C:/Work/NavSlidesEditor/docs/project-changelog.md | MODIFY sau smoke, đã có | Integration owner; migration/capability receipts. |

## Caller cutover inventory
Các consumer production đã xác minh: `client/src/data/element-defaults.js:1`, `client/src/hooks/use-element-creation.js:3`, `client/src/utils/editor-presentation-migration.js:2`, `client/src/components/properties/game-properties.jsx:3-6`, `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:43`, `client/src/components/canvas/element-renderers/game-element-renderer.jsx:14-15`, `client/src/components/canvas/element-renderers/game-renderers/shared.jsx:36`, `server/services/presenter-game-bootstrap.js:3-27`, `shared/src/htmlGenerator.js:465-486`, `server/middleware/schemas.js:34-44`.
Danh sách trên phải mở rộng với room normalizeQuestions/submitAnswer, game-socket public/hydration/results, REST answer boundary, use-game-player, QuestionCard/ResultCard và retained HotPotatoRenderer. Re-enumerate tất cả remaining readers trước serial checkpoint03; không ghi canonical JSON trước khi readers cùng đổi. Shared playable htmlGenerator connector thuộc04, nhưng schema/public projection03 phải hoàn chỉnh;12/13 không sửa chữa một03 live regression bị bỏ lại.

## Full authoring ten games
| Subtype | Nội dung giáo viên sửa được và observable persistence |
| --- | --- |
| name-picker | Modes wheel/dice/button, item label/weight/add/delete/reorder, weighted/exclude/duration/confetti; item ID không đổi khi sửa label. |
| hot-potato | Ordered canonical questions/images/correctness, shuffle/allowLate/showLeaderboard; không save currentQuestion. |
| jeopardy | Category ID/title/reorder; cells point value/canonical question/image; teams tên/màu; daily doubles theo stable cell IDs, wager/negativePoints/timer policy. |
| four-corners | Canonical questions và correct corner ID, cornerCount/eliminateMode/duration/showTimer; đổi count không âm thầm giữ key ngoài range. |
| relay-race | Teams tên/màu/reorder, questions/media/correctness, questionsPerRound/shuffleTeams/passOnWrong/timer; team ID không dùng tên làm khóa. |
| trivia-champ | Rounds ID/name/mode/question IDs/order/timeLimit; teams; editable buzzPoints finite>=0 with legacy/omitted default10, lightning/timePerQ and jackpot/multiplier; no hardcoded ROUND_DEFS or silent buzz policy change. |
| scattergories | Categories ID/label/reorder, teams, timePerRound/letterMode/scoring; runtime answers/scores không save. |
| poll | Prompt/options IDs/text/reorder, showResults/allowVoteChange/timerDuration; delete/reorder không biến vote ID thành index. |
| word-cloud | Prompt/maxPhraseLength/maxSubmissionsPerPlayer/displayLimit/timerDuration với bounds hợp server, không chỉ prompt control. |
| matching | Prompt/pairs stable promptId/targetId/text/images/alt/add/delete/reorder/timer; đáp án ID nguyên sau reorder. |
Catalog new9 defaults có cấu hình meaningful: quiz questions/attemptLimit, lucky-wheel items/weights, countdown duration, scoreboard teams/binding, memory pairs, flashcards cards, sorting buckets/items, crossword authored layout/words, word-search words/seed/grid bounds; detailed UI/play thuộc06–11, không tuyên bố playable khi chưa nối.

## Tests Before — RED scenarios
1. Các control thiếu của Jeopardy/FourCorners/Relay/Trivia/Scatter phải failing ở tương tác sửa config thật; không assert label có mặt.
2. Reorder options/cells/categories giữ correct answer/daily double identity; xóa referenced item báo validation actionable, không tự chọn đáp án mới.
3. Legacy strings picker normalize weight1; random0/near1 chọn đúng cumulative range; NaN/Infinity/zero/negative reject, weighted false chọn đều.
4. Save sau Try state injection loại progress/scores nhưng giữ authored options/points; hai factory configs mutation không ảnh hưởng nhau.
5. Media/canonical seven question kinds roundtrip; invalid key/hotspot geometry không được save; nested thắng flat deterministic và load không tạo ID mới liên tục.
6. RED matcher fixtures gồm multi-choice exact set không partial-credit, matching duplicate target invalid, ordering đúng stable IDs sau reorder, fill NFC/trim nhưng dấu vẫn significant, hotspot rect/circle0..1 boundary và invalid payload; clock/random không cần matcher.
7. Save migrated Hot Potato → actual existing host + learner → right/wrong/reordered choice/duplicate/reconnect: canonical prompt/options stay visible, current bounded wire answer maps to the intended stable key, score preserves source policy and public state contains no private fields. Retained editor preview shows authored prompt/media after save/reload/undo and remains inert.

## Numbered implementation steps
1. Hoàn tất fresh caller inventory và persisted fixtures; tạo test RED trước đổi defaults/schema.
2. Tạo registry19 metadata/capabilities và shared schema/defaults; integration owner migrate consumers, không còn parallel allowlists.
3. Implement legacy boundary normalization với stable IDs, option-index→ID key, Jeopardy cell identity và picker numeric weights; không rewrite arbitrary HTML.
   Implement shared evaluateAnswer bảy kinds trước downstream05/06/12; schema và evaluator cùng stable key contract, không giữ correctIndex evaluator sau cutover hay shim export thứ hai.
4. Tách GameProperties thành orchestrator và authoring/display modules; giữ modal focus/keyboard/undo contract, không thêm progress state vào form.
5. Implement từng dòng authoring ten-game table; control validation dùng shared contracts, images dùng media safety hiện hữu.
6. Nối persist projection/schema/load migration tuần tự; preserve valid unrelated element/plugin fields và publish unsupported errors rõ ràng.
7. Atomically connect canonical room grading/public projection/REST and shipped learner/inert-preview readers BEFORE writable persistence approval. Run existing live correct/wrong/reorder/reconnect proof now; new native typed quiz/live-round authority still belongs12/13.
8. Chạy GREEN và actual generated editor/Present smoke, sau đó ghi docs/changelog; không ghi docs tuyên bố runtime mười game trước05.

## Refactor
Mọi production module CREATE/split <200 LOC, chung dưới shared/; question schema một nguồn, không thêm clone normalizer ở quiz-config phase06.
Xóa duplicate capabilities/label/default definitions và obsolete re-exports khi caller đã migrate; factory identity helper theo conventions hiện hữu không thêm module-global session state.

## Tests After — GREEN
Các form thao tác thật cho đủ10 games và seven question kinds đều save/reload/undo được; payload persist không chứa runtime state, invalid data không bị lưu âm thầm.
Weighted deterministic boundaries và sampling không mutate config; server-bootstrap option projection không làm mất settings, existing live contract tests cần update khi bị ảnh hưởng.
Seven-kind matcher GREEN phải cho valid/correct/error đúng và không mutate config/input; downstream points/attempt policy không được cài lại matcher.

## Behavior matrix
| Mức | Scenario | Unit / integration / E2E |
| --- | --- | --- |
| critical | Stable correctness/daily doubles sau reorder và legacy migration | Shared semantic key validation + saved API payload + editor reload. |
| high | All10 full authoring/settings/images | Real controls + nested persist + generated question/static snapshot. |
| high | Numeric weights, config isolation/transient stripping | Deterministic selection + factory mutation isolation + save/reload. |
| medium | Catalog19 và honest local/live capabilities | Unique schema discriminators consumed by factory/Insert/bootstrap, không prose count test. |

## Executable focused commands
File tests CREATE đề xuất phải được tạo trước; fresh scout xác nhận lane discovery. Lệnh dùng trong execution, không chạy lúc planning.
```powershell
npx vitest run shared/tests/education-authoring-schema.test.js shared/tests/weighted-picker.test.js shared/tests/answer-evaluator.test.js
npx vitest run client/src/components/properties/game-authoring-behavior.test.jsx client/src/components/properties/game-properties-question-editor.test.jsx client/src/utils/editor-presentation-migration.test.js
npx vitest run server/routes/presentations-game-bootstrap.test.js server/middleware/schemas.test.js
npx vitest run server/services/game-canonical-question-socket.test.js
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'; npx playwright test tests/e2e/games/game-authoring-persistence.spec.js --project=chromium --workers=1
npx playwright test tests/e2e/live/canonical-existing-quiz.spec.js --project=chromium-live --workers=1
```

## ACTUAL browser smoke journey
Tạo deck chứa đủ10 subtype, authored questions/images/teams/settings; save/reload, duplicate, undo/redo, chuyển subtype rồi trở lại không mất config.
Mở generated Present/Preview/hosted share thật để kiểm nội dung cấu hình được thể hiện, không dùng React test thay mount; phase04/05 sẽ đóng behavioral play.
Xuất portable HTML kiểm question images/static content với network blocked; kiểm tại320/768/desktop và keyboard/touch, ghi rõ runtime parity chưa là acceptance03.

## Success criteria + unchecked actionable checklist
- [x] Catalog có đúng19 unique game subtypes, canonical defaults vẫn19; factories/Insert/schema dùng cùng nguồn và không hứa live sai.
- [x] Mười game có đủ controls trong table; edit/save/reload/duplicate/undo giữ cấu hình và media/correct IDs.
- [x] Seven canonical question kinds validate đúng; reorder không đổi answerKey; lỗi reference có hướng dẫn sửa.
- [x] Legacy flat/nested/string items migrate idempotent, numeric weights hoạt động, config independent và transient fields không save.
- [x] New/split production modules <200 LOC; duplicated tables/obsolete exports đã xóa sau migrate, không có config placeholder.
- [x] Focused receipts, real existing live canonical grading/reconnect and inert preview/editor smoke observed; every canonical reader cut over in03 before writable persistence, then docs/changelog.

## Security/risks and failure protocol
High (cao × cao): answerKey lệch khi reorder; mitigate stable IDs và delete-reference validation, không dựa index UI.
High (vừa × cao): canonical question đổi sớm phá existing live correctIndex; integration owner kiểm boundary và phase12 cutover receipt, không duplicate evaluator/shim exports.
High (vừa × cao): runtime state persist hoặc defaults shared mutation; pure projection và independent factory tests, không deepcopy mỗi render không cần thiết.
Medium (vừa × vừa): legacy Jeopardy null cells/duplicate point values; reject ambiguous board với actionable validation, giữ backup trước save normalized.
Rollback: checkpoint trước schema migration + raw JSON backup; restore consumer modules cùng catalog checkpoint, không downgrade newly authored config mất field.
Nếu migration ambiguous hoặc smoke sai, chặn dependent04/05, báo payload/path/key và sửa boundary; không sanitize thành empty config hoặc mock runtime để pass.
Unchecked facts: số consumer sau fresh scout, persisted decks có legacy score seeds mang chủ đích hay không, schema-specific bounds cần đối chiếu live normalization trước implementation.

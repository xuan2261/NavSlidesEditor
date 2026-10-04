---
phase: 11
title: 'Crossword và word-search local với sinh lưới có giới hạn'
status: in_progress
priority: P2
dependencies: [3, 4]
---

# Phase 11 — Trò chơi từ tiếng Việt trên generated HTML

## Execution progress

Crossword/word-search implementation slice đã bàn giao. Còn cần final generated/file receipts cho Vietnamese input/composition, authored layout/seed validation, complete placement, selection/check/reveal/reset và mobile/keyboard/touch theo checklist; source/generator checks không thay actual puzzle journeys. [Root progress](./plan.md#execution-progress) giữ acceptance open, không bỏ word hoặc nới budget để đóng gate.

## Goal

Giáo viên tạo crossword bằng layout tường minh hoặc generator có giới hạn; word-search tái tạo từ seed với mọi từ đều có placement hợp lệ. Cả hai hoàn thành local bằng touch, pointer hoặc keyboard trong Present và file HTML, không giả lập live participation.

## Context/evidence

- `client/src/constants/game-element-types-constants.js:134-161` cho thấy canonical nested game config và stable-ID precedent; crossword/word-search chưa xuất hiện trong grep code hiện tại.
- `shared/src/element-renderers.js:951-975` đang tạo game placeholder; runtime mount phase 04 là prerequisite, không lấy React preview làm acceptance.
- `server/services/presenter-game-bootstrap.js:3-14,63-72` bootstrap chỉ game trong allowlist; không thêm hai word games vào live allowlist.
- `client/src/components/properties/game-properties.jsx:9-20,416-436` đang route subtype content; integration owner phase 03 đã chia authoring thì phải sửa route mới thay vì bồi thêm monolith.
- `CLAUDE.md:169-174` và `docs/code-standards.md:30-43,87-91` quy định shared logic, module nhỏ, test fixtures và selectors.
- `playwright.config.js:27-35,61-92` có chromium và chromium-live riêng; word game specs đi chromium, tự tạo touch context khi cần.

## Deep scout gate

- [ ] Re-grep tên subtype, canonical registry/schema phase 03 và runtime mount phase 04; đánh dấu output dependency chưa tạo là proposed, không đoán existing path.
- [ ] Trace authoring update → save/reload → normalized config → generated payload; xác nhận seed/grid/layout không bị JSON roundtrip làm mất IDs.
- [ ] Kiểm tra `Intl.Segmenter` trong Node/browser/Electron runtime hỗ trợ thực tế; fallback shared phải cho cùng grapheme kết quả nếu bắt buộc.
- [ ] Scout Reveal gesture/key ownership và runtime-session reset/hide/show; xác nhận cell input không bị global arrow shortcuts lấy mất.
- [ ] Đọc defaults/bounds phase 03 và đồng bộ limits ở đây vào cùng contract; không đặt limits khác giữa UI và exported runtime.

## Requirements

- Hai subtype mới `crossword`, `word-search` là classroom-local; không phòng live, socket, CDN, network dictionary hoặc parent globals.
- Config giữ seed/stable IDs/words/clues/layout/settings; progress/selected cell/found words/feedback chỉ tồn tại trong session.
- Crossword explicit entries gồm `{id,answer,clue,row,column,direction:'across'|'down'}`; dimensions rõ ràng, không overlap trái chữ hay đi ngoài lưới.
- Generator deterministic theo seed; backtracking/search có operation budget cố định, không vòng lặp vô hạn hoặc trả puzzle thiếu từ.
- Word-search dùng authored words có IDs, grid size, seed và selected directions từ E/W/N/S/NE/NW/SE/SW; cấm direction rỗng hoặc không có hướng nào chứa được từ.
- Vietnamese NFC và grapheme là đơn vị ô; dấu và `đ` giữ ý nghĩa. Chữ precomposed/decomposed tương đương, không bỏ dấu để ép placement.
- Validation trả lỗi có entryId, code, constraint và hành động sửa; oversize/contradiction/search exhausted được phân biệt, không tuyên bố mọi thất bại search là chứng minh vô nghiệm.
- Wrong selection/answer không thưởng; completion mỗi entry/word ghi một lần, retry và reset hoạt động. Layout/seed không đổi chỉ vì reset progress.

## Architecture/contracts

- Data flow: authoring config → `word-puzzle-config` + Unicode tokenization → explicit layout validator hoặc bounded generator → immutable puzzle → runtime state → DOM inputs/selections → completion/feedback.
- Proposed common bounds để khóa cùng phase 03: grid 2..20 mỗi chiều, tối đa 40 words/entries, token 2..20 graphemes; crossword search tối đa 50,000 node expansions, word-search tối đa 20,000 placement expansions.
- Kiểm tra raw string cap 256 code units trước NFC/uppercase; trim ngoài, uppercase theo `vi-VN`, segment sau normalization. Inner whitespace/punctuation phải báo lỗi author thay vì âm thầm xóa; label/clue gốc vẫn hiển thị nguyên văn.
- Cell chấp nhận một grapheme; xử lý paste nhiều ô và compositionend của IME, không chấm giữa composition. Input decomposed được normalize rồi mới so.
- Reject duplicate normalized answer/word và duplicate IDs; display labels trùng nhưng khác token được phép. Không tự loại một từ rồi báo sinh puzzle thành công.
- Crossword explicit: mỗi entry nằm trong bounds, hai entry giao tại cùng grapheme; cấm trùng placement, overlap song song và inconsistent numbered starts. Clue numbering xác định từ coordinates, ID không lấy số hiển thị.
- Crossword generator ưu tiên longest-first rồi seeded tie-break, enumerate candidate crossings, backtrack và đếm expansions; chỉ commit khi đặt đủ entries và validator độc lập chấp nhận.
- Không có layout sau hết budget trả `SEARCH_EXHAUSTED` kèm words chưa đặt và gợi ý tăng grid/đổi seed/sửa bộ từ; constraint chứng minh sai trả `UNSATISFIABLE_LAYOUT`, quá bounds trả `PUZZLE_OVERSIZE`.
- Word-search overlap chỉ khi graphemes tương ứng bằng nhau; reject duplicate placement/path và đi ngược chỉ khi reversed direction được bật.
- Sau placement đầy đủ, fill cells còn trống bằng alphabet đã khai báo/deterministic seed; lưu expected placements theo word IDs, validate lại letters/bounds/directions trước render.
- Selection là thẳng liên tục theo allowed direction; pointer dùng start/end cells, touch/click chọn start rồi end, keyboard arrows + Space xác lập path, Enter submit.
- Chained/scoped Reveal keyboardCondition theo 6.0.2 `shared/src/reveal-runtime-assets.js:3` nhường Space/arrows cho grid/button/select; Tab thoát và slide navigation ngoài game vẫn hoạt động. Native button dùng click một lần; action delegation không kích hoạt wrapper khi thao tác cell/form.
- Keyboard alternative bổ sung danh sách word → nhập/chọn start/end coordinates; vẫn chứng minh placement thực tế, không chỉ bấm tên từ để tự hoàn thành.
- Crossword có clue list keyboard chọn entry, arrows chuyển ô, direction toggle tại crossing; word-search có roving focus và region status, không announcer mỗi timer tick.
- Mount dùng session generation phase 04; reset giữ puzzle config/seed và xóa progress; đổi seed chỉ qua authoring explicit, không tự sửa deck khi chơi.

## File inventory

Mỗi CREATE là proposed; mọi file production mới dưới 200 LOC. Các output dependency chỉ MODIFY sau fresh scout xác nhận.

| Full path                                                                             | Action / fact                     | Ownership, size và test impact                                                                            |
| ------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| C:/Work/NavSlidesEditor/shared/src/education/word-graphemes.js                        | CREATE / proposed                 | Domain; NFC/token/grapheme rules; <200 LOC                                                                |
| C:/Work/NavSlidesEditor/shared/src/education/word-puzzle-config.js                    | CREATE / proposed                 | Domain; shared bounds/IDs/errors; <200 LOC                                                                |
| C:/Work/NavSlidesEditor/shared/src/education/crossword-layout.js                      | CREATE / proposed                 | Domain; explicit validator/numbering; <200 LOC                                                            |
| C:/Work/NavSlidesEditor/shared/src/education/crossword-generator.js                   | CREATE / proposed                 | Domain; bounded seeded search; <200 LOC                                                                   |
| C:/Work/NavSlidesEditor/shared/src/education/word-search-generator.js                 | CREATE / proposed                 | Domain; all-word placement/budget; <200 LOC                                                               |
| C:/Work/NavSlidesEditor/shared/src/education/word-search-selection.js                 | CREATE / proposed                 | Domain; paths/completion reducer; <200 LOC                                                                |
| C:/Work/NavSlidesEditor/shared/src/education/browser/crossword-presenter.js           | CREATE / proposed                 | Domain; clue/cell DOM; <200 LOC                                                                           |
| C:/Work/NavSlidesEditor/shared/src/education/browser/word-search-presenter.js         | CREATE / proposed                 | Domain; grid/list DOM; <200 LOC                                                                           |
| C:/Work/NavSlidesEditor/shared/src/education/browser/word-grid-controls.js            | CREATE / proposed                 | Domain; pointer/keyboard/IME; <200 LOC                                                                    |
| C:/Work/NavSlidesEditor/client/src/components/properties/word-puzzle-properties.jsx   | CREATE / proposed                 | Domain; complete layout/seed/direction controls; <200 LOC                                                 |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx          | MODIFY / known :9-20              | Integration owner; route authoring at sequential checkpoint; use actual phase 03 split route when present |
| C:/Work/NavSlidesEditor/shared/src/education/browser/mount.js                         | MODIFY / proposed phase 04 output | Integration owner; register presenters without touching renderer monolith                                 |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime.css                      | MODIFY / proposed phase 04 output | Integration owner; grid focus/mobile scroll, no external fonts                                            |
| C:/Work/NavSlidesEditor/shared/tests/education/word-puzzle-layout.test.js             | CREATE / proposed                 | Validator, Unicode, bounded generation invariants                                                         |
| C:/Work/NavSlidesEditor/client/src/components/education/word-grid-interaction.test.js | CREATE / proposed                 | Real DOM focus/input/composition/selection behavior                                                       |
| C:/Work/NavSlidesEditor/tests/e2e/games/education-word-games.spec.js                  | CREATE / proposed                 | Generated Present/share keyboard/touch; <=200 LOC                                                         |
| C:/Work/NavSlidesEditor/tests/e2e/games/education-word-games-file.spec.js             | CREATE / proposed                 | Direct file no-network smoke; <=200 LOC                                                                   |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md                               | MODIFY / known                    | Integration owner after observed implementation smoke                                                     |
| C:/Work/NavSlidesEditor/docs/project-changelog.md                                     | MODIFY / known                    | Integration owner after observed implementation smoke                                                     |

## Tests Before — RED scenarios

Không có test/gate chạy khi author plan. Tạo proposed tests rồi chạy để thu RED consumer-visible, không pin generator source/wording.

- NFC `học` và decomposed equivalent cho cùng cells; `hoc` không thành đáp án `học`; `Đ`/`đ` theo case policy, IME không tạo completion sớm.
- Explicit layout: valid crossing; contradictory crossing; outside grid; duplicate ID/token; parallel overlap; oversized token. Mỗi invalid case có code + entryId + constraint sửa được.
- Generator: cùng seed/config cho cùng grid/placements; mọi authored word đều tìm được theo expected coordinates; operation count không vượt budget kể cả bộ từ khó.
- Oversize/zero allowed directions/word dài hơn mọi selected direction span thất bại ngay; exhausted search không trả partial puzzle hoặc random guaranteed-impossible placement.
- Word-search selection reverse disabled, zigzag, missing cell, overlap đúng/sai, same word submit hai lần; chỉ đúng allowed path mới ghi found một lần.
- Crossword keyboard/click/touch hoàn thành crossing, sửa một ô sai, paste/composition; reset giữa interaction không nhận completion generation cũ.
- Save/reload/duplicate giữ config IDs/seed/layout, nhưng duplicated runtime có progress độc lập và không thay presentation JSON.

## Implementation steps

1. Tạo Unicode/layout/generation RED fixtures có tiếng Việt và contradiction; chọn operations budget deterministic thay timeout hoặc đo wall-clock làm oracle.
2. Viết word-graphemes và config validator dùng cùng limits/UI; nếu thiếu Segmenter thì thực hiện fallback chính xác và tests cùng corpus, không split theo code point.
3. Viết explicit crossword validator trước generator; generator chỉ gọi validator chung trước commit, report actionable errors không fake fallback puzzle.
4. Viết word-search generator với allowed vectors/bounded candidate enumeration/backtracking; commit đủ mọi từ, fill deterministic rồi independent validation.
5. Viết state completion/selection và DOM presenters; correct/wrong/retry/reset/IME/click-start-end/keyboard coordinates đều dùng cùng state transitions.
6. Hoàn thiện authoring entries/clues/coordinates/grid/seed/directions; disable save khi invalid với lỗi gắn đúng field, không chặn giáo viên đọc/sửa bản đã lưu invalid.
7. Integration owner nối authoring route/mount/styles sequentially; không sửa server bootstrap vì modes local-only là contract bắt buộc.
8. Smoke generated localhost/file rồi mới cập nhật docs/changelog; receipt ghi actual seed, layout, browser và interaction path, không chỉ screenshot editor.

## Refactor

Chung tokenization/bounds/error shape giữa hai games; giữ generator riêng theo thuật toán cần thiết. Không tạo abstraction solver framework, network dictionary, custom code execution hoặc live protocol. Xóa dead temporary generation scaffolds sau smoke, giữ behavior tests.

## Tests After — GREEN

Đánh lại tất cả invalid configs và corpus valid cố định; xác minh full placement, unique IDs, intersection consistency, direction adherence, exact completion/score và reset isolation. Không dùng assertion nonempty-grid làm bằng chứng tính đúng puzzle.

## Behavior matrix

| Mức      | Scenario                                       | Kết quả quan sát                                                   |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| Critical | Contradictory/oversize/exhausted configuration | Error có thao tác sửa, không partial puzzle/hang                   |
| High     | Vietnamese NFC/grapheme/IME                    | Một grapheme một ô, dấu giữ nghĩa, input tương đương chấm như nhau |
| High     | Seed + all words + directions + overlap        | Puzzle tái lập, mọi placement hợp lệ, không thiếu từ               |
| High     | Wrong/retry/reset/duplicate completion         | Progress/score nhất quán, saved config bất biến                    |
| Medium   | Keyboard/touch, 320/768/desktop                | Hoàn thành không drag, grid cuộn/controls dùng được                |

## Executable focused commands

Chỉ chạy trong implementation sau khi tạo test files và publish current-phase runtime bằng `npm run vendor` theo contract04; specs tự tạo hasTouch context. Không full suites hoặc build trong lượt planning.

```powershell
npx vitest run shared/tests/education/word-puzzle-layout.test.js client/src/components/education/word-grid-interaction.test.js
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/games/education-word-games.spec.js tests/e2e/games/education-word-games-file.spec.js --project=chromium --workers=1
```

## ACTUAL browser smoke journey

Author một crossword explicit tiếng Việt và một generated crossword; nhập contradiction để thấy error rồi sửa. Author word-search với seed, overlapping words và E/S/NE selected directions; save/reload/undo/duplicate, mở Try và generated `/api/presentations/{id}/present`, hoàn thành bằng clue keyboard rồi touch start/end. Mở hosted share và kiểm tra same puzzle. Mở generated file thật qua `file://` với HTTP/WS bị chặn: điền/pick sai, sửa, hoàn thành, reset và hoàn thành lại. Final normal Download portable closure là gate phase 14; ở đây vẫn phải có actual file receipt, không nhận React-only tests.

## Success criteria + unchecked actionable checklist

- [ ] Explicit crossword và bounded generator xử lý đủ valid/unsatisfiable/oversize/exhausted cases, lỗi hướng dẫn giáo viên sửa được.
- [ ] Word-search đặt đủ mọi từ theo seed/directions, overlap hợp lệ và NFC/grapheme corpus đúng.
- [ ] Keyboard/touch/click hoàn thành bài với retry/reset/idempotent completion trên actual generated HTML/file.
- [ ] UI ghi local classroom mode, không phát socket/network; docs chỉ cập nhật sau smoke; mọi module production mới <200 LOC.

## Security/risks and failure protocol

High (vừa × cao): search combinatorics treo main thread; chặn bằng bounds, operation budget và error đầy đủ, không tăng budget tự động. High (cao × cao): code-point split phá tiếng Việt; NFC + grapheme cùng shared contract và composition tests. High (vừa × cao): generator giấu words chưa đặt; commit atomic chỉ khi validator chứng minh đủ entries. Medium (vừa × vừa): grid lớn khó dùng mobile; scroll region/focus và keyboard coordinate path. Rollback: hoàn nguyên registration/presenters checkpoint cùng nhau, giữ nested config/seed/layout đã lưu, không xóa subtype data; author vẫn mở/sửa deck. Khi lỗi generation/smoke xảy ra, ghi seed/config/expansion count/trace, dừng phase và sửa algorithm/contract; không bỏ từ, mất dấu hoặc trả mẫu puzzle khác để thông qua gate. Facts chưa kiểm chứng tại execution: Segmenter baseline và paths authoring đã split phải được fresh scout khóa trước sửa.

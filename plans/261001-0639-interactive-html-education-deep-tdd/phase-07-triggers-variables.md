---
phase: 7
title: 'Sáu click actions, visibility và biến điểm giới hạn'
status: in_progress
priority: P1
dependencies: [4]
---

# Phase 07 — Triggers và variables

## Execution progress

Triggers/variables implementation slice đã bàn giao. Final receipts còn mở cho authored action/reference roundtrip, effective master/child/fragment visibility, numeric bindings/reset và generated/Share/file keyboard/touch; eligible live authority không được suy từ local variables. [Root progress](./plan.md#execution-progress) giữ current qualification boundary; checklist/FailureProtocol không thay đổi.

## Goal

Tác giả gắn được show/hide/toggle/score-add/score-subtract/reset-slide và quan sát kết quả trong tài liệu Reveal thật, không cần eval hoặc generic workflow engine.
Giữ action navigation hiện có; biến điểm có contract để scoreboard phase 08 bind, không biến mọi block local thành multiplayer.

## Context/evidence

- `C:/Work/NavSlidesEditor/shared/src/element-actions.js:32-57` normalize kind bằng allowlist và reject field không hợp lệ; mở rộng đúng boundary này.
- `C:/Work/NavSlidesEditor/client/src/components/properties/action-controls.jsx:39-58` begin chỉ seed slide/URL và luôn hiện new-window cho nhiều kind; phải tách field theo kind.
- `C:/Work/NavSlidesEditor/shared/src/htmlGenerator.js:195-223` runtime navigation gắn cả click/key; `:34-43,328-349` resolve master và child trước render.
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js:213-219,1036-1050` wrapper chưa có universal ID, action button là sibling; `:1056-1059` editor hidden bị bỏ hẳn.
- `C:/Work/NavSlidesEditor/shared/src/slide-layouts.js:31-50` fixed elements mang `layout-fixed:<layoutId>:<elementId>`; cùng fixed ID xuất hiện trên nhiều effective slides.
- `C:/Work/NavSlidesEditor/client/src/hooks/use-clipboard.js:6-18,67-84,129-144` đã có ID map cho connectors; reuse map thay tạo convention copy riêng.
- `C:/Work/NavSlidesEditor/client/src/hooks/slide-operation-helpers.js:12-54` clone recursive; `C:/Work/NavSlidesEditor/client/src/hooks/use-slide-operations.js:427-441` duplicate child dùng đường khác cần migrate rõ.
- `C:/Work/NavSlidesEditor/shared/tests/action-runtime.test.js:7-14` đang assert source/wording; bỏ test này khi chuyển sang proof runtime behavior, không re-pin chuỗi.

## Deep scout gate

- Mỗi lần executor bắt đầu phase phải grep lại citations, glob các callers action controls/copy/duplicate/detach/layout và đọc code paths hiện tại.
- Trace event thật: native button key có thể sinh click, delegated key hiện tại có thể thực thi đôi; RED phải tái hiện trước khi sửa.
- Kiểm renderers nhận wrap vào node nào và sibling action overlay; visibility phải áp lên cả content/action surface, không chừa hotspot vô hình vẫn active.
- Kiểm runtime-session/reveal-lifecycle phase 04: một deck variable store cho mỗi document mount, slide state riêng theo effective slide và element ID.
- Scout current Presentation persistence/validation và history/undo; không thêm process/global singleton hoặc thay lưu runtime score vào deck JSON.

## Requirements

- Chỉ sáu action mới `show`, `hide`, `toggle`, `score-add`, `score-subtract`, `reset-slide`; không play-media, selector expression, JS, conditional chain.
- `initialVisibility` dành cho target có thể chơi; editor `hidden` vẫn bỏ khỏi export và không thể show target không tồn tại.
- Fragment gate AND trigger visibility; Show không reveal fragment chưa đến, Hide không xóa progress của game.
- ID scoping đúng top-level/vertical/master, copy/paste/duplicate/detach remap references; missing target báo actionable, không trúng slide khác.
- Variables hữu hạn/bounded numeric, authoring có initial/min/max; binding contract đọc score bằng textContent và subscribe cleanup.
- Reset slide chỉ reset state/lifecycle của slide đang effective; không reset deck variables trừ author bật tùy chọn rõ ràng.

## Architecture/contracts

- Action payload visibility `{kind:'show'|'hide'|'toggle',targetElementId,label?,hotspot?}`; target chỉ element ID trong effective slide, không CSS selector.
- Score payload `{kind:'score-add'|'score-subtract',variableId,amount,label?,hotspot?}`; amount finite dương ≤1,000,000, chỉ +/- theo kind.
- Reset payload `{kind:'reset-slide',resetVariables?:boolean,label?,hotspot?}`; default false, true reset deck variables về authored initial values và UI cảnh báo phạm vi deck.
- Presentation proposed field `interactionVariables:[{id,name,initialValue,min,max}]`, tối đa 32 biến, IDs unique; name plain text ≤80 ký tự.
- Numeric invariant: finite -1,000,000,000 ≤ min ≤ initialValue ≤ max ≤ 1,000,000,000; malformed import không silently convert NaN/Infinity thành điểm.
- Runtime clamp `nextValue = min(max,currentValue ± amount)`; số thập phân hữu hạn được phép, render nhất quán, reject fields/IDs không khai báo.
- `initialVisibility:'visible'|'hidden'` default visible; omission là visible. Không dùng `hidden` persisted cho câu trả lời cần reveal lúc chơi.
- Effective visibility = element tồn tại AND triggerVisible AND fragmentGate; fragment classes/index vẫn do Reveal quản lý, runtime không rewrite class để vượt gate.
- Gắn escaped `data-ns-element-id` cho wrapper và association của sibling surface; section effective slide có scoped ID riêng, lookup map theo section chứa source.
- Xây map bằng DOM attributes/Map, không interpolate ID vào querySelector hoặc CSS; master references resolve raw ID sang fixed effective ID tại export boundary.
- `resolveEffectiveElements` known tại `C:/Work/NavSlidesEditor/shared/src/slide-layouts.js:31` là nơi map inherited references; master không giữ state giữa hai slide dùng chung layout.
- Copy nhiều elements remap cả source lẫn selected target qua một idRemap; giữ target ngoài selection chỉ khi target tồn tại trên destination effective slide, nếu không unresolved.
- Duplicate top-level/child remap local targets trong clone; fixed targets giữ layout effective ID scoped theo slide; detach map fixed IDs mới và action refs cùng pass.
- Callers phải chạm: paste `C:/Work/NavSlidesEditor/client/src/hooks/use-clipboard.js:54`, duplicate `:105`, clone `C:/Work/NavSlidesEditor/client/src/hooks/slide-operation-helpers.js:12`, child duplicate `C:/Work/NavSlidesEditor/client/src/hooks/use-slide-operations.js:427`, detach `C:/Work/NavSlidesEditor/shared/src/slide-layouts.js:85`.
- Fresh scout bổ sung từng caller phát hiện thêm với file:line trước code; không giả danh sách hiện tại bao phủ paths chưa trace.
- Điểm deck thuộc runtime-session của document; score observer proposed `{read(variableId),change(variableId,delta),reset(),subscribe(listener)}` nội bộ, không public generic expression API.
- Scoreboard phase 08 nhận variable ID và runtime store thật; phase này test subscriber cập nhật khi action thực thi, không tạo scoreboard giả để claim UI.
- Reset-slide tăng slide generation, cancel feedback/timers/listeners của slide, trở lại initialVisibility/fragment baseline và reset mounted activities trên slide.
- Reset không navigate sang slide khác, không xóa state slide khác, không đổi saved config; full replay của phase 04 reset session/deck generation riêng.
- Native buttons dùng click activation một lần cho pointer/Enter/Space; nếu non-button accessible surface cần key adapter thì chặn synthetic duplicate/repeat có chủ đích.
- Integration owner scope/chained keyboardCondition theo Reveal 6.0.2 (`C:/Work/NavSlidesEditor/shared/src/reveal-runtime-assets.js:3`), nhường phím cho playable root, không global keyboard=false và giữ navigation bên ngoài.
- Delegation closest([data-ns-action]) không chiếm button/select/form con của activity; RED Space/arrows trong quiz/card phải chỉ đổi widget, Tab ra ngoài rồi deck navigation vẫn hoạt động.
- Editor canvas inert: click/select/Enter không mutate runtime variables/visibility; Try/Present là nơi action thực thi.
- Authority resolves PER capability, not document live query: bounded interactionVariables, score-add/subtract and classroom-local scoreboard bindings stay local to the presenter document even in a live-enabled deck. Eligible live-game score/deadline commands alone use authoritative12/13 and become read-only on disconnect; variableId is never implicitly a game/player score key. No variable synchronization protocol is claimed.
- Data flow: authored config → shared validation/normalization → scoped ID remap → DOM activation → bounded presenter-document variable reducer → bindings/textContent/ARIA; eligible game commands follow their separate transport authority.

## File inventory

| Full path                                                                                       | Action / evidence         | Ownership, size và test impact                                                                                                                  |
| ----------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| C:/Work/NavSlidesEditor/shared/src/education/interaction-variables.js                           | CREATE proposed           | Numeric normalize/reducer/store contract; <200 LOC                                                                                              |
| C:/Work/NavSlidesEditor/shared/src/education/interaction-actions.js                             | CREATE proposed           | Sáu reducers/actions, không eval; <200 LOC                                                                                                      |
| C:/Work/NavSlidesEditor/shared/src/education/interaction-references.js                          | CREATE proposed           | Remap/scoped IDs thuần dùng chung; <200 LOC                                                                                                     |
| C:/Work/NavSlidesEditor/shared/src/education/browser/interaction-presenter.js                   | CREATE proposed           | Delegation/visibility/reset DOM; <200 LOC mỗi split                                                                                             |
| C:/Work/NavSlidesEditor/client/src/components/properties/interaction-variable-controls.jsx      | CREATE proposed           | Add/edit/delete variable, bounds và references; <200 LOC                                                                                        |
| C:/Work/NavSlidesEditor/shared/tests/education/interaction-actions.test.js                      | CREATE proposed           | Bounded values, target scope, visibility/reset invariants                                                                                       |
| C:/Work/NavSlidesEditor/shared/tests/education/interaction-references.test.js                   | CREATE proposed           | Clipboard/duplicate/master remapping                                                                                                            |
| C:/Work/NavSlidesEditor/client/src/components/properties/interaction-variable-controls.test.jsx | CREATE proposed           | Field edit/save/reload, invalid draft feedback                                                                                                  |
| C:/Work/NavSlidesEditor/tests/e2e/games/interaction-actions.spec.js                             | CREATE proposed           | Six actions qua UI và generated browser; ≤200 LOC                                                                                               |
| C:/Work/NavSlidesEditor/tests/e2e/games/interaction-actions-file.spec.js                        | CREATE proposed           | Portable file cùng actions, blocked network; ≤200 LOC                                                                                           |
| C:/Work/NavSlidesEditor/shared/src/element-actions.js                                           | MODIFY known :32          | Integration owner mở strict kind/field schemas serial                                                                                           |
| C:/Work/NavSlidesEditor/shared/src/types/presentation.js                                        | MODIFY known :17-43,332   | Integration owner thêm action/visibility/variables contract                                                                                     |
| C:/Work/NavSlidesEditor/server/middleware/schemas.js                                            | MODIFY known :107-122     | Integration owner07; same shared interactionVariables validator in create/update schemas, no passthrough bypass                                 |
| C:/Work/NavSlidesEditor/server/routes/presentations.js                                          | MODIFY known              | Validate complete merged deck/action/binding references before persisting partial updates; do not validate PATCH against an incomplete document |
| C:/Work/NavSlidesEditor/server/services/project-import-archive-validation.js                    | MODIFY known :57-60       | Existing create-schema admission consumes same field/reference validator; no duplicated variable schema                                         |
| C:/Work/NavSlidesEditor/server/routes/interaction-variable-validation.test.js                   | CREATE proposed           | Real create/update/import valid32, invalid33/duplicate/nonfinite/reversed bounds and unknown references; <=200 LOC                              |
| C:/Work/NavSlidesEditor/shared/src/htmlGenerator.js                                             | MODIFY known :195,281,344 | Integration owner nối one runtime dispatch, section scope                                                                                       |
| C:/Work/NavSlidesEditor/shared/src/element-renderers.js                                         | MODIFY known :1036        | Integration owner universal ID + surface association                                                                                            |
| C:/Work/NavSlidesEditor/shared/src/slide-layouts.js                                             | MODIFY known :31,85       | Integration owner master/detach reference normalization                                                                                         |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime-entry.js                           | MODIFY proposed phase 04  | Integration owner import controller serial                                                                                                      |
| C:/Work/NavSlidesEditor/shared/src/education/runtime-session.js                                 | MODIFY proposed phase 04  | Integration owner deck store lifetime và scoped reset                                                                                           |
| C:/Work/NavSlidesEditor/client/src/components/properties/action-controls.jsx                    | MODIFY known :39          | Integration owner nối fields đúng kind, initialVisibility                                                                                       |
| C:/Work/NavSlidesEditor/client/src/components/PropertiesPanel.jsx                               | MODIFY known :206         | Integration owner compose action/variable controls sau fresh scout                                                                              |
| C:/Work/NavSlidesEditor/client/src/hooks/use-clipboard.js                                       | MODIFY known :54,105      | Integrator reuse ID map cho action refs                                                                                                         |
| C:/Work/NavSlidesEditor/client/src/hooks/slide-operation-helpers.js                             | MODIFY known :12          | Integrator recursive clone remap                                                                                                                |
| C:/Work/NavSlidesEditor/client/src/hooks/use-slide-operations.js                                | MODIFY known :427         | Integrator duplicate child dùng same helper                                                                                                     |
| C:/Work/NavSlidesEditor/shared/tests/action-runtime.test.js                                     | DELETE known :7-14        | Source/wording assertions obsolete; replacement hành vi ở proposed tests                                                                        |
| C:/Work/NavSlidesEditor/docs/project-changelog.md                                               | MODIFY known              | Sau successful smoke, không sửa trong planning                                                                                                  |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md                                         | GENERATED known           | Không hand-edit; phase 16 regenerate từ fresh receipts và đúng scope                                                                            |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/feature-manifest.json                         | MODIFY known :125         | Integration owner khai báo proposed game.interactions capability serial                                                                         |

## Tests Before — RED

Không chạy gate lúc lập plan. CREATE tests proposed rồi thực thi RED khi code được phép, ghi expected/observed thực.

- Click, Enter và Space mỗi lần đúng một delta; held repeat không double-apply synthetic click; editor click không thực thi.
- Target initial hidden + unrevealed fragment: Show vẫn invisible; reveal fragment mới thấy, Hide rồi fragment change không tự hiện lại.
- Hidden editor không có target; stale ID không trúng ancestor/child/master slide khác; source button hidden không còn focus/click surface.
- Copy source+target, chỉ source, duplicate slide có child, duplicate child riêng và detach master giữ reference semantics, không mutation original.
- Score clamp min/max, NaN/Infinity, thiếu variable ID, extra field/selector string bị reject; binding observer nhận bounded value thật.
- API/import admission rejects33 variables, duplicate IDs, nonnumeric/nonfinite values, reversed min/initial/max and unknown action/binding variable references in the COMPLETE deck. Valid32 saves/reloads; legal partial update retains valid omitted existing references rather than failing against the partial body.
- Local variable action in a live-enabled document updates its store; eligible disconnected live game still cannot mutate score. Full two-scoreboard visual agreement is exercised by08/13 after those consumers exist, not a fake board in07.
- Reset current slide khôi phục visibility/progress, không reset deck score hay slide khác; explicit resetVariables true thì reset đúng toàn deck.
- Exit/return giữ activity progress; pending timeout generation cũ sau reset không đổi target hay cộng điểm.

## Implementation steps

1. Tạo RED reducer/reference/browser fixtures với hai top-level, một vertical child và cùng master; ghi geometry/visibility/counter trước và sau actions.
2. Implement shared variable normalization/validation and safe action payloads; integrate API create/update schemas and project admission, validate complete merged references before save. Preserve eight old actions and reject incompatible fields, no duplicate server-only schema.
3. Implement reference helper dùng ID map hiện có; trace và migrate từng caller liệt kê trên, kiểm partial copy và detach bằng JSON roundtrip.
4. Integration owner gắn section/wrapper IDs và cả overlay association; implement fragment AND visibility bằng lớp state riêng cùng Reveal events.
5. Implement deck variable lifetime, subscriber cleanup và scoped reset generation trong runtime phase 04; xử lý missing target bằng accessible feedback.
6. Integration owner nối UI authoring variable/visibility/target controls và runtime entry tuần tự; chọn target chỉ từ effective slide, không nhập selector.
7. Chạy focused proof, actual smoke; sau thành công cập nhật docs/changelog và chuyển binding/authority contract cho phase 08/12/13.
   Sau smoke, changelog ghi behavior đã exercise; manifest/test tags proposed `[cap:game.interactions]` do integration owner nối serial. `C:/Work/NavSlidesEditor/scripts/feature-inventory/build-matrix.mjs:145,188-191` chỉ sinh editor-core matrix; gửi receipts phase 16, không hand-edit output hoặc đổi game scope để né gate.

## Refactor

Một delegated controller mỗi document, một subscription mỗi binding; destroy phải unsubscribe, không thêm listener khi mỗi slide visit.
Chuyển action runtime duplicate sang controller chung, giữ navigation API Reveal; xóa source-text assertions và obsolete inline branch sau consumer cutover.

## Tests After — GREEN

Chạy lại RED behavior cases với runtime thật; DOM integration dùng document/Reveal lifecycle thật ở E2E, clock fake chỉ cho isolated reducer/timer cleanup.
Verify điểm thể hiện qua observer và phase 08 scoreboard sau DAG tương ứng; live real Socket.IO authority thuộc phases 12/13, không hứa phone-play ở phase này.

## Behavior matrix

| Mức      | Unit                                    | Integration                         | Browser                                                |
| -------- | --------------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| Critical | Clamp + single activation + scope/reset | References qua clone/resolve/detach | Generated Show/Hide/Score/Reset và fragment precedence |
| High     | Invalid IDs/fields + lifetime           | Author edit/save/undo, editor inert | Master + child + duplicate, offline file không network |
| Medium   | Subscription/generation cleanup         | Hide/show giữ progress và bindings  | 320/768/desktop, touch + keyboard, reduced-motion      |

## Focused commands

Test paths proposed phải CREATE trước khi chạy; không project-wide build/test/lint ở checkpoint này.

```powershell
npx vitest run shared/tests/education/interaction-actions.test.js shared/tests/education/interaction-references.test.js client/src/components/properties/interaction-variable-controls.test.jsx
npx vitest run server/routes/interaction-variable-validation.test.js
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/games/interaction-actions.spec.js tests/e2e/games/interaction-actions-file.spec.js --project=chromium --workers=1
```

Dùng dev-server lane đã có `C:/Work/NavSlidesEditor/playwright.config.js:120-136`; publish current-phase JS/CSS bằng `npm run vendor` theo contract04 trước smoke, không build/lint toàn repo chỉ để phase qua.

## ACTUAL browser smoke journey

Tác giả tạo shape source + text target + game target, đặt initialVisibility hidden, fragment và đủ sáu actions; sửa bounded deck variables bằng UI rồi save/reload/undo.
Copy nhóm source/target, duplicate top-level/child và detach master; mở Try rồi generated `/api/presentations/:id/present`, kiểm mỗi source chỉ tác động scope đang active.
Enter/Space/touch, Show trước fragment reveal, hide/reveal, cộng/trừ tới min/max, reset current slide và kiểm deck score còn; explicit resetVariables mới xóa deck score.
Mở Share và Download file self-contained theo phase 04, double-click file:// context mới với HTTP/WS blocked; lặp sáu actions, không React-only proof.
Chạy 320/768/desktop và reduced-motion; kiểm target hidden mất focus/hit-testing và focus Reset quay về control hợp lệ.

## Success criteria + unchecked actionable checklist

- [ ] Sáu actions thực thi đủ UI → persisted config → generated document → visible result, mỗi activation đúng một lần.
- [ ] Fragment AND trigger visibility đúng, editor hidden vẫn export omission, hidden overlays không click/focus.
- [ ] Copy/paste/duplicate top-level/child/master/detach đều giữ đúng ID semantics, không tác động slide khác.
- [ ] Numeric variables reject invalid API/import input, clamp valid runtime values and validate complete-deck references; subscribers receive actual score and default reset preserves deck variables.
- [ ] Try/Present/Share/file smoke has keyboard/touch receipts; classroom-local variables remain local in live-enabled decks while disconnected eligible game authority never falls back.
- [ ] Shared controller/reducers <200 LOC mỗi file và docs cập nhật chỉ sau successful smoke.

## Security/risks and failure protocol

High = cao × cao: source/target ID collision từ master; mitigate scoped Map và clone/detach regression, không dùng document-wide first match.
High = cao × cao: keydown + native click double-score; mitigate one activation path, browser Enter/Space receipt, không debounce tùy tiện che lỗi.
High = trung bình × cao: fragment/display conflict và stale reset timers; mitigate two gates, generation cleanup; rollback nối controller trước modules.
Rollback snapshot authored deck, revert chỉ integration/module phase này; giữ optional variables/action data để không phá saved decks, không restore eval/selector workaround.
Failure protocol: checkpoint fail phải giữ failing fixture + expected/observed, re-scout callers/lifetime, sửa root cause rồi targeted re-run; không approve scope leak hoặc reset deck ngoài cấu hình.
Unchecked facts: handler order/keyboardCondition và artifact Reveal 6.0.2 cần fresh browser proof; proposed runtime files phase 04 chưa có evidence trong lượt plan; không có RED/GREEN/browser receipts đã chạy.

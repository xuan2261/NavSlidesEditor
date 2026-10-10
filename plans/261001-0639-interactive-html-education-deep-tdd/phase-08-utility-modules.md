---
phase: 8
title: 'Lucky wheel, countdown và scoreboard dùng chung runtime local'
status: in_progress
priority: P2
dependencies: [3, 4, 7]
---

# Phase 08 — Utility modules

## Execution progress

Wheel/countdown/scoreboard implementation slice đã bàn giao. Cần final authored settings, actual result/deadline/score binding, pause/replay và generated/file accessibility receipts theo checklist. Integration owner đã exercise Scoreboard DOM region repair bằng genuine pointer input trên real generated Present dùng current-source isolated compiled runtime: tăng/giảm0→1→0 bằng Increase rồi Decrease, không có nested inert regions; visual `.tmp/region-input-smoke.png` trong worktree. Scoreboard Reset vẫn pending full-surface journey. Đây không phải published runtime/full frozen-subject hoặc all-surface qualification. [Root progress](./plan.md#execution-progress) giữ observed boundaries, không advertise live utility qualification.

## Goal

Tác giả thêm và chỉnh sửa được lucky-wheel, countdown, scoreboard; ba module chơi thực trên Try/Present/Share/portable HTML bằng shared DOM runtime.
Đây là local classroom utilities. Không quảng bá phone participation hoặc multiplayer; bounded score/timer session chỉ được nối khi phase 12/13 có authority thật.

## Context/evidence

- `C:/Work/NavSlidesEditor/client/src/constants/game-element-types-constants.js:58-76` name-picker có weighted nhưng chưa authored per-item weight; factory nested tại `:207-229` là pattern cần reuse.
- `C:/Work/NavSlidesEditor/server/services/game-room-manager-singleton-service.js:656-669` picker hiện chọn uniform và splice room.items; không dùng implementation này làm bằng chứng weighted đã chạy.
- `C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx:48-59` authoring picker là comma-text và timer generic; cần panel structured thật, không chỉ đăng ký catalog.
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js:956-1004` game export còn static placeholder; `C:/Work/NavSlidesEditor/server/routes/presentations-extras.js:97-116` Present tiêu thụ generated HTML.
- Phase 03 cung cấp weighted-picker/catalog/schema; phase 04 cung cấp runtime-session, mount, reveal-lifecycle, deadline-clock; phase 07 cung cấp bounded variables và reset contract.
- Đọc GameFixScout và PresentRuntimeScout; tên phase 03/04 modules dưới đây là proposed prerequisite, phải xác minh trên code sau khi dependencies hoàn tất.

## Deep scout gate

- Fresh glob/grep code, registry defaults/capabilities, weighted-picker exports, runtime cleanup và variable subscriptions trước implementation.
- Trace Insert → panel nested patches → persisted deck → generated mount; kiểm ba subtypes không làm tăng canonical element count.
- Kiểm deadline-clock dùng monotonic deadline/elapsed và pause remaining, không copy decrement interval hoặc parent.__timerStates.
- Liệt kê consumer weighted-picker/variables/reset trước khi nối; domain module không sửa name-picker gameplay, engine socket hay offlineExport.
- Verify runtime version từ `C:/Work/NavSlidesEditor/shared/src/reveal-runtime-assets.js:3`; Reveal 6.0.2 keyboard button/select có scoped ownership từ phase 04/07.

## Requirements

- Lucky wheel: prize label/weight editable, weight thiếu =1, positive finite; remove picked khi cấu hình, empty state rõ và Reset khôi phục pool authored.
- Countdown: chỉnh duration, Start/Pause/Resume/Reset thật, pause không mất remaining, expiry đúng một lần và không âm.
- Scoreboard: author add/edit/remove/reorder teams, màu/tên/initial score, increments/decrements, bounds/reset và bind deck variable.
- UI edit phải save/reload/undo được; runtime state không ghi đè saved config, duplicate hai block độc lập trừ binding chung chủ ý.
- Pointer/touch/keyboard đủ, feedback accessible và reduced-motion không ảnh hưởng result/expiry/score.

## Architecture/contracts

- Lưu nested configs `element['lucky-wheel']`, `element.countdown`, `element.scoreboard`; không thêm renderer-specific flat aliases.
- Wheel config proposed `{title,items:[{id,label,weight?}],removeAfterPick,animationDuration}`; IDs unique, label plain text, danh sách bounded theo game-schema phase 03.
- Shared positive-weight normalization/picker ở phase 03 là duy nhất; missing=1, zero/negative/NaN/Infinity lỗi actionable, không đổi thành uniform silent fallback.
- Picker lấy random injected trong [0,1); tránh overflow tổng bằng chuẩn hóa theo max weight, đảm bảo item weights extreme vẫn không tạo Infinity.
- Reducer dùng item IDs, result `{id,label}`; selection và removal commit atomically đúng một lần, animation chỉ trình bày kết quả đã chọn.
- Khi còn một item chọn chắc item đó; pool rỗng disable Spin và hiện đã hết, không trả winner undefined; Reset phục hồi original IDs/weights/pool.
- Hai click Spin trong animation không hai lượt; reset/destroy generation cũ không phát confetti/result hoặc remove thêm. Reduced-motion hiển thị kết quả ngay với cùng transition.
- Countdown config proposed `{title,durationSeconds,autoStart,expiryMessage}`; duration integer 1..86400, autoStart default false, expiryMessage plain text.
- State `{phase:'idle'|'running'|'paused'|'expired',remainingMs,deadline,generation}`; `remaining = max(0, deadline - clock.now())` khi running.
- Start từ idle; Pause snapshot remaining; Resume tạo deadline mới từ remaining; Reset về authored duration và idle, không auto-resume trừ autoStart authored.
- Callback expiry chỉ chấp nhận đúng generation và running với remaining=0; delayed callback sau pause/reset không fire; expired không Resume nếu chưa Reset.
- Local slide leave/hide pause ngay, return/show resume nếu trước đó running; user-paused vẫn paused; live authoritative deadlines không pause theo local slide.
- Timer tick chỉ vẽ thời gian, không aria-live spam; expiry báo polite một lần. Duration/Start/Pause/Reset đều nhìn thấy và điều chỉnh được, không blanket timing exemption.
- Scoreboard config proposed `{title,teams:[{id,name,color,initialScore,variableId?}],step,minScore,maxScore,resetBoundVariables}`; IDs stable, tên/color theo existing safety.
- Bounded finite score/step dùng contract phase 07; step dương, unbound score clamp theo minScore/maxScore, bound score clamp theo variable min/max.
- Unbound initialScore thuộc config; bound initial lấy deck variable initialValue, không tạo điểm thứ hai trong team. Không cho panel chỉnh hai initial sources xung đột.
- +/- runtime gọi một shared reducer/store; score display dùng textContent, role=status cập nhật aggregate vừa đủ; không cộng điểm từ render effect.
- Hai scoreboard bind cùng variable phải thấy cùng score ngay; subscribe unsubscribe đúng mount/destroy, không hai notification/mutation mỗi visit.
- Reset scoreboard xóa unbound scores về authored initial, default giữ bound deck variables; `resetBoundVariables:true` reset chỉ variable IDs bound bởi board, UI xác nhận phạm vi rõ.
- Reset-slide từ phase 07 reset local wheel/timer/unbound scoreboard nhưng không reset deck variable mặc định; full replay dùng session generation và deck reset của phase 04.
- Config editing và runtime state tách biệt: runtime +/- không đổi team.initialScore trong saved deck, author undo không chứa spins/remaining/score.
- Catalog capability ba utility subtypes is classroom-local, including live-enabled decks: wheel/timer/scoreboard and presentation variable bindings never provision phone rooms or implicitly send variableId to a game-score service.
- Eligible live-game score/deadline authority is a separate12/13 contract. This plan does not implement synchronized utility/variable service; mixed-mode smoke proves local boards update together while disconnected eligible game mutations stay read-only.
- Data flow wheel: config → weighted-picker → atomic pool/result → DOM wheel/status; countdown: duration + monotonic clock → lifecycle state → display/expiry; scoreboard: teams/bindings → variable/local reducer → score DOM.
- Thin React Try adapter phase 04 mount cùng ba presenters; editor canvas chỉ snapshot inert. PPTX/PDF chỉ wheel/pool/timer/scoreboard snapshot thực, không claim tương tác.

## File inventory

| Full path                                                                            | Action / evidence        | Ownership, size và test impact                                         |
| ------------------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------- |
| C:/Work/NavSlidesEditor/shared/src/education/utility-config.js                       | CREATE proposed          | Compose ba config từ schema phase 03; <200 LOC                         |
| C:/Work/NavSlidesEditor/shared/src/education/lucky-wheel-state.js                    | CREATE proposed          | Pool/result/reset reducer, reuse weighted picker; <200 LOC             |
| C:/Work/NavSlidesEditor/shared/src/education/countdown-state.js                      | CREATE proposed          | Deadline/pause/expiry reducer; <200 LOC                                |
| C:/Work/NavSlidesEditor/shared/src/education/scoreboard-state.js                     | CREATE proposed          | Team scoring/binding/reset; <200 LOC                                   |
| C:/Work/NavSlidesEditor/shared/src/education/browser/lucky-wheel-presenter.js        | CREATE proposed          | DOM spin/status với cleanup; <200 LOC                                  |
| C:/Work/NavSlidesEditor/shared/src/education/browser/countdown-presenter.js          | CREATE proposed          | Actual controls/remaining/expiry; <200 LOC                             |
| C:/Work/NavSlidesEditor/shared/src/education/browser/scoreboard-presenter.js         | CREATE proposed          | Teams +/-/bindings, textContent; <200 LOC                              |
| C:/Work/NavSlidesEditor/client/src/components/properties/lucky-wheel-properties.jsx  | CREATE proposed          | Structured prizes/weights/removal; <200 LOC                            |
| C:/Work/NavSlidesEditor/client/src/components/properties/countdown-properties.jsx    | CREATE proposed          | Duration/autostart/expiry settings; <200 LOC                           |
| C:/Work/NavSlidesEditor/client/src/components/properties/scoreboard-properties.jsx   | CREATE proposed          | Teams/bounds/binding/reset settings; <200 LOC                          |
| C:/Work/NavSlidesEditor/shared/tests/education/utility-modules.test.js               | CREATE proposed          | Weighted/reset/deadline/score invariants; split ≤200 LOC               |
| C:/Work/NavSlidesEditor/client/src/components/properties/utility-properties.test.jsx | CREATE proposed          | UI edits persist nested fields and IDs                                 |
| C:/Work/NavSlidesEditor/tests/e2e/games/utility-modules.spec.js                      | CREATE proposed          | Authoring/Present/Share utility outcomes; ≤200 LOC                     |
| C:/Work/NavSlidesEditor/tests/e2e/games/utility-modules-file.spec.js                 | CREATE proposed          | File export chơi ba modules với network blocked; ≤200 LOC              |
| C:/Work/NavSlidesEditor/shared/src/education/weighted-picker.js                      | REUSE proposed phase 03  | Không tạo picker mới, không phụ thuộc phase 05                         |
| C:/Work/NavSlidesEditor/shared/src/education/browser/deadline-clock.js               | REUSE proposed phase 04  | Monotonic scheduler/lifecycle contract                                 |
| C:/Work/NavSlidesEditor/shared/src/education/interaction-variables.js                | REUSE proposed phase 07  | Shared store và numeric bounds                                         |
| C:/Work/NavSlidesEditor/shared/src/education/game-registry.js                        | MODIFY proposed phase 03 | Integration owner nối capabilities/defaults serial                     |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime-entry.js                | MODIFY proposed phase 04 | Integration owner compose presenters serial                            |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx         | MODIFY known :27         | Integration owner routes three panels, không domain monolith edit      |
| C:/Work/NavSlidesEditor/shared/src/element-renderers.js                              | MODIFY known :956        | Integration owner playable/public static snapshots                     |
| C:/Work/NavSlidesEditor/docs/project-changelog.md                                    | MODIFY known             | Chỉ sau successful implementation smoke                                |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md                              | GENERATED known          | Không hand-edit; phase 16 regenerate từ fresh receipts đúng game scope |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/feature-manifest.json              | MODIFY known :125        | Integration owner khai báo proposed game.utilities capability serial   |

## Tests Before — RED

Chưa thực thi trong planning. CREATE proposed tests trước production code, ghi behavioral failures chứ không assert catalog label/source text.

- Weighted draw với deterministic random ở từng cumulative boundary, missing weights, very small/large weights, invalid values; remove tới empty rồi Reset phục hồi.
- Reset giữa animation, double Spin và hai mounts: mỗi result/removal đúng một lần và không ảnh hưởng pool block khác.
- Countdown drift/delayed tick, pause ngay trước deadline, repeated Start/Resume, expiry đúng một lần, reset expiry và stale callback generation.
- Hide/leave rồi return: local remaining giữ nguyên pause; manual paused không tự chạy; hai countdown khác duration không đổi lẫn nhau.
- Scoreboard +/- ở min/max, decimal finite, unknown binding, same-variable two boards, reset mặc định/explicit, score saved deck không mutate.
- Panel thật đổi label/weight/team names/colors/duration/binding rồi save/reload/undo; nested fields không mất và IDs không đổi khi reorder.
- Browser Space/Enter native controls không đổi Reveal slide hoặc duplicate score; ngoài root deck navigation vẫn chạy.

## Implementation steps

1. Fresh scout prerequisites và dựng RED fixture ba modules, hai boards binding chung, hai timers và extreme picker weights.
2. Implement configs/state thuần; wheel import weighted-picker phase 03, countdown import deadline clock phase 04, scoreboard import variable store phase 07.
3. Implement wheel DOM và removal/reset; chỉ animation từ state result, không chọn lại lúc transitionend; reduced-motion dùng cùng commit.
4. Implement countdown controls với phase transition explicit, expiry invariant và lifecycle pause/resume/generation cleanup.
5. Implement scoreboard visible +/-/Reset và subscription thật; giữ unbound local state tách deck bound store, không effect-based score increments.
6. Tạo ba authoring panels với field-level errors, reorder ổn định ID và binding choices; integration owner nối panel/catalog/runtime/snapshots tuần tự.
7. Chạy targeted proof/browser/file smoke, cập nhật docs/changelog sau receipts; không chỉnh engine hoặc advertise live utility khi authority chưa verified.
   Sau smoke cập nhật changelog cùng manifest/test tags proposed `[cap:game.utilities]`, chuyển receipts cho phase 16. `C:/Work/NavSlidesEditor/scripts/feature-inventory/build-matrix.mjs:145,188-191` sinh editor-core output; không hand-edit matrix hay chuyển game scope để giả coverage.

## Refactor

Không duplicate weighted picker hoặc timer reducer từ React games. Mỗi production module <200 LOC; split cohesive config/presenter helpers nếu cần, không generic widget engine.
Xóa placeholder assertions cho ba subtypes bị cutover; không thay thành “có runtime string” hoặc wiring-only tests.

## Tests After — GREEN

Đối chiếu exact selected IDs, remaining deadlines, expiry count và observed scores; dùng fake clock/random chỉ unit, browser dùng controls/runtime thật.
Run actual generated document để chứng minh listener/subscription cleanup sau nhiều lần leave/return/reset; không coi jsdom panel test là Present proof.

## Behavior matrix

| Mức      | Unit                                            | Integration                           | Browser                                               |
| -------- | ----------------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| Critical | Weighted/remove/reset, expiry once, score clamp | Real reducers + store + lifecycle     | Spin/Pause/Resume/+/-/Reset kết quả đúng              |
| High     | Stale generation + shared binding               | Author save/reload/undo và two mounts | Local file không HTTP/WS; hidden timers pause đúng    |
| Medium   | Decimal display + reduced-motion state          | Snapshot public với dữ liệu thật      | 320/768/desktop, touch, Tab/Enter/Space, focus/status |

## Focused commands

Chỉ khi implementation được phép; CREATE test files proposed trước, prerequisites phải hoàn tất. Không build/lint/suite toàn repo tại phase này.

```powershell
npx vitest run shared/tests/education/utility-modules.test.js client/src/components/properties/utility-properties.test.jsx
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/games/utility-modules.spec.js tests/e2e/games/utility-modules-file.spec.js --project=chromium --workers=1
```

Runner thật `C:/Work/NavSlidesEditor/playwright.config.js:120-136` tạo isolated localhost/data; phase 04 vendor phải staged trước khi browser chạy.

## ACTUAL browser smoke journey

Qua Insert/panels, tác giả nhập ba prizes weights khác nhau và removal, countdown duration ngắn, hai teams và một binding deck variable; save/reload/undo/duplicate.
Mở Try, generated `/api/presentations/:id/present` và Share: Spin đến pool empty, Reset; Start/Pause/leave/return/Resume/expiry/Reset; +/- scores và trigger score-add phase 07 cập nhật hai bound boards.
Reset-slide phải phục hồi wheel/timer/unbound score nhưng giữ bound deck score; explicit reset setting mới reset binding, saved deck initial values không thay đổi.
Download HTML self-contained theo phase 04, mở file:// context mới chặn HTTP/WS rồi lặp đủ control; không room retry hay thông báo multiplayer không tồn tại.
Ở 320/768/desktop và hasTouch: labels/targets/focus thật, Space không advance slide, Tab thoát rồi navigation vẫn hoạt động; reduced-motion wheel vẫn một result/removal.
Role=status thông báo result/expiry/score mà không cướp focus; không announce timer mỗi tick. Ghi browser receipts và observed remaining/score sau reset.

## Success criteria + unchecked actionable checklist

- [ ] Prizes/weights/removal và teams/duration/bindings thực sự chỉnh bằng UI, save/reload/undo không mất dữ liệu.
- [ ] Wheel weighted selection dùng shared picker, remove đúng ID đến empty, Reset phục hồi không callback cũ.
- [ ] Countdown pause/resume/reset và expiry invariant đúng cả delayed clock và generated document leave/return.
- [ ] Scoreboard +/-/bindings/reset đúng bounds, hai binding views đồng bộ local, runtime không mutate saved deck.
- [ ] Try/Present/Share/file:// parity đủ controls, không HTTP/WS/local parent globals, không claim multiplayer.
- [ ] Keyboard/touch/reduced-motion và feedback có actual smoke; integration owner/docs checkpoint xong sau proof.

## Security/risks and failure protocol

High = trung bình × cao: floating-weight overflow/bias; mitigate scaled weighted picker boundary tests, không fallback uniform hoặc dùng roulette animation để chọn.
High = cao × cao: timer drift/stale callback làm expiry hai lần; mitigate monotonic deadline + generation + hide/leave lifecycle proof.
High = trung bình × cao: bound scoreboard tạo shadow score hoặc reset deck bất ngờ; mitigate single variable store, explicit resetBoundVariables và two-board smoke.
Rollback tách registry/runtime imports ba subtypes rồi revert modules/panels của phase này; snapshot saved deck trước cutover, giữ known configs và không quay lại broken fake play.
Failure protocol: dừng checkpoint module lỗi, ghi seed/clock/action sequence/expected/observed; re-scout store/lifecycle boundary, sửa root cause và re-run focused cases trước approve.
Unchecked facts: shared weighted-picker/deadline/variables API phải verify sau phases 03/04/07; portable recursive media closure cuối thuộc phase 14; chưa có test/browser receipt trong planning.

---
phase: 9
title: 'Memory và flashcards với shared DOM, accessibility và reset an toàn'
status: in_progress
priority: P2
dependencies: [3, 4]
---

# Phase 09 — Memory và flashcards

## Execution progress

Memory/flashcards implementation slice đã bàn giao. Bounded imported-file smoke đã quan sát native images của hai memory sides và flashcard back; không thay full author/history, mismatch/flip/navigation, pending-reset, concealed accessibility/AT và per-surface receipts trong checklist. [Root progress](./plan.md#execution-progress) giữ proof boundary; acceptance chưa đóng.

## Goal

Hai educational blocks `gameType:'memory'` và `gameType:'flashcards'` có authoring panels đầy đủ và chơi được bằng cùng shared DOM trong Try, generated Present, Share và file:// local.
Giữ progress/cleanup/reset nhất quán cho nhiều blocks; đây là classroom-local, không thêm room hoặc phone-play không được hỗ trợ.

## Context/evidence

- `C:/Work/NavSlidesEditor/client/src/constants/game-element-types-constants.js:6-18,207-229` catalog hiện có mười discriminator và factory config nested; schema/catalog phase 03 mở rộng tới 19 subtypes.
- `C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx:27-45,125-159` subtype selector/content routing và nested patch là đường authoring thật cần nối.
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js:956-1004` exported game chưa playable; `C:/Work/NavSlidesEditor/server/routes/presentations-extras.js:97-116` chứng minh Present là generated document.
- `C:/Work/NavSlidesEditor/shared/src/content-safety.js:36-50` kiểm/normalize media scheme; dùng same boundary cho images, không cho inline event/unsafe image URLs.
- `C:/Work/NavSlidesEditor/shared/src/slide-layouts.js:31-50` master có fixed IDs lặp qua slides; mount isolation phải gồm effectiveSlideId, không key elementId toàn document.
- `C:/Work/NavSlidesEditor/shared/src/reveal-runtime-assets.js:3` là Reveal 6.0.2; đọc research/learning-accessibility-research.md cho button keyboard và concealed card accessibility.
- Runtime API/lifecycle/config registry thuộc phases 03/04 là proposed prerequisite, chưa coi implementation tồn tại ở thời điểm plan.

## Deep scout gate

- Trước code fresh glob/grep lại sources trên, registry capabilities/defaults và mount/runtime-session/reveal-lifecycle/deadline-clock đã triển khai.
- Trace authoring → save/history/duplicate → mount thật; không dùng React presenting branch không có caller để tuyên bố Present hoạt động.
- Kiểm lifecycle initial ready, active slide, vertical/master scope, hidden root/accessibility tree và destroy callback identity.
- Kiểm question/card media validation/offline required assets để text/image được portable; không làm thêm parser arbitrary HTML cards.
- Chốt state lifetime `(document mount,effectiveSlideId,elementId,generation)`, không module singleton, không mutable config nằm trong store deck.

## Requirements

- Memory author paired cards bằng text/image với alt; flip/reveal, pair acceptance, mismatch lock/unlock, reset và score idempotent.
- Flashcards author front/back bằng text/image với alt; Flip, Next, Previous, Shuffle, progress và Reset đủ điều khiển.
- Nội dung ẩn không lộ qua accessible label/alt/DOM accessibility tree; progress/feedback không chỉ dựa màu/animation.
- Hide/slide leave giữ progress, pause local delayed mismatch rồi resume remaining; reset/replay/destroy hủy callback/listeners/pointer capture.
- Nhiều memory/flashcards trên một slide và cùng master nhiều slide độc lập; keyboard/touch/reduced-motion có behavior parity.

## Architecture/contracts

- Content canonical proposed `{type:'text',text}` hoặc `{type:'image',src,alt}`; plain text, safe image URL và meaningful alt, không arbitrary script/HTML card.
- Memory config nested `{title,pairs:[{id,first:content,second:content}],shuffleOnStart,mismatchDelayMs,matchPoints}`; pair IDs unique, 2..24 pairs.
- Memory mismatchDelayMs integer 0..5000, matchPoints integer 1..1000; values/defaults đi qua game-schema phase 03, errors actionable thay silent truncation.
- Tạo runtime card IDs từ `(pairId,side)` ổn định; layout permutation chỉ shuffle IDs, không mutate pair content hoặc saved order.
- State có shuffled order, faceUp IDs tối đa hai unresolved, matched pair IDs, attempts, score, pendingMismatch remaining/generation và revealMode.
- Flip một concealed unmatched card bằng native button click; same card second activation không thành pair/attempt, matched card không cộng lại điểm.
- Chọn card thứ hai commit một attempt; cùng pair ⇒ giữ face up + mark pair matched + cộng matchPoints đúng một lần; khác pair ⇒ lock input đến mismatch timer kết thúc.
- Mismatch callback chỉ generation đang active; đóng đúng hai IDs đã chọn, clear lock, không đóng pair đã accepted; mismatchDelay=0 cũng giữ transition atomic.
- Reveal all là teacher/practice view có control rõ: lộ tất cả content nhưng không mark matched/award score; disable solving khi revealMode, Reset trở lại phiên normal sạch.
- Reset memory: tăng generation, cancel pending delay, score/attempts/matched/faceUp về đầu, tạo order theo shuffleOnStart; không ghi deck và không reset block khác.
- Face-down accessible name chỉ “Thẻ <vị trí>, úp”, không pairId/identity/alt chứa đáp án; content concealed không nằm accessibility tree hoặc tab order.
- Khi face up, text/alt mới được đọc; matched/mismatch feedback qua status polite tạo sẵn, không autofocus feedback. Pair ID trong runtime/offline không được quảng bá là secret.
- Disable/remove current focused card phải đưa focus tới card/control hợp lệ trong block; không trap Tab và không ép focus khi feedback bình thường.
- Flashcards config nested `{title,cards:[{id,front:content,back:content}],shuffleOnStart}`; IDs unique, 1..100 cards; author có add/remove/reorder và media fields hai mặt.
- State flashcards `{order,currentIndex,side:'front'|'back',studiedIds,generation}`; Flip toggle side của card hiện tại, first reveal back thêm ID vào studied một lần.
- Next/Previous nonwrapping, disabled ở boundaries; chuyển card mặc định front, không giữ back side bất ngờ; một card vẫn Flip được, Next/Previous disabled.
- Progress hiển thị vị trí `index+1 / total` và số unique studied/total, không tăng khi cùng card Flip nhiều lần; đây không phải correctness score.
- Shuffle là permutation IDs với random injected, giữ current card ID và studied set, không sửa content; nếu chỉ một card thì không tạo thay đổi giả.
- Reset flashcards đưa studied về empty, current đầu, front và authored/shuffleOnStart order mới; Shuffle/Reset đều feedback status và không tự chuyển Reveal slide.
- Mặt ẩn flashcards có hidden/inert semantics để AT không đọc và controls phía ẩn không focus; Flip/Previous/Next/Shuffle/Reset là native buttons.
- Local leave/hide pause pending memory delay ngay và giữ state; show/return resume đúng remaining nếu root effective-visible, không reset mặc định.
- Fragment AND trigger visibility từ phase 04/07 là input lifecycle; phase này không phụ thuộc 07, dùng interface phase 04, integration 07 gửi visibility khi có.
- Reset/replay/destroy clear scheduler/subscriptions/event listeners với cùng callback identity; stale generation không lật card, tăng score hay announce message.
- Không sở hữu WebSocket/transport ở memory/flashcards; explicit live deck vẫn ghi capability local classroom, không giả đồng bộ bằng shared parent global.
- Data flow: normalized card/pair config → isolated reducer/order → native DOM inputs → transitions/deadline-clock → render visible content/progress/status; saved JSON chỉ config/stable IDs.
- React Try adapter phase 04 và generated HTML mount đúng presenters này; PDF/PPTX snapshots là board/current front thực, không reveal concealed answer mặc định hoặc hứa tương tác.

## File inventory

| Full path                                                                          | Action / evidence        | Ownership, size và test impact                                                |
| ---------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| C:/Work/NavSlidesEditor/shared/src/education/memory-config.js                      | CREATE proposed          | Pair/content composition và bounded settings; <200 LOC                        |
| C:/Work/NavSlidesEditor/shared/src/education/memory-state.js                       | CREATE proposed          | Flip/match/mismatch/reveal/reset reducer; <200 LOC                            |
| C:/Work/NavSlidesEditor/shared/src/education/flashcards-config.js                  | CREATE proposed          | Two-side card composition; <200 LOC                                           |
| C:/Work/NavSlidesEditor/shared/src/education/flashcards-state.js                   | CREATE proposed          | Flip/navigation/shuffle/progress/reset; <200 LOC                              |
| C:/Work/NavSlidesEditor/shared/src/education/card-content.js                       | CREATE proposed          | Shared text/image safety và clone helpers, không renderer duplicate; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/card-content-dom.js           | CREATE proposed          | Shared visible/concealed content/alt DOM; <200 LOC                            |
| C:/Work/NavSlidesEditor/shared/src/education/browser/memory-presenter.js           | CREATE proposed          | Native card grid/status/cleanup; <200 LOC mỗi split                           |
| C:/Work/NavSlidesEditor/shared/src/education/browser/flashcards-presenter.js       | CREATE proposed          | Native two-side controls/progress; <200 LOC                                   |
| C:/Work/NavSlidesEditor/client/src/components/properties/memory-properties.jsx     | CREATE proposed          | Paired content/settings authoring; <200 LOC                                   |
| C:/Work/NavSlidesEditor/client/src/components/properties/flashcards-properties.jsx | CREATE proposed          | Front/back/list/reorder settings; <200 LOC                                    |
| C:/Work/NavSlidesEditor/client/src/components/properties/card-content-fields.jsx   | CREATE proposed          | Shared media/text/alt fields, không gameplay; <200 LOC                        |
| C:/Work/NavSlidesEditor/shared/tests/education/memory-state.test.js                | CREATE proposed          | Idempotent matches, lock/pause/generation/reveal                              |
| C:/Work/NavSlidesEditor/shared/tests/education/flashcards-state.test.js            | CREATE proposed          | Boundaries/permutation/studied/reset                                          |
| C:/Work/NavSlidesEditor/client/src/components/properties/card-properties.test.jsx  | CREATE proposed          | Authored pairs/front/back/alt/reorder persist                                 |
| C:/Work/NavSlidesEditor/tests/e2e/games/memory-flashcards.spec.js                  | CREATE proposed          | Real generated lifecycle/accessibility/multiple blocks; ≤200 LOC              |
| C:/Work/NavSlidesEditor/tests/e2e/games/memory-flashcards-file.spec.js             | CREATE proposed          | Text/image file smoke network blocked; ≤200 LOC                               |
| C:/Work/NavSlidesEditor/shared/src/education/browser/deadline-clock.js             | REUSE proposed phase 04  | Mismatch delay pause/resume, không interval duplicate                         |
| C:/Work/NavSlidesEditor/shared/src/education/browser/reveal-lifecycle.js           | REUSE proposed phase 04  | Visibility/leave/reset/destroy callbacks                                      |
| C:/Work/NavSlidesEditor/shared/src/education/game-registry.js                      | MODIFY proposed phase 03 | Integration owner declare local capabilities/defaults serial                  |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime-entry.js              | MODIFY proposed phase 04 | Integration owner compose presenters serial                                   |
| C:/Work/NavSlidesEditor/client/src/components/properties/game-properties.jsx       | MODIFY known :27,125     | Integration owner nối panels, không domain sửa monolith                       |
| C:/Work/NavSlidesEditor/shared/src/element-renderers.js                            | MODIFY known :956        | Integration owner playable/safe static snapshot                               |
| C:/Work/NavSlidesEditor/docs/project-changelog.md                                  | MODIFY known             | Sau successful smoke, không sửa khi planning                                  |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md                            | GENERATED known          | Không hand-edit; phase 16 regenerate từ fresh receipts, giữ game scope        |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/feature-manifest.json            | MODIFY known :125        | Integration owner khai báo proposed game.cards capability serial              |

## Tests Before — RED

Không chạy tests khi lập plan; executor CREATE proposed tests trước code và ghi failed behavior receipt thực, không fake RED vì module import thiếu.

- Memory same card repeated, matched pair repeated, rapid third card trong mismatch lock, reveal không score, reset sau một flip/pending mismatch/complete.
- Clock chạy pending mismatch rồi pause/advance fake time/return: remaining đúng; Reset/replay/destroy callback generation cũ không lật card hoặc announce/score.
- Hai memory + flashcards cùng slide, duplicate element, master hai slides: result/progress/score/mismatch không bleed sang block khác.
- Flashcards first/last boundaries, one-card deck, Flip nhiều lần, Previous/Next front, Shuffle permutation và giữ current ID/studied set, Reset về 0 studied.
- Concealed card accessibility tree không identity/alt text; flashcard back hidden không đọc/focus; reveal card có correct alt và polite feedback không cướp focus.
- Panel add/edit/delete/reorder text/image pairs và two-side cards, save/reload/undo giữ ID/media/alt/settings, unsafe image URL báo lỗi.
- Generated HTML Space trên card/control chỉ một activation, không advance slide/fragment; Tab thoát và deck navigation ngoài widget còn hoạt động.

## Implementation steps

1. Fresh scout schema/lifecycle và dựng RED deterministic pair/card fixtures, duplicate/master/isolation cases; khẳng định output bằng state/score/DOM interactions.
2. Implement shared card-content cùng config composition, dùng content-safety thật; giữ IDs xuyên edit/reorder/duplicate và không chấp nhận arbitrary HTML scripts.
3. Implement memory reducer idempotent, pending mismatch token và reveal mode; dùng monotonic deadline-clock phase 04 cho remaining, không global timeout map.
4. Implement flashcards reducer front/back, boundaries, shuffle và studied progress; shuffle không tạo ID mới hoặc mutate saved array.
5. Implement shared DOM content và hai presenters với native buttons/status; conceal content đúng accessibility tree, reduced-motion chỉ đổi presentation.
6. Tạo authoring panels/card fields thật; integration owner nối catalog/panels/runtime/snapshots tuần tự sau modules ổn định, không sửa common chokepoints song song.
7. Chạy scoped GREEN và actual browser/file smoke; chỉ sau thành công cập nhật docs/changelog, không báo local cards là multiplayer.
   Sau successful smoke, changelog/manifest cập nhật và tests gắn proposed `[cap:game.cards]`; gửi receipts cho phase 16. `C:/Work/NavSlidesEditor/scripts/feature-inventory/build-matrix.mjs:145,188-191` là generator editor-core, không hand-edit output hoặc đổi game capability sang editor-core để tạo coverage giả.

## Refactor

Shared pure reducers không import DOM/React; content safety không copy giữa memory/flashcards/authoring, DOM helper chịu concealed-visible rendering rõ.
Mỗi new production module <200 LOC; split helper cohesive trước vượt size, không tạo card/game abstraction tổng quát ngoài hai consumers thật.

## Tests After — GREEN

Dùng exact matched IDs, score, lock state, pending remaining, studied IDs và focus/accessible names để chứng minh; test fakes chỉ clock/random isolated.
Browser sử dụng actual generated document và session reset API thật; không mock timer presenter hay ghi assertion label/source-string để thay gameplay.

## Behavior matrix

| Mức      | Unit                                       | Integration                               | Browser                                                    |
| -------- | ------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| Critical | Memory once-only score + stale cleanup     | Reducer/lifecycle nhiều mounts            | Pair/mismatch/reset/exit-return cùng score đúng            |
| High     | Flashcard boundaries/permutation/progress  | Panels → normalized save/reload/undo      | Concealed AT tree, native Space, touch, file image closure |
| Medium   | Reduced-motion invariant + reveal no-score | Public static snapshots không reveal keys | 320/768/desktop, target/focus/status không trap            |

## Focused commands

Proposed tests phải CREATE trước khi chạy khi triển khai; không chạy gates trong lượt lập plan hay project-wide build/lint/suite ở phase này.

```powershell
npx vitest run shared/tests/education/memory-state.test.js shared/tests/education/flashcards-state.test.js client/src/components/properties/card-properties.test.jsx
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/games/memory-flashcards.spec.js tests/e2e/games/memory-flashcards-file.spec.js --project=chromium --workers=1
```

Dùng config localhost/data isolation tại `C:/Work/NavSlidesEditor/playwright.config.js:120-136`; runtime assets phase 04 staged trước smoke, không artifact production stale.

## ACTUAL browser smoke journey

Tác giả Insert memory và flashcards, nhập paired text/image và front/back/alt bằng panels, sửa delay/points/shuffle, save/reload/undo/reorder/duplicate.
Mở Try và generated `/api/presentations/:id/present`: flip đúng pair/sai pair, thử third click lúc lock, reveal, Reset; flash Flip/Next/Previous/Shuffle/progress/Reset.
Rời slide/ẩn root lúc mismatch đang chờ, quay lại sau thời gian dài: giữ tiến độ và remaining local; Reset/replay khi pending rồi đợi, không stale score/reveal/status.
Dùng hai memory và hai flashcards trên cùng slide rồi cùng master ở slide khác để quan sát isolation; mở hosted Share và lặp core transitions.
Download artifact self-contained text/data-image theo phase 04, double-click file:// với HTTP/WS blocked; card ảnh và alt tồn tại, mọi control/reset chạy không socket/parent globals.
320/768/desktop + hasTouch + reduced-motion: đo controls 24×24 CSS px hoặc equivalent, Tab/Space/Enter không đổi slide trong widget, Tab ra ngoài deck navigation còn chạy.
Inspect accessibility tree và manual AT khi có: card úp không đọc identity/alt, mặt hidden không focus, flip đọc đúng content, polite mismatch/match/progress không lấy focus; ghi giới hạn AT chưa exercise.
Recursive uploads/remote media closure cuối gate phase 14; không pass file smoke nếu ảnh bị mất, không bỏ card image khỏi fixture để tránh lỗi.

## Success criteria + unchecked actionable checklist

- [ ] Panels tạo/sửa/reorder/save/reload/undo text/image pairs và front/back đầy đủ, stable IDs/alt/settings còn nguyên.
- [ ] Memory pair acceptance chỉ score một lần, mismatch lock/unlock đúng, reveal không score, Reset không callback stale.
- [ ] Flashcards Flip/Next/Previous/Shuffle/progress/Reset đúng boundaries và unique studied invariant.
- [ ] Hide/leave preserve + pause/return remaining, reset/replay/destroy cleanup, multiple blocks/master isolation có receipts.
- [ ] Try/Present/Share/file:// dùng same DOM gameplay, text/image offline thật và không hứa multiplayer.
- [ ] Concealed accessibility/keyboard/touch/reduced-motion có observed proof; docs chỉ cập nhật sau smoke, new production files <200 LOC.

## Security/risks and failure protocol

High = cao × cao: card úp lộ identity qua label/alt hoặc hidden face focus; mitigate separate concealed rendering và actual accessibility-tree/AT inspection, không CSS opacity-only.
High = cao × cao: mismatch timeout đời cũ lật pair/cộng điểm sau reset; mitigate generation-scoped pending IDs, remaining pause và cleanup proof.
High = trung bình × cao: same master IDs và duplicate mounts bleed state; mitigate effectiveSlide scope + mount identity, two-slide/two-block tests, không singleton card store.
Rollback tháo runtime/catalog/panel imports riêng hai subtypes rồi revert modules phase này, backup authored decks; giữ saved config có IDs, không destructive migration hoặc fake renderer substitution.
Failure protocol: ghi card IDs/seed/clock/action order và expected/observed; dừng checkpoint sai, re-scout lifecycle/content boundary, sửa root cause và targeted re-run trước approval.
Unchecked facts: prerequisite lifecycle/schema module APIs, portable uploads/remote closure và manual AT interoperability phải verify lúc implementation; plan này chưa chạy RED/GREEN/browser/AT.

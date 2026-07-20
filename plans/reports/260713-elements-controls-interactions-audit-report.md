# Audit Elements, Controls, and Editor Interactions

- **Ngày audit:** 2026-07-13
- **Phạm vi:** current working tree; 19 canonical element types; canvas interactions; Properties; Ribbon; keyboard/clipboard/group/history/autosave; vertical child slides; media; import/export; accessibility focus.
- **Chế độ:** read-only đối với source/test/config. Chỉ report này được tạo.
- **Kết quả cuối:** **67 product-reachable findings** — **17 High**, **50 Medium**, không có Critical/Low.
- **Độ tin cậy:** mỗi candidate distinct được 3 verifier độc lập kiểm tra theo reproduce/data-flow/refutation; majority-survives, sau đó coordinator adjudication theo contract và production reachability.

## Executive Summary

Audit chạy 11 hướng độc lập, thu 80 candidate records, hợp nhất thành 72 candidate distinct. Workflow majority giữ 69; coordinator loại thêm 2 finding chưa đủ product contract/reachability (ELC-008, ELC-019), nên còn 67 finding xác nhận. Ba candidate majority-rejected: ELC-009, ELC-026, ELC-045.

Rủi ro lớn tập trung ở:

1. **Data integrity / persistence:** keyboard xóa ngoài scope, history/redo sai, autosave conflict/route race, archive mất media child, malformed import crash.
2. **Canvas interaction state machine:** marquee bị click xóa, pending pointer nuốt click, group resize/rotate tách group, pointer/pinch ownership sai.
3. **Vertical child split-brain:** UI đọc parent nhưng update/persist child; Find, Ribbon, Timeline, Preview, status/index không cùng active address.
4. **Schema/control fan-out:** fresh elements bỏ field hợp lệ; game subtype, line geometry, chart/table/media fields lệch renderer.
5. **Accessibility/keyboard:** focus ring thiếu, popup mất focus, menu keyboard không vào item, media control key bị canvas chiếm.

### Priority order

- **P1 — fix first:** ELC-001, ELC-004, ELC-006, ELC-007, ELC-016, ELC-017, ELC-022, ELC-025.
- **P1 — core editor contract:** ELC-003, ELC-005, ELC-010, ELC-011, ELC-014, ELC-015, ELC-018, ELC-023, ELC-024.
- **P2:** Medium findings; ưu tiên vertical-child, group integrity, focus/keyboard, then rendering parity.

## Method and Verification Evidence

- Canonical element scope lấy từ `client/src/data/element-defaults.js`.
- 11 finder dimensions; 72 distinct candidates; 3 verifier lenses/candidate.
- Focused baseline: 10 files / 146 tests passed.
- Element-control matrix: 141 rows passed.
- Hai focused verification batches: 247/247 passed. Green tests thường chứng minh **coverage gap**, không phủ nhận data flow đã tái hiện.
- Nhiều finding có direct helper/React/DOM/Chromium probe. `wmux browser` không hoạt động trong session, nên không claim một full visible-browser sweep.
- Workflow: 228/229 verifier agents completed. Một reproduce agent của ELC-065 mất kết nối; hai verifier còn lại xác nhận cùng root cause và path.
- Working tree đã rất dirty trước audit. Findings mô tả **current working-tree behavior**, không gán lỗi cho một commit cụ thể.

## Severity Calibration

- **High:** crash; durable data loss; history/save conflict invariant; core workflow bị vô hiệu; resource exhaustion; persisted group/slide contract corruption.
- **Medium:** localized/recoverable geometry, rendering, focus, validation, or lock-policy defect; không chứng minh mất content không thể phục hồi.
- Coordinator hạ ELC-002, ELC-012, ELC-013, ELC-020, ELC-021 từ workflow High xuống Medium để giữ rubric nhất quán.

## High Findings (17)

### ELC-001 — Delete/Backspace trong SELECT vẫn xóa element trên slide

- **Category:** `keyboard-scope/data-loss`
- **Primary anchor:** `client/src/components/SlideCanvas.jsx:270`
- **Repro:** Chọn image unlocked, focus Object Fit select, nhấn Delete hoặc Backspace.
- **Wrong result:** Delete/Backspace từ native select có thể xóa selection và autosave mutation.
- **Root cause:** Document keydown owner của SlideCanvas chỉ loại INPUT/TEXTAREA, không loại SELECT.
- **Evidence:** Lines 268-276 gọi onDeleteSelectedElements cho SELECT; guard SELECT trong use-keyboard là listener khác. Delete flow lọc element rồi persistence schedule snapshot.
- **Confidence:** 1
- **Recommended regression:** Mount SlideCanvas with focused ribbon SELECT; dispatch Delete/Backspace and assert delete callback is not called in client/src/components/SlideCanvas.test.jsx.

### ELC-003 — Đổi game type lưu config nested mà renderer legacy không đọc

- **Category:** `schema-contract/state-persistence`
- **Primary anchor:** `client/src/components/properties/game-properties.jsx:61`
- **Repro:** Name Picker -> Jeopardy, thêm team; hoặc -> Hot Potato, thêm question.
- **Wrong result:** Panel giữ team/question mới nhưng canvas/presentation render default hoặc rỗng.
- **Root cause:** Fan-out loại subtype flat keys của type cũ nhưng giữ object nested; renderer đọc flat schema.
- **Evidence:** Line 61 phát flat+nested. Fan-out ownership lọc flat keys; Jeopardy/Hot Potato renderer đọc element.teams/questions.
- **Confidence:** 1
- **Recommended regression:** UI type switch -> buildSelectionUpdates -> render GameElementRenderer and assert nested Jeopardy team/Hot Potato question appears.

### ELC-004 — Redo nhiều bước làm hỏng invariant history stack

- **Category:** `undo-redo-correctness`
- **Primary anchor:** `client/src/hooks/editor-controller/use-editor-history-controller.js:124`
- **Repro:** Tạo 3 snapshot cách nhau >500ms rồi chạy chuỗi command trên.
- **Wrong result:** A→B→C, Undo×2, Redo×2, Undo trả A thay vì B.
- **Root cause:** Redo push presentation hiện tại thay vì redo target vừa pop.
- **Evidence:** Lines 119-125 tạo history [A,A,B] khi current là C; Undo sau đó restore A.
- **Confidence:** 1
- **Recommended regression:** Add A→B→C, Undo×2, Redo×2, Undo=>B and Redo=>C in client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx.

### ELC-005 — Selection fan-out silently drops supported fields trên element mới

- **Category:** `state-persistence/api-contract`
- **Primary anchor:** `client/src/utils/element-update-fanout.js:92`
- **Repro:** Create default image rồi đổi Brightness hoặc Round Corners.
- **Wrong result:** Image filters/radius/citation, chart fields, code radius, markdown fontSize và showConfetti là no-op trên fresh element.
- **Root cause:** Type-specific patch chỉ được giữ nếu key đã có trên element/default; defaults thiếu các field UI phát ra.
- **Evidence:** Lines 45-49 và 92 drop key; fresh factories chỉ spread incomplete defaults. Controller nhận batch rỗng.
- **Confidence:** 1
- **Recommended regression:** For each affected type, factory -> updateSelectedElements -> presentation assertion in client/src/utils/element-update-fanout.test.js.

### ELC-006 — Import validator chấp nhận element fields làm renderer crash toàn editor

- **Category:** `input-validation/error-boundary`
- **Primary anchor:** `client/src/utils/import-project.js:73`
- **Repro:** Import table data:{}; markdown content:{}; hoặc code language:17.
- **Wrong result:** Imported malformed table/markdown/code field có thể đưa App ErrorBoundary sang “Something went wrong”.
- **Root cause:** Validator chỉ kiểm presentation/slides, migration không canonicalize nested renderer-critical fields.
- **Evidence:** Lines 63-75 không inspect element schema; TableRenderer .map, markdown .replace, và hljs getLanguage number đều throw. Chỉ App-level boundary bọc render.
- **Confidence:** 1
- **Recommended regression:** Reject or normalize malformed table/markdown/code element fields before createPresentation in client/src/utils/import-project.test.js; add renderer fallbacks.

### ELC-007 — Project archive bỏ toàn bộ media trong vertical child slides

- **Category:** `data-portability/archive`
- **Primary anchor:** `client/src/utils/project-media-utils.js:49`
- **Repro:** Đặt child background/image/video/audio/poster dưới slides[0].children[0] rồi export.
- **Wrong result:** Child-only local media không bundle/rewrite; import host khác có URL 404.
- **Root cause:** Collector và URL rewriter chỉ duyệt top-level slides/elements/background.
- **Evidence:** Lines 49-74 và 93-106 không traverse children. Probe trả empty manifest và child URLs không đổi.
- **Confidence:** 1
- **Recommended regression:** Roundtrip archive child background/src/poster/audio/video in client/src/utils/project-media-utils.test.js and assert ZIP manifest plus rewrite.

### ELC-010 — Pointerup marquee chọn xong rồi click nền xóa selection

- **Category:** `interaction/rubber-band`
- **Primary anchor:** `client/src/components/canvas/use-canvas-pointer-interaction.js:426`
- **Repro:** Pointerdown nền, kéo >4px bao A, pointerup rồi click canvas.
- **Wrong result:** Rubber-band selection biến mất ngay bởi compatibility click.
- **Root cause:** endRubberBand xóa ref trước hadInteraction; suppression không coi marquee là interaction.
- **Evidence:** Lines 426-437 apply selection rồi chỉ xét crop/drag; canvas click lines 461-470 clear selection.
- **Confidence:** 0.99
- **Recommended regression:** Pointerdown→move→pointerup→click keeps marquee IDs; click-size drag still clears in client/src/components/canvas/use-canvas-pointer-interaction.test.js.

### ELC-011 — Pending drag nuốt mọi click hợp lệ dù pointer không di chuyển

- **Category:** `interaction/click-routing`
- **Primary anchor:** `client/src/components/canvas/use-canvas-pointer-interaction.js:431`
- **Repro:** A selected; Shift pointerdown/up/click B không move.
- **Wrong result:** Shift-add, collapse multi-selection và selected-table edit không chạy sau zero-motion pointer sequence.
- **Root cause:** finishPointer treats pendingDragRef as interaction và suppresses compatibility click dưới threshold.
- **Evidence:** Promotion chỉ >4px nhưng lines 431-437 suppress pending; SlideCanvas returns before toggle/edit.
- **Confidence:** 0.99
- **Recommended regression:** Integration zero-motion pointerdown→up→click cases for Shift-add, collapse and table edit in client/src/components/SlideCanvas.test.jsx.

### ELC-014 — Ribbon đọc parent slide nhưng ghi vào vertical child active

- **Category:** `wrong-scope/state-routing`
- **Primary anchor:** `client/src/components/editor/editor-ribbon.jsx:9`
- **Repro:** Parent red/fade, child image/zoom; select child then change Background.
- **Wrong result:** Design/Transitions show parent state but mutate child, potentially overwrite child background FX/image.
- **Root cause:** Ribbon passes currentSlide for reads while updateCurrentSlide maps writes to active child.
- **Evidence:** Lines 9-10/18 use currentSlide; active mapper writes child. Design spreads parent background into child patch.
- **Confidence:** 0.99
- **Recommended regression:** EditorPage parent/child background+transition integration: child selection reads child and writes only child.

### ELC-015 — Timeline range không giới hạn có thể tạo hàng trăm triệu SVG nodes

- **Category:** `performance/resource-exhaustion`
- **Primary anchor:** `client/src/components/timeline-element-utils.js:25`
- **Repro:** Auto timelineStart=0, timelineEnd=100000, then 1e9.
- **Wrong result:** Huge year range blocks render/main thread or exhausts memory.
- **Root cause:** buildTicks loops entire range with fixed step<=2 and no node budget.
- **Evidence:** Lines 19-27 create 50,001 ticks for 100k; Timeline maps each to SVG group/line/text.
- **Confidence:** 0.99
- **Recommended regression:** Assert bounded tick budget for extreme ranges and fixed render time in client/src/components/timeline-element.test.jsx.

### ELC-016 — History debounce làm Undo tức thời no-op và stale Redo ghi đè edit mới

- **Category:** `undo/async-ordering/data-loss`
- **Primary anchor:** `client/src/hooks/editor-controller/use-editor-history-controller.js:53`
- **Repro:** Edit A→B then Undo at 499ms; or Undo A, edit C, Redo at 499ms.
- **Wrong result:** Undo <500ms can no-op; Redo after new edit can restore stale branch.
- **Root cause:** Snapshot push and redo invalidation both occur only in delayed effect.
- **Evidence:** Lines 43-58 defer both; handlers lines 107-125 read stale stacks immediately.
- **Confidence:** 0.99
- **Recommended regression:** Fake-timer 499ms tests for edit→Undo and Undo→edit→Redo in editor-page-history-autosave characterization.

### ELC-017 — Save Conflict actions retry stale failed snapshot before recovery snapshot

- **Category:** `autosave/conflict-recovery`
- **Primary anchor:** `client/src/hooks/editor-controller/use-editor-save-controller.js:74`
- **Repro:** PUT gen0 gets 409 gen1; choose either conflict action.
- **Wrong result:** Use Remote/Keep Local can resend stale generation/key and reopen conflict.
- **Root cause:** processQueue prioritizes failedEntryRef; conflict handlers schedule state but do not discard/replace failed entry.
- **Evidence:** Lines 72-85 pick failed entry; persistence handlers 91-127 have no clear failed-entry API.
- **Confidence:** 0.99
- **Recommended regression:** Mock 409 then each action; assert next PUT uses generation1/new idempotency key in editor-autosave-lifecycle.test.jsx.

### ELC-018 — Additive selection chỉ thêm một member và xé group

- **Category:** `selection/group-integrity`
- **Primary anchor:** `client/src/hooks/editor-controller/use-editor-selection-controller.js:55`
- **Repro:** Select X; Ctrl/Shift select A where A/B share group; then move/nudge.
- **Wrong result:** Add group member to selection then move/nudge splits its sibling.
- **Root cause:** Multi branch toggles raw id; it does not expand group while plain branch does.
- **Evidence:** Lines 55-58 add A only, 60-66 expand only plain selection. Keyboard/move batch receives incomplete IDs.
- **Confidence:** 0.99
- **Recommended regression:** SelectionPane Ctrl-add A from [X] must yield [X,A,B], then nudge moves A/B equally.

### ELC-022 — Use Remote không reset history nên Undo phục hồi local state đã bỏ

- **Category:** `history/conflict-boundary`
- **Primary anchor:** `client/src/hooks/editor-controller/use-editor-persistence-controller.js:96`
- **Repro:** Commit local L, receive conflict, choose Use Remote R, wait history debounce, Undo.
- **Wrong result:** After Use Remote, Undo can restore discarded local snapshot.
- **Root cause:** Use Remote calls setPresentation(remote) but not seedHistory(remote).
- **Evidence:** Initial load seeds at 43-46; remote handler 91-100 does not. History appends R after local state.
- **Confidence:** 0.98
- **Recommended regression:** Conflict→Use Remote→advance 500ms→Undo must retain remote baseline; also assert stale failed entry is removed.

### ELC-023 — Resize/rotate group chỉ cập nhật primary member

- **Category:** `group-geometry/api-contract`
- **Primary anchor:** `client/src/components/canvas/use-canvas-pointer-interaction.js:376`
- **Repro:** Select A/B same group, drag A east handle or rotation handle.
- **Wrong result:** Group resize splits layout; rotate changes only handle-owning member.
- **Root cause:** Move uses startEls batch; resize/rotate call onUpdateElement for drag.elementId only.
- **Evidence:** Lines 288-324 batch move versus 376-393 single target; controller patches matching ID only.
- **Confidence:** 0.97
- **Recommended regression:** Two-member group pointer resize/rotate asserts both transformed through onUpdateElements.

### ELC-024 — Design và Transitions vẫn sửa slide locked

- **Category:** `lock-invariant/data-integrity`
- **Primary anchor:** `client/src/hooks/editor-controller/use-editor-element-controller.js:7`
- **Repro:** Lock active slide then change Design background or transition direction/duration.
- **Wrong result:** Locked slide background/transition metadata changes through ribbon.
- **Root cause:** updateCurrentSlide spreads updates unconditionally; only element writers guard slide lock.
- **Evidence:** Lines 7-9 map update regardless locked; Design/Transitions call it.
- **Confidence:** 0.97
- **Recommended regression:** Locked-slide Design and Transitions integration must leave state/persisted snapshot unchanged and controls disabled.

### ELC-025 — Route switch có thể chạy hai save song song trên deck mới

- **Category:** `concurrency/autosave`
- **Primary anchor:** `client/src/hooks/editor-controller/use-editor-save-controller.js:147`
- **Repro:** Hold PUT A; navigate A→B; start B1, queue B2; resolve A before B1.
- **Wrong result:** B1/B2 PUTs can overlap with same generation after old A save settles.
- **Root cause:** Route reset clears shared inFlight flag without abort/epoch-gating old processQueue finally.
- **Evidence:** Lines 147-154 reset lock; old finally 81-84 clears current shared lock and drains B queue.
- **Confidence:** 0.97
- **Recommended regression:** Deferred A→B/B1/B2 test asserts max concurrent B saves=1 and B2 adopts B1 generation.

## Medium Findings (50)

### ELC-002 — Shift-resize phá aspect ratio khi chạm MIN_SIZE

- **Category:** `geometry/aspect-ratio`
- **Primary anchor:** `client/src/components/canvas/use-canvas-resize-rotate.js:169`
- **Repro:** Resize SE element 200x100 với dx=-190, dy=-10, giữ Shift.
- **Wrong result:** Shift resize có thể biến phần tử 2:1 thành 1:1.
- **Root cause:** Chiều suy ra theo ratio bị floor MIN_SIZE độc lập thay vì scale cặp kích thước.
- **Evidence:** Lines 169-173 cho 40x40; clamp aspect giữ geometry đó vì nó nằm trong slide. README công bố Shift giữ tỉ lệ.
- **Confidence:** 1
- **Recommended regression:** Add 200x100 Shift-SE boundary case expecting 80x40 and ratio 2 in client/src/components/canvas/use-canvas-resize-rotate.deep.test.js.

### ELC-012 — Clamp resize phần tử xoay co cả trục không kéo và phá fixed anchor

- **Category:** `geometry/rotated-resize`
- **Primary anchor:** `client/src/components/canvas/use-canvas-resize-rotate.js:258`
- **Repro:** Slide 300x300; x40 y80 w200 h120 rot45; drag E dx=800.
- **Wrong result:** Resize edge E qua boundary co height và làm W edge nhảy.
- **Root cause:** Rotated clamp uniform-scales width+height rồi shifts box, không giữ handle-specific anchor.
- **Evidence:** Lines 258-273 scales both dimensions. Probe gives height 57.48 from 120 and W midpoint shift.
- **Confidence:** 0.99
- **Recommended regression:** Assert E-resize retains height=120 and W world midpoint after clamp in client/src/components/canvas/use-canvas-resize-rotate.deep.test.js.

### ELC-013 — Grid snap khi resize đổi trục không kéo và vẫn đẩy element khỏi slide

- **Category:** `geometry/grid-snap/bounds`
- **Primary anchor:** `client/src/components/canvas/use-canvas-resize-rotate.js:276`
- **Repro:** 960x540, x100 y440 w200 h100; drag N dy100 with grid40.
- **Wrong result:** N-resize grid40 có thể change x và bottom vượt slide.
- **Root cause:** Unrotated snap applies independently to x/y/w/h then MIN_SIZE restores size without re-clamp.
- **Evidence:** Lines 276-285 yield x120 y520 h40, bottom560.
- **Confidence:** 0.99
- **Recommended regression:** N/grid40 regression asserts x=100, fixed bottom=540, and y+height<=540 in resize geometry tests.

### ELC-020 — Media Library chèn element vào slide đã khóa

- **Category:** `lock-invariant/data-integrity`
- **Primary anchor:** `client/src/pages/EditorPage.jsx:438`
- **Repro:** Lock active slide, open Media Library, insert local media.
- **Wrong result:** Media Library appends image/video/audio to locked active parent or child.
- **Root cause:** Parallel insertion callback uses mapActive directly without activeSlide.locked guard.
- **Evidence:** Lines 438-464 construct+append. Canonical use-element-creation returns on locked active slide.
- **Confidence:** 0.99
- **Recommended regression:** EditorPage integration for locked parent and locked active child: MediaLibrary onInsert must leave element count/state unchanged.

### ELC-021 — Resize line đổi wrapper nhưng không scale endpoint/control-point

- **Category:** `line-geometry/resize`
- **Primary anchor:** `client/src/components/canvas/element-renderers/line-element-renderer.jsx:73`
- **Repro:** Default line width400/x2=400; set width200 or drag east handle left.
- **Wrong result:** Line path remains outside resized wrapper; guides and visual bounds diverge.
- **Root cause:** Generic resize patches box only; explicit local x1/y1/x2/y2/cx/cy remain stale.
- **Evidence:** Renderer reads points 73-80 against new viewBox 109-114 with overflow visible.
- **Confidence:** 0.98
- **Recommended regression:** Pointer and numeric W/H line resize tests asserting scaled endpoints/control points and path within new viewBox.

### ELC-027 — Find trên vertical child chỉ mở parent, không mở child chứa match

- **Category:** `vertical-slides/find-navigation`
- **Primary anchor:** `client/src/components/EditorModals.jsx:168`
- **Repro:** Only match is slides[1].children[0]; invoke Find Next.
- **Wrong result:** Find reports child match but Next/Enter renders parent without match.
- **Root cause:** Two-argument child destination is passed to one-argument setCurrentSlideIndex.
- **Evidence:** Find calls (parent,child); line 168 passes raw setter. Index effect clears verticalEdit.
- **Confidence:** 1
- **Recommended regression:** Real EditorPage child-only match Next/Enter must set parent+vertical child and render matched element.

### ELC-028 — Image round corners biến mất khi element được selected

- **Category:** `rendering/preview-edit-parity`
- **Primary anchor:** `client/src/components/canvas/canvas-element-wrapper.jsx:225`
- **Repro:** Image borderRadius=24; click select then deselect.
- **Wrong result:** Selected image becomes square although borderRadius persists.
- **Root cause:** Radius is only on outer wrapper; selection makes outer overflow visible, inner clip has no radius.
- **Evidence:** Lines 224-230 change overflow; inner image layer 264-269 clips without borderRadius.
- **Confidence:** 1
- **Recommended regression:** Selected/unselected image clipping test requires inner non-crop layer borderRadius+overflow hidden.

### ELC-029 — Video Autoplay được persist nhưng renderer bỏ prop autoPlay

- **Category:** `renderer-contract/media`
- **Primary anchor:** `client/src/components/canvas/canvas-element-wrapper.jsx:620`
- **Repro:** Set video autoplay=true, muted=true, save/reload.
- **Wrong result:** Video Autoplay stays checked after reload but canvas video has autoplay false.
- **Root cause:** Video JSX omits autoPlay while adjacent audio JSX supplies it.
- **Evidence:** Lines 620-632 have no autoPlay; audio lines 638-645 has it.
- **Confidence:** 1
- **Recommended regression:** Render persisted muted video autoplay=true and assert video.autoplay in canvas-element-wrapper.test.jsx.

### ELC-030 — Chart numeric overflow vào Infinity rồi serialize thành null

- **Category:** `numeric-validation/data-loss`
- **Primary anchor:** `client/src/components/properties/chart-properties.jsx:115`
- **Repro:** Enter `1e309,-1e309,NaN` in Chart Values.
- **Wrong result:** 1e309 becomes null in preview/autosave payload.
- **Root cause:** Number(value)||0 accepts truthy Infinity/-Infinity.
- **Evidence:** Line 115 emits non-finite values; JSON.stringify chart/API converts them to null.
- **Confidence:** 1
- **Recommended regression:** Values overflow tests assert Number.isFinite state and no null serialization in chart-properties.test.jsx.

### ELC-031 — Xóa walkthrough step trước default làm default nhảy sang step khác

- **Category:** `stale-derived-state`
- **Primary anchor:** `client/src/components/properties/code-properties.jsx:60`
- **Repro:** Steps A/B/C, defaultStepIndex=1, remove A.
- **Wrong result:** Default B becomes C when deleting preceding A.
- **Root cause:** Removal only clamps old index; it does not decrement when prior item removed.
- **Evidence:** Lines 56-61 emit [B,C] with index1; renderer indexes array position directly.
- **Confidence:** 1
- **Recommended regression:** Before-default/deleting-default/after-default multi-step cases in media-code-image-latex-html-properties-depth.test.jsx.

### ELC-032 — Question editor cho phép đáp án đúng trỏ tới option rỗng

- **Category:** `input-validation/game-data`
- **Primary anchor:** `client/src/components/properties/game-properties-question-editor.jsx:55`
- **Repro:** Keep A/B text, choose D correct, clear D, Save.
- **Wrong result:** Saved Hot Potato question can designate blank correct answer.
- **Root cause:** Validation counts any filled options but not options[correctIndex].
- **Evidence:** Lines 51-63 save form unchanged; player uses correctIndex to render/reveal blank option.
- **Confidence:** 1
- **Recommended regression:** Interactive Save with blank selected option must show validation and not call onSave.

### ELC-033 — Xóa date endpoint làm timeline event coordinates thành NaN

- **Category:** `boundary-validation/rendering`
- **Primary anchor:** `client/src/components/properties/timeline-properties.jsx:100`
- **Repro:** Day/Month timeline with event; clear Start or End.
- **Wrong result:** Clearing date endpoint removes ticks and emits SVG NaN positions.
- **Root cause:** Empty string persists; nullish fallback retains it and date math does not guard Invalid Date.
- **Evidence:** Lines 96-101 write ''; range utility uses ??; parseDatePos feeds NaN to SVG.
- **Confidence:** 1
- **Recommended regression:** Clear date endpoint then assert no NaN SVG attributes and defined validation/normalization behavior.

### ELC-034 — Nút Preview transition là no-op

- **Category:** `misbound-control`
- **Primary anchor:** `client/src/components/ribbon/transitions-tab-content.jsx:189`
- **Repro:** Open Transitions on deck with >=2 slides and click/keyboard activate Preview.
- **Wrong result:** Preview transition shows no modal or feedback.
- **Root cause:** Handler only preventDefault; no callback/store setter is wired.
- **Evidence:** Lines 186-193 have no action; showTransitionPreview has modal but no true-setting caller.
- **Confidence:** 1
- **Recommended regression:** Activate Preview on two-slide deck and assert showTransitionPreview/modal in ribbon transitions test.

### ELC-035 — Tab/Shift+Tab cycle helper không được nối vào editor

- **Category:** `missing-production-wiring`
- **Primary anchor:** `client/src/hooks/use-element-cycle-through-slide-elements-hook.js:3`
- **Repro:** A/B/C, select A, focus canvas/body, press Tab or Shift+Tab.
- **Wrong result:** Documented Tab cycle leaves selection unchanged and uses native focus traversal.
- **Root cause:** Cycle hook has test-only import; no registry/keyboard/canvas production handler invokes it.
- **Evidence:** Helper only import is test; useKeyboard/SlideCanvas have no Tab branch.
- **Confidence:** 1
- **Recommended regression:** EditorPage integration forward/backward cycle, wrap, vertical child, group and hidden policies.

### ELC-036 — Delete bỏ lại hidden/locked group orphan dù mutation policy báo blocked

- **Category:** `group-integrity/destructive-operation`
- **Primary anchor:** `client/src/hooks/use-slide-operations.js:99`
- **Repro:** A visible free and B hidden/locked share group; select A then Delete.
- **Wrong result:** Delete free member leaves hidden/locked sibling with singleton groupId.
- **Root cause:** Deletion filters selected locked IDs only and never invokes hasBlockedGroupMutation.
- **Evidence:** Lines 99-115 delete A; shared predicate explicitly detects hidden/locked sibling states.
- **Confidence:** 1
- **Recommended regression:** Hidden- and locked-sibling group Delete must block whole operation or atomically apply defined whole-group policy.

### ELC-037 — Markdown regex parser sửa literal bên trong fenced/inline code

- **Category:** `markdown-correctness/complexity`
- **Primary anchor:** `client/src/utils/markdown-utils.js:7`
- **Repro:** Render fenced JS containing `const t = **literal**` or inline backticks.
- **Wrong result:** Code literal `**literal**` renders as strong and fenced markup gets malformed paragraph wrapping.
- **Root cause:** Pipeline emits code HTML then global emphasis and paragraph regexes reprocess it.
- **Evidence:** Lines 7-15 emit code, 22-25 transform emphasis globally, 47-53 wraps closing lines.
- **Confidence:** 1
- **Recommended regression:** Exact pre>code and inline code literal-text assertions, no strong descendants/paragraph-in-pre, in markdown-utils.test.js.

### ELC-038 — Xóa canonical video src không vô hiệu stale videoUrl legacy

- **Category:** `backwards-compatibility/autosave`
- **Primary anchor:** `client/src/utils/migrate-video-src.js:10`
- **Repro:** Load legacy videoUrl, clear canonical src, save/reload.
- **Wrong result:** Clear Source URL but stale legacy video still plays and reappears after reload.
- **Root cause:** Migration/renderer use truthy src||videoUrl so explicit empty equals absent.
- **Evidence:** Line 10 repopulates src; media property patches src only; canvas uses same fallback.
- **Confidence:** 1
- **Recommended regression:** Legacy load→clear→serialize→migrate→render must keep explicit src='' authoritative.

### ELC-039 — Shortcut remap không vô hiệu chord mặc định

- **Category:** `keyboard-contract/duplicate-owner`
- **Primary anchor:** `client/src/components/SlideCanvas.jsx:285`
- **Repro:** Remap Copy to Ctrl+Shift+C then press Ctrl+C with selected element; remap Delete then press Delete.
- **Wrong result:** Old Copy/Cut/Paste/Duplicate/Delete chords remain live after remap.
- **Root cause:** SlideCanvas and useKeyboard have hardcoded command owners outside active shortcut registry.
- **Evidence:** Lines 285-301 hardcode clipboard; Delete fallback is unconditional in use-keyboard.
- **Confidence:** 0.99
- **Recommended regression:** Load Copy/Delete overrides; assert new chord works and former chord invokes no callback.

### ELC-040 — Sorter reorder/delete làm current index trỏ slide identity khác

- **Category:** `mode-switching/stale-selection`
- **Primary anchor:** `client/src/components/EditorModals.jsx:105`
- **Repro:** A/B/C, current B index1 selected b1; move B 1→2 or delete A.
- **Wrong result:** Close Sorter on wrong slide with stale element IDs when numeric index stays valid.
- **Root cause:** Sorter replaces array without preserving current slide by ID; cleanup watches only index.
- **Evidence:** Lines 105-117 mutate slides but do not reconcile identity; canvas resolves unchanged numeric index.
- **Confidence:** 0.99
- **Recommended regression:** Stateful Sorter move-current/delete-before-current must retain B identity and reconcile selection/editing.

### ELC-041 — Bulk Delete/Duplicate trong Sorter chỉ giữ lần update cuối

- **Category:** `array-replacement/bulk-operation`
- **Primary anchor:** `client/src/components/EditorModals.jsx:111`
- **Repro:** A/B/C/D select B/C then Bulk Delete or Duplicate.
- **Wrong result:** Bulk action over multiple slides applies only last replacement array.
- **Root cause:** Each scalar callback derives full slides replacement from same render closure during synchronous loop.
- **Evidence:** Lines 111-128 compute stale arrays; Sorter loops callbacks. Last queued replacement wins.
- **Confidence:** 0.99
- **Recommended regression:** Stateful EditorModals+Sorter bulk delete/duplicate B+C final IDs assertion.

### ELC-042 — Canvas element có tab stop nhưng không có focus indicator

- **Category:** `accessibility/focus-visibility`
- **Primary anchor:** `client/src/components/canvas/canvas-element-wrapper.jsx:207`
- **Repro:** Select A then Tab native focus to unselected B.
- **Wrong result:** Tab-focused unselected element has no visible focus indication.
- **Root cause:** Inline outline resolves none for unselected state; no focus-visible replacement rule.
- **Evidence:** Lines 207-213 ignore focus; wrapper line 464 tabIndex=0; CSS has no consumer.
- **Confidence:** 0.99
- **Recommended regression:** Browser focus unselected wrapper and assert visible focus ring distinct from unfocused state.

### ELC-043 — Nudge từ focused wrapper vượt biên phải/dưới slide

- **Category:** `geometry/keyboard-bounds`
- **Primary anchor:** `client/src/components/canvas/canvas-element-wrapper.jsx:320`
- **Repro:** 960x540 element x860 w100, focus+Shift+ArrowRight.
- **Wrong result:** Focused wrapper Arrow nudge can persist geometry outside right/bottom edge.
- **Root cause:** Wrapper prevents event and only lower-clamps x/y, bypassing central AABB clamp.
- **Evidence:** Lines 320-327 emit x870; useKeyboard ignores defaultPrevented event.
- **Confidence:** 0.99
- **Recommended regression:** Focused selected right/bottom edge Arrow and Shift+Arrow must retain AABB inside slide.

### ELC-044 — Touch kéo line từ toàn bounding box dù pointer chỉ nhận stroke

- **Category:** `touch/hit-testing`
- **Primary anchor:** `client/src/components/canvas/canvas-element-wrapper.jsx:478`
- **Repro:** Touch blank y=3 within 260x40 line wrapper whose stroke is y=20.
- **Wrong result:** Off-stroke tablet touch selects/drags line and blocks canvas/underlying target.
- **Root cause:** Touch fallback skips isLinePathEvent guard used by pointer/click/contextmenu.
- **Evidence:** Lines 470-477 guard pointer but 478-480 immediately invoke fallback. Renderer has full box plus path stroke.
- **Confidence:** 0.99
- **Recommended regression:** Off-path versus stroke-path touch line test asserting only stroke can select/start drag.

### ELC-046 — SVG color override bỏ qua markup dùng single quotes

- **Category:** `svg-data-correctness`
- **Primary anchor:** `client/src/components/canvas/element-renderers/svg-element-renderer.jsx:21`
- **Repro:** Render single-quoted fill/stroke then apply valid override.
- **Wrong result:** Valid SVG fill='#000' ignores Fill Override.
- **Root cause:** Raw regex only matches double-quoted presentation attributes.
- **Evidence:** Lines 21-24 use fill="..."/stroke="..." regex before sanitizer.
- **Confidence:** 0.99
- **Recommended regression:** DOM-based single-quoted and style declaration fill/stroke override tests.

### ELC-047 — Table numeric zero render thành ô trống

- **Category:** `zero-value/data-correctness`
- **Primary anchor:** `client/src/components/canvas/element-renderers/table-element-renderer.jsx:168`
- **Repro:** Load/import table data=[[0]].
- **Wrong result:** Numeric 0 is visually blank and edit textarea hides it.
- **Root cause:** Preview and textarea use cell||'' rather than nullish/value normalization.
- **Evidence:** Lines 143 and 168 erase 0; import/migration preserve numeric cells.
- **Confidence:** 0.99
- **Recommended regression:** Preview/edit/import zero-cell assertion expects text/value '0'; cover Properties/export parity.

### ELC-048 — Từ child về parent cùng index giữ stale selection/editing ID

- **Category:** `selection-lifecycle/vertical-slides`
- **Primary anchor:** `client/src/components/editor/editor-navigator.jsx:24`
- **Repro:** Edit child ca under parent index0, click parent slide0.
- **Wrong result:** Returning child→same-index parent leaves child selected/editing IDs and dead actions.
- **Root cause:** Parent callback clears verticalEdit only; index-dependent cleanup does not rerun when index remains 0.
- **Evidence:** Lines 24-27 omit selection/edit cleanup while child path 51-57 has it.
- **Confidence:** 0.99
- **Recommended regression:** Child edit/selection→same-index parent test asserts selected/editing refs cleared.

### ELC-049 — Chọn child của parent khác không đồng bộ currentSlideIndex

- **Category:** `vertical-slides/stale-parent-index`
- **Primary anchor:** `client/src/components/editor/editor-navigator.jsx:51`
- **Repro:** Current P1 index0; click child P2.1.
- **Wrong result:** Canvas renders child of P2 while Status/Ribbon/preview may read stale P1.
- **Root cause:** Child callback sets verticalEdit parentId but not currentSlideIndex.
- **Evidence:** Lines 51-58 only set verticalEdit; active mapper uses it while currentSlide remains index0.
- **Confidence:** 0.99
- **Recommended regression:** Cross-parent child click must atomically synchronize parent index/address and all read surfaces.

### ELC-050 — Invalid video trim order được lưu nhưng renderer bỏ End Time

- **Category:** `input-validation/media-contract`
- **Primary anchor:** `client/src/components/properties/media-properties.jsx:77`
- **Repro:** Set End=5 then Start=10.
- **Wrong result:** UI persists Start>End yet media source becomes open-ended #t=start.
- **Root cause:** Inputs clamp independently >=0; renderer silently appends end only when end>start.
- **Evidence:** Lines 63/77 emit independent patches; getMediaFragmentSrc line 23 drops invalid end.
- **Confidence:** 0.99
- **Recommended regression:** Stateful reversed trim input must reject/normalize and renderer must match saved contract.

### ELC-051 — Apply theme to all bỏ sót vertical children

- **Category:** `bulk-operation/vertical-slides`
- **Primary anchor:** `client/src/components/ribbon/design-tab-content.jsx:303`
- **Repro:** Parent and child have overrides; change theme then Apply to all.
- **Wrong result:** Parent overrides clear but child designTokens keep old theme.
- **Root cause:** Bulk updater maps only prev.slides and preserves children unchanged.
- **Evidence:** Lines 303-309 clear s.designTokens only; active child merges retained tokens after deck tokens.
- **Confidence:** 0.99
- **Recommended regression:** Parent+child designTokens Apply-to-all asserts all overrides clear and child renders new deck tokens.

### ELC-052 — Rotate 90° multi-select ép mọi element về góc primary

- **Category:** `multi-select/geometry`
- **Primary anchor:** `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx:311`
- **Repro:** Select A=0 then B=45 primary; click Rotate90.
- **Wrong result:** Mixed rotations collapse to primary+90 rather than each +90.
- **Root cause:** Button emits absolute B+90; shared fan-out broadcasts absolute rotation.
- **Evidence:** Line 311 emits 135; rotation is absolute fan-out key.
- **Confidence:** 0.99
- **Recommended regression:** Real multi-select Rotate90 expects A=90/B=135.

### ELC-053 — Table picker mất focus sau Enter

- **Category:** `accessibility/focus-restoration`
- **Primary anchor:** `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:256`
- **Repro:** Focus Add table, open picker, use arrows then Enter.
- **Wrong result:** Keyboard table choose unmounts focused grid and focus falls to body.
- **Root cause:** choose calls raw onClose rather than overlay requestClose/focus destination.
- **Evidence:** Lines 252-259 focus grid then close it; table creation selects state but never focus DOM wrapper.
- **Confidence:** 0.99
- **Recommended regression:** Keyboard picker Enter asserts focus on new table or stable logical fallback, not BODY.

### ELC-054 — Tick Spacing “1 Year” bỏ qua mỗi năm thứ hai trên range dài

- **Category:** `timeline-contract`
- **Primary anchor:** `client/src/components/timeline-element-utils.js:23`
- **Repro:** buildTicks('2000','2025','year',true).
- **Wrong result:** Explicit 1 Year displays two-year ticks for spans >8.
- **Root cause:** Explicit year falls through auto density heuristic instead of step=1.
- **Evidence:** Only 10/100/1000year special-case; line 23 uses step2 for long range.
- **Confidence:** 0.99
- **Recommended regression:** Explicit year 2000–2025 must yield all 26 inclusive labels; keep heuristic only for auto.

### ELC-055 — Smart guides batch snap vào chính selection và hidden elements

- **Category:** `multi-select/smart-guides`
- **Primary anchor:** `client/src/components/canvas/use-canvas-pointer-interaction.js:307`
- **Repro:** Selected A/B at x100/x300; drag A near B; separately use hidden B.
- **Wrong result:** Moving group snaps to selected peer's old location; hidden element also attracts guide.
- **Root cause:** Guide target map includes all slide elements; guide helper excludes only primary id, not selected/hidden.
- **Evidence:** Lines 307-318 and 347-358 map allEls; smartGuides only checks el.id===draggedEl.id.
- **Confidence:** 0.99
- **Recommended regression:** Batch selected peers and hidden target must produce no guides without visible external target.

### ELC-056 — Animation Timeline/Preview đọc parent trong khi update route tới child

- **Category:** `wrong-scope/vertical-slides`
- **Primary anchor:** `client/src/components/EditorModals.jsx:175`
- **Repro:** Parent and child have distinct fragment elements; select child then open Timeline/Preview.
- **Wrong result:** Child-active Timeline displays parent elements and updates no-op; Preview renders parent.
- **Root cause:** Modals receive currentSlide/currentSlideIndex, while updateElement maps to active child.
- **Evidence:** Lines 173-188 pass parent scope; animation helper selects indexed parent and clears children.
- **Confidence:** 0.98
- **Recommended regression:** Child Timeline row updates child ID and Preview HTML contains child only.

### ELC-057 — Image border có trong model/export nhưng canvas WYSIWYG bỏ qua

- **Category:** `render-contract/wysiwyg`
- **Primary anchor:** `client/src/components/canvas/canvas-element-wrapper.jsx:198`
- **Repro:** Load image borderColor red/borderWidth2 and reconstruct PPTX export.
- **Wrong result:** Imported image border exports to PPTX but is invisible on canvas.
- **Root cause:** Canvas wrapper/image styles do not consume fields that exporter renders as border overlay.
- **Evidence:** Wrapper styles 198-236 omit border fields; PPTX image renderer emits line overlay.
- **Confidence:** 0.98
- **Recommended regression:** Canvas render imported border fields and compare visible style to PPTX-export overlay contract.

### ELC-058 — Xóa focused element làm focus rơi về body

- **Category:** `accessibility/focus-management`
- **Primary anchor:** `client/src/components/canvas/canvas-element-wrapper.jsx:306`
- **Repro:** Focus/select first of two wrappers, press Delete.
- **Wrong result:** Immediately after Delete of focused element, no defined editor focus target remains.
- **Root cause:** Delete callback unmounts focused node without choosing successor or canvas focus target.
- **Evidence:** Lines 306-310 call mutation only; controller removes node/selection without focus transfer.
- **Confidence:** 0.98
- **Recommended regression:** Browser-level stateful delete test asserts explicit successor or named canvas fallback focus.

### ELC-059 — Pinch trên nền canvas đồng thời tạo/commit marquee

- **Category:** `interaction/modality-transition`
- **Primary anchor:** `client/src/components/SlideCanvas.jsx:211`
- **Repro:** Two blank pointers; move P2 across A then release P2.
- **Wrong result:** Two-finger pinch can also replace selection with elements crossed by second-finger marquee.
- **Root cause:** Second blank pointer overwrites marquee owner; pinch cancel omits rubberBandRef.
- **Evidence:** Lines 211-218 cancel no marquee; 472-483 start/overwrite every blank marquee; owner up commits it.
- **Confidence:** 0.98
- **Recommended regression:** Two-touch pinch crossing element changes zoom but preserves prior selection and clears marquee.

### ELC-060 — Pointer thứ hai đổi selection trước khi ownership guard từ chối

- **Category:** `interaction/pointer-ownership`
- **Primary anchor:** `client/src/components/SlideCanvas.jsx:579`
- **Repro:** Hold/drag A with P1, touch/click unselected B with P2, then pinch/cancel.
- **Wrong result:** Second contact on B changes selection despite owner A retaining drag session.
- **Root cause:** SlideCanvas mutates selection before startElementDrag checks pending/drag ownership.
- **Evidence:** Lines 579-590 select B first; hook rejects second session at 517-519; cancel restores geometry, not selection.
- **Confidence:** 0.98
- **Recommended regression:** Two-contact A/B integration must retain A selection and owner after second contact/cancel.

### ELC-061 — Selected Chart/LaTeX iframe nuốt pointer nên không kéo lại element

- **Category:** `pointer-interaction/iframe`
- **Primary anchor:** `client/src/components/canvas/element-renderers/chart-element-renderer.jsx:63`
- **Repro:** Select chart/LaTeX then drag iframe center >4px.
- **Wrong result:** Center drag works unselected but not selected Chart/LaTeX.
- **Root cause:** Selected full-size iframe pointer-events:auto isolates pointerdown from outer CanvasElement move handler.
- **Evidence:** Chart line 63 and LaTeX counterpart use auto when selected; no pending drag starts outside iframe.
- **Confidence:** 0.98
- **Recommended regression:** E2E selected chart and LaTeX center drag must update x/y, or verify explicit move affordance.

### ELC-062 — Advanced ribbon menu mở bằng keyboard nhưng focus không vào menu

- **Category:** `accessibility/menu-keyboard`
- **Primary anchor:** `client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.jsx:46`
- **Repro:** Focus More advanced insert options, press Enter then Tab/ArrowDown.
- **Wrong result:** Enter/Space opens menu while focus stays trigger; Arrow navigation is absent.
- **Root cause:** Trigger only toggles state; menu has no initial-focus refs/effect or Arrow handling.
- **Evidence:** Lines 46-50 toggle; 61-94 render items without focus behavior. File menu has contrasting implementation.
- **Confidence:** 0.98
- **Recommended regression:** userEvent Enter/Space focuses first menuitem; Arrow navigation and Escape restoration test.

### ELC-063 — Picture upload bỏ rơi Promise rejection

- **Category:** `error-boundary/unhandled-promise`
- **Primary anchor:** `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:410`
- **Repro:** Select image and make /api/upload reject or return HTTP 500.
- **Wrong result:** Failed Picture upload reports unhandled rejection with no visible error/retry feedback.
- **Root cause:** Generic onchange invokes handler(file) without await/catch; real ribbon upload callback propagates rejection.
- **Evidence:** Lines 404-411 drop Promise; media upload path 415-428 has catch but Picture bypasses it.
- **Confidence:** 0.98
- **Recommended regression:** Rejected Picture upload test asserts no unhandledrejection and user-visible uploadError/retry path.

### ELC-064 — Selection Pane không phản ánh z-order sau reorder/action

- **Category:** `state-ordering/ui-contract`
- **Primary anchor:** `client/src/components/SelectionPane.jsx:160`
- **Repro:** A/B/C drag pane A 0→2 then inspect rows/canvas.
- **Wrong result:** Pane remains insertion order while canvas order changes, so later pane actions use stale indices.
- **Root cause:** Pane maps raw array; reorder changes only zIndex and preserves array.
- **Evidence:** Line 160 maps unsorted elements; replaceElementZOrder maps z values; SlideCanvas sorts by zIndex.
- **Confidence:** 0.97
- **Recommended regression:** Stateful reorder then rerender asserts Selection Pane order equals zIndex/canvas order and next reorder uses it.

### ELC-065 — Media control keyboard bị wrapper chiếm để nudge element

- **Category:** `nested-controls/keyboard-ownership`
- **Primary anchor:** `client/src/components/canvas/canvas-element-wrapper.jsx:320`
- **Repro:** Select unlocked media, focus native controls, press ArrowRight.
- **Wrong result:** ArrowRight from focused VIDEO/AUDIO moves element instead of media control handling key.
- **Root cause:** Editable-target guard excludes VIDEO/AUDIO, so bubbled key reaches wrapper nudge branch.
- **Evidence:** Lines 37-41 omit media; 320-327 preventDefault and send geometry patch.
- **Confidence:** 0.97
- **Recommended regression:** Dispatch ArrowRight from video/audio child; assert no geometry callback and no wrapper preventDefault.

### ELC-066 — Properties cho sửa covered merged cells mà renderer không emit

- **Category:** `merged-cell-state/hidden-data`
- **Primary anchor:** `client/src/components/properties/table-properties.jsx:126`
- **Repro:** 2x2 with R1C1 colSpan2; edit Properties R1C2.
- **Wrong result:** Properties saves covered-cell text invisible in canvas/export.
- **Root cause:** Properties maps every backing cell without covered-cell resolution; renderer skips covered coordinate.
- **Evidence:** Lines 126-139 enable/update R1C2; TableRenderer returns null for covered cells.
- **Confidence:** 0.97
- **Recommended regression:** Merged table Properties must hide/disable/redirect covered cell input; render/update assertion.

### ELC-067 — Image multi-select không có mixed state

- **Category:** `multi-select/misleading-state`
- **Primary anchor:** `client/src/components/properties/image-properties.jsx:7`
- **Repro:** Select cover image then contain image as last/primary.
- **Wrong result:** Mixed Object Fit/filter display primary value as shared and cannot reapply it directly.
- **Root cause:** ImageProperties receives only primary element, not full selection/context to compute effective mixed values.
- **Evidence:** Signature line 7 and controls use element values; PropertiesPanel drops selection context for ImageProperties.
- **Confidence:** 0.96
- **Recommended regression:** Mixed images must show accessible mixed state and explicit apply-primary-to-all flow using effective defaults.

### ELC-068 — Shape color mixed state chỉ là inert data attribute

- **Category:** `multi-select/accessibility`
- **Primary anchor:** `client/src/components/properties/shape-properties.jsx:25`
- **Repro:** Multi-select red and blue shapes.
- **Wrong result:** Divergent fills show a concrete primary swatch with no visual/ARIA multiple-values signal.
- **Root cause:** Mixed detection only forwards data-mixed to native ColorPicker; no CSS/ARIA consumes it.
- **Evidence:** Lines 23-29 keep element.fill value; ColorPicker spreads prop; no data-mixed style/semantic mapping.
- **Confidence:** 0.96
- **Recommended regression:** Mixed fill must expose visible Multiple values and accessible description; state clears after fan-out color update.

### ELC-069 — TouchEvent fallback pinch không cancel active drag/crop

- **Category:** `touch-fallback/modality-transition`
- **Primary anchor:** `client/src/components/SlideCanvas.jsx:212`
- **Repro:** Touch fallback drag >4px, add second touch, pinch, end one touch.
- **Wrong result:** Fallback one-finger drag followed by second-finger pinch retains drag geometry instead of rollback.
- **Root cause:** Fallback owner pointerId is null; pinch cancellation only dispatches pointercancel for non-null owner, then touchend finishes success.
- **Evidence:** Lines 212-218 skip null; hook creates null owner and touchend calls finish(...,false).
- **Confidence:** 0.94
- **Recommended regression:** TouchEvent fallback drag/crop→second touch→partial touchend restores original geometry/crop and clears refs.

### ELC-070 — Cut xé group có hidden/locked member

- **Category:** `group-integrity/destructive-operation`
- **Primary anchor:** `client/src/hooks/use-clipboard.js:137`
- **Repro:** A/B group, hide or lock B, select visible A, Ctrl+X.
- **Wrong result:** Ctrl+X removes free member but leaves hidden/locked sibling singleton group.
- **Root cause:** createCutOperation filters unlocked selected elements only; no blocked-group policy check.
- **Evidence:** Lines 133-149 select free IDs; performCut deletes only them. Existing predicate detects exactly hidden/locked siblings.
- **Confidence:** 0.94
- **Recommended regression:** Hidden- and locked-sibling Cut must block atomically before clipboard/state mutation.

### ELC-071 — Smart-guide snap threshold thay đổi theo zoom màn hình

- **Category:** `zoom-scaling/snapping`
- **Primary anchor:** `client/src/utils/smartGuides.js:1`
- **Repro:** Same 5px visual gap at zoom0.1,1,4.
- **Wrong result:** Low zoom barely snaps; high zoom attracts from far visible distances.
- **Root cause:** Pointer converts pixels to slide units but guide threshold stays fixed slide-space constant.
- **Evidence:** SNAP_THRESHOLD line1; pointer divides by scale then calls helper without scale.
- **Confidence:** 0.94
- **Recommended regression:** Same screen gap snap/no-snap result must match across 0.1x,1x,4x zoom.

### ELC-072 — Locked element không liên quan vô hiệu Crop trên image unlocked

- **Category:** `lock-policy/target-scope`
- **Primary anchor:** `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx:124`
- **Repro:** Select unlocked image plus locked shape, right-click image.
- **Wrong result:** Locked unrelated peer disables Crop/Reset for unlocked right-click image.
- **Root cause:** isReadOnly derives from any locked context peer, not target ctxEl.locked.
- **Evidence:** Lines 121-127 set peer-wide readOnly; Crop/Reset callbacks target only contextMenu.elementId.
- **Confidence:** 0.93
- **Recommended regression:** Mixed selection unlocked image+locked shape keeps Crop/Reset enabled; locked target/slide stays disabled.

## Rejected, Latent, or Policy-Dependent Candidates

### ELC-008 — Jeopardy Hook order

- Mechanical defect exists when `GameElementRenderer` receives `isPresenting=true` and dynamic import completes.
- Excluded from current product findings: production client caller renders `<Renderer element={element} />`; no in-scope caller passes `isPresenting=true`. Keep as latent component-contract debt.

### ELC-009 — async `.then(setState)` game branches

- Rejected for current product reachability. Mechanically suspicious branch exists, but presentation-mode caller is not reachable in audited production client path.

### ELC-019 — Ctrl+A includes hidden elements

- Destructive flow is proven: Ctrl+A can select hidden IDs and Delete persists removal.
- Excluded as confirmed bug because repo has no contract that Ctrl+A means visible-only. Selection Pane permits hidden-layer selection and UI exposes selected count. Requires explicit product policy.

### ELC-026 — native media controls hijacked by pointer drag

- Rejected in Chromium. Native audio/video UA controls consumed pointer events; wrapper received no pointerdown, no pending drag, and play/seek completed.

### ELC-045 — Hot Potato START button no-op

- Button is mechanically inert in direct component render.
- Rejected as current product finding because audited production path never enables that `isPresenting` branch.

## Test Strategy Recommendations

1. Add state→controller→renderer assertions; stop relying mainly on raw callback spies.
2. Add composed interaction tests: pointerup→compatibility click, pointer ownership→pinch cancellation, focused wrapper→document keyboard owner, popup close→focus successor.
3. Add reusable fixtures: parent/vertical child, hidden/locked mixed group, fresh factory elements, deferred save queue, mixed-value multi-selection.
4. Run focused Vitest first; then real Chromium E2E for focus, native media, iframe, touch/pinch, and popup keyboard behavior.
5. Add project roundtrip fixtures covering child media, malformed nested element fields, legacy video URL, table zero/merged cells, SVG quotes, image border parity.

## Unresolved Questions

1. **ELC-006:** server create/update validation có independently reject malformed nested renderer fields không? Server scope chưa được kiểm.
2. **ELC-019:** Ctrl+A phải chọn mọi layer hay chỉ visible canvas elements?
3. **ELC-022:** Use Remote chắc chắn resurrect discarded local state qua Undo; chưa chứng minh stale failed-save queue luôn overwrite remote thành công.
4. **ELC-050:** invalid trim range nên reject, auto-adjust counterpart, hay clear End về sentinel 0?
5. **ELC-069:** supported browser matrix có còn yêu cầu TouchEvent-only fallback không?

## Audit Limitations

- Không sửa product code/tests/config.
- Không chạy full `npm test`, lint, hoặc build cho audit này; focused tests/probes được dùng theo từng contract.
- Không có visible `wmux` browser reproduction vì browser panel startup thất bại; report không suy diễn pixel-level proof ngoài các Chromium probes được ghi rõ trong evidence.
- Client-side paths được chứng minh; không mở rộng claim sang server/shared export khi file đó ngoài candidate verifier scope.

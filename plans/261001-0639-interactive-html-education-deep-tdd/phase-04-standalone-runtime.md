---
phase: 4
title: 'Runtime DOM độc lập, đóng gói vendor và mount generated HTML'
status: in_progress
priority: P1
dependencies: [3]
---

# Phase 04 — Standalone runtime

## Execution progress

Standalone implementation slice đã bàn giao; historical name-picker qualified checkpoint được dẫn tại [root progress](./plan.md#execution-progress). Current-subject generated/native/file lifecycle, effective-root isolation, keyboard và runtime/CSP receipts vẫn cần đối chiếu từng checklist cell sau integration; không dùng checkpoint cũ để đóng current all-surface qualification. Checklist và FailureProtocol giữ nguyên.

## Goal

Generated Present/Preview/Share dùng cùng Vanilla DOM runtime với native Try; core local chạy độc lập không React, HTTP/WebSocket, parent globals, eval hoặc CDN.
Khóa mount/state/lifecycle/packaging đúng trước game presenters05; phase04 chứng minh đường mount bằng presenter thật name-picker, không fake button demo hay runtime placeholder.

## Context/evidence

- `shared/src/element-renderers.js:951-1004` hiện xuất labeled placeholder; normal Present không mount React game branch ở `client/src/components/canvas/element-renderers/game-element-renderer.jsx:35-67`.
- Client `client/src/utils/generateHTML.js:24-25` gọi shared present; `shared/src/htmlGenerator.js:780-790` mở endpoint saved-deck hoặc generated blob.
- `server/routes/presentations-extras.js:97-116` generateRevealHTML rồi gửi text/html; preview chỉ tắt Reveal navigation, không tạo React subtree.
- Generator render effective parent/child slides tại `shared/src/htmlGenerator.js:268-351`, Reveal ready/init tại433-445, game detection hardcoded tại465-491.
- `shared/src/live-presenter-runtime.js:22-35` chọn live query và nạp Socket.IO; `shared/src/live-presenter-game-runtime.js:106-147` sở hữu host socket/session/capability, không mount UI.
- Packaging hiện dùng installed esbuild tại `scripts/copy-vendor.js:3,78-89`; `package.json:107,139` pin0.25.12, không nâng dependency.
- Required assets ở `shared/src/reveal-runtime-assets.js:28-37`; staging/hash manifest ở `scripts/vendor-publication.js:67-121`; closure verifier kiểm hashes tại `scripts/verify-runtime-closure.js:26-59`.
- Current Reveal version là6.0.2 tại `shared/src/reveal-runtime-assets.js:3`; fresh scout phải xác nhận installed/vendor6.0.2, không dùng historical6.0.1.
- Offline inliner tại `client/src/utils/offlineExport.js:79-80` chưa case-insensitive như comment; esbuild escaping không bao phủ raw JSON/bootstrap/vendor concatenation.

## Deep scout gate

- Re-glob inventory và trace cả Present popup, Preview iframe, Share route, Download caller, template blob, effective master và vertical section.
- Đọc runtime/security/accessibility research trong plan và Electron CSP; xác minh loaded vendor version bằng receipt, không sửa dependency.
- Grep current renderGame call/options, presenter bootstrap socket events, required-assets exports và offline serializer để không thêm connection thứ hai.
- Kiểm tra element ID collisions qua master/children/duplicate; lifetime state phải per-document/per-root, không process module singleton.
- Trace keyboard actual Reveal source: keyboardCondition, button/select Space/arrows, existing actions delegated wrapper; tái hiện generated document trước sửa.
- Kiểm tra Vitest discovery của CREATE test files và Playwright dev launch; không coi React-only or page.setContent là bằng chứng normal Present.

## Requirements

- Public API duy nhất `NavSlidesEducation.mount(root,{mode,transport,clock,random}) -> {getState,reset,destroy}`; root mount idempotent, destroy dọn toàn bộ owned resources.
- Browser presenters under shared/src/education/browser/, pure configuration/state under shared/src/education/; không import React/editor stores/server modules.
- Stable wrapper `data-ns-element-id`, playable root `data-ns-game`, subtype metadata và associated application/json config; DOM scope effective slide, không global document IDs cho teams/options.
- Config serialized theo HTML context: escape `<`, U+2028/U+2029 và quotes phù hợp; JSON parse roundtrip tiếng Việt/ampersand/backslash và mixed-case closing tags.
- Local mặc định; live chỉ khi existing query/bootstrap yêu cầu và catalog hỗ trợ thật; offline luôn local classroom, không thử reconnect hay ngầm live→local scoring khi disconnect.
- Monotonic deadlines cho local; elapsed/deadline tính lại sau scheduler delay, pause/resume giữ remaining; live deadline vẫn tiếp tục server-side.
- Hide/slide leave giữ progress, pause local timer/pending feedback; replay tăng generation, clear timers/listeners/subscriptions/pointer capture/delayed callbacks.
- Reveal initial ready/isReady và slidechanged theo effective leaf section; nhiều games/vertical/master cùng chạy nhưng input/reset/state không rò giữa roots.
- Shared `collectEffectiveGameDescriptors(presentation)` traverses resolved parent/vertical slides and layout overrides, excludes editor-hidden roots, and returns `{effectiveSlideId,elementId,gameType,config}`. DOM identity is the effective tuple, never a deck-global element ID.
- Trusted live bootstrap allocates an opaque <=128-character transportGameId per owner/presentation-generation/effective tuple, stores and reuses that mapping until room cleanup, and publishes `{effectiveSlideId,elementId,transportGameId}`. Generator detection, wrapper transport metadata and host lookup consume this SAME descriptor mapping; saved IDs stay unchanged. Two inherited copies therefore cannot share a room.
- Generator option `educationView:'local'|'host'|'audience'` is selected by the authenticated server caller, never a client role query. Local/authorized-host configs use private normalization; audience emits only public config validated by the public schema and mounts a read-only live observer, never a local matcher. Phase04 cuts over EVERY presentation-data producer/fallback with the serializer in the SAME checkpoint, using public schema03;12 extends projection for new authority/round state, not initial leak prevention.
- Enter/Space native button chỉ activation một lần; game controls giữ slide/fragment đứng yên, navigation ngoài widget vẫn hoạt động; không disable keyboard cả deck.
- Hosted assets `/vendor/navslides-education/runtime.js` + runtime.css phải có manifest/hash/required closure; portable inline JS/CSS theo CSP hiện hữu, không blanket data-script/style support.

## Architecture/contracts

Dữ liệu saved nested config từ03 → generated escaped config + stable wrapper → lifecycle tìm active leaf → mount parses/normalizes → runtime-session creates isolated pure state → DOM presenter renders bằng safe textContent.
User interaction → reducer command với instance/session generation → state result → DOM feedback; config không mutate và getState không trả writable saved store object.
Runtime-entry compose actual presenters; phase04 tạo shared weighted name-picker presenter/state đầu tiên để smoke end-to-end, phase05 mở rộng cùng modules, không tạo play implementation trùng.
Live transport adapter chỉ subscribe/dispatch qua bootstrap-owned socket/auth; DOM controls không sở hữu credential, không spawn socket riêng hoặc optimistic authoritative scoring.
Reveal lifecycle giữ mount instances trong WeakMap/root map scoped document; pause internal hooks không thêm public API mới; full document teardown destroy instances/off callbacks.
KeyboardCondition nối điều kiện cũ và nhường keys khi focus/event ở playable controls; delegated authored actions bỏ qua child form controls để không kích action wrapper ngoài ý muốn.
Integration owner tuần tự nối renderers/htmlGenerator, assets/package/vendor, existing live bootstrap, adapter/PropertiesPanel và offline asset contract; domain worker không ghi các chokepoints này.

## File inventory

| Đường dẫn đầy đủ                                                                    | Thao tác/trạng thái                    | Owner, size/test impact                                                                                                       |
| ----------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| C:/Work/NavSlidesEditor/shared/src/education/runtime-session.js                     | CREATE, đề xuất                        | Runtime worker; isolated state/generation/resources, <200 LOC.                                                                |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime-entry.js               | CREATE, đề xuất                        | Runtime worker; exports API/composition, <200 LOC; later integration owner connects presenters.                               |
| C:/Work/NavSlidesEditor/shared/src/education/browser/mount.js                       | CREATE, đề xuất                        | Runtime worker; root parse/normalize/dispatch/destroy, <200 LOC.                                                              |
| C:/Work/NavSlidesEditor/shared/src/education/browser/reveal-lifecycle.js            | CREATE, đề xuất                        | Runtime worker; leaf active scope, resources pause/resume, <200 LOC.                                                          |
| C:/Work/NavSlidesEditor/shared/src/education/browser/deadline-clock.js              | CREATE, đề xuất                        | Runtime worker; deadline/remaining scheduler, <200 LOC.                                                                       |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-transport.js              | CREATE, đề xuất                        | Runtime worker; bootstrap subscribe/send boundary, <200 LOC; owner12/13 reconnect changes serial.                             |
| C:/Work/NavSlidesEditor/shared/src/education/effective-game-descriptors.js          | CREATE, đề xuất                        | Runtime worker04; pure effective traversal reused by generator/bootstrap, <200 LOC.                                           |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime.css                    | CREATE, đề xuất                        | Runtime worker; scoped actual controls, <200 LOC per stylesheet chunk.                                                        |
| C:/Work/NavSlidesEditor/shared/src/education/games/name-picker.js                   | CREATE, đề xuất                        | Runtime worker04 then game worker05 serial; actual weighted/exclusion/replay reducer <200 LOC.                                |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/name-picker.js           | CREATE, đề xuất                        | Runtime worker04 then05 serial; meaningful wheel/dice/button presenter <200 LOC, split animation concern if needed.           |
| C:/Work/NavSlidesEditor/client/src/components/education/native-game-try-adapter.jsx | CREATE, đề xuất                        | Adapter worker; mount same presenter/destroy on close, <200 LOC.                                                              |
| C:/Work/NavSlidesEditor/shared/src/element-renderers.js                             | MODIFY, đã có                          | Integration owner; mount markup + distinct print static snapshot, no inlined domain reducers.                                 |
| C:/Work/NavSlidesEditor/shared/src/htmlGenerator.js                                 | MODIFY, đã có                          | Integration owner; assets/init/keyboard/lifecycle; not concurrent domain writes.                                              |
| C:/Work/NavSlidesEditor/server/services/presenter-game-bootstrap.js                 | MODIFY, đã có                          | Integration owner04; owner-bound opaque tuple mapping, reuse/cleanup and metadata emission;12 extends authority.              |
| C:/Work/NavSlidesEditor/server/routes/presentations-extras.js                       | MODIFY, đã có                          | Integration owner; validated document view and bootstrap tuple mapping passed to generator.                                   |
| C:/Work/NavSlidesEditor/server/services/socket-handler.js                           | MODIFY, đã có                          | Integration owner04; all audience HTML fanout/fallback passes server-derived public view, never default local/private config. |
| C:/Work/NavSlidesEditor/shared/src/live-presenter-runtime.js                        | MODIFY, đã có                          | Integration owner; transport bridge/lifecycle only, keep authorization.                                                       |
| C:/Work/NavSlidesEditor/shared/src/live-presenter-game-runtime.js                   | MODIFY, đã có                          | Integration owner; expose narrow subscribe/command bridge, no credentials in configs.                                         |
| C:/Work/NavSlidesEditor/shared/src/reveal-runtime-assets.js                         | MODIFY, đã có                          | Integration owner; education required runtime asset composition.                                                              |
| C:/Work/NavSlidesEditor/shared/src/index.js                                         | MODIFY, đã có                          | Integration owner; export shared asset/registry contracts cho workspace consumers, tránh shim duplicate.                      |
| C:/Work/NavSlidesEditor/scripts/build-education-runtime.js                          | CREATE, đề xuất                        | Packaging worker; pinned esbuild generated output build helper <200 LOC.                                                      |
| C:/Work/NavSlidesEditor/scripts/copy-vendor.js                                      | MODIFY, đã có                          | Integration owner; generated bundles join existing staging transaction.                                                       |
| C:/Work/NavSlidesEditor/scripts/vendor-publication.js                               | MODIFY chỉ cần, đã có                  | Integration owner; reuse atomic/hash behavior, không tự copy trực tiếp server/vendor.                                         |
| C:/Work/NavSlidesEditor/scripts/verify-runtime-closure.js                           | MODIFY, đã có                          | Integration owner; required hashes/paths checked through shared contracts.                                                    |
| C:/Work/NavSlidesEditor/package.json                                                | MODIFY chỉ script cần thiết, đã có     | Integration owner; esbuild giữ0.25.12, không add runtime deps.                                                                |
| C:/Work/NavSlidesEditor/client/src/components/PropertiesPanel.jsx                   | MODIFY, đã có                          | Integration owner; explicit Try entry, canvas inert, no invisible isPresenting branch.                                        |
| C:/Work/NavSlidesEditor/client/src/utils/offlineExport.js                           | MODIFY giới hạn assets/escaping, đã có | Integration owner04; full recursive closure owner14; preserve existing iframe paths.                                          |
| C:/Work/NavSlidesEditor/shared/tests/education-runtime-session.test.js              | CREATE, đề xuất                        | Pure lifecycle/generation/deadline invariants.                                                                                |
| C:/Work/NavSlidesEditor/shared/tests/education-generated-document.test.js           | CREATE, đề xuất                        | Parse config/DOM behavior, not source text assertions.                                                                        |
| C:/Work/NavSlidesEditor/scripts/education-runtime-assets.test.js                    | CREATE, đề xuất                        | Stage/hash/missing asset behavior actual bundle, no source scanning.                                                          |
| C:/Work/NavSlidesEditor/tests/e2e/games/standalone-runtime-lifecycle.spec.js        | CREATE, đề xuất                        | Real endpoint/Share/Download/file smoke, ≤200 LOC.                                                                            |
| C:/Work/NavSlidesEditor/docs/system-architecture.md                                 | MODIFY sau smoke, đã có                | Integration owner; mount/ownership/local-live evidence.                                                                       |
| C:/Work/NavSlidesEditor/docs/project-changelog.md                                   | MODIFY sau smoke, đã có                | Integration owner; actual packaged-runtime receipts.                                                                          |

## Chokepoint caller map

Generator consumers: saved Present `server/routes/presentations-extras.js:104-116`; client wrapper `client/src/utils/generateHTML.js:24-25`; template/blob `shared/src/htmlGenerator.js:786-790`; element generation parent/child `shared/src/htmlGenerator.js:281-284,344-347`.
Runtime injection chokepoint `shared/src/htmlGenerator.js:443-445`; bootstrap socket `shared/src/live-presenter-game-runtime.js:118-146`; live query `shared/src/live-presenter-runtime.js:22-35`; assets publication `scripts/copy-vendor.js:99-117`; offline consumption `client/src/utils/offlineExport.js:1,201-207`.
Hosted Share trace đã xác minh: GET `server/index.js:358-396` kiểm token/expiry rồi renderShareView; helper tại289-309 đọc authoritative deck, sanitize customCSS rồi generateRevealHTML tại306. API mount mới không cần React route; phase14 owns final offline rewrite, phase12/13 own authoritative protocol.

## Tests Before — RED scenarios

1. Generated endpoint name-picker hiện không spin/exclude/reset; tạo browser failing journey actual generated URL, không render React game component.
2. Multi blocks và parent+vertical child navigate: state scoped roots, local deadlines pause immediate on leave, return giữ progress; existing missing mount phải được observed.
   Include one master-only game inherited by two parent slides plus a vertical child and hidden override: descriptor tuples/transport IDs distinct, hidden root absent, reconnect reuses its own owner-bound mapping. Full live round/score proof follows12, not a premature claim that04 implements every game.
3. Scheduler clock jump/background throttling vẫn hết hạn đúng; replay/destroy trong pending callback không đổi state hay phát feedback generation cũ.
4. Parse config chứa `</ScRiPt>`, `</SCRIPT >`, `</style>`, quotes/ampersand/backslash/NFC tiếng Việt; parent marker không chạy, text và runtime preserved.
5. Tab→Space/Enter native button, select/arrows rồi Tab out: một activation, slide/fragment unchanged trong widget, deck navigation vẫn chạy ngoài.
6. Missing/stale runtime CSS/JS/hash staging fails actionable; local no Socket.IO request; live disconnected giữ waiting/read-only, không local điểm.

## Numbered implementation steps

1. Scout original paths/control flow, create deterministic RED tests và actual generated failing receipts; khóa owner chokepoints trước edits.
2. Implement runtime-session isolation/generation, monotonic clock/deadline lifecycle và mount registry; test wrong/destroyed roots không mutate instance khác.
3. Implement real name-picker reducer + wheel/dice/button DOM using weighted-picker03, exclusions/exhaustion/reset; phase05 tiếp nối file này, không bản thứ hai.
4. Integration owner chuyển game non-print renderer sang stable mount markup; print/PDF vẫn meaningful static board/question snapshot không interaction claim.
5. Nối same effective descriptor traversal vào game detection/bootstrap/generator wrappers và Reveal ready/isReady/slidechanged leaf lifecycle; children/master/multiple blocks dùng tuple mapping, không raw ID dedup hoặc remount/reset ngoài ý muốn.
6. Build helper esbuild installed0.25.12: bundle:true/platform:browser/format:iife/globalName:NavSlidesEducation/target:es2018; keep inline-script/style escaping support, không eval/dynamic imports/React external.
7. Integration owner thêm generated JS/CSS vào vendor staging/hash/runtime closure và required offline assets; serializer độc lập safe cho JSON/bootstrap/vendor concatenation.
8. Nối thin Try adapter và existing bootstrap-owned live transport; local zero network, live read-only on disconnect; không implement server lifecycle mới ngoài12.
9. Run focused GREEN và actual hosted/file name-picker journeys; sau receipts mới docs/changelog, phase05 không được bypass runtime mount.

## Refactor

Tách per-concern modules dưới200 LOC, shared logic dưới shared/; không đưa Tailwind app/React graph vào standalone bundle hoặc nới CSP để cứu dependency.
Không mở hidden React play entry mới; old duplicate play cleanup hoàn thành05 sau adapter cutover, giữ static editor previews có giá trị.

## Tests After — GREEN

Inject deterministic clock/random cho pure test; actual bundle execute trong generated document. Asset manifest/hash failure exercise thật, không assert bundle source chứa string.
Hosted Present/Preview/Share và file local name-picker có một state owner/listener set; destroy closes resources, replay không callback cũ, deck saved JSON unchanged.

## Behavior matrix

| Mức      | Scenario                                      | Unit / integration / E2E                                                  |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| critical | Real generated mounts, safe config serializer | Parse roundtrip + actual IIFE + endpoint/browser interactions.            |
| critical | Replay/destroy/leave/local-vs-live timers     | Deterministic state/deadline + multi-root DOM + vertical generated deck.  |
| high     | Vendor closure/CSP/offline assets             | Actual stage/hash/build + Download/file:// zero HTTP/WS + Electron smoke. |
| high     | Native keys/action wrapper collision          | Input/score count + slide/fragment focus assertions + real Reveal6.0.2.   |
| medium   | Try parity/320/768/touch/reduced motion       | Same DOM transitions, reachable controls, progress preserved.             |

## Executable focused commands

CREATE tests/build helper phải được viết trước; các lệnh dành implementation, không chạy trong planning.

```powershell
node scripts/build-education-runtime.js --out-dir .tmp/education-runtime-smoke
npx vitest run shared/tests/education-runtime-session.test.js shared/tests/education-generated-document.test.js scripts/education-runtime-assets.test.js
npx vitest run scripts/vendor-publication.test.js scripts/verify-runtime-closure.test.js server/vendor-assets.test.js client/src/utils/offlineExport.test.js
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'; npx playwright test tests/e2e/games/standalone-runtime-lifecycle.spec.js --project=chromium --workers=1
```

`npm run vendor` là targeted runtime artifact publication cần phase04, không project-wide client build/lint; test helper dùng same installed esbuild/staging logic, không mô phỏng bundle.

## ACTUAL browser smoke journey

Author/save name-picker nhiều weighted items; Try spin→exclude→reset; đóng Try, saved config không đổi. Present popup từ UI, Preview endpoint và hosted Share đều mount trực tiếp runtime thật.
Chơi hai blocks cùng slide và vertical child, rời/quay lại, hide/show và replay trong animation/timer pending; observer kiểm score/exclusion/remaining và không nghe duplicate events.
Download portable HTML từ UI, mở file:// context mới với network blocked, wheel/dice/button chọn/reset được, JS/CSS/image tải đủ không parent globals; local label không hứa multiplayer.
Exercise Enter/Space/arrows/native select tại320/768/desktop/touch/reduced motion, navigation ngoài root còn chạy; Electron current CSP chạy IIFE/inlineCSS không eval, không giả định data-script được phép.

## Success criteria + unchecked actionable checklist

- [ ] Generated Present/Preview/Share và native Try chơi name-picker thật cùng implementation; canvas edit inert và saved JSON unchanged.
- [ ] Root mount/config serialization an toàn, roots effective parent/vertical/master độc lập, không duplicate listeners/sockets.
- [ ] Local deadlines pause/resume đúng; live deadlines không pause; replay/destroy chặn mọi callback generation cũ.
- [ ] Native control activation đúng một lần không đổi slide trong widget; deck navigation ngoài widget giữ nguyên.
- [ ] Vendor runtime.js/runtime.css hashes và required manifest/closure đúng; portable file chạy network blocked, thiếu asset fail actionable.
- [ ] New/split production modules <200 LOC, no React/CDN/eval/dynamic import/parent polling; docs/changelog cập nhật sau smoke receipts.

## Security/risks and failure protocol

High (cao × cao): generated injection parser break; context-specific JSON/bootstrap/vendor escaping, mixed-case closing fixtures và parent marker behavioral test, không dựa esbuild escape đơn lẻ.
High (cao × cao): duplicate socket/scoring hoặc callbacks replay; existing bootstrap owns auth/socket, generation scoped session và destroy resource cleanup.
High (cao × cao): Reveal Space/button collision; scoped keyboardCondition chained, action delegation child-control exclusion và actual6.0.2 smoke; không global keyboard=false.
High (vừa × cao): portable/CSP failure; prefer hosted vendor + portable inline JS/CSS, preserve sandbox; opaque srcdoc URL base vẫn parent nhưng origin permission độc lập.
Sandbox allow-scripts không chặn mạng/exfiltration; no secret/capability đi vào authored frame/JSON, message bridge event.source+token+schema nếu cần, full sandbox closure phase14.
Rollback: atomically restore vendor manifest/bundle/assets và generator/adapter checkpoint đồng bộ; không rollback JSON schema03 hoặc bật unsafe-eval/allow-same-origin để chữa smoke.
Nếu assets, keyboard hoặc direct mount smoke fail, chặn dependent05–11; báo URL/root/resource/state receipts, sửa đúng boundary, không thay bằng React-only green.
Unchecked facts: installed/vendor artifact version, Electron production CSP behavior và user deployment proxy CSP phải fresh scout/smoke; current phase chưa có executed receipts.

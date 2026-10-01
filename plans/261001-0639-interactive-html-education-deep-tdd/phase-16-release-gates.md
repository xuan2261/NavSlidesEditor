---
phase: 16
title: "Release gates hành vi cho 19 elements và 19 game subtypes"
status: pending
priority: P1
dependencies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
---

# Phase 16 — Integrated release qualification

## Goal
Khóa evidence cho author → save/reload/undo/duplicate → Try/Present/Share → Download file:// và eligible Live; không dùng pass count hoặc matrix editor-core làm bằng chứng game mới đã chạy.
PPTX/PDF có snapshot câu hỏi/board thực, không interactive claim; docs mô tả đúng 19 canonical types và 19 game subtypes với local/live boundaries.

## Context/evidence
- Authority là `reports/execution-contracts.md:17-27,37-47`; mọi dependency phải được smoke và bàn giao trước final gate.
- Canonical inventory là `client/src/data/element-defaults.js:7-256`; game là một discriminator. Hiện Reveal dùng 6.0.2 tại `shared/src/reveal-runtime-assets.js:3`, không nâng dependency.
- Print gọi renderer với forPrint tại `shared/src/htmlGenerator.js:599-603`; PPTX fallback/raster/placeholder tại `client/src/utils/export-pptx-fallback-renderer.js:30-62`, action warnings tại `export-pptx-renderers.js:109-117`.
- Editor matrix loại game ở `scripts/feature-inventory/build-matrix.mjs:142-145`; manifest chỉ có game.score tại `feature-manifest.json:124-125`. Matrix xanh không chứng minh game surfaces.
- Extended report hiện viết về historical plan tại `scripts/feature-inventory/extended-domain-report.mjs:8-11`; stale evidence đã có trustedRunIndex guard tại `:35-36,69-70` nhưng chưa là game release gate.
- Join receipts theo executed status/title tại `scripts/feature-inventory/join-run-status.mjs:14-52,69-98`; missing/skipped không được coi là đã thực thi.
- Counts cần update sau smoke: `README.md:211,224`, `README_vi.md:5,30,45`, `website/features/game-mode.md:7-20`, `docs/codebase-summary.md:231-232`.
- `tests/e2e/element-preview-offline-runtime.spec.js:5-34` đọc source và setContent, không chứng minh file runtime; thay bằng journey thật.
- `tests/unit/electron-desktop-runtime-contracts.test.js:51-94` pin source/CSP wording; giữ URL-policy behavior `:15-48`, bỏ assertions source/wording obsolete.
- CSP thực áp dụng qua `electron/main.js:99-105`; flags renderer tại `:72-75`; đọc `research/sandbox-offline-research.md:31-43` để không suy sandbox chặn mạng.
## Deep scout gate
Re-glob/re-grep tất cả paths/symbols; trace controls → persistence → effective-slide renderer → exported artifact và game mount/transport theo mỗi required matrix cell.
List concrete modified callers file:line trước edit; load delivered phase registries/runtime/test filenames, không invent module names từ scout cũ.
Re-scout snapshot/redaction, real question media, runtime vendor staging/hashes và Electron/package entrypoint; inspect state lifetime per document/room, không chia sẻ game progress giữa blocks/decks.
Xác nhận Playwright project matching: `playwright.config.js:61-118`; new mobile/game tests cần match tablet-touch/mobile projects hoặc explicit viewport contexts, không assume default project chạy chúng.
Chỉ integration owner nối registry/defaults/renderers/export/package/feature manifest tuần tự; approval từng dependency trước final execution, không concurrent gate trên half-edited tree.
## Requirements
Tất cả cells của hai behavior matrices dưới đây bắt buộc có actual outcome; giữ native19/game19, full eligible Live, static export warnings và fail-closed evidence policy.
## Architecture/contracts
Deck configs vào factories/editor → persist native stable IDs → shared runtime local hoặc authenticated transport live → observable interactions/scores/reset → artifact receipts theo surface.
Snapshot flow: normalized config/public view → shared static snapshot → PDF/print và PPTX capture; default view không reveal answer key/solution/highlight correct match; explicit teacher reveal mới hiện đáp án.
Không gửi live host secrets/private keys vào participant HTML/Socket payloads; local file chứa answer config là giới hạn công khai, không hứa chống xem source.
Evidence manifest proposed tại `C:/Work/NavSlidesEditor/scripts/feature-inventory/reports/education-release-evidence.json` gồm runId, exact subject/hash, artifact hashes/runtime version, environment/browser/project/viewport/protocol, capabilityId, element/gameType/questionKind, surface/mode, scenarioId/testTitle, expected/observed, result, timestamp, artifact paths và limitations.
Evidence has separate frozen artifact identities for production-browser, Electron-dev and Windows-packaged lanes. The same source/config/docs/policy subject is captured after preliminary smoke + final documentation, before final runs; generated reports/receipts are outputs, not inputs to their own subject hash. Rebuilds invalidate only affected artifact receipts; a later source/policy change requires requalification.
Package receipt is produced by launching the NEW emitted unpacked/installed exe, records subject/policy hash + installer/exe/packaged client/shared/vendor hashes + observed interactions/CSP, and is validated/imported before the final conjunctive gate. Building/archiving an installer alone is never a packaged-runtime receipt.
Mỗi required cell phải có actual passed result đúng subject/surface/mode; missing/skipped/stale/TAGGED/INVENTORY/wrong surface không release-green. Existing 17 suites/246 tests là lịch sử, không receipt mới.
Game manifest scope game + tags `[cap:game.<subtype>.<surface>]`; thêm lifecycle/scoring/redaction/sandbox/portable/preset capabilities có scenarios thật, giữ editor-core report riêng và thêm explicit education release gate.
Gate dùng conjunctive required-cell policy, không kế thừa any-one-PASS trong matrix để claim parity; extended game report xuất stable scripts/feature-inventory/reports, không archived plan.
## File inventory
CREATE dưới đây là proposed; shared static/requirements contracts <200 LOC, tests split theo concern ≤200 LOC, docs chỉ sửa sau successful smoke.
| Full path | Operation / trạng thái | Ownership và test impact |
|---|---|---|
| C:/Work/NavSlidesEditor/shared/src/education/static-snapshot.js | CREATE / proposed nếu phase04 chưa cung cấp | Integration owner; reuse existing snapshot API, không engine thứ hai |
| C:/Work/NavSlidesEditor/shared/src/education/release-capabilities.js | CREATE / proposed | Shared owner; required cells từ registry <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/element-renderers.js | MODIFY / known | Integration owner; nối shared snapshot forPrint |
| C:/Work/NavSlidesEditor/client/src/utils/export-pptx-fallback-renderer.js | MODIFY / known | Integration owner; actual game snapshot thay placeholder |
| C:/Work/NavSlidesEditor/client/src/utils/export-pptx-renderers.js | MODIFY / known | Integration owner; accepted-limit warnings |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/feature-manifest.json | MODIFY / known | Integration owner; explicit game/surface capabilities |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/extended-domain-report.mjs | MODIFY / known | Gate owner; stable fresh game report path |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/education-release-gate.mjs | CREATE / proposed | Conjunctive gate + --import-package-receipt validation/merge by exact subject/policy/artifact identity; <200 LOC |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/education-release-gate.test.mjs | CREATE / proposed | Missing/stale/failing/wrong-subject/wrong-package required receipt invariants |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/prepare-education-qualification.mjs | CREATE / proposed | Gate owner; --stage safe snapshot of frozen declared inputs/lockfiles, collision refusal, no user data/secrets or original dependency mutation; <200 LOC |
| C:/Work/NavSlidesEditor/electron-builder.yml | MODIFY / known :3-4,15-37 | Integration owner; verify packaged native runtime/source/asset closure, no placeholder or unqualified platform claim |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/reports/education-release-evidence.json | CREATE-GENERATE / proposed | Actual per-cell result manifest sau execution, không fabricated trong planning |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/element-control-expected-controls.json | MODIFY / known | Gate owner; deferred game rows trở thành exercised |
| C:/Work/NavSlidesEditor/scripts/feature-inventory/element-control-audit-matrix.json | MODIFY / known | Gate owner; per-field outcomes và accepted limits |
| C:/Work/NavSlidesEditor/client/src/data/element-defaults.test.js | MODIFY / known | Remove source/prose/matrix-copy guards; keep behavioral boundaries |
| C:/Work/NavSlidesEditor/tests/unit/electron-desktop-runtime-contracts.test.js | MODIFY / known | Remove source/CSP pins, retain URL policy behavior |
| C:/Work/NavSlidesEditor/tests/e2e/element-preview-offline-runtime.spec.js | DELETE / known | Obsolete source assertion suite, real journeys thay thế |
| C:/Work/NavSlidesEditor/shared/tests/education-static-snapshot.test.js | CREATE / proposed | Default vs explicit teacher-reveal behavior |
| C:/Work/NavSlidesEditor/tests/e2e/education/ordinary-elements-release.spec.js | CREATE / proposed | 19 controls/persist/render/export outcomes |
| C:/Work/NavSlidesEditor/tests/e2e/education/game-surfaces-release.spec.js | CREATE / proposed | 19 subtype Try/Present/Share/portable outcomes |
| C:/Work/NavSlidesEditor/tests/e2e/live/education-release-live.spec.js | CREATE / proposed | Real host + two learners, authority/redaction |
| C:/Work/NavSlidesEditor/tests/e2e/education/static-exports-release.spec.js | CREATE / proposed | PDF/PPTX generated artifacts and warnings |
| C:/Work/NavSlidesEditor/tests/e2e/education/desktop-runtime-release.spec.js | CREATE / proposed | Real dev/NEW packaged Electron launches; NAVSLIDES_PACKAGED_EXE selects emitted exe and NAVSLIDES_EDUCATION_PACKAGE_RECEIPT records actual package interactions/CSP; no mock app |
| C:/Work/NavSlidesEditor/tests/e2e/education/release-evidence-reporter.js | CREATE / proposed | Actual per-cell observations/attachments <200 LOC |
| C:/Work/NavSlidesEditor/playwright.config.js | MODIFY / known | Integration owner; mobile/project/reporter matching |
| C:/Work/NavSlidesEditor/package.json | MODIFY / known | Integration owner; proposed matrix:education-gate script |
| C:/Work/NavSlidesEditor/README.md | MODIFY / known | Counts/limits sau smoke |
| C:/Work/NavSlidesEditor/README_vi.md | MODIFY / known | Counts/version truth sau smoke |
| C:/Work/NavSlidesEditor/website/features/game-mode.md | MODIFY / known | 19 subtypes/local/live sau smoke |
| C:/Work/NavSlidesEditor/website/vi/features/game-mode.md | MODIFY / known | Tương ứng Vietnamese |
| C:/Work/NavSlidesEditor/docs/codebase-summary.md | MODIFY / known | Shared runtime/export architecture |
| C:/Work/NavSlidesEditor/docs/system-architecture.md | MODIFY / known | Explicit game gate, không stale 100/100 qualification |
| C:/Work/NavSlidesEditor/docs/export-fidelity-and-limits.md | MODIFY / known | Static snapshot/reveal/portable/sandbox limits |
| C:/Work/NavSlidesEditor/docs/project-changelog.md | MODIFY / known | Working-tree evidence; không publish/release claim |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md | GENERATE / known | Chỉ generator sau fresh receipts, không hand-edit |
## Tests Before — RED scenarios
Tạo proposed tests trước: gate từ chối missing game/file/live cell dù editor-core toàn PASS; stale/wrong artifact/browser/mode và một failure vẫn nonzero dù có sibling PASS.
Default print/PPTX snapshot phải thấy prompt/board nhưng không correct markers/solution; teacher reveal có explicit opt-in, action/game-interactivity warning đúng element.
All19 author field journeys mutate field, persist/reload, Undo/duplicate, inspect visible/accessible render và artifact outcome; không assert control tồn tại hoặc source chứa field name.
Live duplicate/late/wrong-session/old-generation/disconnect submissions không double score; receiver keys không lộ trước reveal; local file không kết nối socket.
Desktop real CSP cho inline runtime/styles chạy nhưng eval/undeclared network/data-script bị chặn; mixed-case closing-tag fixture không inject parent marker.
RED chưa chạy trong planning; record failures lúc implementation, không dùng pinned wording/source tests làm TDD evidence.
## Behavior matrix — 19 canonical ordinary elements
Mỗi hàng chạy editor controls → save/reload/Undo/duplicate → canvas/Present/Share/portable và PPTX/PDF mapping hoặc explicit accepted-format limit; common geometry/lock/hidden/fragments/actions/align/multi-select dùng matrix phụ có kết quả từng field.
| Type và source defaults | Mức | Observable field outcome bắt buộc |
|---|---|---|
| text — element-defaults.js:8 | High | Rich marks/fontFamily/lineHeight/list/link đọc được, giữ typography sau reload/export |
| image — :16 | High | src/crop/fit/filters/border/flip/alt/decorative/longDescription/citation giữ đúng; mixed-select fanout |
| shape — :41 | High | Đổi shape kind không mất geometry/style/text/fontSize/textColor; rotation/opacity và label đúng |
| code — :55 | High | language/font/rounding/walkthrough step đổi đúng lines; static export có code đọc được |
| latex — :66 | High | Formula/TikZ render input thực, font/color; assets offline và format warning khi cần |
| html — :79 | Critical | Script local hoạt động, parent/network isolation; Mermaid/forPrint/portable final-frame đúng |
| markdown — :95 | High | Heading/list/bold/italic/inline code/link phân biệt đúng typography trong print |
| chart — :104 | High | chartType/data/area/stack/legend/axis controls thay plot, reload/export giữ authored series |
| video — :118 | High | src/poster/fit/controls/muted/loop/start/end/rate/tracks đúng; playback cần user gesture |
| audio — :134 | High | Audio source/controls/loop/muted/captions/transcript đúng; không nhầm video control policy |
| table — :145 | High | cell data/style/header/border/padding/row-column sizes và persisted merged cells render đúng |
| icon — :180 | Medium | iconName/color/stroke thực sự đổi glyph, export không mất bounds |
| callout — :188 | Medium | number/colors/font và resize không nhảy do min bounds; label readable |
| qrcode — :197 | High | qrData/colors/error level tạo QR decode về đúng payload, không chỉ có SVG |
| drawing — :206 | High | path/stroke editing/resize/visibility render đúng và không mất paths khi duplicate |
| line — :214 | High | endpoints/curve/stroke/arrows/dash và connector attachment giữ geometry, PPTX flatten warning |
| svg — :231 | High | content/fillOverride/strokeOverride đổi hình; unsafe payload không thoát document |
| timeline — :240 | High | range/ticks/events/items/colors/date editing đổi output, bounded ticks; export giữ event meaning |
| game — :256 | Critical | native config editable/persisted, edit inert, Try playable; subtype matrix bên dưới |
## Behavior matrix — 19 game subtypes
Mọi hàng: editor config/save/Undo/duplicate → Try → generated Present → hosted Share → actual portable file → complete/reveal/score nếu có/reset; PPTX/PDF static view kiểm cùng hàng. Live chỉ nơi registry khai báo và real server behavior đã giao.
| gameType | Mức | Transition/observable outcome và Live boundary |
|---|---|---|
| name-picker | High | Pick/exclude/weighted/reset; giữ existing live broadcast contract, không giả learner answer |
| hot-potato | Critical | Question/timer/late policy/speed score/replay; Live authoritative |
| jeopardy | Critical | Cell/turn/daily-double/score once/replay; Live server-owned lifecycle |
| four-corners | Critical | Choose/eliminate/timer/reset; Live corner submission authoritative |
| relay-race | Critical | Team/turn/baton/wrong policy/reset; Live team ownership |
| trivia-champ | Critical | Authored rounds/buzz/lightning/jackpot/reset; Live arbitration |
| scattergories | Critical | Letter/categories/unique submissions/score/reset; Live validation |
| poll | Critical | One-device vote/change/reveal/reset; Live aggregate eligible |
| word-cloud | Critical | Local phrase/caps/aggregate/clear/reset; Live submissions eligible |
| matching | Critical | Pair IDs/drag/drop/click/keyboard/result/reset; Live redacted matching |
| quiz | Critical | Seven kinds/attempt IDs/exact scoring/media/feedback/reset; Live typed submissions |
| lucky-wheel | High | Weighted prize/remove/reset; local, không hứa phone participation |
| countdown | High | Start/pause/resume/expiry/reset; local hoặc bounded synchronized timer đã thực thi |
| scoreboard | High | Team add/subtract/binding/reset rules; local hoặc bounded score session đã thực thi |
| memory | High | Pair text/image/flip/mismatch/completion/reset; local only |
| flashcards | High | Front/back/next/previous/reset; local only |
| sorting | High | Bucket/item IDs/place/grade/reset và keyboard; local only |
| crossword | High | Valid authored/generator layout/input/check/reset, bounded failure; local only |
| word-search | High | Seeded valid grid/word selection/completion/reset và keyboard; local only |
## Numbered implementation steps
1. Scout delivered contracts, tạo required-cell evidence schema/reporter và RED tests; current modules/test paths dùng citations mới.
2. Nối shared static snapshot vào PDF/PPTX, redact default view, preserve geometry/warnings; reuse phase04 API nếu đã có, không duplicate renderer.
3. Hoàn thiện targeted field/subtype journeys, mobile project matching và real live contexts; bỏ obsolete source/wording/mock-echo assertions, không re-pin.
4. Thêm game capabilities/tags + explicit education gate; stable extended report path, required-cell conjunction và exact fresh receipts.
5. Preliminary focused smoke establishes correctness, then finalize source/config/docs/policy and freeze exact subject. Prepare isolated qualification stage from declared inputs/lockfiles (exclude user data/secrets and generated receipt outputs); refuse unrelated stage overwrite and install locked dependencies only there.
6. Publish/build/runtime-verify production browser artifacts BEFORE final browser/live/static runs; collect fresh receipts tied to frozen subject and lane artifact hashes. Keep all later matrix decisions pending while any required package cell is absent.
7. Build Windows inside isolated stage; launch the NEW unpacked/installed app, exercise native/local/CSP paths with isolated fixture data and collect exe/installer/embedded client/shared/vendor hashes plus actual observations. Separate Electron-dev and packaged receipts; external file Chromium remains an independent lane.
8. Validate/import package receipt, merge all actual lane receipts, THEN run matrix:gate, matrix:extended-report and matrix:education-gate as the final conjunctive decision. Regenerate reports without changing frozen input policy; any later source/artifact change invalidates affected receipts and requires fresh qualification.
## Refactor
Refactor chỉ quanh affected snapshot/evidence paths; new shared logic <200 LOC, no fallback placeholder cho native game, no skipped acceptance hoặc fake implementation.
## Tests After — GREEN
GREEN là actual artifacts/state transitions cho từng required cell; clocks/random fakes chỉ ở unit, browser/live/Electron chạy implementation thật.
## Executable focused commands
Only during implementation, from root; CREATE tests/reporter/stage helper and package-receipt import mode first. Stop on any nonzero command. Final documentation/subject freeze follows preliminary smoke and precedes this final lane; reporter merges actual observations without replacing earlier projects.
```powershell
npx vitest run shared/tests/education-static-snapshot.test.js scripts/feature-inventory/education-release-gate.test.mjs
$env:PLAYWRIGHT_USE_DEV_SERVERS='0'
npm run vendor
npm run build
npm run runtime:verify
npx playwright test tests/e2e/education/ordinary-elements-release.spec.js tests/e2e/education/game-surfaces-release.spec.js tests/e2e/education/static-exports-release.spec.js --project=chromium --workers=1
npx playwright test tests/e2e/live/education-release-live.spec.js --project=chromium-live --workers=1
npm test
npm run lint
npm run test:feature-inventory
npm run test:e2e
npm run docs:build
$env:NAVSLIDES_PACKAGED_EXE=$null
npx playwright test tests/e2e/education/desktop-runtime-release.spec.js --project=chromium --workers=1
node scripts/feature-inventory/prepare-education-qualification.mjs --stage .tmp/education-release-stage
npm --prefix .tmp/education-release-stage ci
npm --prefix .tmp/education-release-stage run electron:build:win
$env:NAVSLIDES_PACKAGED_EXE=(Resolve-Path '.tmp/education-release-stage/dist-electron/win-unpacked/NavSlides Editor.exe').Path
$env:NAVSLIDES_EDUCATION_PACKAGE_RECEIPT='.tmp/education-release-stage/education-package-receipt.json'
npx playwright test tests/e2e/education/desktop-runtime-release.spec.js --project=chromium --workers=1
node scripts/feature-inventory/education-release-gate.mjs --import-package-receipt .tmp/education-release-stage/education-package-receipt.json
npm run matrix:gate
npm run matrix:extended-report
npm run matrix:education-gate
```
Expected unpacked exe path is inferred from current electron-builder.yml productName/output; confirm the ACTUAL emitted Windows path before Resolve-Path/launch, never fabricate a receipt for a guessed path. Stage helper copies declared frozen source/config/docs/lock inputs and initializes isolated fixture data, not user's presentations/uploads/secrets; npm ci/prepare may mutate only that owned stage. Compare frozen source/policy identity before receipt import. No publish/sign/deploy and no macOS/Linux claim.

## ACTUAL browser smoke journey
Mở real editor tại 320/768/desktop; keyboard/Enter/Space/touch/reduced-motion, add multiple native blocks + image/media/HTML, save/reload/Undo/duplicate; check visible controls và independent runtime progress.
Try rồi generated localhost Present/Share; navigate vertical/master/fragments, leave/return timer pause local vs live deadline, replay/destroy không leak listener/scoring; kiểm Reveal 6.0.2 keyboard/lifecycle không đổi version.
Download thật, mở file:// trong fresh Chromium với all HTTP(S) aborted và socket observer; 19 applicable local rows hoàn tất/reset, media/font/plugin/question images và sáu simulations chạy.
Live host + hai separate learner contexts: correct/wrong/late/duplicate/session replay/disconnect/reconnect; host/learners scoreboard khớp, waiting không silent local fallback, private keys absent trước reveal.
PDF qua actual print artifact và PPTX qua actual downloaded package/rendered capture: prompt/board thấy được, chưa reveal không có correct highlighting; teacher reveal explicit, warnings chỉ format limits.
Launch Electron thật, exercise current CSP trên localhost và mount vendor runtime; installer/unpacked Windows chạy deck/local interactions. External browser file smoke không thay bằng mở arbitrary file trong desktop shell.

## Success criteria + unchecked actionable checklist
- [ ] 19 canonical types và 19 subtype matrix có per-field/per-surface actual evidence đúng subject, không row bỏ trống hoặc dùng historical 246-pass receipt.
- [ ] Root author/save/undo/clone/Try/Present/Share/file journeys hoàn tất; local no-network, eligible live authoritative/redacted/replay-safe.
- [ ] Default PPTX/PDF có snapshot thật, không answers trước reveal; explicit teacher view và accepted-limit warnings đã quan sát.
- [ ] Mobile/keyboard/touch/reduced-motion/security journeys and inherited tuple isolation pass; actual audience payloads stay public and newly built Windows packaged runtime has its own validated/imported receipt before final gate.
- [ ] Targeted rồi whole unit/E2E/lint/build/vendor/runtime/docs/matrix gates green; game gate fail closed cho missing/stale/wrong-scope evidence.
- [ ] README/docs giữ canonical19, game19 và boundaries đúng; generated matrix không hand-edit, không release/publish claim chưa được phép.

## Security/risks and failure protocol
High (cao × cao): matrix any-one-pass/editor-core optimistic scope; conjunctive per-cell gate, fresh actual-run receipts, reject unknown/missing/skipped/stale evidence, không allowlist acceptance holes.
High (vừa × cao): answer leak/static snapshot hoặc game cross-instance state; redacted default projection, live payload checks, multiple blocks/decks và session-generation tests.
High (vừa × cao): desktop/file CSP divergence; actual Electron + external file browser riêng, inline packaged JS/CSS, no unsafe-eval/webSecurity disable; sandbox không thay per-embed network policy.
Rollback qualification/config/report changes về checkpoint cùng subject; invalidate receipts/claims ngay, không rollback native saved config sang runtime không hỗ trợ. Runtime/vendor/manifest rollback atomic, user data giữ nguyên.
Gate fail: giữ fixture/artifact/runId, giao đúng owner sửa và rerun affected lane rồi fresh aggregate; không đánh completed khi packaging/runtime prerequisite thiếu. Unchecked: installer/signing environment, real mobile hardware/proxy CSP và actual metrics chưa chạy; ghi exact missing scope, không suy từ browser emulator hoặc source pins.

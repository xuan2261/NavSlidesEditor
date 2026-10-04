---
phase: 1
title: 'Baseline, corrected findings and locked behavioral contracts'
status: completed
priority: P1
dependencies: []
---

# Phase 01 — Baseline, đính chính review và khóa contract

## Execution progress

Qualified Phase01 checkpoint đã được ghi nhận; [baseline superseding assessment](./reports/baseline-evidence.md) giữ historical failures đúng phân loại, không nâng raw server export thành portable proof. [Root progress](./plan.md#execution-progress) dẫn tới qualification report trong coordinator checkout. Completion ở đây chỉ là baseline/contracts acceptance, không phải standalone gameplay, current-subject integration hoặc release.

## Goal

Khóa consumer-visible contracts và failing regressions trước thay runtime; đủ evidence để không sửa nhầm Shape, TipTap, alignment hoặc Jeopardy scoring.

## Context / evidence

- [Scope ledger](./reports/scope-ledger.md), [Execution contracts](./reports/execution-contracts.md), [Evidence](./reports/evidence-index.md).
- Present endpoint `server/routes/presentations-extras.js:91-116` gọi shared generator; `renderGame` `shared/src/element-renderers.js:951-1004` là static fallback.
- Shape label controls đã có tại `client/src/components/properties/shape-properties.jsx:247-292`.
- Fanout geometry dùng delta `element-update-fanout.js:82-92`; prior primary-only alignment claim chưa chính xác.
- 246 tests của 17 suites đã pass trong review trước; không dùng nó làm proof Present/game chạy hoặc baseline revision mới.

## Deep scout gate

1. Resolve current source/working changes, không reset file của user. Đọc docs/contracts và các owning modules.
2. Đọc references/definitions bằng LSP nếu symbol exports sẽ bị thay. Xác nhận endpoint→generator→game mount và tất cả callsites trước cutover.
3. Ghi source snapshot/dirty-file boundaries vào evidence; không viện dẫn historical completed plans là current pass.

## Requirements

- Mọi R01–R14/P01–P12 trong ledger có phase và scenario; không mất scope.
- Quyết định local/live, reset, clock, scoring, registry/type counts như execution contracts.
- Chọn 19 canonical types/19 eventual subtypes; metadata schema phân biệt editor hidden vs initialVisibility.
- Editor authoring inert; Try mount riêng; Present generated-document là acceptance path.
- Production modules mới/tách dưới200LOC; integration chokepoints có owner.

## Architecture / ownership

Repo-level integration owner thay element/default registries, shared generator/renderers, vendor/package integration, GameProperties/Insert, live handlers và portable export theo phase dependency. Domain implementers thêm cohesive pure/reducer/presenter modules; không cùng sửa registry khi chạy song song.

Native runtime public API: `NavSlidesEducation.mount(root,{mode,transport,clock,random})`, trả về `{getState,reset,destroy}`. Không expose answer keys trong public live state. Local round states không ghi ngược vào presentation JSON.

Các canonical schemas/reducers nằm `shared/src/education/` (proposed); browser DOM module ở `shared/src/education/browser/`; compiler dùng existing esbuild. Serializer escape `</script>`, attributes và JSON riêng đúng context, không eval.

## File inventory

| Full path                                                                                                    | Action                                        | Size / test impact                                                      |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------- |
| `C:/Work/NavSlidesEditor/shared/tests/element-renderers.test.js`                                             | Modify existing behavior only                 | Existing long suite; không mở rộng monolith bằng assertions source text |
| `C:/Work/NavSlidesEditor/shared/tests/htmlGenerator.test.js`                                                 | Modify existing generated document assertions | Endpoint content, correct runtime integration                           |
| `C:/Work/NavSlidesEditor/client/src/utils/element-update-fanout.test.js`                                     | Modify existing                               | Selected geometry/fanout boundaries                                     |
| `C:/Work/NavSlidesEditor/tests/e2e/games/game-elements-canvas-rendering.spec.js`                             | Modify existing                               | Bỏ placeholder expectations khi runtime cutover, thêm behavior          |
| `C:/Work/NavSlidesEditor/tests/e2e/education/fixtures/interactive-deck.js`                                   | Create proposed                               | Fixture modules tách <200LOC; IDs config thật                           |
| `C:/Work/NavSlidesEditor/tests/e2e/education/presentation-baseline.spec.js`                                  | Create proposed                               | Normal Present popup, multiple game blocks, vertical slide              |
| `C:/Work/NavSlidesEditor/plans/261001-0639-interactive-html-education-deep-tdd/reports/baseline-evidence.md` | Create during implementation                  | Snapshot + actual RED/smoke outcomes, không fabricate                   |

## Tests Before — RED

| Severity | Scenario                                       | Failure / invariant                                                                |
| -------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Critical | Insert Name Picker, save, click normal Present | Click pick phải tạo winner; hiện tại generated card không có play                  |
| Critical | HotPotato2 questions, actual popup             | Answer feedback/next must progress second question, không text-first-only          |
| High     | Export offline native game                     | Network blocked, playable interaction; chưa có runtime hydration                   |
| High     | 2 images + long description                    | Metadata applied both after reload, không silently discarded                       |
| High     | Unequal-width shapes Format align              | Chứng minh actual deltas trước định nghĩa desired multi-align                      |
| High     | Jeopardy local action + incoming event         | Chỉ ghi bug nếu sequence thực sự double-applies; policy negativePoints documented  |
| Medium   | Existing Shape label size/color                | Must continue rendering/persisting; protection regression, không thêm controls lặp |
| Medium   | TipTap font/lineheight                         | Text renders style after save/reload; không suy từ fallback defaults               |

Test baseline failures phải đúng expected path; import error, missing fixture/server hoặc unrelated failing suite không được tính RED feature.

## Numbered implementation steps

1. Tạo isolated deck fixture có text/image/shape, ten game configs, vertical child, actions, HTML quiz và simulation content; dùng existing API fixture lifecycle để create/delete, không đụng presentations thật.
2. Chụp actual editor/Present behavior; ghi popup URL, rendered node, visible outcome. Kiểm tra socket runtime bootstrap không mount game GUI hiện tại.
3. Ghi confirmed/conditional/rejected classification cho R05/R07/R09/R10/R11; giữ scope outcome nhưng không implement premise sai.
4. Khóa public/private quiz schema, type registry, ID remap rules, timer/reset semantics, local/live capability labels trong contracts.
5. Tạo failing behavioral regression tại owning test nhỏ trước production phase; khi baseline RED intentional, runner chạy đúng targeted spec, không làm unrelated full-suite gate giả PASS.
6. Xác định new tests nào thật sự consumer-visible; thay source/placeholder expectations obsolete bằng runtime behavior trong phase thực hiện.
7. Lập file ownership handoff và rollback backup policies cho migration fixtures; không sửa checked-in real data trước Phase15.

## Refactor

Không refactor production trong baseline. Không giữ duplicate expectation `game export must be static` sau cutover; xóa wording/source assertions làm obsolete. Fixture reusable tách theo quiz/game families, không bản copy khổng lồ.

## Tests After — GREEN baseline gate

Ở phase này GREEN là baseline contracts/fixtures đúng và regression được phân loại đúng, **không phải** native game đã implemented. Giữ failing-before evidence cho feature phases; không claim root outcome xong.

```powershell
npx vitest run client/src/utils/element-update-fanout.test.js client/src/data/element-defaults.test.js
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/education/presentation-baseline.spec.js --project=chromium
```

Command Playwright trên là proposed: tạo spec trước khi chạy, uses current playwright webServer isolation. Expected feature failures phải ghi rõ; baseline gate chặn phase sau nếu failure do môi trường thay vì contract.

## Actual browser smoke

Khởi chạy app qua runner hiện có, dùng editor thật: tạo fixture → Insert → properties → Save → Reload → Present popup. Không coi `renderToString(isPresenting:true)` là bằng chứng. Observe existing shape label, text font style và multi-align tọa độ; export file kiểm tra offline gate chưa được triển khai. Đóng pages/contexts và xóa riêng fixture.

## Success criteria / executable checklist

- [x] Current source và ownership documented, user changes untouched.
- [x] Scope R01–R14/P01–P12 mapped, no omission.
- [x] Confirm/reject conditional review premises by actual path.
- [x] Record expected RED for generated Present games and portable game path.
- [x] Define shared schemas, reset/scoring and capability semantics for following phases.
- [x] Verify baseline fixtures/tests do not modify actual user decks.
- [x] Save actual browser observations and baseline limits in evidence.

## Security / risks / failure protocol

Generated local fixtures include answer keys; live projection must redact later. Do not import an untrusted HTML fixture into real editor session. Failing unknown baseline issue: record exact file/test/actual outcome, isolate owning prerequisite and fix reachable planning assumption; do not suppress error, change expected semantics or promise later completion. Nếu thay scoring product decision không có source evidence, hỏi user đúng tradeoff trước edit.

## Next

02 editor control fixes và 03 shared schemas bắt đầu sau gate baseline; các phase khác phụ thuộc sơ đồ ở plan. Docs/changelog chỉ cập nhật cho production change đã smoke, không sửa product docs để nói baseline đã ship.

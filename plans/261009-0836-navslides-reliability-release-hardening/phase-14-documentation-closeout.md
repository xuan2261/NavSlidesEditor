---
title: "Phase 14: Documentation drift, claims và evidence closeout trước release"
status: pending
priority: P1
depends_on: [02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 13]
---

# Phase 14 — Tài liệu có nguồn kiểm chứng, không tuyên bố release sớm

## Phạm vi và DAG

- [ ] **Pending; PLAN-only. Không chạy tests, generator, build hoặc release trong task viết plan.** Không thay runtime/docs sản phẩm ở bước này.
- [ ] Nhận evidence từ `02,03,04,05,06,07,08,09,10,11,13`; thiếu evidence thì claim tương ứng là pending/blocked, không tự điền PASS.
- [ ] Phase14 chuẩn bị docs release và evidence index **dựa trên pending gates**. Phase12 chạy final qualification **sau 14**, ghi post-run addendum cùng artifact receipts/publication result. `13 → 14 → 12`; **14 không phụ thuộc 12**, không chờ final release để hoàn thành bản chuẩn bị.
- [ ] “Closeout phase14” chỉ nghĩa reconciled documentation + handoff, không có nghĩa product qualified/published. Mọi từ final/released/verified phải có phạm vi và provenance.
- Không sửa số liệu báo cáo/journal lịch sử cho khớp runtime hiện tại; không thay security/PPTX guarantees bằng văn marketing. Không thực hiện version bump hay workspace migration trong phase này.

## Rescout bắt buộc cho từng priority

Đã đọc CLAUDE.md, package.json, runtime-versions.json, release-state/runtime receipt scripts, editor runtime/controllers/thumbnails, testing configs, README và các đoạn architecture/testing docs liên quan. Source review không thay run evidence.

| Ưu tiên / owner vai trò | Drift quan sát được / cần re-scout | Quy tắc hành động |
| --- | --- | --- |
| P1 version/workspaces — release maintainer | CLAUDE nói 4 npm packages gồm electron; package.json thực tế workspaces là server/client/shared/website. Root product version 1.17.0 không tự chứng minh published release | Phân biệt npm workspace, desktop runtime, product version, published tag và runtime pin; đọc manifests/locks/tag ở SHA mới trước sửa |
| P1 claims — security + PPTX owners | Claims phụ thuộc 02–11 và pending phase12; `release-state` trả publicationStatus `not-verified` | Không chuyển candidate thành released chỉ vì version/tag hoặc exit 0 |
| P1 architecture — editor maintainer | codebase-summary còn “editor body stays inline”; runtime có EditorWorkspace/EditorNavigator/controllers; code-standards nói presentation store nhưng EditorPage giữ presentation local | Trace imports/callers hiện tại, không suy ra store ownership từ tên file |
| P2 UX/perf — UI + performance owners | Design guide nói hidden slides reduced opacity; navigator source không có nhánh hidden-slide tương ứng. Phase13 chưa có baseline đo | Ghi mismatch để quyết định sửa claim/đặc tả; không triển khai feature để làm doc đúng trong phase14 |
| P2 tests/counts — QA + docs owners | Testing guide nói E2E auto-start dev server; config mặc định production build. element-defaults.test.js có hardcoded 19 và typedef assertion, chưa phải guard parse mọi README claim | Tạo executable assertions nguồn→docs có fixture âm; không sao chép count của registry/Insert ribbon |
| P2 evidence — release + docs owners | Journals/report cũ có counts và trạng thái theo run cũ | Chỉ append correction/addendum trỏ bản cũ; index hiện tại không được tái gán kết quả cũ cho SHA mới |

- [ ] Trước **mỗi** priority: ghi SHA, owner, paths/line ranges mới, upstream receipt và diff từ lần scout; xác minh claim còn tồn tại trước sửa. Pending owner chưa được phân công cụ thể là blocker cho acceptance, không phải chữ ký giả.

## Inventory xác minh / dự kiến, kích thước và impact

Dòng là snapshot source đã đọc hoặc đo bằng fs, không phải số đếm test và không phải mục tiêu cắt file.

| Hiện hữu | Dòng đã kiểm tra | Tác động dự kiến khi thực thi |
| --- | ---: | --- |
| CLAUDE.md | 181 | Sửa workspace description, nguồn canonical; không rewrite lịch sử |
| README.md / README_vi.md | 541 / 470 | Claims bilingual cùng contract; giữ candidate/published distinction |
| docs/codebase-summary.md | 245 | Editor shell/controllers, ownership và workspace/runtime distinction |
| docs/system-architecture.md | 655 | Đối chiếu navigation/save/history và contracts upstream |
| docs/code-standards.md | 540 | Selector example, actual state ownership, JSDoc seam/type-check chỉ nếu phase13 duyệt |
| docs/design-guidelines.md | 330 | Hidden/offscreen semantics, thumbnail inert/focus; chỉ documented behavior đã chứng minh |
| docs/navslides-editor-vitest-playwright-k6-testing-guide.md | 308 | Built-client E2E default, command semantics, evidence limitations |
| docs/project-changelog.md | 577 | Append candidate entry có links, không sửa release entries cũ để xanh |
| package.json | 180 | Đọc scripts/workspace/product authority; chỉ thêm check script nếu approval |
| client/package.json / server/package.json / shared/package.json / website/package.json | 55 / 44 / 5 / 16 | Read-only authority inputs; không đồng nhất runtime pin với product version |
| runtime-versions.json | 14 | Read-only toolchain pin authority |
| scripts/ci/release-state.mjs | 174 | Existing version/lock/tag receipt, không tự chứng minh publication |
| scripts/runtime-receipt.js | 113 | Existing hash/environment/artifact receipt, không phải test-result receipt |
| client/src/data/element-defaults.test.js | 122 | Existing canonical-type guard; bổ sung đúng seam hoặc companion thay hardcode docs mới |
| vitest.config.mjs / playwright.config.js | 42 / 138 | Executable authority cho lanes/server/project, không đổi test architecture để sửa docs |

Các file nguồn này là cross-check inputs; chỉ sửa phần thật sự drift. `package-lock.json`, `electron/server-package-lock.json`, runtime vendor manifest và CI workflow phải inventory lại nếu claim chạm tới chúng, chưa coi là fully-reviewed trong scope này.

| **PROPOSED** chưa tạo | Kích thước dự kiến | Owner / impact |
| --- | --- | --- |
| scripts/docs/documentation-contracts.mjs | 100–180 dòng | Docs tooling; pure collection/validation, explicit source+owner mapping |
| scripts/docs/documentation-contracts.test.mjs | 120–190 dòng | QA; positive/negative isolated fixture, không mutate repo trong test |
| scripts/docs/documentation-claims.json | 60–120 dòng | Docs + domain owner; claim ID, source, target anchor, assertion, scope, evidence requirement |
| docs/generated/runtime-contracts.md | 40–100 dòng | Generated-only facts; link thay duplicate prose counts |
| docs/releases/navslides-hardening-candidate.md | 100–160 dòng | Release owner; limitations/pending gates và link addendum phase12 |
| plans/reports/navslides-hardening/phase14/<run-id>/manifest.json | 40–100 dòng | Evidence owner; immutable run index/hashes, không fake artifact |

Ước lượng không là lý do split arbitrary LOC. Trước tạo test .mjs, kiểm tra laneInclude/node-parallel hoặc node-serial discovery; không báo zero-test run là PASS. Không có `scripts/ci/release-state.test.mjs` tại path đã dò: không trích dẫn test tưởng tượng đó làm evidence.

## Executable doc assertions và authority

Generator/validator dưới đây là **đề xuất cần triển khai TDD sau này**, không phải script đang tồn tại. Đầu ra deterministically sorted, không timestamp thay đổi mỗi generate; run timestamp để ở receipt riêng. `--check` read-only trả nonzero nếu stale/missing/mismatch; `--write` chỉ cập nhật generated block được allowlist. Không regex toàn repo rồi rewrite prose/history tự động.

| Claim family | Nguồn authoritative | Assertion executable dự kiến | Owner |
| --- | --- | --- | --- |
| Npm workspaces | root package.json.workspaces | Tập paths + manifest existence; generated workspace table khớp, electron là runtime ngoài tập | Release/tooling |
| Product/candidate version | manifests, lock roots/workspace entries, release-state result ở clean subject | Đối chiếu version đúng policy existing script; tag kind/publication tách riêng, failure không fallback hardcoded version | Release |
| Runtime/toolchain | runtime-versions.json + applicable dependency/vendor receipts | Field-specific mapping, không ép Node local = Docker image tag hoặc mọi version phải bằng nhau | Supply-chain owner phase05 |
| Element types | Object.keys(ELEMENT_DEFAULTS) | Sinh count/list canonical, parse generated targets EN/VI; divider/inline math không cộng; registry/Insert actions không làm denominator | Editor + docs |
| State/navigation/thumbnail | Actual imports/controllers + S13/phase06 assertions | Contract tests cho ID/index, inert preview, child targeting; prose manual review có source links, không dùng string grep thay behavior test | Editor |
| Commands/testing | package.json.scripts + Vitest/Playwright config | Documented script tồn tại, lane/project/server mode đúng; proposal phải gắn PROPOSED không bị quảng bá như existing | QA |
| Performance | Phase13 approved raw samples/manifest | Claim size/cohort/hardware/cold-warm/p50-p95 khớp receipt; thiếu baseline approval → pending | Performance |
| Release/security/PPTX | Phase02–11 evidence manifests; phase12 bổ sung sau run | Claim phải có subject SHA, artifact hash, scope, gate status và domain sign-off; missing/skipped/stale không PASS | Domain + release |

Không sinh architecture assertions chỉ bằng sự tồn tại filename. Human review chứng minh ownership; executable test chứng minh behavior. Generated facts và behavior evidence có phạm vi khác nhau. Không giữ hardcoded tổng tests/files hiện tại trong prose; link inventory/run receipt. Historical counts giữ nguyên với ngày/SHA của chúng.

## Ma trận deep TDD

Mỗi scenario có setup độc lập, expected assertion và owner theo bảng trên; RED failure phải do mismatch chủ ý chứ không do thiếu dependency/import. Không chạy các scenario trong task này.

| ID | Risk / layer | Setup / kích thích | Assertion |
| --- | --- | --- | --- |
| S14-01 | P1 unit generator | Fixture workspaces thêm website, doc còn electron | --check fail nêu claim/path; write chỉ sửa generated block đúng tập |
| S14-02 | P1 unit contract | Manifest candidate version lệch một lock workspace | Validation fail có field diagnostic; không tự bump file để che mismatch |
| S14-03 | P1 integration receipt | Clean subject có candidate tag nhưng publication chưa kiểm chứng | Docs vẫn candidate/pending publication, không “released” |
| S14-04 | P1 unit generator | Thêm canonical element key, README generated block stale | Count/list assertion RED rồi GREEN sau generate; không hardcode expected count mới trong test |
| S14-05 | P2 unit | Registry/Insert thêm preset divider hoặc inline math | Canonical count không đổi; claim action count không bị nhầm type count |
| S14-06 | P1 docs contract | EN cập nhật limit/claim, VI stale | Target parity fail theo claim ID/giá trị, không ép hai bản dịch giống chữ |
| S14-07 | P1 integration/manual source | Store doc nói presentation owner là Zustand nhưng EditorPage local | Ownership review fail, link đúng controller/compose; không di chuyển state để khớp prose |
| S14-08 | P1 integration | Test guide nói dev default; config useDevServers=false | Validator/default-mode fixture fail; hướng dẫn cần build và isolated data đúng |
| S14-09 | P1 unit claims | Phase13 thiếu baseline hoặc chỉ có warm 50 slides | Không claim 300/cold/budget đạt; pending gate giữ nguyên |
| S14-10 | P1 unit evidence | Manifest upstream thiếu hash/SHA hoặc log thuộc revision cũ | Reject stale/missing evidence; không dùng một PASS cho tất cả phase |
| S14-11 | P1 unit evidence | Gate SKIP/xfail/not-run hoặc exit 0 nhưng zero tests | Không convert PASS; owner/waiver/expiry nếu permitted phải explicit |
| S14-12 | P1 filesystem integration | Generate/check hai lần, xen journal/report lịch sử | Output byte-identical; historical file hashes không đổi; check không write |
| S14-13 | P1 unit claim policy | Native PPTX/security broad claim nhưng evidence chỉ smoke scoped | Reject overclaim; approved wording ghi scope/limitations/deferred gates |
| S14-14 | P2 unit links | Xóa target doc/đổi anchor hoặc script không tồn tại | Local link/command validation nonzero, không tải mạng để giả xác nhận external evidence |
| S14-15 | P1 DAG/closeout contract | Phase14 ready với phase12 chưa chạy | Handoff hợp lệ nhưng release chưa final; đồ thị không có 14→12→14 cycle |
| S14-16 | P1 post-run addendum contract | Phase12 sau run nhận fail hoặc success khác artifact SHA | Addendum append đúng result; không overwrite phase14 pending receipt, không promote artifact khác |
| S14-17 | P2 unit authority | Node pinned, nodeFloor và nodeImage khác nhau hợp lệ | Field-specific validation không ép equality sai; version docs ghi đúng ý nghĩa từng field |
| S14-18 | P1 behavior evidence review | Hidden row/child slide claim không có test hoặc implementation tương ứng | Claim defer/correct có owner; không lấy docs làm bằng chứng cho chính docs |

## Tests Before → RED → Green → Refactor → Tests After

- [ ] **Tests Before:** rescout mỗi priority; chụp hashes historical docs và generated targets; collect upstream evidence còn pending; kiểm tra existing canonical guard và inventory discovery trước thêm checker. Existing mismatches ghi debt, không sửa cả repo vô điều kiện.
- [ ] **RED:** thêm fixture âm từng S14; chạy checker ở temp fixture cho workspace/version/count/claim sai. Manual architecture review ghi assertion/caller evidence thất bại khi chưa có executable tương đương.
- [ ] **Green:** implement minimal generator/validator theo allowlist; chỉ sửa active docs sections đã xác nhận drift. Giữ journal/report lịch sử nguyên vẹn, append correction link khi cần.
- [ ] **Refactor:** gom authority mapping/claim IDs tránh duplicate EN/VI, tách collection khỏi render/check vì trách nhiệm chứ không LOC; domain owners review claim boundaries.
- [ ] **Tests After:** chạy lại negative+positive contracts, deterministic generation twice, --check, link/script checks, docs build và upstream scoped tests nếu source liên quan thay đổi. Ghi command/exit/status/subject; docs build thành công không là product qualification.

### Lệnh thực có trong repo cho execution run tương lai

```bash
npx vitest run client/src/data/element-defaults.test.js
npm run test:inventory
npm run matrix:gate
npm run docs:build
npm run release-state
npm run runtime:verify
```

`test:inventory`/`matrix:gate` có thể ghi generated artifacts: chạy ở checkout thực thi được phép, capture diff và review, không overwrite report lịch sử. `release-state` yêu cầu subject/git sạch và tag/version/lock phù hợp; candidate untagged/dirty có thể fail đúng thiết kế. Không tạo tag chỉ để làm docs gate xanh. `runtime:verify` cần client/dist và closure hợp lệ, không bypass missing artifact. `npm run runtime:receipt` tồn tại nhưng phải đọc lại CLI/environment/artifact prerequisites trước dùng; receipt không chứng minh publication.

```bash
# PROPOSED commands: chỉ chạy SAU khi checker/fixtures đã được tạo và lane discovery review:
npx vitest run scripts/docs/documentation-contracts.test.mjs
node scripts/docs/documentation-contracts.mjs --write
node scripts/docs/documentation-contracts.mjs --check
# Review-only, không chạy tests:
git diff --check
git diff --name-only
```

Không dùng `npm run format` toàn repo cho phase này; không quảng bá npm script docs:check khi chưa thêm. Nếu generator cần import JSX/module ESM, chọn loader/build seam đã được review thay đọc bằng regex fragile; canonical source chỉ có một nơi.

## Evidence closeout và handoff phase12

- [ ] Claim ledger: `claimId, owner, sourcePaths, targetAnchors, upstreamPhase, subjectSHA, runId, command, exitCode, result(pass/fail/pending/blocked/deferred), artifactHash, limitations, reviewedBy`.
- [ ] Bundle phase14 có inventory/drift diff, assertion matrix S14, RED/GREEN logs, generated diff, local-link check, historical before/after hashes, domain approvals. Chưa thực thi thì không tạo “green receipt”.
- [ ] Release candidate doc ghi những gì đã xác minh và pending gates của 12; không copy số test từ report cũ, không gọi runtime receipt hoặc package version là final release evidence.
- [ ] Phase12 nhận frozen candidate docs + source/build/artifact subjects và checklist final gates. Sau final run, **phase12 sở hữu post-run addendum**: timestamp, exact commands, run links/hashes, final status, publication receipt hoặc “not verified”, changed limitations/rollback decision. Addendum append-only liên kết phase14; phase14 không mở dependency quay lại 12.
- [ ] Evidence thực tế khác prepared claim → phase12 chặn promotion, append correction/retraction; không sửa receipt lịch sử để trông như đã biết trước. Changed docs/source subject phải revalidate applicable gates, không carry PASS qua SHA khác không giải thích.

## Exit criteria và rollback

- [ ] Tất cả active factual assertions có authority + owner + executable guard hoặc manual evidence được ghi rõ; scenarios không áp dụng có rationale, không tick giả.
- [ ] Mọi priority đã re-scout; unresolved drift có owner/blocker/target phase; thiếu upstream evidence không được trình bày như verified.
- [ ] No stale live counts, no rewritten historical reports; generated output idempotent; EN/VI semantic parity; planned commands phân biệt existing/proposed.
- [ ] Domain/release/docs owners duyệt **prepared-for-qualification**, không “released”; phase12 final qualification và postrun addendum còn pending.
- [ ] Rollback nếu generator chạm file ngoài allowlist, claim rộng hơn evidence, hoặc docs build/guard regression: revert riêng generated/docs commit, giữ failed logs và claim ledger; invalidate derived claims về pending. Không revert runtime để khớp docs cũ, không xóa reports hay dùng version bump làm rollback.

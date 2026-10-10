---
title: "Phase 12 — Final release qualification sau code/docs freeze"
status: pending
priority: P0
dependencies: [phase-02, phase-03, phase-04, phase-05, phase-06, phase-07, phase-08, phase-09, phase-10, phase-11, phase-13, phase-14]
---

# Phase 12 — Final release qualification sau code/docs freeze

## Vị trí cuối DAG và bất biến

Phase 12 chạy **sau tất cả dependencies, kể cả 13 và 14**, không theo thứ tự số. Đây là PLAN-only: chưa build, test, scan, ký, dispatch, tạo tag/draft/publish hay sửa policy. Phần TDD chuẩn bị verifier có thể thiết kế trước freeze, nhưng mọi thay đổi test/code/docs phải hoàn tất rồi freeze lại trước final qualification. Nếu final gate tìm bug, trả về owner phase, sửa với RED/GREEN, freeze SHA mới và chạy lại; không sửa sau qualification rồi dùng receipt cũ.

Người dùng đã xác nhận giữ `linux-ci`/container và Windows **cả NSIS lẫn portable public**. `linux-desktop`/`macos-desktop` hiện not-selected đúng policy; không tự chọn thêm hoặc dùng not-selected cho Windows. Không hạ gate để hợp môi trường thiếu. Thiếu Windows host, protected signer, OfficeCLI, PowerPoint, DB/network, attestation hoặc approval => **blocked, không passed**. Host receipt hiện chỉ nhận passed/failed; blocked là trạng thái orchestration/report, không ép serialized schema giả hoặc tạo passed host receipt.

## Inventory và findings đã đọc

| File hiện hữu | Dòng / byte | Vai trò / impact dự kiến |
|---|---:|---|
| `.github/workflows/release.yml` | 190 / 9710 | Resolve exact tag, verify, stage draft, publish final; thao tác có approval riêng |
| `.github/workflows/reusable-green-sha-verification.yml` | 173 / 10494 | DAG CI/release, nguồn receipts; audit checkout create-root |
| `.github/workflows/reusable-windows-qualification.yml` | 170 / 9946 | Protected signer, physical evidence, pre/post signature, attestation |
| `config/release-target-policy.json` | 52 / 1424 | Target/gate floor, chỉ giữ hoặc tăng với duyệt, không downgrade |
| `scripts/ci/release-receipts.mjs` | 173 / 6295 | Qualification identity, parent receipt DAG, policy gate presence |
| `scripts/ci/release-receipt-workflow.mjs` | 199 / 7849 | Evidence adapters, cần test semantic provenance trước hash |
| `scripts/ci/release-subject.test.js` | 72 / 2108 | Exact tag/checkout/CI/artifact/receipt SHA tests |
| `scripts/ci/release-receipts.test.js` | 190 / 5692 | DAG/required-gate tests; không phình quá 200 LOC |
| `scripts/ci/authenticode-policy.test.js` | 63 / 1928 | Subject/thumbprint/time/hash/pre-post signature tests |
| `scripts/ci/release-evidence-source.test.js` (mới) | Chưa tồn tại; 140–190 dòng | Real-output fixture adapter tests, semantic negatives |
| `tests/unit/release-qualification-workflow-contract.test.js` (mới) | Chưa tồn tại; 120–180 dòng | Target/checkout/receipt source/approval boundary contracts |
| `scripts/ci/release-evidence-source.mjs` (mới nếu cần) | Chưa tồn tại; 120–190 dòng | Tách adapter khỏi file 199 LOC nếu RED đòi hỏi |

Findings tĩnh, chưa khẳng định runtime đã fail/pass:

- Linux adapter khởi tạo gate hashes từ `{result: 'passed'}`; evidenceRoot mới ghi đè docker/supply-chain/attestation. Hash một assertion tự tạo không chứng minh unit/playwright/load đã chạy. Cần validate nguồn job/runner evidence thật trước tạo gate digest.
- Windows physical adapter kiểm tra status/subject/client digest nhưng phải re-scout physical receipt schema để kiểm chứng producer, run, tool và claim scope; filename `.json` không đủ.
- Attestation adapter hiện parse JSON rồi tự gán issuer/identity/verified từ caller. Cần chứng minh chính output `gh attestation verify` chứa binding mong muốn; parseable JSON không phải verified provenance.
- Authenticode-post adapter dùng `signer.signature` lại trong evidence, trong khi workflow có Get-AuthenticodeSignature độc lập. Phải ghi kết quả post-download thực và hash đúng file, không copy pre-signature làm proof lần hai.
- `create-root` checkout hiện không truyền `ref: inputs.subject_sha`; cần RED bảo đảm policy/lock bytes lấy đúng subject, không vô tình lấy workflow ref. File adapter đã 199 LOC, tránh nhồi thêm.
- Release scan chạy lại saved image nhưng root đang import Linux CI receipt từ source run: phải bind **receipt scan release mới** vào qualification outcome/DAG có kiểm tra schema, không chỉ dựa một job success bên ngoài receipt.

## Source identity và receipt source ledger

- Exact-source SHA = commit peeled từ tag, bằng checkout build/test, successful push CI head trên master, manifest subject và mọi artifact/receipt subject. PR merge SHA hoặc dispatch workflow SHA không tự chứng minh source release. `release-subject.mjs` là verifier thật cho mối quan hệ này.
- Workflow SHA/ref là provenance của code orchestration; có thể khác source trong dispatch. Ghi riêng `GITHUB_WORKFLOW_REF`, workflow commit nếu API cung cấp, run ID/attempt, event, issuer/signer workflow; validate policy identity. Không bắt đồng nhất hai namespace bằng cách gán lại field.
- Client artifact manifest digest, EXE byte hash, image tar SHA256, image **config** digest (`docker inspect .Id`), registry manifest/index digest là các identity riêng. Không lấy config digest đi verify registry digest. Registry digest không bắt buộc cho image local chưa publish; source expected config là saved-image artifact từ Docker qualification.

| Evidence | Nguồn phải chứng minh | Consumer / oracle |
|---|---|---|
| `linux-ci-receipt-v1-<SHA>` | Successful push CI exact source run, attempt và actual gate outputs | Release import + parent Windows; validate semantics trước hash |
| `container-supply-chain-v1-<SHA>` | CI saved image và release rescan run, raw Trivy/Syft + phase 05 receipt | Bind config image identity, fresh scan và policy hash; không chỉ artifact name |
| Client artifact + `client-dist-manifest.json` | Reusable client artifact producer, source run và manifest bytes | `verify-client-dist-manifest.mjs`, same bytes các consumer |
| OfficeCLI physical / PowerPoint fidelity artifacts | Hiện workflow tải từ `physical_receipt_run_id = source_run_id` | Phải tìm producer thật, schema/version/tool/source; không có producer receipt đúng run => blocked |
| Signed EXE + Authenticode | External signer provisioned ngoài checkout; protected identity vars; pre/post download capture độc lập | Valid publisher/thumbprint/RFC3161 và EXE hashes, đủ hai public artifact types |
| Attestation bundle + verify JSON | `gh attestation verify` exit thành công, actual issuer/workflow/subject digest | Policy verifier đối chiếu output thật, không tự tạo `verified: true` |
| Root receipt | Validated Linux/Windows children, exact policy/locks/subject/client digest | Deterministic qualificationId, parent hashes, explicit not-selected desktop receipts |

Không dùng fixture unit a.repeat(...) như release evidence. Real tool fixtures giữ raw bytes + manifest command/version/source run/attempt/hashes; redaction nếu cần ghi rõ và không phá signed payload. Negative tests là mutations của capture, không giả là tool output. Nếu không có clean scan thật, parser acceptance và CVE gate rejection vẫn là test hợp lệ; không phát minh clean report.

## Re-scout và chuẩn bị TDD trước freeze

- [ ] Re-read CLAUDE, package scripts, policy, toàn bộ reusable producer/consumer và verifiers/related tests; recount file sizes và review diff hiện hữu.
- [ ] Xác nhận mọi phase dependency đã đóng code/docs, hoặc ghi blocked. Phase 13 performance budgets và phase 14 docs không được chạy sửa sau final gate.
- [ ] Kiểm kê approved access cho release-windows-signing, release-staging, release-publication, external signer, physical tools; không tiết lộ secret. Workflow có quyền không đồng nghĩa operator cấp phép dùng.
- [ ] RED: viết adapter/contract tests dưới đây trước sửa. Giữ source-run fixtures và expected rejection reasons. Test lại bằng policy production thực, không chỉ policy giản lược trong unit cũ.
- [ ] GREEN tối thiểu: sửa đúng provenance/semantic validation gaps, input checkout và đủ artifact types; tách helper dưới 200 LOC. Không đổi requiredGates, selected targets hay giảm signing requirements.
- [ ] Refactor: canonicalization/hashing dùng một helper, nhưng validate trước hash; tách fixtures/tests theo concern. Chốt code + docs rồi freeze exact source; bất kỳ diff nào sau đó reset qualification.

| ID | Layer / severity | Setup / thao tác | Expected / oracle |
|---|---|---|---|
| S12-01 | dependency/contract / P0 | Phase 13 hoặc 14 chưa đóng, hay dirty source | Qualification blocked trước publish; frozen manifest là oracle |
| S12-02 | source unit / P0 | Tag peeled/checkout/CI/artifact/receipt một SHA lệch | `verifyReleaseSubject` reject từng biến thể |
| S12-03 | provenance integration / P0 | Dispatch workflow SHA khác subject; checkout đúng subject | Giữ hai identity, validate workflow separately; không thay subject |
| S12-04 | adapter integration / P0 | Parseable fake JSON, gate hash self-asserted passed | Reject; cần actual runner/tool output và source binding |
| S12-05 | DAG unit / P0 | Thiếu Linux gate hoặc sai parent/lock/policy/client digest | Reject root theo policy production |
| S12-06 | artifact integration / P0 | Client bytes bị đổi sau manifest download | Manifest verifier fail trước consumer build/test |
| S12-07 | container integration / P0 | Release rescan mới fail hoặc receipt config digest sai | Release blocked/fail dù CI scan cũ pass; root không passed |
| S12-08 | Windows integration / P0 | Thiếu NSIS hoặc portable, chỉ có một EXE hợp lệ | Reject đủ public artifact types, không suy từ count wildcard |
| S12-09 | signing policy / P0 | Missing signer/subject/thumbprint/timestamp; signature invalid | Block thiếu env; reject evidence invalid, không unsigned fallback |
| S12-10 | signing integration / P0 | EXE changed sau upload hoặc post result copy pre | Reject hash/provenance, yêu cầu capture Get-AuthenticodeSignature lần hai |
| S12-11 | physical integration / P0 | OfficeCLI receipt thiếu/stale/sai run/source/tool | Block/reject, không dùng package no-officecli smoke thay physical |
| S12-12 | physical integration / P0 | Thiếu PowerPoint fidelity hoặc claim scope không đủ | Block/reject; mock render không thay PowerPoint |
| S12-13 | attestation integration / P0 | Output verify issuer/workflow/digest sai, JSON vẫn parse | Reject actual semantic binding, không hardcode verified |
| S12-14 | policy contract / P0 | Windows đổi not-selected hoặc bỏ Authenticode gate | Contract fail; Linux/mac desktop not-selected vẫn hợp lệ |
| S12-15 | release workflow / P0 | Root pass nhưng chưa approval stage/publish | Không stage/publish; RC vẫn draft/prerelease đúng semantics |
| S12-16 | freeze/replay / P0 | Sửa docs/locks/code sau qualify; rerun khác attempt | Receipt cũ không qualify subject mới; xác minh source attempt artifact |

## Tests After: smoke khác qualification

Tất cả lệnh sau là hướng dẫn thực thi sau approval, **chưa chạy trong nhiệm vụ này**. CWD là root repo; test mới chỉ tồn tại sau RED.

```bash
npx vitest run scripts/ci/release-subject.test.js scripts/ci/release-receipts.test.js scripts/ci/authenticode-policy.test.js scripts/ci/attestation-policy.test.js scripts/ci/release-evidence-source.test.js tests/unit/release-qualification-workflow-contract.test.js
npx eslint scripts/ci/release-receipts.mjs scripts/ci/release-receipt-workflow.mjs scripts/ci/release-evidence-source.mjs scripts/ci/release-evidence-source.test.js tests/unit/release-qualification-workflow-contract.test.js
npm run lint
npm run build
npm run test:inventory
npm run test
npm run test:coverage
npm run test:ci-budget
npm run matrix:gate
npm run test:pptx:corpus-metrics
npm run test:e2e
npm run runtime:verify
npm run docs:build
```

- Focused unit + local build/runtime verify là smoke/contract; không cấp release-qualified. Chỉ chạy eslint helper mới nếu GREEN thực sự cần tạo helper đó.
- Full CI phải thu bốn Chromium shards và các lane PPTX import/live/mobile/visual như workflow, coverage, performance budget, k6 smoke, Docker runtime, scan và attestations trên exact source. `npm run test:load:api:smoke` / `npm run test:load:ws:smoke` chỉ smoke; capacity/load claims cần các profile load/stress đã có và acceptance phase 13, không đổi tên smoke thành qualification.
- `npm run test:pptx:importer-qualification` và `npm run test:pptx:oracle:qualify` là commands thật; re-scout prerequisite/evidence scope trước dùng, không coi chúng tự sinh Windows OfficeCLI/PowerPoint physical receipts. Thiếu đúng physical evidence thì blocked dù unit/corpus pass.
- Trên approved Windows runner: theo workflow `node scripts/prepare-electron.js`, `npm run runtime:verify`, `npm run electron:builder -- --win nsis portable --publish never`, `node scripts/verify-runtime-closure.js --root dist-electron/win-unpacked/resources --require-client-dist`. Build --publish never không ký/publish; external signing cần approval riêng. Không chạy convenience build rồi coi như full release workflow.
- Client checker thật: `node scripts/ci/verify-client-dist-manifest.mjs --root client/dist --manifest client-dist-manifest.json --subject "$SUBJECT_SHA"`. `$SUBJECT_SHA` phải lấy từ frozen subject đã verify, không placeholder tùy chọn.
- Dùng `release.yml` để resolve **existing tag** và source run; không dispatch workflow trong PLAN. Reusable workflow không tự biến thành workflow_dispatch; mọi trigger/sign/tag/draft/publish là operation riêng được duyệt.

## Acceptance checklist, quyền và rollback

- [ ] Ledger exact-source/workflow identity/run/attempt, artifact IDs/hashes, policy/locks, raw evidence và dependency closure hoàn chỉnh; all tests/gates có actual logs.
- [ ] Positive adapters dựa tool output thật; negative cases chứng minh fail-closed. Full build/lint/test gates không chỉ focused tests; missing env ghi blocked kèm owner và prerequisite.
- [ ] Giữ private single-operator deployment claim của phase 11, không tuyên bố auth/untrusted sandbox. Public binaries không đồng nghĩa public CRUD an toàn.
- [ ] Lock refresh resolution cần explicit approval, không `npm audit fix`/resolve để chữa release gate ngoài review. Quyền repo/PR settings, signer provisioning, signing, tag/release staging/publishing đều xin riêng; passed qualification không tự cấp publish approval.
- [ ] Final root và rescan evidence được validate trước stage; re-download EXEs verify lại trước publication. Documentation/claim text đã frozen cùng source.
- [ ] Rollback trước publish: giữ blocked/draft, lưu evidence, không upload thay artifact dưới cùng receipt. Sau publish nếu cần withdraw/rollback, xin approval riêng, giữ audit log và chọn bản trước đã qualified; không force-move tag hay silently replace signed bytes.
- [ ] Mọi sửa chữa tạo subject mới và chạy lại final gate sau code/docs freeze. Kết quả PLAN hiện tại là pending, không release-ready.

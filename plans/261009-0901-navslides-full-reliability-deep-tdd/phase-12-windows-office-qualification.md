---
phase: 12
title: "Windows NSIS/portable, OfficeCLI và PowerPoint"
status: in-progress
priority: P1
effort: ""
dependencies: [10, 11]
---

# Phase 12: Windows NSIS/portable, OfficeCLI và PowerPoint

## Goal
Qualification đủ hai Windows artifacts với physical Office evidence, signing và independent post-download verification.

## Context và bằng chứng
reusable-windows-qualification.yml:27–160 build/sign/verify; config/release-target-policy.json:18–28 publicArtifacts nsis-exe/portable-exe. scripts/officecli/physical-feasibility-receipt.mjs:42–150 đòi authoritative schema 2 physical evidence, không tương đương corpus.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [10](phase-10-pptx-portable.md), [11](phase-11-container-runtime.md).

Execution: independent producers local GREEN; exact NSIS/portable physical OfficeCLI/PowerPoint, signing, independent download/signature và attestation gates blocked. Actual release integration testResults không chứa physical-release-envelope test; requested filters không proof. Xem [execution ledger](evidence-ledger.md#execution-ledger-reconciliation).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Modify | `C:/Work/NavSlidesEditor/.github/workflows/reusable-windows-qualification.yml` | artifact completeness, independent verification và immediate exit-code checks |
| Modify | `C:/Work/NavSlidesEditor/scripts/ci/release-receipt-workflow.mjs` | physical envelope, genuine attestation và independent signature bindings |
| Verify | `C:/Work/NavSlidesEditor/scripts/officecli/run-physical-feasibility.mjs` | actual OfficeCLI runner |
| Verify | `C:/Work/NavSlidesEditor/scripts/officecli/physical-feasibility-receipt.mjs` | binary/fixture/process evidence |
| Modify if gap | `C:/Work/NavSlidesEditor/scripts/ci/release-receipts.test.js` | missing/invalid Windows gate behavior |
| Modify if gap | `C:/Work/NavSlidesEditor/server/services/pptx-import/officecli/physical-feasibility-contract.test.js` | physical evidence schema |
| Verify | `C:/Work/NavSlidesEditor/server/services/pptx-import/evidence/` | composite fidelity claims |
| Modify | `C:/Work/NavSlidesEditor/.github/workflows/reusable-green-sha-verification.yml` | tách CI run và physical receipt run identities |
| Modify | `C:/Work/NavSlidesEditor/.github/workflows/release.yml` | truyền explicit OfficeCLI/PowerPoint run IDs và artifact names |
| Verify implemented | `C:/Work/NavSlidesEditor/scripts/ci/physical-release-envelope.mjs` | adapter validates raw receipt then binds release inputs; no fake producer |
| Verify implemented | `C:/Work/NavSlidesEditor/scripts/ci/windows-verification-evidence.test.js` | actual schema2 adapter/raw bindings and verification-output policy negatives; caller→Windows consumer proof in `reports/windows-caller-boundary-smoke.json` |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Preflight từ phase 01: clean candidate, Windows runner, actual Microsoft PowerPoint environment, pinned OfficeCLI binary/license manifest, fixture corpus và protected external signer. Không suy installed Office từ OS Windows.
2. Chạy OfficeCLI physical fixture acceptance/rejection bằng runner thật; capture binary hash/size/version, legal/acquisition metadata, process evidence, host/limitations. Chạy PowerPoint oracle thật riêng trên Original/edited outputs; browser/integrity tests không thay thế.
   - Sửa internal contract gap trước physical qualification: runner `run-physical-feasibility.mjs:130–136` xuất schema 2 với `subject.commit`, consumer `release-receipt-workflow.mjs:89–93` đòi top-level subjectSha/clientDigest. Adapter phải gọi authoritative validator trên raw receipt, giữ raw hash/claimScope/limitations và bind client manifest digest trong release envelope; không chỉ thêm status passed/fields để consumer chấp nhận.
   - Tách `linux_ci_run_id`, `officecli_receipt_run_id`, `fidelity_receipt_run_id` xuyên release → reusable-green-sha → reusable-windows. Giữ tên artifacts `officecli-physical-receipt-v1-${subjectSha}` và `powerpoint-fidelity-receipt-v1-${subjectSha}` như routing labels, schema raw vẫn 2; mỗi artifact gắn verified producer run/source/hash. Không giả định cả ba cùng CI run.
   - Producer OfficeCLI là physical runner hiện có trên host được cấp quyền; PowerPoint producer phải là actual capture/qualification host theo evidence contract. Admission manifest ghi run IDs/artifact IDs/raw hashes/client digest/subject trước consumer. Nếu host chưa provision được, task adapter/caller tests vẫn thực hiện được, physical gate vẫn blocked; không tạo synthetic receipt thay producer.
3. Build Electron từ client artifact đúng SHA/digest bằng workflow --win nsis portable --publish never. Assert expected artifact kind set gồm đủ NSIS và portable, reject missing/ambiguous/mismatched version trước receipt; không chỉ glob có một exe.
4. Chỉ signer được authorized trong protected environment, script absolute path ngoài checkout, expected publisher/thumbprint và RFC3161 timestamp. Không tạo self-signed substitute hay ghi credentials vào plan/log.
5. Verify mọi artifact trước upload; tải độc lập rồi verify digest, Authenticode publisher/thumbprint/timestamp và provenance attestation workflow identity. Receipt bind subject/client/physical/fidelity/artifact identities.
   - `attestation-windows` phải parse genuine `gh attestation verify` output theo schema được pin, đối chiếu mỗi EXE digest/source SHA/issuer/workflow lấy từ provenance đã verify. Reject `[]`, old-source, thiếu một artifact; không tự gắn `verified:true` hoặc expected identity từ argv thay chứng cứ.
   - `authenticode-post` phải capture chữ ký/timestamp trực tiếp từ downloaded EXE bằng Windows verifier có khả năng chứng minh RFC3161, chain trust và certificate validity tại signing time. Không copy `signer.signature` vào postDownload. Preflight pin verifier/version và fixture signed hợp lệ/invalid; nếu verifier không cung cấp đủ evidence thì gate blocked, không suy từ TimeStamperCertificate tồn tại.
   - Kiểm tra `$LASTEXITCODE` ngay sau **mỗi** node/gh/verifier invocation trong vòng lặp, trước command tiếp theo. EXE đầu fail/EXE sau pass vẫn fail cả job.
6. Install NSIS trên disposable Windows profile, launch/edit/save/reopen/uninstall không mất user data ngoài policy. Portable launch từ path có spaces/non-ASCII, không cần install; kiểm tra runtime closure/headless export. Không publish release trong phase này.
7. Đối chiếu output fidelity với corpus version/fixture hash và known limitations. Không claim PowerPoint 100%; missing physical evidence block Windows qualification. Final hashes phase 16 phải qualification lại nếu inputs đổi.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P12-01 | C | Thiếu PowerPoint/OfficeCLI physical receipts | Block trước release, không reuse browser report |
| P12-02 | C | Có portable nhưng thiếu NSIS hoặc ngược lại | Artifact completeness fail |
| P12-03 | C | Wrong SHA/client digest/fixture/binary hash | Receipt rejected |
| P12-04 | H | Signer missing/inside checkout/relative path | Fail closed |
| P12-05 | H | Wrong publisher/thumbprint/missing timestamp | Fail pre-upload |
| P12-06 | H | Downloaded artifact tampered | Hash/signature/attestation reject |
| P12-07 | H | Wrong attestation workflow/source identity | Reject dù file signed |
| P12-08 | H | Expected rejected Office fixture được accepted | Physical qualification fail |
| P12-09 | H | NSIS install/launch/reopen/uninstall | User deck preserved theo supported policy |
| P12-10 | H | Portable path spaces/non-ASCII | Launch/render/export hoạt động |
| P12-11 | H | PowerPoint open repaired/corrupted package | Fidelity gate fail, không mark 100% |
| P12-12 | M | Known unsupported feature | Report explicit limit, không silently reconstruct edited |
| P12-13 | C | Raw schema-2 physical receipt hợp lệ qua adapter tới Windows consumer | Authoritative validation pass, raw hash/scope giữ nguyên, subject/client manifest bind đúng |
| P12-14 | H | CI run khác OfficeCLI/PowerPoint run; một run/subject/client sai | Đúng distinct runs được tải; wrong producer/subject/client rejected, không fallback cùng CI run |
| P12-15 | C | Genuine gh output rỗng, old-source hoặc thiếu EXE | Producer reject trước policy, đủ hai artifact digest/source bindings mới pass |
| P12-16 | C | Signer JSON passed nhưng independent RFC3161/trust verification fail | Post-download gate fail; không tái sử dụng lời khai signer |
| P12-17 | H | EXE đầu verification fail, EXE sau pass | Job fail ngay, không che exit code |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run scripts/ci/windows-verification-evidence.test.js scripts/ci/release-receipts.test.js server/services/pptx-import/officecli/physical-feasibility-contract.test.js server/services/pptx-import/officecli/physical-feasibility.test.js
```

Physical commands dưới đây dùng PowerShell sau preflight. Qualification owner provision biến môi trường bằng **đường dẫn thật của cùng evidence run**: `PPTX_EVIDENCE_MANIFEST`, `PPTX_ROLE_RECEIPTS`, `PPTX_CORPUS`, `PPTX_GOLDENS`, `PPTX_ACTUALS`, `PPTX_REPORT_DIR`, `SUBJECT_SHA`. Manifest/role receipts phải do actual PowerPoint capture host tạo theo oracle evidence schema; lưu hashes vào admission manifest. Thiếu biến/file là prerequisite blocked; bare npm script không đủ.

```powershell
npm run test:pptx:oracle:integrity -- --evidence-manifest "$env:PPTX_EVIDENCE_MANIFEST" --role-receipts "$env:PPTX_ROLE_RECEIPTS" --corpus "$env:PPTX_CORPUS" --goldens-dir "$env:PPTX_GOLDENS" --actuals-dir "$env:PPTX_ACTUALS" --report-dir "$env:PPTX_REPORT_DIR"
if ($LASTEXITCODE -ne 0) { throw 'oracle integrity failed' }
npm run test:pptx:oracle:qualify -- --evidence-manifest "$env:PPTX_EVIDENCE_MANIFEST" --role-receipts "$env:PPTX_ROLE_RECEIPTS" --corpus "$env:PPTX_CORPUS" --goldens-dir "$env:PPTX_GOLDENS" --actuals-dir "$env:PPTX_ACTUALS" --report-dir "$env:PPTX_REPORT_DIR"
if ($LASTEXITCODE -ne 0) { throw 'oracle qualification failed' }
node scripts/ci/verify-client-dist-manifest.mjs --root client/dist --manifest client-dist-manifest.json --subject "$env:SUBJECT_SHA"
if ($LASTEXITCODE -ne 0) { throw 'downloaded client identity failed' }
node scripts/prepare-electron.js
if ($LASTEXITCODE -ne 0) { throw 'electron preparation failed' }
npm run runtime:verify
if ($LASTEXITCODE -ne 0) { throw 'runtime verification failed' }
npm run electron:builder -- --win nsis portable --publish never
if ($LASTEXITCODE -ne 0) { throw 'windows packaging failed' }
```

Không dùng `electron:build:win` cho qualification: script đó rebuild client, phá exact prebuilt-client binding. Signing/download verification tiếp tục theo workflow đã sửa; packaging không tự chứng minh signed qualification.

## Runtime smoke bắt buộc
Actual OfficeCLI/PowerPoint commands lấy từ pinned manifest và existing workflow sau preflight, không invent flags. Quan sát physical app mở package và Windows executables launch; tải độc lập rồi verify bằng PowerShell/GitHub commands existing workflow.

## Deliverables / checklist
- [ ] 12.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [ ] 12.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 12.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 12.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [ ] 12.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Post-audit consumer repair: runtime `clientSubject` is the producer's SHA string, not a `{ sha }` object. Both Linux and Windows actual CLI consumers now accept only the matching string and refuse malformed/legacy shapes without issuing a receipt. [RED evidence](reports/audit-fixes-red-release.json), [source-matched affected GREEN](reports/audit-fixes-green-identity.json) and [actual CLI consumer smoke](reports/audit-fixes-release-cli-runtime.json) retain the boundary proof. Upstream CI/scanner/signature/EXE/Office/fidelity inputs in these local scenarios are explicitly synthetic; no physical or release checklist item is closed.

## Exit gate
Cả hai artifact kinds đạt all target gates trên exact subject/digest; actual physical evidence có receipt, không test-double receipts. Nếu thiếu quyền/môi trường giữ blocked.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Build local Windows không tự cho quyền dùng signing service/publish. PowerPoint automation cần runner phù hợp; plan không hạ gate nếu unattended environment không dùng được.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.

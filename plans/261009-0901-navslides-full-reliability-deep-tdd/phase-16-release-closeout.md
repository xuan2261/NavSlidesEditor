---
phase: 16
title: "Final integration, CI evidence và release closeout"
status: "in-progress: current-input verification and performance/external qualification open"
priority: P1
effort: ""
dependencies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
---

# Phase 16: Final integration, CI evidence và release closeout

## Goal
Đóng toàn bộ chặng 0–5 trên final candidate; release chỉ đủ điều kiện khi source/artifact/policy/required gates khớp, publication cần quyền riêng.

## Context và bằng chứng
release.yml resolve/verification/container-supply-chain/verify-staged-assets/stage-draft/publish-final; release-state.mjs kiểm tra clean subject/tag/version; electron-server-lock-refresh.yml:12–14 đã request permissions nhưng :57–61 gh pr create --base master, quyền repo cần kiểm tra thực.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [01](phase-01-start.md), [02](phase-02-settings-atomic-revision.md), [03](phase-03-settings-ui-draft.md), [04](phase-04-ci-required-summary.md), [05](phase-05-scanner-evidence.md), [06](phase-06-history-autosave.md), [07](phase-07-pptx-publication.md), [08](phase-08-pptx-concurrency.md), [09](phase-09-pptx-recovery.md), [10](phase-10-pptx-portable.md), [11](phase-11-container-runtime.md), [12](phase-12-windows-office-qualification.md), [13](phase-13-navigator-baseline.md), [14](phase-14-navigator-optimization.md), [15](phase-15-documentation-drift.md).

Execution: production build/runtime closure passed on the dirty working tree; scoped portable/editor browser checks passed on their recorded inputs. New P06 native harness initial RED is under counsel; final whole lint and unfiltered coverage remain pending. Actual extracted release caller RED/GREEN now rejects wrong SHA/branch and reused producer IDs before outputs (20 isolated cases); no live permissions, dispatch or publication changed. Main owns final checks/navigator and reports/final-evidence.json. Exact clean SHA, required Linux/Windows graph, Office, signing, independent download and attestation qualification remain blocked.

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/.github/workflows/release.yml` | final subject/target/gate integration |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/.github/workflows/electron-server-lock-refresh.yml` | approved base branch và permission handling |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/scripts/ci/release-state.mjs` | clean subject/version/tags |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/scripts/ci/release-receipts.mjs` | root receipt DAG validation |
| Modify | `C:/Work/NavSlidesEditor/scripts/ci/release-state.test.js` | branch/version/subject negatives nếu gap |
| Modify | `C:/Work/NavSlidesEditor/scripts/ci/release-receipts.test.js` | required gate/digest negatives |
| Create | `C:/Work/NavSlidesEditor/plans/261009-0901-navslides-full-reliability-deep-tdd/reports/final-evidence.json` | final evidence khi thi hành |
| Modify | `C:/Work/NavSlidesEditor/scripts/ci/release-receipt-workflow.mjs` | actual leaf evidence và attestation normalization, không declaration hashes |
| Modify | `C:/Work/NavSlidesEditor/.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` | producer job/shard manifest truyền vào Linux receipt |
| Modify | `C:/Work/NavSlidesEditor/.github/workflows/reusable-green-sha-verification.yml` | verified run manifests và separate physical evidence routes |
| Create | `C:/Work/NavSlidesEditor/scripts/ci/release-evidence-producer.test.js` | real CLI producer → receipt → root negative/positive integration |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Tổng hợp source changes trong authorized branch; không commit/push/tag tự động nếu user chỉ cho implement local. Khi release authority được cấp, chốt clean candidate SHA và policy hash; mọi shipped input đổi sau đó invalidate affected evidence.
2. Chạy lint/build/full test inventory/coverage/matrix/corpus/E2E/load theo existing CI commands. Floors hiện tại lines74/branches60/functions68/statements71 không được hạ; failed test do environmental setup ghi blocked không delete assertion để xanh.
3. Requalify final container/Linux và Windows artifacts theo phase 11/12 với cùng subject/client manifest. Phases 11/12 là lane setup/provisional evidence khi các phase sau còn đổi code; final ledger phải có fresh receipts hoặc content-addressed reuse chứng minh inputs identical.
4. Gate evaluator kiểm tra exact required target set, artifact kind set, source SHA, client/policy/report/SBOM/artifact digests, parent receipt DAG, scanner/Office/signing status. missing/skipped/blocked/waived không là passed; no target selected không được bypass required Linux+Windows policy. Sửa producer `release-receipt-workflow.mjs:45–68`: Linux leaf digests phải hash actual run/job/shard conclusions và artifact evidence manifests; `hash({gate,result:passed})` không đủ. Validate complete expected shard set, trusted workflow/event/ref/SHA/attempt và input identities trước tạo host receipt.
   - Tích hợp attestation producer đã sửa ở phase 12; không implementation owner thứ hai. Linux producer bắt buộc evidenceRoot, đủ 4 Chromium shards và mọi lane required theo manifest, cùng run/attempt/source/client identities. Missing/stale shard hoặc declaration-only inputs không được tạo passed receipt; tests đi qua CLI producer → root, không chỉ constructor với hash giả.
5. Lock refresh: đây là GitHub PR creation permission, không phải Electron app permission. Đọc repository default branch/Actions setting bằng authorized read-only API; main checkout không chứng minh default branch. Resolve approved base thay hardcoded master nếu mismatch được xác nhận. Cùng branch policy áp dụng release.yml:57 lookup CI đang filter master: chọn run đúng approved release branch, exact SHA/event/workflow và success; không lấy run arbitrary branch chỉ để vượt gate. Test no diff, PR already open, permission denied và verify generated lock tree; không tự bật quyền hoặc cấp PAT.
6. GITHUB_TOKEN-created PR không tự kích hoạt CI như workflow comment nêu. Giữ in-job isolated tree verification và explicit qualification của commit được merge; không lấy PR creation success làm CI proof.
7. Trình release manifest/run links/remaining limitations để owner approve. Không upload public assets, tạo tag, stage draft có external effect hoặc publish nếu chưa được phép. Nếu permission/signing/Office thiếu, final status implementation-verified/release-blocked, plan chưa completed toàn chương trình.
8. Docs/changelog chỉ ghi observed results; evidence report tạo ngoài shipped artifact tránh vòng invalidation. Nếu sửa shipped docs/code sau final freeze, chốt candidate mới và rerun impacted qualification trước release.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P16-01 | C | Receipt CI từ SHA cũ nhưng version giống | Reject |
| P16-02 | C | Any required job missing/skipped/blocked | No qualified root |
| P16-03 | C | Wrong image/exe/client/policy digest | Reject dù status passed |
| P16-04 | C | Thiếu Linux hoặc một Windows artifact kind | Không silently omit target |
| P16-05 | H | Dirty candidate/untracked product inputs/tag mismatch | Release-state fail; user docs không bị tự xóa |
| P16-06 | H | One E2E shard missing | Không full E2E success |
| P16-07 | H | Receipt parent DAG thiếu/sai/cycle | Reject/root không valid |
| P16-08 | H | Lock refresh PR denied | Job/actionable diagnostic; không tăng quyền tự động |
| P16-09 | H | Existing refresh PR / no lock diff | Không duplicate PR hoặc force unrelated branch |
| P16-10 | H | Approved branch là main, đúng SHA có push CI success trên main nhưng không trên master | PR base và release CI lookup chọn đúng approved branch/run; không đoán từ local main |
| P16-11 | H | RC vs final publish authorization | Không public nếu chỉ qualified/draft/requested plan |
| P16-12 | H | Post-freeze shipped input changed | Invalidate và requalify affected artifact |
| P16-13 | M | Known corpus/Office limitations | Release notes có scope, không claim 100% |
| P16-14 | C | Host receipt chứa declaration hashes nhưng không có leaf/shard evidence | Producer/root qualification reject, không chỉ kiểm tra digest shape |
| P16-15 | C | Attestation JSON hợp lệ cú pháp nhưng sai artifact/source/workflow/issuer | Reject normalization, không tự gán verified:true từ argv |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npm run lint
npm run build
npm run test:inventory
npm run test:coverage
npm run matrix:gate
npm run test:pptx:corpus-metrics
npm run test:pptx:adversarial
npm run test:e2e
npm run test:load:api:smoke
npm run test:load:ws:smoke
npx vitest run scripts/ci/release-state.test.js scripts/ci/release-receipts.test.js scripts/ci/release-evidence-producer.test.js scripts/ci/windows-verification-evidence.test.js
```

## Runtime smoke bắt buộc
Exercise final packaged/container app: create/edit/save/reload, rich text Undo/Redo, Settings two tabs, package import→Original/edited export, archive restore, large navigator. Inspect real CI job/shard conclusions and downloaded signatures; test outputs alone không thay surface smoke.

## Deliverables / checklist
- [x] 16.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [x] 16.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 16.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 16.4 Final integration và target runtime smoke đạt trên exact current identities; scoped audit-fix checks không thay toàn qualification.
- [x] 16.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: Các chín findings sau audit đã được sửa, với 16 observed RED failures và [222/222 affected tests GREEN](reports/audit-fixes-green.json) trên [source/config/harness khớp trước–sau](reports/audit-fixes-green-identity.json). [Package/TCP HTTP runtime](reports/audit-fixes-pptx-runtime.json), [Settings browser/API runtime](reports/audit-fixes-settings-browser.json) và [actual receipt CLI trên synthetic upstreams](reports/audit-fixes-release-cli-runtime.json) đã qua; current client build và machine-facts verifier cũng qua. Đây là scoped audit repair, không phải final full-suite/E2E hoặc target qualification. Navigator candidate oracle chưa đạt stability/budget/comparison, nên phase 14 và final local qualification chưa đóng. [Final evidence](reports/final-evidence.json) phân biệt current scoped repair, historical checks và external blockers. Không publish/tag/commit; không hạ gate hoặc thay missing physical/hosted/signing evidence bằng test doubles.
## Exit gate
All scoped behavior và final target gates passed trên exact identities; artifact manifest/evidence run links đủ. Nếu external publish chưa được phép: qualified-not-published là trạng thái riêng, không tự publish.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Repo default branch/master expectation và permissions là live configuration, không xác nhận từ source. Không tạo PR hoặc sửa settings trong phiên plan-only.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.

## Re-audit repair: eleven findings, TDD execution

User-authorized scope: repair all eleven re-audit findings using regression-first TDD. Pre-fix production/module/UI/CLI observations are retained outside the repository in `local://navslides-post-cook-reaudit-evidence-index.json`; they are diagnosis evidence, not final qualification.

Acceptance: permanent consumer-visible regressions fail before each production fix, then pass on the repaired inputs; repeat the isolated runtime scenarios, verify affected callers and build/lint, independently review changes, and bind receipts to the final inputs. Prior affected222 evidence becomes historical for changed inputs.

1. Serialize plain-deck history restore before outstanding save transports can overwrite it.
2. Release exclusively owned pending media after definitely unpublished PPTX preparation failure.
3. Reissue compatible publications after matrix authority high-water recovery.
4. Normalize equivalent Go stdlib scanner/SBOM identities without weakening coverage gates.
5. Retry retained rollback and expiry cancellation intents during startup.
6. Keep unpublished template destinations invisible until their route commits.
7. Recognize terminal package-session replay without cleared staging identities.
8. Select current replay receipts after repeated portable replacement, preserving retained authority.
9. Transfer keyboard focus after Settings review, reload and rebase.
10. Fetch the automation branch and use an observed explicit lease for lock refresh.
11. Reconcile baseline qualification claims with the retained failed noise oracle.

Ownership: one integration owner; disjoint frontend, PPTX import compensation, package-store authority/replay, project-session recovery, and CI/scanner slices. Regression additions precede production changes; the integration owner runs RED and final GREEN centrally. No concurrent broad checks during edits.

Non-goals: no performance policy reduction, new compatibility shims, remote CI dispatch, live GitHub settings, commit/push/publish, or replacement of missing physical Linux/Windows/Office/signing evidence. External qualification and full-program acceptance remain open unless separately proven.

Backend verification: actual production Node/HTTP/disk smokes passed for [media preparation compensation](reports/re-audit-media-runtime.json), [high-water authority recovery](reports/re-audit-epoch-runtime.json), [deferred template publication](reports/re-audit-template-runtime.json), [repeated portable replacement/replay](reports/re-audit-portable-runtime.json), and [retained cancellation plus overlapping terminal replay](reports/re-audit-session-runtime.json). The session proof uses two fresh process restarts for each cancellation reason. [Scanner/lease CLI proof](reports/re-audit-scanner-lease-runtime.json) covers seven verifier cases and eight native local-origin Git workflow cases; metadata/GitHub boundaries are explicitly synthetic. Final regression, frontend browser proof and integration gates are not yet closed.

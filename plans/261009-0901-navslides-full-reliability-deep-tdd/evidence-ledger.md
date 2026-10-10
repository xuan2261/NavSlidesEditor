# Evidence ledger và giới hạn lập kế hoạch

## Baseline quan sát trực tiếp

- `git status --short --branch` và `git rev-parse HEAD`: nhánh `main`, SHA `aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131`; output trong phiên lập kế hoạch có các docs/plans untracked. Không sửa/xóa/stash/commit chúng.
- Có bản nháp user-owned `../261009-0836-navslides-reliability-release-hardening/` chứa phase stub và claim approval từ ngữ cảnh khác. Kế hoạch mới không kế thừa approval, không sửa bản nháp.
- `package.json:3` version 1.17.0; :12–17 workspaces server/client/shared/website; :39–83 test entrypoints.
- `server/routes/settings.js:29–45` merge ngoài lock atomic toàn operation. `server/services/storage.js:233–238` lock riêng reads/writes; :47–65 lock in-process.
- `client/src/pages/SettingsPage.jsx:185–207` response thay form; :222–237 người dùng vẫn sửa state.
- `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml:144–157` 13 required jobs; :164–166 denylist chưa từ chối skipped.
- `.github/workflows/reusable-container-supply-chain.yml:30–32` scanner pinned v0.74.0, emit report rồi verifier; chưa chạy scan trong phiên này.
- `.github/workflows/electron-server-lock-refresh.yml:12–14` request contents/pull-requests write; :57–61 tạo PR base master. Repository default branch/Actions permission hiện tại chưa được truy vấn trong phiên này.
- `client/src/components/SlidePanel.jsx:80–88` eager mount. :60–68 focus refs vào item; đây là cấu trúc, chưa là measured performance.

## Bằng chứng scout đọc mã

| Nguồn | Phạm vi | Trạng thái |
|---|---|---|
| [PPTX scout](reports/pptx-scout.md) | Root/WAL, publication visibility, rollback identity, portable/media | Source-read; không chạy test |
| [Release scout](reports/release-scout.md) | CI/receipts/Windows/Office/scanner | Source-read; không qualification |
| [Editor scout](reports/editor-scout.md) | History, autosave, selection, navigation, docs | Source-read; không benchmark |

**Adjudication source notes:** Scout reports là raw research, không execution authority. Release scout suy đoán “refresh permission” thành app permission là không phù hợp: chủ đề đúng là GitHub PR permission trong `electron-server-lock-refresh.yml`, đã xử lý ở phase 16. PPTX scout example command có recovery/lock helper không phải test: commands phase đã loại các helper đó. Những findings “không tìm thấy test” là coverage discovery limit, không chứng minh feature chưa tồn tại. Execution authority là các phase đã review, không raw report.

## Bằng chứng lịch sử từ attachment, không tái xác nhận trong phiên

CI 630 test files / 5.052 tests / 71 HIGH-CRITICAL, corpus 11/11, release public v1.16.2 và “HEAD chưa có run” thuộc review được người dùng cung cấp. Không thực hiện lại GitHub queries hoặc scans để chứng minh chúng hiện còn đúng. SHA lịch sử `5e324699318da8cd2950e80f6a2d0057cd3d7d33` khác candidate. Lỗi verifier `{}` là observation người dùng đã thực thi; không chạy lại để xác nhận.

## Trạng thái evidence triển khai

| Nhóm | Trạng thái tại lúc lập kế hoạch | Cần khi thi hành |
|---|---|---|
| Settings regression/server/UI | not-run | RED/GREEN + actual two-client/two-tab smoke |
| CI required summary | not-run | Evaluator + graph skipped smoke |
| Current image scan/SBOM | not-run | Exact image, pinned tool output + receipt |
| History interactions | not-run | Existing tests + cross-controller/browser evidence |
| PPTX concurrency/restart/archive | not-run | Deterministic barriers, actual kill/reopen, clean-root roundtrip |
| Windows/Office/signing | prerequisites-unverified | Physical and independent download evidence |
| Navigator 50/100/300 | not-run | Raw metrics + frozen budgets + before/after |
| Final candidate CI/release | not-run | Clean subject, all selected targets + receipt DAG |

Không có production bug fix, test execution, container scan, Office render hay release publication được thực hiện trong phiên lập kế hoạch. Plan artifact validation được ghi riêng trong review-report.md; nó không thay qualification sản phẩm.

## Execution evidence: working tree, not release qualification

- Settings: [focused API/UI result](reports/settings-focused-green.json), [boundary characterization](reports/settings-boundary-green.json), [actual HTTP concurrency/restart](reports/settings-http-smoke.json), and [actual pending-response/two-tab UI](reports/settings-browser-smoke.json). The POSIX permission case remains skipped on Windows and the joint qualification gate stays open.
- Editor: [focused regressions](reports/editor-focused-green.json) and [actual text/offline/queue/master browser proof](reports/editor-browser-smoke.json). IME was not exercised; browser selection-ID survival was not separately captured.
- PPTX publication: [focused local evidence](reports/pptx-publication-focused-green.json); actual full corpus/browser, concurrency, recovery and portable-archive gates are separate.
- Upload ledger: [expected RED, focused GREEN and actual standalone Node disk proof](reports/upload-ledger-preservation-green.json). The initial Bun synchronous launch timed out; direct Node proved preservation without a product-code timeout workaround.
- Navigator: [failed setup receipt](reports/navigator-setup-failure.json). No timing samples were captured; budgets and synthetic fixtures were not changed. The exact Playwright FullProject property repair requires the subsequent isolated run.

Original baseline/scout/attachment rows above are historical planning evidence. These links do not promote dirty working-tree results, skipped POSIX checks, synthetic scanner/release fixtures, or missing physical/signing/CI capabilities into qualification.

## Execution ledger reconciliation

Đây là checkpoint working-tree, không phải release receipt. Các mục baseline/scout, attachment và execution đầu phiên ở trên là lịch sử; “IME chưa chạy”, “navigator chỉ setup failure” và focused totals cũ không mô tả checkpoint mới. Chỉ receipt có source/artifact identity lúc chạy mới chứng minh đúng input đó; tên `final-source` không tự chứng minh source sau repair vẫn identical. Không cộng các run chồng lặp, không đóng scenario bằng tổng test xanh. Các checkboxes chưa được chứng minh trọn contract giữ nguyên.

### Evidence mới và phạm vi thật

| Lane | Receipt đã đọc | Quan sát và giới hạn |
|---|---|---|
| 04/05/06/12/15/16 | [joint working-tree GREEN](reports/editor-scanner-release-docs-current01.json) | 15 files, 273 pass; includes required-checks CLI/status matrix, scanner, editor, docs và release producers. Đây là local contract tests, không remote CI graph/image/Windows qualification. |
| 05 | [genuine scanner CLI](reports/scanner-cli-genuine-current02.json) | Passed clean CLI và malformed rejection/no success receipt; reduced genuine Alpine report, binary/DB/raw/fixture hashes. SBOM/browser inputs synthetic; không NavSlides candidate image hay scanner attestation. |
| 06 | [history boundary browser](reports/editor-history-boundary-browser.json), [IME observation](reports/editor-ime-format-observation.json), [navigation browser](reports/editor-navigation-current01.json) | Native history/IME/format persistence evidence là older build-bound observations; navigation run có 10 pass, không skip/fail. Không biến functional navigation thành navigator latency baseline, hoặc older browser thành current repair proof. |
| 06/07/10 | [editor/menu RED](reports/editor-lock-style-menu-red.json), [corrected menu RED](reports/fidelity-menu-red.json), [GREEN](reports/editor-lock-style-menu-green.json) | Initial RED có 5 genuine editor failures (heading typography; slide/element Undo lock; locked rich-text updates) và 1 invalid fidelity fixture error. Corrected menu RED thật chứng minh menu không dismiss trong pending Original download. GREEN: 6 files, 56 pass; current browser lock/style/menu acceptance vẫn cần final identity. |
| 06 | [restored lifecycle GREEN](reports/p06-restored-adoption-green02.json), [native identity-matched summary](reports/p06-native-summary-final02.json), [whole lint](reports/final-lint-frozen02.json) | Focused40/40; native5/5 with zero skipped/unexpected/flaky, workers1/retries0; IDs07/08/09/10/11/12/14. Every native journey matches before/after source6b0171… and execution202b2…. Real restore→author→save works without reload; pending projection restore remains an explicit refusal. Whole lint exit0/errors0,71 pre-existing non-blocking warnings. Exact13 manual/newer-draft/unload and fullcoverage still open; no hardwareIME/Office/clean-SHA claim. |
| 07 | [native publication HTTP](reports/pptx-phase07-final-source-native-publication-http.json) | Passed P07-01/07/10/11/12 với parser/corpus fixture, paused visibility → done, Original digest và template rebinding. Edited availability chỉ observed, không verified editability/Office render. |
| 07 | [committed journal reader GREEN](reports/committed-journal-reader-final-green.json) | 5 files, 58 pass. Current reader repair checkpoint sau older native HTTP; không retroactively bind HTTP receipt vào reader mới. |
| 08 | [reconciled inventory](reports/pptx-phase08-current-complete-inventory.json), [source-bound owner API](reports/pptx-phase08-source-bound-owner-api-smoke.json) | 14 files, 233 pass. Named P08-07 lost native save response giữ receipt authority, P08-12 unrelated deck barrier, P08-05 ack replay, P08-10 overlap và P08-14 stale fence đều có assertions. API smoke passed winner/head/Original/media preservation; synthetic ZIP/PNG và injected unavailable sink, không process death/Office render. |
| 09 | [post-review GREEN](reports/pptx-phase09-post-terminal-review-green.json), [real startup recovery HTTP](reports/pptx-phase09-final-source-recovery-http.json) | 17 files, 165 pass; real startup process-death và corrupt/unreadable ledger/readiness cases. HTTP passed P09-01/02/03/04/05/06/07/08/11/14/15. P09-09/12/13 có named focused assertions; ENOSPC/EACCES là injected faults, không Linux permissions. P09-10 và backup/restore runbook proof vẫn cần explicit final mapping, không suy từ số pass. |
| 10 | [portable session GREEN](reports/portable-package-session-integration-green.json), [retained authority GREEN](reports/portable-retained-authority-green.json), [real authority runtime](reports/portable-authority-runtime.json) | Integration 7 files/95 pass; new retained authority 3 files/51 pass. Minimal ZIP real commit/import/export/replace + template/snapshot restore giữ Original; foreign revision/generation/schema rejection giữ state unchanged (assertions ở runtime harness). Four source hashes, không whole-source freeze, native parser/Office/browser qualification. |
| 10 | [real process kill](reports/p10-process-kill-final-source.json) | P10-08 passed tại prepublication/root-committed/raw-applied/owner-committed/cleanup-partial, repeated production startup/HTTP. Repository PPTX package, Windows process termination; không POSIX/power-loss/fsync hoặc Edited validation. |
| 10 | [historical browser final01](reports/p10-portable-ui-final01.json), [historical final02](reports/p10-portable-ui-final02.json), [later seven native journeys](reports/editor-portable-ui-final04.json) | Earlier strict-trigger/poster failures are retained, not current blockers: later Playwright stats show seven expected, zero unexpected/skipped/flaky tests. This is scoped native UI import/re-export/decoded offline media evidence; current whole-source qualification still requires final input binding. |
| 07/16 | [corpus metrics](reports/pptx-corpus-current01.json), [raw drift](reports/pptx-corpus-drift-current01.json) | 11/11 metrics passed; strict corpus evidence ghi 13 unmapped/permanent placeholders, manifestDigest null. Drift là raw per-element geometry deltas, không separate passed qualification receipt. Không tương đương native Office fidelity hay final clean-SHA evidence. |
| 12/16 | [release/portable integration](reports/release-portable-integration-final.json) | 5 actual files, 61 pass; release receipts/producers/Windows verifier/portable authority/routes. Requested filter không chứng minh file được chạy: `physical-release-envelope.test.js` không có trong actual testResults. Không physical host, signed EXE, independent download hay attestation proof. |
| 15 | [facts GREEN](reports/documentation-facts-focused.json), [bilingual browser render](reports/documentation-render-current03.json) | 2 files/32 pass; EN/VI architecture pages HTTP 200 và real screenshots. Older bounded facts/build evidence; newest docs repairs cần final verifier/render alignment. |

### Identity receipts, không transplant

- Native P07, startup P09 và portable process P10 receipts có `sourceBefore.sha256 === sourceAfter.sha256` là `d13652717f468cb802f26d0a7753e1c59d28c3ab8d5929a00ceb1457c77607b0` trong scope backend/shared/runtime harness/locked dependencies mà từng receipt khai báo. Đó là input khi chạy, không clean git SHA hay browser/client identity, và có trước current reader/retained-authority repairs.
- P08 owner API receipt giữ before/after `0c2665143980102a6b76a2b78af28606cb30810b9717e048e9c7bc1c7d5e9d5e` trong scope riêng; không so digest khác scope để khẳng định toàn candidate identical. Older unbound owner smoke vẫn historical.
- Production manifest remains dirty working-tree evidence, not release qualification. Current nativeP06 receipt independently binds the built artifact plus complete declared source/runtime inputs; earlier a80afd… artifact and failed whole-lint checkpoint are historical. `reports/final-lint-frozen02.json` observes whole lint exit0/errors0/warnings71; later harness edits need scoped lint and final freshness reconciliation.
- Main owns final full tests/runtime browser/navigator/lint/matrix và `reports/final-evidence.json`. Không tạo hoặc sửa final evidence trong reconciliation này; final results được thêm sau khi final input binding có thật.

### Acceptance còn mở theo phase

| Phase | Current state và exact gap |
|---|---|
| 01 | completed: baseline/capability ledger đã đóng; không đổi thành final source certification. |
| 02/03 | blocked: P02-14 actual Linux/POSIX permissions; joint 02/03 gate không đóng bằng Windows/local browser pass. |
| 04 | blocked: authorized remote CI graph chứng minh required skipped làm summary đỏ; evaluator/CLI local GREEN không thay remote graph. |
| 05 | in-progress: genuine reduced clean CLI đã có; exact candidate scan/SBOM/browser inventory/DB/tool binding và P05 full matrix final mapping vẫn mở ở Linux/container lane. |
| 06 | in-progress: current focused40/native5 pass restored lifecycle, authoring/master, queue/route/retry/conflict/reversible restore; mapped IDs01..06 have reusable integrated assertions awaiting current fullcoverage. Exact13 combined manual/newer-draft/unload recovery is reachable and still needs native execution. HardwareIME qualification remains separate. |
| 07 | in-progress: fresh native publication/template/Original and current/stale-generation unavailable Edited refusal passed in `reports/pptx-publication-final-admission-refusal02.json`; five-file admission/refusal regression passed 50 tests. P07-05 pending retained-template and P07-06 admission race preserve destination/store/Original state. All-reader C/H final broad input binding remains open. |
| 08 | in-progress: task-map `completed` cũ không có current joint exit; P08-07/12 không còn “unexercised”, nhưng final source-bound C/H inventory/runtime và upstream 07 acceptance chưa đóng. |
| 09 | in-progress, không pending: durable recovery/readiness/ownership implemented và actual process proof passed; P09-10 explicit mapping, backup/runbook verification và final impacted-source reconciliation còn mở. |
| 10 | in-progress: full archive/session/client implementation and native process proof exist; later portable UI final04 passed seven native journeys, superseding final02 poster failure. Exact archive/store/HTTP regressions now pass 86 tests across eight files, including independent duplicate ownership/delete/reopen, descriptor/payload bijections and corrupt-blob refusal. Final current-input process/browser binding remains open. |
| 11 | blocked: exact Linux/container image digest, real pinned scan/SBOM, runtime/permissions/volume restart/backup restore không có; reduced Alpine schema input không substitute. |
| 12 | in-progress: local synthetic command-boundary proof now covers raw schema2 adapter→Windows consumer, distinct producer admissions and first-EXE-failure immediate abort in all three actual PowerShell caller bodies (`reports/windows-caller-boundary-smoke.json`). Actual NSIS/portable/Office/PowerPoint/signing/download/attestation qualification remains externally blocked. |
| 13 | blocked: [historical sample collection](reports/navigator-baseline.json) hoàn thành, nhưng receipt có `summary.stable=false`, `withinBudget=false`; `100x3` input có `noiseValid=false`. Không đủ baseline qualification hoặc authority để unblock phase 14. Giữ raw samples và frozen budgets; cần controlled current-input measurement đạt oracle. |
| 14 | blocked: [candidate oracle](reports/navigator-candidate.json) records `stable=false`, `withinBudget=false`, `comparison.passed=false` and `phase14 blocked`. Keep raw measurements and frozen budgets; controlled current-input rerun required. Historical functional/a11y results do not close the performance gate. |
| 15 | in-progress: machine-facts/docs-build receipts are historical; audit reconciliation removes unsupported performance/completion claims. Current verifier and upstream qualification remain separate gates. |
| 16 | in-progress: audit reproduced publication/no-op/recovery/sidecar/Settings/receipt defects after the older full-suite snapshot. Scoped RED→GREEN and smoke evidence must be bound to repaired inputs; full performance, physical targets and authorized publication remain blocked. |

Unsupported/unchecked scenarios giữ nguyên IDs và acceptance oracle trong từng phase; ledger này không waiver, không thay checklist bằng generic totals và không đóng toàn plan.

Earlier editor/style/Settings/portable/native-history receipts remain historical scoped observations on their recorded inputs. `reports/final-coverage-frozen04.json` passed its captured suite, but later SlidePanel/navigator changes and current audit repairs invalidate transplanting that success to today's candidate. `reports/final-e2e-frozen03.json` records one unexpected failure and skipped cases; later targeted repairs are not a current full-E2E pass. Do not merge totals or relabel snapshots as current qualification.

Release caller RED/GREEN is now explicit: actual extracted Bash had accepted wrong branch/SHA through nonfinal `&&` operands despite `set -e`. Main split every run/subject/branch/event/conclusion/distinct-producer guard into standalone tests; `reports/github-caller-boundary-smoke-green.json` passes 20 isolated cases, including approved-main discovery, wrong subject/branch refusal, all producer duplicate pairs, and lock-refresh denied/no-diff/existing-PR consumer effects. Upstream responses are synthetic and Git remotes are owned local files; no live GitHub setting, dispatch or publication was changed.

Post-plan audit fixes: the four `reports/audit-fixes-red-*.json` reports retain 16 observed failures (Settings 5, PPTX 5, expiry 2, receipts 4). [Affected GREEN](reports/audit-fixes-green.json) passes 222/222 tests in 19 files with [unchanged source/config/harness identity](reports/audit-fixes-green-identity.json). Additional guards cover Original-only metadata/no ghost rows and selected R1 journal authority through no-op save, disk reopen, fresh/replacement portable import and replay. [Actual package/TCP HTTP smoke](reports/audit-fixes-pptx-runtime.json) passes four scenarios and cleans its isolated root; [actual Settings browser/API smoke](reports/audit-fixes-settings-browser.json) passes five scenarios with matching scoped source hashes. [Actual receipt CLI smoke](reports/audit-fixes-release-cli-runtime.json) accepts string subjects and rejects legacy objects for both consumers, using explicitly synthetic upstream CI/Office/signature artifacts, not physical qualification. Current client build and machine-facts verification passed. These close the nine audited findings only: final full-suite/E2E, navigator stability/budgets, Linux/Windows/Office/signing/hosted qualification and publication remain separate, open gates.



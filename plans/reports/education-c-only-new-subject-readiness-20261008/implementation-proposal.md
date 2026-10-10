# Đề xuất implementation bounded — education subject mới trên C:

Ngày: 2026-10-08. Trạng thái: **PROPOSAL_ONLY — NOT_AUTHORIZED_FOR_IMPLEMENTATION_OR_TESTS**.

## Quyết định đề xuất

Dùng subject mới `education-new-subject-20261008` ở candidate dự kiến `C:/Work/NavSlidesQualification/education-new-subject-20261008`. Không gọi đây là retry/resume11, Correction12 hoặc reconstructed frozen11. Candidate hiện chưa tồn tại và chưa được tạo/copy.

Tiếp tục `cook --auto --advice --tdd` bằng một slice **occurrence ledger / exposure contract**, sau khi được cấp quyền riêng. Không dispatch nguyên scope26 bằng prompt cũ vì prompt đó cấm tests/callers trong khi TDD cần behavioral RED trước implementation. Không sửa host, chọn model, cài dependency hoặc rebuild cache để giải quyết gap này.

## Những quyền cần được cấp cụ thể cho slice này

1. Tạo candidate C: mới và regular-copy các input cần thiết đã được manifest hóa từ worktree C: hiện tại; giữ nguyên dirty/untracked inputs được chọn. Không copy D:, `.git`, `node_modules`, junction/symlink, generated/build outputs, caches, uploads/data, credentials hoặc historical reports. Chỉ copy tài liệu contract thực sự cần dưới danh sách explicit; không reconstruct source từ retained transcripts. Canonical coordinator/education vẫn bất biến.
2. Được tạo đúng hai helper mới bên trong candidate:
   - `tests/e2e/education/pending-round-lifecycle-error-ledger.js`
   - `tests/e2e/education/pending-round-lifecycle-error-exposure.js`
3. Được tạo đúng hai focused test mới, ngoài danh sách 12 acceptance callers:
   - `tests/unit/education-new-subject-20261008/occurrence-ledger.test.mjs`
   - `tests/unit/education-new-subject-20261008/error-exposure.test.mjs`
4. Được chạy behavioral RED rồi focused GREEN của đúng hai test đó, bằng Node C: cụ thể, không npm/Vitest/Playwright wrappers. Đây là proposal đổi runner cho **slice pure-contract này**, không đổi test framework/project config hay acceptance oracle. Sau approval, kiểm tra runtime semantics của runner theo FailureProtocol trước khi sử dụng; chưa chạy/probe Node ở lượt này.
5. Cho phép report/test output mới riêng dưới candidate/report directory đã duyệt. Đề xuất cap candidate **0.75 GiB tổng**: inputs ≤0.25 GiB, logs/test artifacts ≤0.25 GiB, temporary/output ≤0.25 GiB; luôn giữ free C: ≥8 GiB. Không copy dependency/browser/Electron tree cho slice này. Cap này là đề xuất, chưa được phê duyệt và không phải qualification budget.

Không mở rộng thêm helper/test/file/config nếu phát hiện dependency chưa nằm trong scope. Dừng tại authority gap; không tự làm full26, callers hoặc production repair.

## Runner draft — không thực thi

Executable đã thấy trên C: (byte metadata, **chưa chạy**):
`C:/Users/Z10PAD8C_Xuan2261/AppData/Local/nvm/v22.22.0/node.exe`.

Dự kiến ở candidate root, environment process-scoped được duyệt, bỏ NODE_OPTIONS/NODE_PATH kế thừa, tránh global config/host changes:

```text
<absolute C Node> --experimental-default-type=module --test --test-concurrency=1 --test-reporter=tap tests/unit/education-new-subject-20261008/occurrence-ledger.test.mjs tests/unit/education-new-subject-20261008/error-exposure.test.mjs
```

Default-type flag chỉ cho invocation cô lập này vì proposed helpers là ESM `.js`; không chỉnh package.json/lock/config. Exact executable/flags, output path và giới hạn execution phải thuộc approval. Không network, server, browser, database, fixture side effects, package resolution qua junction hoặc dependency install. Node stdlib `node:test`/`node:assert/strict` chỉ là contract oracle, không thay actual browser transport witness.

## Contract phải viết rõ trước authoring

- Durable browser occurrence identity: scoped document/root/generation + observation occurrence id. Distinct transport objects cho cùng occurrence có thể normalize một lần; equal text/stack không chứng minh identity. Unknown/provenance thiếu phải explicit, không merge đoán.
- Thứ tự chỉ so trong một domain có observation-site evidence thật. Không numeric sort xuyên caller/common-ledger/document namespaces; không `obsOrder + 0.01` hoặc universal packet-first/recorder-first ranking. Recursive causes và setup earliest phải sống nguyên.
- Error reference, caller wrapper/arrays và serialized-only diagnostics không được thay thế/truncate; stable ledger-owned serialization identity per occurrence.
- Explicit wrapper phase/metadata authoritative trên cả `errorLedger`, `secondaryFailures`, `allErrors`; phase-less wrapper không clobber phase đã recorded. Caller ledger established order đi trước secondary-only arrivals. Empty arrays không tự sinh provenance keys trên sole actual Error.
- Mandatory sink và late attachment/close/finalization arrivals không được thay primary earlier hoặc che error. Contract unit fixtures chỉ chứng minh synthetic deterministic inputs; không receipt của real UI/lifecycle.

## RED → GREEN → advice checkpoint sau approval

1. Agree API/fixtures, ownership và exact ordered assertions; source scaffold/loadability checkpoint được ghi riêng.
2. Test cases cho same occurrence across separate transport objects; distinct occurrences same text; independent namespaces; setup cause vs later siblings; phase precedence; retained object identities; serialized-only diagnostics; late sink arrivals.
3. Capture **behavioral** RED. Missing module/export, parser failure, dependency/runtime failure hoặc scaffold chưa có behavior không được ghi là behavioral RED. Nếu không tạo được behavioral RED trong authorized slice thì báo gap, không giả lập receipt hay dùng old PASS.
4. Implement chỉ hai helpers; GREEN đúng tests đó. RED/GREEN expected TDD iterations không phải retry Native11 delivery; không rerun ngoài authority hay tăng retry/timeout/window để che failure.
5. Advice review actual source/fixtures/evidence, authentic terminal partial/failed/success receipt với exact input/output identities, commands, failures, model metadata engine-provided hoặc unknown. Không dùng review note làm producer receipt.
6. Stop. Unit GREEN không sourceReady cho toàn26, không GO/admission/caller cutover/54-cell qualification.

## Toàn26 và các gate sau vẫn giữ nguyên

24 absent helpers +2 present helpers là future complete helper scope26. Hai helper slice này chỉ là phần đầu; 24 helper khác vẫn NOT_AUTHORED/NOT_EVALUATED. Sau slice cần authorization cho Native producer/consumer integration: actual browser occurrence witness, extraction/live-root chronology, genuine state/UI siblings, guard document binding, navigation passive diagnostics, clocks/witnesses/finalization. Có hai independent **full current-source** audits sau genuine combined delivery; scoped preparation advisors hiện tại không phải gates đó.

12 missing acceptance caller paths ngoài scope, cần authority authoring riêng và không thể claim old immutable caller objects available. 18×Present/Share/file=54 cells vẫn REQUIRED_UNEXECUTED, 0 executed/admitted; giữ original NC11/RPC17/original9 meanings, Quiz Reset+5000, complete Relay lanes và Trivia question/round/Next/scoring/history/due policy.

NF-A4 và blanket ineligible-key rejection: SOURCE_MECHANISM_CONFIRMED_SCOPE_APPLICABILITY_UNRESOLVED; không repaired/disproved/waived, không seventh repair. Private Reveal bindings không có public `getBindings`; không gọi synthetic `keyboardCondition`, không focus/unpause/close overlay/policy mutation. Nếu passive observation không đủ thì retain unresolved, xin scope riêng.

Historical ceilings còn giữ: producer ≤45 phút, host timeout ceiling ≤2760s, không fallback/retry delivery. Đây không tự cấp runtime deadline. FailureProtocol: giữ fixture/expected-observed/earliest cause và exact provenance; cause-first re-scout permitted owner, scoped counsel; dừng và xin authority trước repair. Không rẽ sang JeikCode host/global config/cleanup/install/cache regeneration.

## Điều chỉnh model có hiệu lực

Cho selected session model và subagent không pin cho công việc mới. Không cần xác minh local8045/Gemini, không inference probe. Coordinator metadata không được engine cung cấp: `unknown`. Engine tool của preparation subagents trả `gpt-6.1-sol`; lưu metadata này như **preparation only**, không producer delivery. Historical model/receipt/provenance/conclusions giữ nguyên.

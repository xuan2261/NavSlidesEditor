# Education — transfer to a separately Gemini-selected session

Date: 2026-10-07
Status: HANDOFF_READY / SESSION_NOT_OPENED_BY_THIS_HANDOFF / IMPLEMENTATION_NOT_AUTHORIZED

## Mục tiêu

Tiếp tục education cook --auto --advice --tdd với substantive producer **local8045/gemini-3.8-flash-high**. Session coordinator hiện tại và global defaults phải giữ nguyên. Đây là phương án thay cho per-task pin chưa chứng minh được ở tool hiện tại; không phải permission sửa host JeikCode.

## Mở session riêng

Actual installed JeikCode --help đã xác nhận --provider và --model. Dùng terminal tương tác riêng:

```powershell
Set-Location 'C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001'
& 'C:/Users/Z10PAD8C_Xuan2261/.local/bin/jeikcode.exe' --provider local8045 --model gemini-3.8-flash-high
```

Không đổi default config/main coordinator. Không dùng lệnh này trong shell không tương tác rồi chờ vô hạn. Lượt startup nền trước không cung cấp proof route; không lặp lại nó.

Trước khi gửi prompt substantive, kiểm tra model selector/status hiển thị đúng provider/model. CLI flags chứng minh requested selection, không tự chứng minh effective route hoặc retries/fallback. Nếu session thực tế khác target, dừng; không fallback và không sửa config để lách.

## Đọc authority/report trên C:, không truy cập D:

1. CLAUDE.md và AGENTS.md của worktree.
2. `plans/reports/education-partial11-settlement-20261007/combined-correction11-failure-settlement.md` và JSON cùng tên; cần chi tiết đọc native11-complete-settlement-v2.json và evidence11-complete-settlement-report.json.
3. `plans/reports/education-c-only-correction-preparation-20261007/c-only-readiness.json`, `new-subject-authority.draft.json`, `producer-prompt.draft.md`, `inherited-34-disposition-ledger.json`, `preparation-validation.json`.
4. `plans/reports/education-c-only-gate0-20261007/gate0-report.json`, `review-limits-and-next-action.md`.
5. `plans/reports/education-route-config-supplement-20261007/route-config-supplement.json`.
6. `plans/reports/education-subagent-routing-20261007/routing-result.json`.
7. `plans/reports/education-isolated-route-startup-20261007/startup-validation-and-next-step.json`.
8. Bản bàn giao gốc `C:/Work/NavSlidesEditor/plans/handoffs/education-partial11-resume-20261007.md` dùng cho lịch sử phạm vi; KHÔNG follow các evidence paths D:.

Draft không là executable authority. Gate0 storage caps là proposal, không actual reserved space; capacity phải đo lại trước writes được cấp phép.

## Git identity và preservation

Coordinator `C:/Work/NavSlidesEditor`: branch main, HEAD aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131; handoff partial11 untracked sẵn.
Education worktree `C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001`: branch feat/education-gemini38-cook-261001, HEAD c5b5e896d9f06859b21e19122f81c7613067c386. Baseline12modified+9untracked có sẵn ngoài reports của các request tiếp nối. Sau handoff này có thêm handoff mới; đừng coi nó là baseline-clean hoặc xóa để lấy9.
Không staged; phải kiểm tra status mới khi tiếp nhận. Không reset/stash/checkout/clean, merge/commit/push/deploy hoặc xóa scratch/archive.

## Subject và dữ liệu

Native11 đã FAILED_DELIVERY_NOT_ADMITTED, genuine Native receipt thiếu. Evidence11 genuine receipt không thay được Native. Combined source verdict REPAIR_REQUIRED, coverage bounded. Không reconstruct receipts hay dùng historical PASS cho current source.
D: bị lỗi truy cập/storage; không inference dữ liệu mất và không repair/probe/scan/copy/regenerate/overwrite D: trong continuation này.
CurrentC KHÔNG là frozen11: chỉ2/38 required helper/caller paths hiện diện (`release-surfaces.js`, `present-offline-helpers.js`).24helper và12caller paths thiếu. Fresh implementation từ current source, không source reconstruction từ transcript.26helper scope draft chứa24new+2existing;12callers cần quyền tác giả/cases riêng.
New candidate proposed C path chưa tạo. Không được copy HEAD clean bằng git archive và bỏ dirty changes; phải explicit allowlist/dependency closure theo approval sau này. Historical `.playwright/runs` có junctionD, không follow hoặc xóa. Source-only allowlist chưa runtime-equivalent: dist/build/data excluded có thể bỏ dependencies/entrypoints. Không auto npmci/install/build để bù.

## Routing và policy

Registry models.yml và config.toml có target. Current task receipt schema research đã quan sát `model=gpt-6.1-sol`, KHÔNG Gemini. Đừng ghi model assertion trong prompt rồi coi là pin.
New selected coordinator KHÔNG tự chứng minh subagent inheritance. Nếu user sau này cho phép một read-only route-check task, kiểm receipt engine cung cấp provider/model; không lấy lời tự khai của subagent làm bằng chứng. Nếu receipt thiếu hoặc khác, dừng, không inference retries để tìm GREEN.
Application/SDK/gateway/provider no-retry/no-fallback chưa proven hiện tại; historical overlay05/10 không proof live state. Không đọc/export secrets, headers, tokens hoặc đổi settings. Không đổi provider/model để tránh429, không tăng timeout/retries.
Không thay configured deadlines trong route transfer. Cap startup trước chỉ là observation, không producer timeout hoặc permission retry/resume11.

## Authority hiện tại

Chỉ tiếp nhận handoff và xác nhận model/status/policy có evidence. User chưa cấp authority thực thi candidate/source/test. Không tự bắt đầu26helpers hoặc12callers vì prompt nói cook --auto.
Nếu route đạt target và policy verified, báo kết quả rồi xin authority bounded candidate creation/helper implementation. Nếu user không muốn17th permission loop, nêu đúng một quyết định scope cần chốt, không yêu cầu Gate0/CLIhelp đã làm lại.
NF-A4 giữ EXCLUDED/SOURCE_MECHANISM_CONFIRMED_SCOPE_APPLICABILITY_UNRESOLVED; không repair7. Blanket unconditional-keypress rejection scope cũng unresolved. Có34historical disposition entries, không34new repairs.
54declared/0admitted/0executed. Caller cutover, source integration, smoke/qualification ngoài scope cho đến khi genuine new producer delivery và hai independent full-source GO gates + quyền thực thi phù hợp.
Không sửa assertions/scoring/physics để lấy GREEN; không source/receipt fixes trước approval. Các false findings Reveal.isPaused/clickTriviaNext đã retracted; N10B-01 old getBindings suggestion NONOPERATIVE, phải current owner passive dispatcher evidence.

## Prompt chuyển session — CHỈ SAU model selector xác nhận

Đọc handoff này và các C authority/report được dẫn. Không truy cập D:, sửa config/source, tạo candidate, chạy tests hoặc qualifications. Xác minh branch/HEAD/status không clean assumption. Xác nhận requested/effective model theo engine evidence, không self-reported identity; nếu chưa có receipt thì báo chưa verified. Kiểm no-retry/no-fallback policy từ evidence không secrets hiện có; unknown giữ unknown. Báo ngắn phần đã verified, blocker thật và một proposal authorization bounded để bắt đầu freshC subject. Không lặp CLIhelp/startup/registry scans hoặc reconstruct frozen11/receipts.

## Acceptance of transfer

- User-operated separate session status confirmed target, main coordinator unchanged.
- Live effective route evidence supplied; independently bound policy limits truthful.
- Git/status/subject boundaries understood, no D access, no source edits by reception.
- Nếu bất kỳ điều kiện thiếu: SESSION_TRANSFER_PENDING, không claim complete/liveGemini binding.

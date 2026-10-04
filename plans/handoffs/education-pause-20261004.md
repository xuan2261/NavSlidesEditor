# Education cook — pause checkpoint

## Mission and current status

Cook tạm dừng theo yêu cầu người dùng: lưu toàn bộ thay đổi hợp lệ, không chạy lại tests, dọn scratch/worktree thừa và bàn giao công việc còn mở. Không hoàn thành, không release-ready. Implementation đã có trên nhánh education; current-subject acceptance của Phase04–16 vẫn mở. Phase01–03 chỉ có qualified historical checkpoints.

## Scope and guardrails

- Implementation workspace: `C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001`, branch `feat/education-gemini38-cook-261001`.
- Coordinator/main workspace: `C:/Work/NavSlidesEditor`; không tự merge education vào main, push hoặc deploy.
- Resume giữ `--auto --advice --tdd` và producer model `local8045/gemini-3.8-flash-high`; kiểm tra route thật trước dispatch, không tự đổi model.
- Lệnh không chạy lại tests chỉ áp dụng thao tác checkpoint/cleanup này. Phiên tiếp tục phải verify phần thay đổi và qualification theo plan.
- Không đổi product scoring, physics, timeouts/retries/assertions hoặc thu hẹp acceptance để lấy GREEN. Failed verification phải có counsel theo Failure Protocol trước sửa tiếp.
- Không commit raw sessions, private runtime data, generated packages/caches hoặc credential values. Không xóa failed receipts, original fixtures/user presentations, hay implementation chưa được bảo toàn.

## Current state

Main HEAD trước checkpoint: `8389b7f1f203137f8ddf771c7bcbc50f61d06936`; education HEAD trước checkpoint: `760eae26d9bdcdd22cb42dd5f1e0eab487e18fa3`. Lấy HEAD mới từ Git trước resume; các commits trong thao tác này là checkpoint, không qualification.

Ba producer `author`, `timed`, `references` đã bị hủy theo yêu cầu. Bulk byte comparison với prepared source snapshot quan sát **không có file mới/khác do producer tạo ra**. Không có acceptance producer output để tích hợp hoặc claim PASS. Worktrees phụ được phép gỡ sau khi giữ sessions/dispatch contracts và checkpoint source; không gọi các slices đó là hoàn thành.

Git inventory trước cập nhật handoff: main có 6 modified + 313 untracked; education có 302 modified + 579 untracked. Main chứa coordinator reports và một thay đổi ribbon riêng; giữ độc lập, không ghi đè bằng education. Raw JSONL sessions được chuyển ngoài Git khi cleanup; source/tests/plans/docs hợp lệ được checkpoint.

Cleanup receipt canonical: `C:/Work/NavSlidesEditor/plans/reports/education-pause-cleanup-20261004.json`. Nếu receipt chưa tồn tại hoặc có errors, cleanup chưa hoàn tất; không suy thành thành công từ phần kế hoạch dưới đây.

## Decisions and rationale

- Giữ implementation trên nhánh riêng: chưa đủ acceptance để đưa vào main như tính năng đã hoàn thành.
- Roadmap main bỏ historical Phase04 complete claim cho source hiện tại; Phase04–16 remain open. Education plan chứa checklist chi tiết cho từng acceptance gap.
- Giữ historical/failed receipts để điều tra, không dùng test totals hoặc prior subject để đóng release cells.
- Scratch có evidence được relocate, không xóa mù. Các consumer phải dùng relocation receipt để tìm dữ liệu ở vị trí mới; đường dẫn `.tmp` trong historical reports ghi vị trí tại lúc chạy, không phải live source path sau cleanup.

## Work performed

- Canceled owned process handles `bg_390`, `bg_391`, `bg_392`.
- Đọc source plan, Git/worktree inventory, commit hook configuration và existing preliminary result; không chạy lại kiểm tra sản phẩm.
- Cập nhật pause state, branch/source pointers và checklist acceptance còn thiếu.
- Scan nội dung checkpoint không gồm raw sessions bằng private-key/provider-key/credential-URL/credential-assignment patterns: không có finding. Đây không phải security audit toàn codebase.
- Active feature hook là `lint-staged` với ESLint/Prettier; không có test command. Hook không bị bypass. Main configured `.husky/_` không có installed launcher tại lúc kiểm tra.

## Verification

Không chạy lại tests/build/browser qualification trong checkpoint này theo yêu cầu người dùng.

Historical bounded evidence đã có trước lệnh tạm dừng:

- Deadline-rearm full producer: 800 files, 6,242 passed tests, zero failures, 3 existing skips; receipt `.tmp/education-full-unit-20261004-deadline-rearm.json` (sau cleanup dùng relocation receipt). Source sau đó còn thay đổi, nên không coi là exact-current-subject GREEN.
- Mounted countdown repair: RED-before/GREEN-after; 3 focused suites / 16 tests.
- Actual Chromium rerun: `D:/NavSlidesQualification/common-preliminary-20261004-r10/remaining-acceptance.log` ghi **9 passed (3.2m)**, không retries/deadline tăng: utility lifecycle Present/Share/file, card touch Present/file, Vietnamese puzzle CDP touch/composition Present/Share/file.
- Native Chromium CDP composition không chứng minh native OS IME hoặc physical mobile hardware.
- Prior browser lanes từng có 426 passed / 2 failed; prior desktop lane 44 passed / 6 failed. Retain failed context/trace; các source repairs sau đó invalidate subjects cũ.
- Fresh complete frozen browser/static/live/Electron-dev/Windows-package qualification và broad affected E2E chưa hoàn tất. Hai Windows binaries trước được ghi NotSigned; không claim production readiness.

## Open risks and blockers

Các acceptance sau **chưa được exercise đủ**, không nhất thiết là known product bugs:

1. Bảy quiz kinds: authored content/answer/media/reorder, save/reload/undo/duplicate và stable-ID grading.
2. Memory/flashcards content/reorder/history và stable pair/card identities.
3. Trigger Share/file parity; UI variable/fragment/reference remapping history.
4. Quiz và legacy pending deadlines khi leave/return/reset trên Present/Share/file.
5. Native pointer capture/interrupted drag: cancellation không assignment/score changes.
6. Contradictory/bounded puzzle authoring errors: feedback, correction bằng controls và replay.
7. Hot Potato bonus, Scatter duplicate unique scoring, Trivia buzz policy distinguishing branches.
8. Bode invalid-input recovery; three-phase amplitude/speed/pause/resume controls.
9. Nested native-project media sau khi original sources không truy cập được.
10. Fresh source/config/docs freeze trên D:, isolated production-mode Windows build, sequential exact-subject artifact lanes và final release gate.

Underlying atomic-save latency/previous word-search launch timeout chưa có proved cause; không báo đã fix filesystem/storage chỉ vì rerun sau đó pass. Không dùng C: cho qualification stage/cache khi D: đã là approved scratch route.

## Exact next actions

1. **First safe step**: đọc handoff, cleanup receipt và education `plan.md`; xác minh branch/HEAD/worktree bằng Git. Không tạo lại snapshot/dispatch trước khi biết source checkpoint và archived artifact locations.
2. Tiếp tục trực tiếp trong worktree education được giữ. Chỉ tạo lại isolated producer worktrees nếu cần parallel work; dùng source checkpoint mới và Git index đúng, không `--no-checkout` rồi coi snapshot là branch diff sạch.
3. Đọc archived `acceptance-author-prompt.md`, `acceptance-timed-prompt.md`, `acceptance-references-prompt.md` và jobs/permissions từ relocated education scratch. Paths/CWD cũ thuộc canceled attempts, phải điều chỉnh trước dispatch. Producer chưa tạo các files được giao.
4. Đóng lần lượt gaps 1–9 ở trên, ưu tiên author history/pending-round/trigger/drag/puzzle/scoring; simulation/native-media nằm ngoài ba producer contracts. Review và tích hợp owned files trước coordinator-run checks; không chạy child build/lint/tests mid-flight.
5. Sau acceptance smoke, cập nhật affected docs/checklists theo receipts thật; fresh complete-input freeze, stage/build/outputs trên D:, rồi chạy sequential actual browser/static/live/Electron-dev/new Windows-package lanes đúng subject/artifact identity.
6. Chạy broad affected E2E độc lập với required-cell receipt; chạy `scripts/feature-inventory/education-release-gate.mjs`. Chỉ tick Phase04–16 khi đủ named criteria, không khi code đã tồn tại hoặc totals GREEN.
7. Không merge/push/deploy nếu chưa có lệnh riêng của người dùng.

## Source pointers

- Education plan: `C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001/plans/261001-0639-interactive-html-education-deep-tdd/plan.md`.
- Phase acceptance owners: các `phase-04-*.md` đến `phase-16-*.md` trong plan directory; `reports/scope-ledger.md`, `reports/execution-contracts.md`, `reports/baseline-evidence.md`.
- Evidence gate owners: `scripts/feature-inventory/education-release-gate.mjs`, `education-qualification-stage.mjs`, `prepare-education-qualification.mjs`.
- Existing actual scenarios: `tests/e2e/education/utility-lifecycle-acceptance.spec.js`, `card-touch-acceptance.spec.js`, `puzzle-touch-ime-acceptance.spec.js`, `release-simulation-interactions.js`.
- Retained qualification roots: `D:/NavSlidesQualification/common-preliminary-20261004-r10`, `education-final-20261004-disk-recovery`, `education-final-20261004-deadline-rearm-stage`, `archive-261004-edu-stages`.
- Planned scratch archive root: `D:/NavSlidesQualification/pause-checkpoint-20261004`; exact moved paths/cleanup success belong to canonical cleanup receipt, not assumptions.

# Gate0 review limits and concrete next action

Gate0 đã hoàn tất phần read-only. Không có producer GO; không đề nghị lặp Gate0 hoặc cấp phép chung thêm.

## Copy inventory không phải runnable closure

- Byte counts là lower-bound logical-file inventory trong allowlist, không snapshot reproducible hoặc copy plan đã cấp phép.
- Exclusion `dist`/`build`/nested `node_modules` có thể bỏ entrypoints/assets/transitive closure của installed dependencies. Không được copy theo inventory rồi giả định runnable; candidate thật cần dependency-closure plan riêng trước copy. Phần reserve2GiB là proposed cap, không chứng nhận closure nằm trong cap.
- Root/config/support files ngoài allowlist phải được xét cụ thể, không nhận là đã đầy đủ.
- C reparse links cũng không thể follow mù; gồm alias package/dist mà target bị excluded. Khi cho phép candidate, phải chọn cách materialize hoặc recreate internal links với targets nằm trong candidate và closure đã chứng minh.
- `.bin` text wrappers/generated launchers dù là regular files có thể giữ đường dẫn canonical hoặc dynamic runtime roots. Không dùng chúng để launch mà chưa đọc/kiểm path binding và reviewed C-only environment.
- Tất cả canonical dependencies phải giữ nguyên. Không npm install/ci/update, không gọi source/launcher trong preparation.

## Storage

Observedfree không future reservation hoặc actual NTFS allocated-size. Hypothetical4KiB rounding chỉ tính giả định, không biết cluster/packing. Đề xuất10GiB gồm candidate2/artifact4/freefloor4; checks capacity phải lặp đúng trước những writes được cấp phép sau này. Không xóa scratch/archive để lấy chỗ, không nâng cap tự động.

## Route prerequisite — cần một artifact, không cần recoveryD

Cung cấp current redacted receipt hoặc pin-aware execution surface chứng minh:

1. Requested/effective provider `local8045`, model `gemini-3.8-flash-high`.
2. Binding tới surface/session/job dự kiến, timestamp và expiry/scope (process-only hay durable).
3. Retry/fallback effective tại caller/client/gateway/provider layers; unknown layer phải ghi rõ, không infer prompt policy là enforcement.
4. Non-inference dry-run plan nếu tool hỗ trợ; không yêu cầu inference probe, không pretend đang có surface đó.

Không secrets, tokens, raw config, commandlines. Có thể paste redacted artifact hoặc cung cấp regular readableC file. OMP processname và lịch sử overlay05/10 không thay proof hiện tại. Currentquota/availability vẫn unknown đến legitimate dispatch được cấp phép sau này.

Nếu không có surface pin-aware, công việc producer phải blocked. Không dùng GPT reviewer để thay model, không tự sửa global configuration. Đây là prerequisite kỹ thuật thật, không rào cản có thể giải quyết bằng câu “tiếp tục” chung.

Sau route proof: review dependency closure/explicit candidate authority và26helper implementation;12callers/TDD runtime/54acceptance/cutover/smokequalification vẫn scope riêng. NF-A4excluded/unresolved;0cells executed; failed11settlement giữ nguyên.

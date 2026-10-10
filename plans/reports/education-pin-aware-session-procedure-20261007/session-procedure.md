# Pin-aware session procedure — 2026-10-07

## Phạm vi đã hoàn tất

Kiểm tra tĩnh và trình lệnh trước execution. Không khởi chạy CLI/session, inference, config reload/edit, candidate/source/test; không D access. User đề nghị tiếp tục theo proposal trình lệnh trước chạy, không cấp quyền thay default toàn phiên.

## Facts và giới hạn

- User-supplied JeikCode registry khai báo `local8045/gemini-3.8-flash-high`; OMP registry cũng có target.
- Actual process executable metadata: `C:/Users/Z10PAD8C_Xuan2261/.local/bin/jeikcode.exe`, không còn tại old target/release path. Old report path là historical observation, không current executable identity.
- Current `functions.task` schema không có provider/model override. Registry declaration chưa bind task to target; GPT task không substantive Gemini.
- Source JeikCode được đọc trên C:, code_explore không có index và không init. Source/layout thay đổi giữa các lượt; compiled binary/source equivalence chưa chứng minh. Do đó không dùng old source offsets hoặc guessed `--provider`/`--model` syntax làm lệnh đã verified.
- `models` nếu binary hỗ trợ chỉ chứng minh registry, không live session effective route/policy. `chat` không route-only probe: có thể thực hiện inference và startup side effects.
- Startup có thể đọc config/auth/extensions, khởi tạo logs/runtime/session assets hoặc telemetry tùy version. Không launch để dò mù và không export raw config.
- OMP installed static CLI cho thấy pin-aware flags/RPC tiềm năng nhưng actual retry/fallback/session binding vẫn chưa verified. Không chuyển qua OMP hoặc dùng default SDK policies tự động.

## Lệnh tiếp theo tối thiểu — CHƯA CHẠY

Trong PowerShell, thư mục C: đã xác minh, dùng absolute path tránh PATH D:

```powershell
& 'C:/Users/Z10PAD8C_Xuan2261/.local/bin/jeikcode.exe' --help
```

Mục đích: kiểm tra exact supported flags/subcommands của binary hiện tại, không prompt, không chat, không inference và không model switch.
Source/version chưa đủ chứng nhận tuyệt đối startup behavior của binary; chỉ chạy sau user đồng ý đúng lệnh trên. Nếu process không thoát ngay hoặc xuất config/credential, dừng inspection không gửi stdin/prompt và không tự retry.

Tool structured request_user_input không được môi trường hỗ trợ. Vì vậy không ghi “user đã approve --help”; cần xác nhận bằng chat. Không dùng --help approval để chạy subcommands tiếp.

## Sau output --help — điều kiện, không executable script được cấp phép

1. Xác định exact flags override theo binary, tránh tự đoán syntax.
2. Chọn session riêng với target model; giữ nguyên global config/main session và worktree canonical.
3. Trước startup riêng, review side effects/storage/config loading và yêu cầu scope cho session metadata; không inference. Nếu không có route-only state feature, báo thiếu feature thay vì gọi chat làm test.
4. Ghi requested/effective provider/model + binding session/job + snapshot time và effective retry/fallback từng layer. Không coi retry field thiếu là false.
5. Nếu runtime/gateway no-retry/no-fallback chưa quan sát được, producer còn blocked; không sửa binary/provider policy để lách, không SDK direct call hoặc default-model substitution.
6. Chỉ sau proofroute và authority source/candidate riêng mới triển khai26helpers trên subject C mới.12caller/test/cutover/smokequalification riêng; NF-A4excluded/unresolved;54declared0admitted0executed.

## Hành động người dùng cần xác nhận

“Cho phép chạy duy nhất jeikcode.exe --help ở đường dẫn trên; chưa chạy chat/session/inference, chưa sửa cấu hình hoặc source.”

Không yêu cầu phục hồiD hay gửi APIkey/token/raw config. Không lặp Gate0; đây là command-level prerequisite cụ thể.

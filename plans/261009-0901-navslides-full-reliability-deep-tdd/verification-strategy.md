# Verification strategy — deep TDD

## Quy tắc chứng minh

Kế hoạch này không thực thi sửa mã hoặc qualification. Mỗi scenario ID `Pxx-yy` là yêu cầu kiểm chứng, không phải số test đã chạy. RED phải là assertion hành vi lỗi, không phải thiếu dependency, sai test path hoặc timeout môi trường. Những guard đang đúng được characterization GREEN; không sửa code tốt để giả lập RED.

1. Phase-entry scout: đọc source/test/config mới nhất, liệt kê callers, prerequisites và expected output. Với exported API dùng LSP references khi có.
2. Reuse existing case trước thêm case. Viết regression cho race/state/identity boundary thiếu proof; parameterize các status/severity có cùng contract.
3. RED → sửa tối thiểu → GREEN → refactor vùng chạm → focused regression → runtime smoke thật.
4. Không permanent tests cho source text, wiring, forwarding/mock echo, copy, incidental default, className hay exact prose. Tests cũ dạng này trong vùng chạm phải bỏ/thay bằng observable behavior, không repin.
5. Lỗi interleaving dùng deferred/barrier, fake timers cho debounce; concurrency/atomicity phải quan sát real temp storage. Process crash dùng child process + IPC checkpoint + kill + reopen, không gọi injected exception là crash/power-loss proof.
6. Chỉ chạy lint/build/full regression một lần sau cụm edit, không giữa các subagent đang sửa chung. Trước đóng mỗi phase chạy đúng focused path và smoke surface.

## Môi trường và command discipline

- Root: `C:/Work/NavSlidesEditor`; Node engine lấy `package.json`, runner/browser pins lấy `runtime-versions.json` và workflow. `npm ci` chỉ tại workspace kiểm thử được phép, không sửa lock để cài cho qua.
- `npx vitest run <existing-test-paths>` dùng cài đặt local được pin. New test path trong phase chỉ executable sau khi tạo. Không `--passWithNoTests` hoặc mock echo để che project exclusion. Dùng `npm run test:inventory` kiểm tra file mới và test partition trước claim pass.
- `npm run build` tạo client artifact; Playwright mặc định chạy production Express với isolated data/uploads và ports trong `playwright.config.js:120–136`. Không chạy E2E trên server/data thật. Không reuse server người dùng.
- `--project=chromium` cho editor/settings/history/navigation; PPTX import spec được config phân lane phải dùng `--project=chromium-pptx-import`. Visual lane Linux theo workflow, không tự rebaseline để xanh.
- k6 API/WebSocket phải có server isolated và URL/profile lấy từ existing scripts; readiness trước load, giữ thresholds hiện có. `test:ci-budget` là Vitest performance, không phải UI latency budget.
- Trivy v0.74.0/Syft v1.52.0 theo reusable workflow. Capture genuine fixtures và invocation metadata trước cố định schema. Scanner process error hoặc thiếu target evidence không được coi clean scan.
- OfficeCLI physical, PowerPoint fidelity, Windows signing, independent download và attestation là external capability gates. Không mock receipt để chứng nhận. Commands có environment prerequisites phải đọc existing runner/manifest/help trước thực thi; không đoán flags.

## Evidence ledger schema cho mỗi run

Tạo `reports/<phase>-<run>.json` khi thi hành, gồm:

```json
{
  "phase": 2,
  "scenarioIds": ["P02-01"],
  "sourceSha": "40-hex",
  "worktreeState": "clean-or-dirty-with-diff-digest",
  "policyHash": "sha256",
  "artifactKind": "source-or-image-or-nsis-or-portable",
  "artifactDigest": "sha256-with-identity-kind",
  "fixtureHashes": {},
  "toolVersions": {},
  "command": "exact argv without secrets",
  "startedAt": "ISO8601",
  "exitCode": 0,
  "status": "passed",
  "outputs": [],
  "limitations": []
}
```

Đây là schema dự kiến, không phải receipt đã có. Giá trị ví dụ không được đưa vào final evidence. Với Docker ghi riêng image/config ID và registry manifest digest; không coi hai loại như cùng identity. Evidence test harness không có artifact binary ghi `artifactKind: source`, không bịa image digest.

Status: `not-run`, `passed`, `failed`, `blocked`, `skipped`. Waiver/exception là quyết định policy có scope/owner/expiry, không đổi status raw test thành passed. Không có field nào cho phép receipt tự khai authority thay verified producer/provenance.

## Lớp test và exit

| Lớp | Mục đích | Oracle |
|---|---|---|
| Unit/contract | Merge, revision, schema, exact required status, closure | Returned values/errors/state invariants |
| Integration filesystem/HTTP | Lock, owner/head/projection/session mutation | Persisted bytes/hash + real response |
| Fault/restart | Apply/ack, WAL/root, media placement và compensation | State sau kill/reopen + identity-bound convergence |
| Browser | Draft/history/selection/navigation/a11y | Visible input/focus/content + persistence |
| Artifact | Container/Electron/Office/PowerPoint | Actual process/render/signature/download/provenance |
| Final CI | Source/artifact/policy consistency | Required job/shard manifest và receipt DAG |

Coverage floors hiện có: lines 74, branches 60, functions 68, statements 71 (`vitest.config.mjs`). Không dùng coverage để kết luận không có race hoặc PowerPoint fidelity toàn diện. Corpus count là fixture scope, không thị trường tính năng.

## Failure, rollback và release freeze

- Dừng dependent phase khi invariant fail; giữ logs/fixtures, xác định nguyên nhân; không vô hiệu gate, retry stale write vô điều kiện hoặc hybrid fallback cho edited export.
- Storage failure trước rename phải giữ old bytes/revision và release lock; rename là commit point. Không báo uncommitted failure do thao tác fallible dư thừa sau commit, không rollback ghi đè winner. Fault cases phân biệt trước/sau commit. Package compensation phải bảo toàn winner/original/shared ownership.
- Runtime smoke không đạt thì phase chưa complete dù focused tests xanh.
- Phases 11/12 có thể dùng candidate trung gian để chuẩn bị lane; phase 16 yêu cầu đúng final SHA và artifact. Mọi shipped input thay đổi sau freeze phải tái kiểm chứng phần bị ảnh hưởng. Không dùng bằng chứng trung gian cho final bằng cách đổi nhãn SHA.
- Chưa có signing/Office/GitHub permission: triển khai độc lập có thể tiếp tục; release vẫn blocked. Thực thi kế hoạch không ngầm cấp quyền publish, thay repository settings hoặc truy cập signing secrets.

# PPTX Import Readiness Audit

**Ngày kiểm tra:** 2026-07-22  
**Phạm vi:** client upload/UX, HTTP jobs, parser worker, ZIP/XML/media guards, OOXML scene graph, mapper, package authority, save/export, corpus, browser/E2E, oracle, tài liệu  
**Chế độ:** read-only audit; không sửa application code  
**Trạng thái báo cáo:** hoàn tất điều tra, có fresh verification

## 1. Kết luận thẳng

**PPTX Import hiện đã dùng được cho self-hosted, best-effort import. Chưa “hoàn thiện 100%”, chưa đủ bằng chứng cho 1:1, full editability, native edited-package release, hoặc PowerPoint visual fidelity.**

Nhận định chính:

- **Có thể dùng:** upload `.pptx`, parse trong child process, dựng editable NavSlides projection, lưu presentation, mở trong editor, khôi phục/download đúng original package.
- **Đã harden đáng kể:** giới hạn ZIP/XML/media/parser/deadline; kiểm tra path collision/traversal; cancellation; package authority; source map; generation fencing; idempotent edited-package transaction; fail-closed fidelity contract.
- **Browser structure hiện tốt hơn báo cáo cũ:** fresh strict audit chạy **5 deck / 227 slide**, không có slide fail, text overflow, unexpected image clipping, unexpected out-of-canvas, hoặc console error. Báo cáo cũ tháng 5 không còn đại diện trạng thái hiện tại.
- **Chưa có bằng chứng visual fidelity với nguồn:** visual oracle fail vì toàn bộ 11 deck vẫn là `placeholder-goldens`; không có SSIM.
- **Strict importer chưa đạt trên deck thật:** `Bai_2_1.pptx` fail `emf-convert-disabled`; `STTre_Duc.pptx` fail do 174 native leaf node chưa map.
- **Có lỗi production đáng sửa ngay:** `uploadLimiter` đang throttle cả upload, status polling, SSE và cancel. Fresh probe: request GET thứ 31 nhận HTTP 429.
- **Corpus “strict” hiện không đồng nghĩa strict importer:** lane corpus pass 11/11 nhưng không bật các native scene/EMF strict gates.
- **`pptx2json fallback` là claim sai:** implementation chỉ dùng `pptx2json` làm package inspector trên output sắp bị reject; không thay parser output.

### Verdict theo capability

| Capability | Verdict | Ghi chú |
| --- | --- | --- |
| Import PPTX best-effort | **Usable, limited** | Parser + mapper + package commit hoạt động; complex content có thể approximate/read-only/placeholder |
| Browser structural/layout health trên corpus hiện tại | **Green trong phạm vi test** | 227/227 slide pass heuristic; không phải source visual comparison |
| Editable NavSlides projection | **Usable, limited** | Text/shape/image/table và nhiều primitive dùng được; native identity vẫn còn gap |
| Exact original recovery | **Implemented, strong software contract** | Immutable R0/original download; đây là recovery, không phải editability |
| Reconstructed PPTX export | **Implemented, lossy by contract** | 63.0% average reconstructed roundtrip trên corpus hiện tại |
| Validated edited-package export | **Bounded/fail-closed, chưa release-qualified** | Generation/idempotency contract có; Office/native qualification còn mở |
| Imported native chart editing | **Không available** | UI cố ý preserve-only khi chưa đủ qualification fields |
| Strict native importer | **Blocked** | Representative real decks vẫn fail strict gates |
| PowerPoint visual fidelity | **Blocked/unproven** | Oracle không có reviewed goldens; SSIM `null` |
| 1:1 PowerPoint roundtrip | **Blocked/unproven** | Fresh composite claim evidence chưa có |
| Multi-tenant job security | **Không thuộc supported model hiện tại** | Cần per-job authorization nếu product model đổi |

## 2. Audit contract và cách phân loại bằng chứng

### Outcome

- Dựng lại pipeline end-to-end.
- Xác định phần đã implement, phần chỉ preserve/approximate, phần lỗi, phần chưa chứng minh.
- Đánh giá correctness, lifecycle, fidelity, reliability, security, performance, UX, tests, corpus và docs.
- Đưa roadmap P0–P3.

### Constraints

- Không suy completion từ plan/journal hoặc historical green run.
- Dùng source, tests, fresh command output và generated evidence.
- Không đụng application code; không overwrite dirty worktree có sẵn.
- Export chỉ xét phần giao với import, original recovery, package authority và roundtrip.

### Nhãn bằng chứng

- **Confirmed — source:** code path hiện tại chứng minh.
- **Confirmed — reproduced:** fresh probe/test tái hiện.
- **Intentional limit:** behavior cố ý fail-closed hoặc preserve-only.
- **Unverified risk:** plausible, cần thêm empirical evidence; không gọi là bug đã tái hiện.

## 3. Pipeline thực tế

```text
HomePage file selection
  -> POST /api/pptx/import
  -> reserve in-memory job trước khi nhận body
  -> Multer UUID temp upload
  -> fork parse-worker
      -> validate file/ZIP/XML/resource budgets
      -> pptxtojson parse
      -> optional pptx2json inspection only
      -> output usability check
  -> host reopens and revalidates package
  -> build OOXML scene graph
  -> map parser output to 960x540 NavSlides projection
  -> supplement chart/SmartArt evidence from OOXML
  -> reconcile scene graph/native nodes
  -> optional strict acceptance
  -> build source map
  -> package-store import commit: immutable R0 + head generation 1
  -> create compatibility JSON visibility
  -> commit imported media transaction
  -> complete job with presentationId/stats/warnings
  -> SSE or polling returns terminal result
  -> client opens /editor/:presentationId
```

### Chi tiết theo stage

1. **Client validation và busy retry** — `client/src/pages/HomePage.jsx:641-684`.
2. **Async upload API** — `client/src/utils/api.js:98-118`.
3. **Job wait bằng SSE, fallback sang polling** — `client/src/utils/pptx-job-wait.js:24-69`, `client/src/utils/pptx-job-wait.js:79-157`.
4. **Job admission trước Multer body** — `server/routes/pptx-import.js:312-327`.
5. **HTTP job routes** — `server/routes/pptx-import.js:367-392`.
6. **Global import deadline và cancellation** — `server/routes/pptx-import.js:117-150`.
7. **Parser child process** — `server/services/pptx-import/worker-runner.js:66-196`.
8. **Package validation** — `server/services/pptx-import/pptx-guards.js:71-139`.
9. **Parser + inspector** — `server/services/pptx-import/parse-worker.js:11-88`.
10. **Scene graph, mapper, reconciliation, source map** — `server/services/pptx-import/importer.js:55-165`.
11. **Mapper output và native evidence** — `server/services/pptx-import/mapper/map-presentation.js:243-484`.
12. **Package-first commit** — `server/routes/pptx-import.js:154-213`, `server/services/pptx-import/package-store/import-commit.js:129-193`.
13. **Media commit rồi complete job** — `server/routes/pptx-import.js:248-254`.
14. **Original/reconstructed/validated export modes** — `client/src/hooks/use-export-actions.js:76-171`.

## 4. Phần đã làm tốt

### 4.1 Parser isolation và resource ceilings

Các ceiling hiện tại nằm ở `server/services/pptx-import/constants.js:4-15`:

- upload: 100 MiB;
- ZIP entries: 5,000;
- decompressed package: 500 MiB;
- parsed JSON: 256 MiB;
- aggregate imported media: 500 MiB;
- parser timeout: 60 giây;
- import deadline: 120 giây;
- parser heap: 1,024 MiB;
- SIGTERM → SIGKILL grace: 2 giây;
- stale upload age: 15 phút;
- concurrent import: 1, tại `server/services/pptx-import-job-manager.js:3-15`.

Worker có ACK, abort, timeout, stderr/stdout diagnostic truncation và kill escalation. Parser crash/OOM không trực tiếp kéo host process xuống.

### 4.2 ZIP, XML và media safety

- Raw ZIP parser reject control chars, backslash/absolute path, dot-segments, encoded traversal, duplicate path, case collision và central/local header mismatch — `server/services/pptx-import/package-store/raw-zip.js:10-53`.
- Package guard đo declared và actual decompressed bytes; bounded entry reads — `server/services/pptx-import/pptx-guards.js:71-139`.
- XML guard reject DTD, entity declaration và XInclude; có byte/depth/attribute/text ceilings — `server/services/pptx-import/xml-safety.js:3-8`, `server/services/pptx-import/xml-safety.js:73-147`.
- Media dùng magic-byte sniffing, mismatch warning/rejection, SHA-256 dedup và UUID-owned paths — `server/services/pptx-import/media.js:6-18`, `server/services/pptx-import/media.js:88-168`.
- Không thấy importer tự fetch arbitrary remote media URL.

### 4.3 Mapping breadth

Mapper có path cho text, image, shape, line, table, chart, diagram, group, video, audio, math, notes, background, theme/layout metadata, transitions và animation inventory. OOXML evidence bổ sung chart/SmartArt khi parser thiếu. Unsupported content được warning hoặc locked placeholder thay vì silently pretending full editability.

### 4.4 Package authority và claim discipline

- Content-addressed package blobs.
- Immutable R0 original revision.
- Package head + generation.
- Server-owned source map.
- Compatibility JSON được định nghĩa là projection, không phải package authority.
- Generation-fenced saves.
- Idempotency-bound edited-package transaction.
- Export surfaces tách rõ:
  - Download Original;
  - reconstructed PPTX;
  - validated edited revision.
- Fidelity contract có claim ceiling level 1–5 và luôn giữ level 5 unavailable — `server/services/pptx-import/fidelity-contract.js:29-35`, `server/services/pptx-import/fidelity-contract.js:209-225`.
- Chart import chỉ editable khi đủ bốn qualification fields; hiện preserve-only — `client/src/components/properties/chart-properties.jsx:6-15`, `client/src/components/properties/chart-properties.jsx:41-156`.

Đây là hướng kiến trúc đúng: không đánh đồng original recovery, package preservation, validated package, feature editability và PowerPoint compatibility.

## 5. Fresh verification

### 5.1 Passing evidence

| Gate | Fresh result |
| --- | --- |
| Focused import regressions | 10 files pass; 80 tests pass; 1 skipped |
| Security boundaries | 6 files pass; 51 tests pass |
| Package-backed fidelity contracts | 5 files pass; 55 tests pass |
| Source-map/native transaction tests | 3 files pass; 50 tests pass |
| Phase-13 evidence contracts | 4 files pass; 12 tests pass |
| No-OfficeCLI package boundary | Pass; chỉ chứng minh không bundle disallowed OfficeCLI executable |
| Strict corpus metric lane | 11/11 deck; 100.0% average parser-relative semantic; 63.0% reconstructed roundtrip |
| Strict browser smoke | 3/3 tests; 2 deck; 127 slide |
| Strict browser full | 6/6 tests; 5 deck; 227 slide; zero strict heuristic failure |

Fresh browser report: `plans/reports/pptx-import-real-browser-audit-runs/2026-07-22T08-55-38-512Z-14908/pptx-import-real-browser-audit.md:1-14`.

Audit này iterate toàn bộ slide thật — `tests/e2e/pptx-import-real-browser-audit.spec.js:140-169`. Nó kiểm tra missing canvas, text overflow, unexpected clipping, out-of-canvas, zero-size và console errors. 128 raw out-of-canvas objects đều được phân loại thành source-evidenced decorative bleed; không còn unexpected item. Classification owner: `tests/e2e/pages/pptx-import-audit-helper.js:129-145`, `tests/e2e/pages/pptx-import-audit-helper.js:167-192`.

### 5.2 Passing nhưng còn yếu

Corpus strict output:

- chart decks chỉ khoảng **29.0% reconstructed roundtrip**;
- `Bai_2_1.pptx`: 70 warnings;
- `Bai_2_2.pptx`: 199 warnings;
- `Bai_2_5.pptx`: 203 warnings.

`100.0% semantic` không có nghĩa 100% source fidelity. Metric so parser output với NavSlides projection — `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:229-237`, `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:1161-1178`. Nội dung mà `pptxtojson` không thấy không thể kéo metric này xuống.

Representative best-effort timings:

- `Bai_2_5.pptx`: 1,133,172 bytes; 45 slides; 3,843 ms; 203 warnings.
- `STTre_Duc.pptx`: 2,879,091 bytes; 20 slides; 1,959 ms; 5 warnings.

Kết quả tốt ở file nhỏ vài MiB; chưa nói được gì về 100 MiB upload hoặc 500 MiB decompressed ceiling.

### 5.3 Failing/unavailable evidence

| Gate | Result | Ý nghĩa |
| --- | --- | --- |
| Visual oracle | Fail: `golden-evidence-invalid`; 11/11 `placeholder-goldens`; mean SSIM `null` | Không có source visual fidelity evidence |
| 1:1 SLA composite | Exit 1: `fresh-composite-run-required` | Không có fresh composite claim bundle |
| Strict import `Bai_2_1.pptx` | Fail: `emf-convert-disabled` | Strict EMF path chưa qualified |
| Strict import `STTre_Duc.pptx` | Fail: `PPTX_SLA_STRICT_NODES: 174 leaf node(s) unmapped` | Native identity coverage chưa đủ |

Oracle artifact: `plans/reports/pptx-oracle-runs/pptx-oracle-2026-07-22T08-59-44-928Z.json:1-95`.

Composite CLI yêu cầu `--run-dir`, `--trust-root`, `--trusted-config`; không có run dir thì cố ý trả `fresh-composite-run-required` — `server/services/pptx-import/pptx-sla-1to1-cli.js:79-89`.

## 6. Confirmed defects

### F-01 — P0: upload limiter throttle cả status, SSE và cancellation

**Confirmed — source + reproduced.**

`server/index.js:91-97` tạo `uploadLimiter`, sau đó mount cùng limiter lên toàn bộ prefix `/api/pptx` tại `server/index.js:123-124`. Vì vậy limiter đếm:

- `POST /api/pptx/import`;
- `GET /api/pptx/jobs/:jobId`;
- `GET /api/pptx/jobs/:jobId/stream`;
- `DELETE /api/pptx/jobs/:jobId`.

Production max là 30 request/15 phút. Fresh probe: GET 29 và 30 trả 404 như dự kiến; GET 31 trả 429. Poll fallback mỗi giây có thể tự khóa status/cancel sau khoảng 30 giây. Busy retries cũng tiêu cùng quota.

**Impact:** job vẫn chạy nhưng client mất observability/cancel; polling path có thể fail trước server deadline.

**Fix direction:** gắn upload limiter chỉ vào `POST /import`; status/SSE/DELETE dùng normal API limiter hoặc read-safe policy riêng.

### F-02 — P0/P1: client không honor `Retry-After`

**Confirmed — source.**

`handleResponse()` đọc `Retry-After` vào `err.retryAfter` — `client/src/utils/api.js:4-11`. Nhưng retry loop luôn sleep fixed `busyRetryDelayMs` — `client/src/utils/api.js:98-116`. HomePage dùng 5 giây, trong khi server trả 60 giây — `client/src/pages/HomePage.jsx:651-655`, `server/routes/pptx-import.js:319-321`.

**Impact:** 12 retry/minute khi server yêu cầu 1 retry/minute; tăng load và làm cạn limiter.

### F-03 — P1: upload/busy wait không abort; polling-only path không đăng ký active job

**Confirmed — source.**

- Upload fetch và `sleep()` không nhận AbortSignal — `client/src/utils/api.js:98-116`.
- Unmount chỉ cancel được khi `pptxImportRef.current` có `jobId` — `client/src/pages/HomePage.jsx:300-305`.
- `onConnection` chỉ chạy sau khi tạo EventSource — `client/src/utils/pptx-job-wait.js:98-108`.
- Nếu không có EventSource, function chuyển thẳng sang polling, không emit `{ jobId }` — `client/src/utils/pptx-job-wait.js:88-96`.

**Impact:** rời HomePage trong busy wait/upload/poll-only vẫn có thể tiếp tục retry hoặc start import; server job có thể chạy orphaned.

### F-04 — P1: client wait window đua với server deadline

**Confirmed — source timing.**

Client default 120 poll × 1 giây — `client/src/utils/pptx-job-wait.js:24-37`; server import deadline cũng 120 giây — `server/services/pptx-import/constants.js:9-10`. Client bắt đầu timeout/cancel/reconcile đúng lúc server đang chuyển terminal state.

**Impact:** race quanh deadline, đặc biệt khi network/proxy thêm latency.

### F-05 — P0 truthfulness: `pptx2json` không phải fallback parser

**Confirmed — source.**

`parse-worker` chạy inspector khi output có zero slide hoặc mọi slide empty — `server/services/pptx-import/parse-worker.js:11-29`, `server/services/pptx-import/parse-worker.js:61-77`. Ngay sau đó worker gọi `assertUsableParserOutput(result.output)` — `server/services/pptx-import/parse-worker.js:85-89`. Inspector không normalize hoặc thay `pptxtojson` output. Output đó vẫn bị reject.

Tuy nhiên importer báo `fallbackParserUsed: Boolean(parsed.fallback)` và có successful `fallback-inspector` warning — `server/services/pptx-import/importer.js:14-34`, `server/services/pptx-import/importer.js:159-165`. Successful path này thực tế unreachable.

README hiện claim `pptxtojson with pptx2json fallback` — `README.md:315-329`.

**Impact:** telemetry, docs và user expectation sai.

**Fix direction:** đổi tên thành `fallbackInspector`/`packageInspector`, bỏ `fallbackParserUsed`; hoặc làm một normalized secondary parser thật trong dự án riêng nếu business value đủ lớn.

### F-06 — P0 evidence contract: corpus `--strict` không bật strict importer

**Confirmed — source + reproduced.**

`productionImportOptions()` chỉ clone overrides — `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:71-81`. `testCorpusFile()` truyền `options.importOptions`, không truyền top-level `options.strict` vào importer — `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:1161-1163`.

CLI strict summary chỉ gate failed files, corpus size, average semantic, average roundtrip và production export method — `server/services/pptx-import/pptx-import-corpus-cli.js:57-88`.

Do đó corpus strict pass trong khi direct strict importer fail EMF/native-node trên deck thật.

**Impact:** tên lane dễ tạo false confidence; release gate không chứng minh production strict policy.

### F-07 — P0 evidence contract: scene-graph gap được tính rồi bị drop

**Confirmed — source + fresh probe.**

Reconciliation ghi:

- `mapped.stats.sceneGraphMappedNodes`;
- `mapped.stats.sceneGraphUnmapped`.

Xem `server/services/pptx-import/importer.js:85-96`. Sau đó `buildImportStats()` whitelist fields nhưng không copy hai field này — `server/services/pptx-import/importer.js:14-35`.

Corpus baseline lại cố đọc `result.stats?.sceneGraphUnmapped` — `server/services/pptx-import/pptx-import-corpus-cli.js:20-40`; kết quả thành `null`. Strict summary cũng không gate native scene gaps.

Fresh probe trên `STTre_Duc.pptx`: scene graph có 174 node-gap warning evidence nhưng public stats không có `sceneGraphUnmapped`.

### F-08 — P1: package import có hai compatibility writers

**Confirmed — source + composition probe. Không tái hiện corruption.**

Package commit queue compatibility outbox upsert — `server/services/pptx-import/package-store/import-commit.js:171-182`. Sau package publication, route gọi `createImportedPresentation()` — `server/routes/pptx-import.js:187-199`; function này trực tiếp `presentations.push()` — `server/services/pptx-import/create-imported-presentation.js:46-49`.

Docs nói outbox là sole package-backed writer — `docs/export-fidelity-and-limits.md:119-125`.

Fresh production-composition probe:

- HTTP 202, terminal `done`;
- outbox trước drain: 1;
- compatibility row trước drain: 1;
- drain xử lý 1 record;
- outbox sau drain: 0;
- vẫn chỉ có 1 matching row.

**Kết luận chính xác:** invariant/documentation contradiction và redundant pending replay đã xác nhận; chưa có bằng chứng duplicate row hay data loss.

### F-09 — P0/P1 evidence gap: core edit/export E2E bypass package-backed authority

**Confirmed — source.**

`pptx-import-fidelity.spec.js` đọc imported presentation, copy projection sang legacy test fixture, rồi xóa imported presentation — `tests/e2e/pptx-import-fidelity.spec.js:43-58`.

`critical-pptx-journey.spec.js` làm cùng pattern — `tests/e2e/critical-pptx-journey.spec.js:44-59`.

Visual snapshot E2E cũng copy sang fixture và chỉ chạy khi reviewed-baseline env flag bật — `tests/e2e/pptx-import-visual-fidelity.spec.js:46-56`.

**Impact:** tests chứng minh editor/reconstructed export của copied JSON; không chứng minh package-backed import → edit → save/reload → original/validated export lifecycle.

### F-10 — P1/P2: full warnings transient và chưa bounded

**Confirmed — source.**

Mapper tích lũy full `warnings` array nhưng `_pptxMeta` chỉ lưu selected metadata/unsupported features — `server/services/pptx-import/mapper/map-presentation.js:447-483`. Full warnings chỉ trả trong terminal HTTP job result — `server/routes/pptx-import.js:248-254`; jobs giữ in-memory 10 phút — `server/services/pptx-import-job-manager.js:3-5`.

Không thấy global warning count/serialized-byte ceiling.

**Impact:** người dùng mất report chi tiết sau TTL/restart; pathological package có thể phình job response/memory.

### F-11 — P1: HTTP job authority mất khi server restart

**Confirmed — source.**

Job manager dùng module-level `Map` — `server/services/pptx-import-job-manager.js:3-5`; GET chỉ đọc map và trả 404 nếu không có — `server/routes/pptx-import.js:367-370`. Package store lại có durable import job completion record — `server/services/pptx-import/package-store/import-commit.js:183-193` — nhưng HTTP route không reconcile từ đó.

**Impact:** restart/crash quanh package commit có thể tạo outcome “unknown” cho client dù durable presentation đã publish.

### F-12 — P2: timeout diagnostic hardcode 60 giây

**Confirmed — source.**

Worker cho phép custom `timeoutMs` nhưng message luôn `PPTX parser timed out after 60s` — `server/services/pptx-import/worker-runner.js:66-68`, `server/services/pptx-import/worker-runner.js:111-119`.

## 7. Intentional limitations — không nên gọi là bug

- Best-effort import mặc định non-strict.
- Một concurrent import là resource-safety choice.
- Imported charts preserve-only/read-only khi chưa được level-4 promote.
- Exact original download là recovery, không phải evidence rằng mọi object editable.
- Reconstructed export là lossy path độc lập với original package.
- Validated edited export fail-closed nếu package/evidence không qualified.
- Level 5 / PowerPoint visual compatibility cố ý unavailable.
- Macro, ActiveX, OLE, encryption, signature và unsafe package features có thể đẩy presentation về original-only hoặc unsupported-blocking behavior.

## 8. Security assessment

### Đã có kiểm soát tốt

- ZIP bomb/path/collision checks.
- XML DTD/entity/XInclude rejection.
- File, entry, decompression, parsed JSON, media, heap và time limits.
- Child-process parser isolation.
- No arbitrary remote media fetch path được tìm thấy.
- UUID job IDs; single-user/self-hosted model được ghi rõ tại `server/routes/pptx-import.js:305-310`.

### Unverified risks cần harden

1. **Parser worker inherit toàn bộ parent environment.** `buildParserWorkerEnv()` spread `...baseEnv` — `server/services/pptx-import/worker-runner.js:17-33`. Nếu parser dependency bị exploit, child có thể thấy inherited secrets và vẫn có filesystem/network privileges. Process isolation không phải OS sandbox.
2. **CRC corruption behavior chưa có regression evidence.** Package load dùng `checkCRC32: false` — `server/services/pptx-import/pptx-guards.js:98-107`.
3. **Multi-tenant auth chưa có.** UUIDv4 đủ cho supported single-user model; không đủ nếu nhiều mutually-untrusted tenant.
4. **Malformed media decoder surface.** Magic sniffing giảm mismatch, không sandbox downstream image/vector converters.
5. **Temp residue remediation chưa durable.** Cleanup fail-closed được harden, nhưng residue owner/sweeper và race-proof OS handle containment còn mở theo current project journal.

Không có exploit cụ thể được tái hiện trong audit này; đây là hardening risks, không phải confirmed compromise.

## 9. Performance và scalability

### Hiện có

- Single concurrent import tránh memory amplification.
- Parser heap/time budget.
- Aggregate decompression/media budgets.
- Representative small-deck import ở mức khoảng 2–4 giây.

### Chưa chứng minh

- 10/50/100 MiB compressed packages.
- 50/500/5,000 entries.
- Near-500 MiB decompressed/media packages.
- Many-slide decks với hàng nghìn native nodes.
- Deadline headroom khi parser, host revalidation, OOXML scene graph, OPC inventory và package commit đều đọc package.
- Electron/Docker/supported-platform parity.

Không nên tối ưu bằng cách bỏ revalidation. Nếu giảm repeated archive passes, chỉ reuse inventory đã hash-bind với exact source blob và vẫn giữ safety invariants.

## 10. UX assessment

### Tốt

- Progress stages có upload, parse, mapping, package commit, presentation creation.
- SSE có polling fallback.
- Busy state có retry message.
- Import xong mở thẳng presentation.
- Warning summary phân nhóm approximation/placeholder/failure.
- Export surfaces phân biệt original, reconstructed và validated edited.

### Cần cải thiện

- Cancel phải bao phủ upload, busy sleep, SSE và polling bằng cùng một AbortController.
- Poll-only mode phải register job identity ngay khi nhận `jobId`.
- Honor `Retry-After`; hiển thị countdown hoặc next retry time.
- Server nên trả deadline/expiry metadata để client dùng slack hợp lý.
- Persist bounded import report per presentation; cho xem lại warning details sau reload.
- Summary nên nói rõ “preserved/read-only”, “approximated”, “placeholder”, “failed”, không gom mơ hồ.

## 11. Roadmap đề xuất

### P0 — trước khi claim production/release fidelity

1. **Sửa route limiter.**
   - Limit chỉ `POST /api/pptx/import`.
   - Không dùng upload quota cho GET/SSE/DELETE.
   - Thêm production-mode test: long poll/SSE/cancel vẫn hoạt động sau hơn 30 status events.

2. **Honor server retry contract.**
   - Dùng `Retry-After` với sane clamp.
   - Abort được retry sleep.
   - Test đúng delay contract, không chỉ test “có retry”.

3. **Sửa parser truthfulness.**
   - README: đổi thành `pptxtojson + pptx2json package inspection`, hoặc bỏ nhắc `pptx2json`.
   - Rename/remove `fallbackParserUsed` và unreachable success warning.
   - Chỉ gọi “fallback parser” khi parser thứ hai thực sự tạo normalized import projection.

4. **Tách hai nghĩa strict.**
   - `strict metric corpus`: parser-relative semantic/roundtrip regression.
   - `strict importer qualification`: EMF/chart/SmartArt/native-node/placeholder gates.
   - Không dùng một nhãn `strict` cho cả hai.

5. **Propagate native evidence.**
   - Copy `sceneGraphMappedNodes` và `sceneGraphUnmapped` vào public stats.
   - Baseline phải reject missing/non-finite scene metrics thay vì ghi `null`.
   - Gate chart/SmartArt/native gaps cho qualification lane.

6. **Thêm package-backed critical E2E.**
   - Import vào ID thật.
   - Edit supported primitive.
   - Save với generation fence.
   - Reload và verify projection.
   - Download exact original, verify hash không đổi.
   - Request validated edited export; verify đúng success/fail-closed outcome.
   - Không copy sang legacy fixture.

7. **Không claim visual fidelity trước oracle thật.**
   - Replace placeholder goldens bằng PowerPoint hoặc accepted LibreOffice renders.
   - Record renderer/version/platform/font manifest.
   - Compare mọi slide, không chỉ initial editor canvas.

### P1 — reliability và lifecycle

1. Một AbortController xuyên suốt upload → busy sleep → SSE/poll → cancel.
2. Emit/store `{ jobId }` trước khi chọn EventSource hay polling.
3. Server trả deadline/terminal TTL; client wait có slack lớn hơn server deadline.
4. Persist bounded import report per presentation: summary counts + capped diagnostics + omitted count.
5. Chọn một compatibility writer. Khuyến nghị package outbox là writer duy nhất; route drain/ack rõ ràng trước API visibility nếu cần read-after-write.
6. Reconcile HTTP job GET từ durable package job/head sau restart.
7. Thêm crash-point tests quanh package publish, compatibility visibility, media commit và terminal completion.
8. Allowlist parser worker environment; bỏ inherited secrets không cần thiết.

### P2 — security, performance, corpus breadth

1. Benchmark matrix 1/10/50/100 MiB và 50/500/5,000 entries; ghi p50/p95, peak RSS, timeout stage.
2. Chỉ hợp nhất archive passes bằng verified, hash-bound inventory reuse.
3. Global warning count/byte budget; append omitted-count summary.
4. CRC-corruption regression tests và documented acceptance policy.
5. Corpus bổ sung:
   - real SmartArt;
   - EMF/WMF;
   - macro/OLE/ActiveX/signature/encryption;
   - external relationships;
   - nested packages;
   - comments/notes/inheritance;
   - animations/transitions;
   - missing fonts;
   - multilingual/RTL/CJK;
   - malformed ZIP/XML/media.
6. Timeout message dùng actual `timeoutMs`.
7. Đánh giá OS/container sandbox và network deny cho parser/converters.
8. Production-style restart/interleaving suite cho package store/outbox/jobs.

### P3 — capability growth

1. Qualify level-4 feature rows từng loại, không promote theo nhóm mơ hồ.
2. Chart/complex-object editing chỉ mở khi adapter, transaction, native re-import và Office evidence đều pass.
3. Hoàn thiện OfficeCLI receipt, strict native re-import, PowerPoint oracle, Electron/Docker và supported-platform qualification.
4. Chỉ xây true secondary parser nếu measurable corpus gain bù được normalization/source-map/maintenance cost.
5. Nếu hỗ trợ multi-tenant: bind job với owner/per-job secret; authorize GET/SSE/DELETE.

## 12. Claim language khuyến nghị

### Có thể nói ngay

> Best-effort PPTX import creates an editable NavSlides projection and preserves the exact original file for recovery. Complex PowerPoint features may be preserved, approximated, read-only, or represented by placeholders.

Có thể bổ sung:

> Current browser structural checks pass the audited five-deck, 227-slide corpus.

Phải giữ caveat: đây là browser heuristic, không phải PowerPoint-rendered visual parity.

### Chưa được nói

- “100% compatible with PowerPoint.”
- “Pixel-perfect/1:1 import.”
- “All PPTX content remains editable.”
- “pptx2json fallback parser.”
- “Strict corpus proves strict native import.”
- “Roundtrip preserves PowerPoint semantics/visuals.”

## 13. Acceptance gates để gọi feature release-ready

Tối thiểu:

- [ ] Production limiter không chặn GET/SSE/DELETE.
- [ ] Retry/cancel/deadline client-server contract pass integration tests.
- [ ] Parser/fallback docs và telemetry phản ánh đúng implementation.
- [ ] Strict metric lane và strict importer lane tách rõ.
- [ ] Scene/native gap metrics có mặt, finite, và được gate.
- [ ] Package-backed edit/save/reload/original/validated-export E2E pass.
- [ ] Compatibility projection có một writer/invariant nhất quán.
- [ ] Restart after package commit trả recoverable terminal outcome.
- [ ] Reviewed visual goldens cho target renderer; all-slide comparison có numeric thresholds.
- [ ] Fresh composite claim bundle pass ở claim level thực sự muốn công bố.
- [ ] Supported platforms và near-limit performance có evidence.

## 14. Ưu tiên quyết định

Nếu mục tiêu release gần là **self-hosted best-effort import**, làm P0.1–P0.6 và P1 reliability trước; không cần chờ level 4/5.

Nếu mục tiêu là **PowerPoint 1:1**, đây không còn là bugfix nhỏ. Cần chương trình qualification riêng: native feature matrix, Office renderer evidence, font/platform control, per-slide oracle, native re-import, package diff policy và edited-package release gates.

## 15. Câu hỏi chưa giải quyết

1. Product claim mục tiêu là “best-effort import” hay “PowerPoint 1:1”? Hai mục tiêu có chi phí và release gates rất khác.
2. Visual authority bắt buộc là Microsoft PowerPoint desktop, PowerPoint web, LibreOffice, hay một matrix nhiều renderer?
3. Target deployment vẫn chỉ single-user/self-hosted, hay sẽ có mutually-untrusted users/tenants?
4. Validated edited-package export có phải release requirement gần nhất, hay exact original recovery + reconstructed export đã đủ cho milestone hiện tại?
5. Deck nào là business-critical corpus và threshold nào được chấp nhận cho warning, placeholder, native-node gap và visual drift?

---
title: "Phase 07 — Publication, projection và template PPTX"
status: pending
priority: P1
dependencies: [phase-01]
effort: "4–6 ngày, chốt lại sau rescout"
---

# Phase 07 — Publication, projection và template

## 1. Phạm vi và bằng chứng hiện tại

Đây là PLAN, không phải báo cáo đã sửa lỗi. Chỉ triển khai sau receipt phase 01. Mục tiêu: một publication có authority, projection, ownership và trạng thái nhìn thấy nhất quán; không mở rộng tập native-edit được hỗ trợ. Không thay đổi renderer, CI hay bảo đảm Office fidelity.

Đã đọc `CLAUDE.md`, `docs/export-fidelity-and-limits.md`, services/routes/tests bên dưới. Có drift quan trọng: tài liệu limits còn nói save-as-template nhận pending, nhưng `server/routes/presentations-extras.js` hiện **đã** chặn `pendingJournalHash` bằng `PACKAGE_PENDING_PROJECTION`, retain theo expected head và rollback khi JSON không publish. Không coi guard này là thiếu. `presentations.js` chỉ còn mount ba router; owner thực là `presentations-crud.js`, `presentations-pptx.js`, `presentations-extras.js`.

Các bảo vệ phải giữ:
- Shared reader lấy projection + generation từ một state snapshot, kiểm tra original/current ownership và hash pointers; bulk có quarantine theo policy. Original-only có điều kiện rõ, không phải fallback tùy ý.
- Outbox có snapshot acknowledgement theo ID, generation filtering ở view; runtime serialize drain, cô lập poisoned record vào dead-letter. Import visibility contract B đã tồn tại; không thêm direct `presentations.push` vào package import.
- Template PUT chỉ cho title/description khi package-backed; instantiate retained head đã chặn pending, kiểm tra projection, retained head và destination trong mutation.
- Original download dùng immutable original revision, kể cả R0 còn nhưng successor mất. Không dùng editable reader làm điều kiện bắt buộc cho recovery này.
- `templates.test.js` có CRUD, immutable projection, release unavailable và write failure. `compatibility-outbox.test.js` dùng store/temp FS thật nhưng apply callback của một số case là giả; không chứng minh crash giữa JSON write và ack.

Rủi ro cần kiểm chứng: publication receipt và ack có đủ mạnh xuyên route/store/JSON; mất tiến trình giữa retain và template JSON; template delete đã xóa JSON nhưng release thất bại; cleanup khi hai operation tranh destination. Đây là giả thuyết/qualification gap, không gộp thành defect đã tái hiện.

## 2. Rescout bắt buộc trước thực thi

- [ ] Đọc lại CLAUDE, limits mục package contract, git diff của toàn bộ owner; ghi commit SHA và drift so với baseline này.
- [ ] Đọc cả `package-store/import-commit.js`, `package-store/lifecycle.js`, `package-store-runtime.js`, import job terminal và template instantiate trong CRUD; trace lock order đến `storage.js`.
- [ ] Lập bảng existing assertions ↔ S07; giữ case đã xanh làm regression, chỉ gọi RED khi assertion thực sự thất bại do invariant, không do fixture.
- [ ] Chốt publication point, owner operation identity và status API trước khi sửa; bất kỳ schema/API mới dưới đây đều là **đề xuất**, chưa tồn tại.

## 3. Inventory chính xác dự kiến

LOC là delta thô, không phải quota. File code mới <200 LOC theo CLAUDE; file cũ quá lớn chỉ sửa vùng owner hoặc tách helper đúng scope. Không tạo tất cả file nếu rescout cho thấy có seam phù hợp.

| Path | Hiện trạng / action khi thực thi | Delta LOC | Test impact |
|---|---|---:|---|
| `server/routes/presentations-extras.js` | có; giữ pending guard, fence retain→publish/compensation | 20–50 | S07-02,05,06 |
| `server/routes/presentations-crud.js` | có; template instantiate receipt/visibility | 20–50 | S07-03,09 |
| `server/routes/templates.js` | có; deletion/retry ownership fence | 25–60 | S07-07,08 |
| `server/services/package-lifecycle-integration.js` | có; truyền expected head + identity nếu cần | 15–35 | rollback route↔store |
| `server/services/package-backed-presentation-read.js` | có; regression, chỉ sửa nếu RED | 0–25 | S07-01,04,12 |
| `server/services/pptx-import/package-store/lifecycle.js` | có; publication/retained guard tối thiểu | 20–60 | S07-03,09 |
| `server/services/pptx-import/compatibility-outbox.js` | có; ack contract, phối hợp phase 08 | 0–30 | S07-10,11 |
| `server/services/pptx-import/package-store-runtime.js` | có; visibility/dead-letter classification nếu RED | 15–40 | S07-10,11 |
| `server/services/pptx-import/publication-receipt.js` | **mới đề xuất**; receipt identity, không thêm authority thứ hai | 80–140 | unit equality/fencing |
| `server/routes/templates.test.js` | có; mở rộng lỗi sau publication | 60–120 | S07-07,08 |
| `server/services/pptx-import/compatibility-outbox.test.js` | có; giữ snapshot/generation regression | 40–80 | S07-10,11 |
| `server/services/package-backed-presentation-read.test.js` | có; regression reader/original-only | 30–70 | S07-01,04 |
| `server/routes/package-template-publication.test.js` | **mới đề xuất**; cross-layer temp FS | 140–190 | S07-02,03,05,06,09,12 |
| `server/services/pptx-import/publication-crash.test.js` | **mới đề xuất**; parent crash suite | 100–170 | S07-13,14 |
| `server/services/pptx-import/test-support/publication-child.cjs` | **mới đề xuất**; IPC barrier, isolated root | 80–140 | crash process thật |

Các path read-only cần regression: `server/services/pptx-import/package-revision-resolver.js`, `server/services/pptx-import/package-store/dto.js`, `server/services/pptx-import/package-store/state-migrations.js`, `server/services/pptx-import/package-store/schemas.js`, `server/services/storage.js`. Không sửa schema trong phase này trừ ADR riêng được duyệt; durable remediation thuộc phase 09.

## 4. Invariant, transition và crash windows

1. Authority head là nguồn quyết định package generation. JSON/editor DTO không tạo quyền từ field do client gửi; generation của DTO phải cùng snapshot với projection.
2. `prepared → retained/committed → compatibility-pending → visible → acknowledged`; đây là mô hình contract **đề xuất** để phân tích, không khẳng định có persisted enum hiện tại. HTTP/job openable chỉ khi presentation row tương ứng receipt đã tồn tại và authority đọc được. Poisoned/dead-letter không tương đương visible.
3. Template create: `source-read(H) → retain(owner,H) → JSON publish → response`. Trước JSON commit có thể bù retain của chính operation; sau JSON commit lỗi response không được xóa template thành công. Nếu không xác định commit đã xảy ra, read/reconcile receipt trước cleanup.
4. Template delete: `read identity → remove JSON → release matching retained owner`; release failure phải retry/reconcile rõ, không báo thành công giả và không release owner mới thay thế. Không biến mọi delete thành physical blob removal.
5. Instantiate: source/retained fence và destination-absent check ở commit; response dùng rebound projection/source-map. Loser không được delete/quarantine winner chỉ vì trùng destination ID.
6. Immutable R0: SHA-256 **và byte equality** trước/sau create/delete/instantiate/retry. Không regenerate ZIP để làm “original”; preserve-only vẫn preserve-only.

| Cửa sổ | Hậu quả cần test | Hành động cho phép |
|---|---|---|
| Sau retain, trước template JSON | retained owner không có row | reconcile chỉ owner identity của operation; phase 09 bổ sung durable intent |
| JSON đã ghi, trước response | client không biết thành công | retry đọc receipt/row; không bù success |
| Package/outbox đã commit, trước apply | head có, row chưa có | pending-visibility, drain idempotent |
| Sau apply, trước ack | row đã có, outbox còn | replay không đổi generation/metadata; ack đúng snapshot |
| JSON delete xong, release chưa xong | ownership còn, template không hiện | cleanup pending/retry; không delete bytes |

## 5. Deep TDD

### 5.1 Tests Before — RED

1. Capture baseline assertions và fixture hash; chạy focused commands ở mục 7 **khi thực thi**, không trong lượt viết PLAN.
2. Thêm S07-01…14; gắn barrier tại retain-return, JSON-persisted và before-ack. Không dùng sleep để tạo interleaving.
3. Tách characterization đang được bảo vệ (pending/template immutable) với regression RED mới. Nếu case không RED, giữ test và bỏ patch suy đoán.
4. Cross-layer dùng Express/Supertest → runtime initialized giống production → store và `presentations.json`/`templates.json` trên temp root thật; không chỉ dùng `NODE_ENV=test` fallback reopen store.
5. Mocks chỉ inject ENOSPC/EPERM/serialization failure hoặc validator output. Child IPC báo “đã persist” rồi parent kill không chạy finally; reopen bằng tiến trình khác. Promise rejection không phải crash evidence.

### 5.2 GREEN

6. Chọn helper receipt **đề xuất** `{operationId, destinationId, expectedHeadHash, committedHeadHash, projectionWriteId}`; không dùng destination ID đơn độc làm bằng chứng cleanup ownership. Tận dụng mutation result/outbox hiện có trước khi thêm persisted field.
7. Giữ sole writer ở import, unify visibility check theo receipt; pending không có `presentationId` mở được. Phân biệt poison với lỗi I/O transient trước khi quyết định ack/dead-letter.
8. Fence template retention/publication/delete theo identity; lỗi response sau durable commit không rollback. Compensation uncertain trả failure/reconcile, bàn giao durable owner phase 09.
9. Không kéo validator availability vào original recovery; không promote native capability khi copy/template.

### 5.3 Refactor

10. Tách equality/fence helper thuần; không dựng global transaction lock bao trùm JSON và package writer. Giữ lock order test hiện có; không gọi package lifecycle từ trong `withPresentations`/`withTemplates` callback nếu tạo vòng chờ.
11. Loại bool “attempted ⇒ tôi sở hữu destination” khỏi quyết định xóa; chỉ receipt xác nhận commit mới là bằng chứng.

### 5.4 Tests After

12. Replay mỗi failpoint hai lần + reopen store; đối chiếu heads/owners/outbox/dead-letter/JSON và R0 hash. Kiểm tra pending→visible chỉ một lần, không tăng generation do ack.
13. Chạy matrix và qualification; ghi rõ skipped/platform limitations, không đổi docs fidelity thành claim native editing.

## 6. Matrix (ID duy nhất, oracle cụ thể)

`U` = unit; `I` = integration temp FS thật; `C` = child-process crash. Mọi case I/C phải giữ hash R0 và sibling sentinel.

| ID | Layer / risk | Setup hoặc interleaving | Oracle bắt buộc |
|---|---|---|---|
| S07-01 | I / authority drift | stale JSON g1, committed projection g2 | GET projection g2 + DTO generation 2; không trả slide g1 |
| S07-02 | I / pending template | source pending journal; gọi save-as-template | 409 `PACKAGE_PENDING_PROJECTION`; 0 template row/owner mới |
| S07-03 | I / instantiate drift | retained committed template; sửa title hợp lệ rồi instantiate | destination id/source-map generation cùng head; nội dung canonical không đổi |
| S07-04 | U+I / forged authority | PUT authority fields hoặc head pointer mismatch | field client không thành authority; mismatch fail-closed, không stale fallback |
| S07-05 | I / create compensation | retain thành công; inject templates write failure | không row; chỉ owner mới được release; source/R0 nguyên vẹn |
| S07-06 | I / response failure | JSON template persisted; throw response serialization | row và retained owner vẫn tồn tại, reopen instantiate được |
| S07-07 | I / delete I/O | fail JSON removal before persist | row + owner giữ nguyên; không release trước kết quả durable |
| S07-08 | I / delete release | JSON removed; release fail hai lần rồi retry | retry cleanup đúng owner, không xóa template owner thay thế; lỗi 503 rõ |
| S07-09 | I / destination loser | pause instantiate A; B publish cùng destination; A resume/fail | đúng một head/row của B, owner/bytes B còn; A không quarantine B |
| S07-10 | I / visibility | pause outbox apply sau package commit | job không openable; apply xong mới visible; metadata report không mất |
| S07-11 | I / ack failure | apply JSON xong; ack throw; drain lại | 1 row, generation không tăng, ack chỉ applied IDs; poison còn evidence |
| S07-12 | I / recovery separation | R0 intact, successor blob mất | original endpoint trả byte-for-byte R0; editable read bị từ chối |
| S07-13 | C / orphan retain | kill child tại retain durable trước JSON | reopen không có phantom visible template; retained artifact inventory xác định được, không delete vô chủ |
| S07-14 | C / apply-before-ack | kill child sau JSON durable, trước ack | startup drain hội tụ đúng 1 row; original bytes và head hash không đổi |

## 7. Lệnh dự kiến — chỉ kiểm tra path/script, KHÔNG chạy trong lượt lập PLAN

Các test path hiện hữu bên dưới và scripts `test`, `test:pptx:importer-qualification`, `test:pptx:adversarial` đã đối chiếu repository/package.json. Paths mới ở inventory chỉ chạy sau khi tạo.

```bash
npm test -- server/routes/templates.test.js server/services/package-backed-presentation-read.test.js server/services/pptx-import/compatibility-outbox.test.js server/services/pptx-import/package-store/lifecycle.test.js
npm test -- server/routes/presentations.test.js server/routes/presentations-duplicate-race.test.js server/services/pptx-import/package-store/legacy-state-migration.test.js
# Sau khi tạo tests đề xuất:
npm test -- server/routes/package-template-publication.test.js server/services/pptx-import/publication-crash.test.js
# Qualification rộng, không thay thế S07:
npm run test:pptx:importer-qualification
npm run test:pptx:adversarial
```

Qualification script thực là `scripts/run-pptx-qualification.cjs`, dùng corpus manifest `server/data/test-corpus/importer-qualification-manifest.json` và ghi evidence vào `tests/fixtures/pptx-corpus/pptx-qualification-evidence.json`; kiểm tra fixture/toolchain tồn tại khi rescout, chạy trên sandbox, không ghi evidence giả nếu thiếu. Qualification phần mềm không chứng minh Office parity.

## 8. Migration, rollback và exit receipts

Schema hiện hành record=1, root/state/head=2; loader có v1 migration. Không tăng version chỉ để thêm test. Nếu receipt cần persist, đề xuất migration phải test v1 pre-authority, v1 authority, v2, unknown-version reject; không tự cấp thêm quyền cho legacy. Rollback code chỉ khi state mới còn được reader cũ hiểu; nếu không, dừng writer và restore snapshot root + JSON nhất quán, giữ blob immutable, không downgrade generation tại chỗ.

- [ ] Rescout receipt: SHA, scope/diff, existing safeguards và drift limits đã ghi.
- [ ] RED receipt: ID, command, expected/actual assertion, không ghi “RED” cho lỗi môi trường.
- [ ] GREEN receipt: logs đầy đủ, counts pass/fail/skip, OS/Node, temp root và fixture digest.
- [ ] Publication receipt audit: mỗi cửa sổ có head/owner/outbox/JSON trước-sau; loser sentinel nguyên vẹn.
- [ ] Crash receipt: child PID, IPC failpoint, termination mode, reopened state, giới hạn không mô phỏng power-loss.
- [ ] Original SHA/byte comparison và migration/rollback rehearsal được lưu ở execution evidence sau này.
- [ ] Bàn giao phase 08 các race chưa phủ; phase 09 các compensation cần durable remediation. Exit không yêu cầu tuyên bố mọi gap đã đóng; unresolved blocker phải giữ pending.

**Trạng thái bằng chứng hiện tại: chưa chạy test/qualification; chưa có exit receipt.**
